-- Update an existing balance snapshot in place (keeps recorded_at)
create or replace function public.update_balance_snapshot(
  p_snapshot_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total numeric(15, 2) := 0;
  v_entry jsonb;
  v_asset_count integer;
  v_entry_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.balance_snapshots
    where id = p_snapshot_id
      and user_id = v_user_id
  ) then
    raise exception 'Snapshot not found';
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

  update public.balance_snapshots
  set total_worth = v_total
  where id = p_snapshot_id;

  delete from public.balance_snapshot_entries
  where snapshot_id = p_snapshot_id;

  insert into public.balance_snapshot_entries (snapshot_id, asset_id, balance)
  select
    p_snapshot_id,
    (entry->>'asset_id')::uuid,
    (entry->>'balance')::numeric
  from jsonb_array_elements(p_entries) as entry;
end;
$$;

grant execute on function public.update_balance_snapshot(uuid, jsonb) to authenticated;
