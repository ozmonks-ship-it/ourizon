-- Store computed saving amount on each monthly log
alter table public.monthly_logs
  add column if not exists saving_amount numeric(15, 2) not null default 0
  check (saving_amount >= 0);

create or replace function public.save_monthly_log(
  p_year integer,
  p_month integer,
  p_net_income numeric,
  p_saving_amount numeric,
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

  if p_saving_amount < 0 then
    raise exception 'Saving amount cannot be negative';
  end if;

  insert into public.monthly_logs (user_id, year, month, net_income, saving_amount)
  values (v_budget_user_id, p_year, p_month, p_net_income, p_saving_amount)
  on conflict (user_id, year, month)
  do update set
    net_income = excluded.net_income,
    saving_amount = excluded.saving_amount,
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

grant execute on function public.save_monthly_log(integer, integer, numeric, numeric, jsonb) to authenticated;
