-- Asset definitions owned by each user
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  institution text not null default 'Self-managed',
  group_id text not null check (group_id in ('cash', 'stocks', 'crypto', 'property', 'super')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index assets_user_id_idx on public.assets (user_id);

-- Point-in-time net worth snapshots
create table public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  total_worth numeric(15, 2) not null check (total_worth >= 0),
  created_at timestamptz not null default now()
);

create index balance_snapshots_user_recorded_idx
  on public.balance_snapshots (user_id, recorded_at);

-- Per-asset balances captured in a snapshot
create table public.balance_snapshot_entries (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.balance_snapshots (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  balance numeric(15, 2) not null check (balance >= 0),
  unique (snapshot_id, asset_id)
);

create index balance_snapshot_entries_asset_id_idx
  on public.balance_snapshot_entries (asset_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

-- Atomically save all balances as a new snapshot
create or replace function public.save_balance_snapshot(p_entries jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot_id uuid;
  v_total numeric(15, 2) := 0;
  v_entry jsonb;
  v_asset_count integer;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_entry_count := jsonb_array_length(p_entries);

  if v_entry_count is null or v_entry_count = 0 then
    raise exception 'At least one balance entry is required';
  end if;

  select count(*)
  into v_asset_count
  from public.assets
  where user_id = v_user_id;

  if v_entry_count <> v_asset_count then
    raise exception 'Balance entries must cover every asset';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if not exists (
      select 1
      from public.assets
      where id = (v_entry->>'asset_id')::uuid
        and user_id = v_user_id
    ) then
      raise exception 'Invalid asset';
    end if;

    if (v_entry->>'balance')::numeric < 0 then
      raise exception 'Balance cannot be negative';
    end if;
  end loop;

  select coalesce(sum((entry->>'balance')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_entries) as entry;

  insert into public.balance_snapshots (user_id, total_worth)
  values (v_user_id, v_total)
  returning id into v_snapshot_id;

  insert into public.balance_snapshot_entries (snapshot_id, asset_id, balance)
  select
    v_snapshot_id,
    (entry->>'asset_id')::uuid,
    (entry->>'balance')::numeric
  from jsonb_array_elements(p_entries) as entry;

  return v_snapshot_id;
end;
$$;

alter table public.assets enable row level security;
alter table public.balance_snapshots enable row level security;
alter table public.balance_snapshot_entries enable row level security;

create policy "Users manage own assets"
  on public.assets
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own balance snapshots"
  on public.balance_snapshots
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own snapshot entries"
  on public.balance_snapshot_entries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.balance_snapshots snapshot
      where snapshot.id = balance_snapshot_entries.snapshot_id
        and snapshot.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.balance_snapshots snapshot
      where snapshot.id = balance_snapshot_entries.snapshot_id
        and snapshot.user_id = auth.uid()
    )
  );

grant execute on function public.save_balance_snapshot(jsonb) to authenticated;
