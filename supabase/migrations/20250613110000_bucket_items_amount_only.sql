-- Items (nested under a parent expense bucket) must use fixed amounts only.

update public.buckets
set allocation_mode = 'amount'
where parent_bucket_id is not null
  and allocation_mode = 'percent';

create or replace function public.enforce_bucket_parent_rules()
returns trigger
language plpgsql
as $$
declare
  v_parent public.buckets%rowtype;
begin
  if new.parent_bucket_id is null then
    return new;
  end if;

  if new.kind <> 'expense' then
    raise exception 'Only expense buckets can have a parent bucket';
  end if;

  if new.allocation_mode <> 'amount' then
    raise exception 'Items must use fixed amount allocation';
  end if;

  select * into v_parent
  from public.buckets
  where id = new.parent_bucket_id;

  if not found then
    raise exception 'Parent bucket not found';
  end if;

  if v_parent.user_id <> new.user_id then
    raise exception 'Parent bucket must belong to the same budget owner';
  end if;

  if v_parent.kind <> 'expense' then
    raise exception 'Parent bucket must be an expense bucket';
  end if;

  if v_parent.parent_bucket_id is not null then
    raise exception 'Items cannot be nested further than one level';
  end if;

  return new;
end;
$$;
