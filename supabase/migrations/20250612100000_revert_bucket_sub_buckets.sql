-- Revert 20250611100000_bucket_sub_buckets.sql

-- Sub-buckets depend on parent_bucket_id; remove them before dropping the column.
delete from public.buckets where parent_bucket_id is not null;

drop trigger if exists buckets_enforce_parent_rules on public.buckets;
drop function if exists public.enforce_bucket_parent_rules();

drop index if exists public.buckets_parent_bucket_id_idx;

alter table public.buckets drop column if exists parent_bucket_id;
