-- Bucket definitions (income or expense, amount or percent allocation)
create table public.buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  allocation_mode text not null check (allocation_mode in ('amount', 'percent')),
  default_value numeric(15, 2) not null default 0 check (default_value >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index buckets_user_id_idx on public.buckets (user_id, sort_order);

-- One log per calendar month per budget owner
create table public.monthly_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  net_income numeric(15, 2) not null default 0 check (net_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create index monthly_logs_user_period_idx on public.monthly_logs (user_id, year, month);

-- Per-bucket values captured in a monthly log
create table public.monthly_log_entries (
  id uuid primary key default gen_random_uuid(),
  monthly_log_id uuid not null references public.monthly_logs (id) on delete cascade,
  bucket_id uuid not null references public.buckets (id) on delete cascade,
  input_value numeric(15, 2) not null default 0 check (input_value >= 0),
  resolved_amount numeric(15, 2) not null default 0 check (resolved_amount >= 0),
  unique (monthly_log_id, bucket_id)
);

create index monthly_log_entries_bucket_id_idx on public.monthly_log_entries (bucket_id);

create trigger buckets_set_updated_at
before update on public.buckets
for each row
execute function public.set_updated_at();

create trigger monthly_logs_set_updated_at
before update on public.monthly_logs
for each row
execute function public.set_updated_at();

-- Seed default expense buckets for a budget owner (idempotent)
create or replace function public.seed_default_buckets()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_user_id uuid := public.resolve_budget_user_id();
begin
  if v_budget_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_budget(v_budget_user_id) then
    raise exception 'Access denied';
  end if;

  if exists (select 1 from public.buckets where user_id = v_budget_user_id) then
    return;
  end if;

  insert into public.buckets (user_id, name, kind, allocation_mode, default_value, sort_order)
  values
    (v_budget_user_id, 'Daily Expenses 🛒', 'expense', 'percent', 60, 1),
    (v_budget_user_id, 'Splurge 🛍️', 'expense', 'percent', 10, 2),
    (v_budget_user_id, 'Smile 🌴', 'expense', 'percent', 10, 3),
    (v_budget_user_id, 'Fire Ext. 🔥', 'expense', 'percent', 10, 4),
    (v_budget_user_id, 'Mojo 🚀', 'expense', 'percent', 5, 5),
    (v_budget_user_id, 'Grow 🌱', 'expense', 'percent', 5, 6);
end;
$$;

-- Atomically save a monthly log with resolved bucket amounts
create or replace function public.save_monthly_log(
  p_year integer,
  p_month integer,
  p_net_income numeric,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_user_id uuid := public.resolve_budget_user_id();
  v_log_id uuid;
  v_entry jsonb;
begin
  if v_budget_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_budget(v_budget_user_id) then
    raise exception 'Access denied';
  end if;

  if p_net_income < 0 then
    raise exception 'Net income cannot be negative';
  end if;

  insert into public.monthly_logs (user_id, year, month, net_income)
  values (v_budget_user_id, p_year, p_month, p_net_income)
  on conflict (user_id, year, month)
  do update set
    net_income = excluded.net_income,
    updated_at = now()
  returning id into v_log_id;

  delete from public.monthly_log_entries where monthly_log_id = v_log_id;

  for v_entry in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    if not exists (
      select 1
      from public.buckets
      where id = (v_entry->>'bucket_id')::uuid
        and user_id = v_budget_user_id
    ) then
      raise exception 'Invalid bucket';
    end if;

    insert into public.monthly_log_entries (monthly_log_id, bucket_id, input_value, resolved_amount)
    values (
      v_log_id,
      (v_entry->>'bucket_id')::uuid,
      coalesce((v_entry->>'input_value')::numeric, 0),
      coalesce((v_entry->>'resolved_amount')::numeric, 0)
    );
  end loop;

  return v_log_id;
end;
$$;

alter table public.buckets enable row level security;
alter table public.monthly_logs enable row level security;
alter table public.monthly_log_entries enable row level security;

create policy "Budget members manage buckets"
  on public.buckets
  for all
  to authenticated
  using (public.can_access_budget(user_id))
  with check (public.can_access_budget(user_id));

create policy "Budget members manage monthly logs"
  on public.monthly_logs
  for all
  to authenticated
  using (public.can_access_budget(user_id))
  with check (public.can_access_budget(user_id));

create policy "Budget members manage monthly log entries"
  on public.monthly_log_entries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.monthly_logs log
      where log.id = monthly_log_entries.monthly_log_id
        and public.can_access_budget(log.user_id)
    )
  )
  with check (
    exists (
      select 1
      from public.monthly_logs log
      where log.id = monthly_log_entries.monthly_log_id
        and public.can_access_budget(log.user_id)
    )
  );

grant execute on function public.seed_default_buckets() to authenticated;
grant execute on function public.save_monthly_log(integer, integer, numeric, jsonb) to authenticated;
