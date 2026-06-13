-- Sub-buckets: expense buckets nested under a parent expense bucket.
-- Sub-buckets use the same amount / percent allocation modes as top-level buckets.

alter table public.buckets
  add column parent_bucket_id uuid references public.buckets (id) on delete cascade;

create index buckets_parent_bucket_id_idx on public.buckets (parent_bucket_id);

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
    raise exception 'Sub-buckets cannot be nested further than one level';
  end if;

  return new;
end;
$$;

create trigger buckets_enforce_parent_rules
before insert or update on public.buckets
for each row
execute function public.enforce_bucket_parent_rules();
