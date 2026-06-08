-- User profiles (Google avatar, display name)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (lower(email));

-- Budget sharing: owner invites collaborators by email
create table public.budget_collaborators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  collaborator_id uuid references auth.users (id) on delete cascade,
  email text not null,
  invited_at timestamptz not null default now(),
  unique (owner_id, email)
);

create index budget_collaborators_owner_idx on public.budget_collaborators (owner_id);
create index budget_collaborators_collaborator_idx on public.budget_collaborators (collaborator_id);
create index budget_collaborators_email_idx on public.budget_collaborators (lower(email));

-- Sync profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Resolve the budget owner for the current user (self or shared budget)
create or replace function public.resolve_budget_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select bc.owner_id
      from public.budget_collaborators bc
      where bc.collaborator_id = auth.uid()
      limit 1
    ),
    auth.uid()
  );
$$;

-- True when the current user may read/write a budget owned by p_budget_user_id
create or replace function public.can_access_budget(p_budget_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_budget_user_id = auth.uid()
    or exists (
      select 1
      from public.budget_collaborators bc
      where bc.owner_id = p_budget_user_id
        and bc.collaborator_id = auth.uid()
    );
$$;

-- Upsert profile from auth metadata (call on each login)
create or replace function public.upsert_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where id = auth.uid();

  if v_user.id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    v_user.id,
    coalesce(v_user.email, ''),
    coalesce(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name'),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
end;
$$;

-- Link pending invites when invitee logs in with matching email
create or replace function public.link_pending_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();

  if v_email is null then
    return;
  end if;

  update public.budget_collaborators
  set collaborator_id = auth.uid()
  where lower(email) = v_email
    and collaborator_id is null;
end;
$$;

-- Owner invites a collaborator by email (no email is sent)
create or replace function public.invite_budget_collaborator(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_invite_id uuid;
  v_existing_user_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email address';
  end if;

  if exists (
    select 1 from auth.users
    where id = v_owner_id and lower(email) = v_email
  ) then
    raise exception 'You cannot invite yourself';
  end if;

  select id into v_existing_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  insert into public.budget_collaborators (owner_id, email, collaborator_id)
  values (v_owner_id, v_email, v_existing_user_id)
  on conflict (owner_id, email) do update set
    collaborator_id = coalesce(budget_collaborators.collaborator_id, excluded.collaborator_id)
  returning id into v_invite_id;

  return v_invite_id;
end;
$$;

-- Owner removes a collaborator or cancels a pending invite
create or replace function public.remove_budget_collaborator(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.budget_collaborators
  where id = p_invite_id
    and owner_id = auth.uid();
end;
$$;

-- Update snapshot RPCs to use shared budget owner
create or replace function public.save_balance_snapshot(p_entries jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_user_id uuid := public.resolve_budget_user_id();
  v_snapshot_id uuid;
  v_total numeric(15, 2) := 0;
  v_entry jsonb;
  v_asset_count integer;
  v_entry_count integer;
begin
  if v_budget_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_access_budget(v_budget_user_id) then
    raise exception 'Access denied';
  end if;

  v_entry_count := jsonb_array_length(p_entries);

  if v_entry_count is null or v_entry_count = 0 then
    raise exception 'At least one balance entry is required';
  end if;

  select count(*)
  into v_asset_count
  from public.assets
  where user_id = v_budget_user_id;

  if v_entry_count <> v_asset_count then
    raise exception 'Balance entries must cover every asset';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if not exists (
      select 1
      from public.assets
      where id = (v_entry->>'asset_id')::uuid
        and user_id = v_budget_user_id
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
  values (v_budget_user_id, v_total)
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
  v_budget_user_id uuid := public.resolve_budget_user_id();
  v_total numeric(15, 2) := 0;
  v_entry jsonb;
  v_asset_count integer;
  v_entry_count integer;
begin
  if v_budget_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.balance_snapshots
    where id = p_snapshot_id
      and user_id = v_budget_user_id
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
  where user_id = v_budget_user_id;

  if v_entry_count <> v_asset_count then
    raise exception 'Balance entries must cover every asset';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if not exists (
      select 1
      from public.assets
      where id = (v_entry->>'asset_id')::uuid
        and user_id = v_budget_user_id
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

create or replace function public.can_read_budget_collaborators(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or exists (
      select 1
      from public.budget_collaborators bc
      where bc.owner_id = p_owner_id
        and bc.collaborator_id = auth.uid()
    );
$$;

create or replace function public.shares_budget_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_other_user_id = auth.uid()
    or exists (
      select 1
      from public.budget_collaborators bc
      where bc.owner_id = auth.uid()
        and bc.collaborator_id = p_other_user_id
    )
    or exists (
      select 1
      from public.budget_collaborators bc
      where bc.collaborator_id = auth.uid()
        and bc.owner_id = p_other_user_id
    )
    or exists (
      select 1
      from public.budget_collaborators mine
      join public.budget_collaborators theirs
        on mine.owner_id = theirs.owner_id
      where mine.collaborator_id = auth.uid()
        and theirs.collaborator_id = p_other_user_id
    );
$$;

-- RLS for new tables
alter table public.profiles enable row level security;
alter table public.budget_collaborators enable row level security;

create policy "Users read related profiles"
  on public.profiles
  for select
  to authenticated
  using (public.shares_budget_with(id));

create policy "Users update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Owners manage budget collaborators"
  on public.budget_collaborators
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Members read budget collaborators"
  on public.budget_collaborators
  for select
  to authenticated
  using (public.can_read_budget_collaborators(owner_id));

-- Replace owner-only RLS with shared budget access
drop policy if exists "Users manage own assets" on public.assets;
drop policy if exists "Users manage own balance snapshots" on public.balance_snapshots;
drop policy if exists "Users manage own snapshot entries" on public.balance_snapshot_entries;

create policy "Budget members manage assets"
  on public.assets
  for all
  to authenticated
  using (public.can_access_budget(user_id))
  with check (public.can_access_budget(user_id));

create policy "Budget members manage balance snapshots"
  on public.balance_snapshots
  for all
  to authenticated
  using (public.can_access_budget(user_id))
  with check (public.can_access_budget(user_id));

create policy "Budget members manage snapshot entries"
  on public.balance_snapshot_entries
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.balance_snapshots snapshot
      where snapshot.id = balance_snapshot_entries.snapshot_id
        and public.can_access_budget(snapshot.user_id)
    )
  )
  with check (
    exists (
      select 1
      from public.balance_snapshots snapshot
      where snapshot.id = balance_snapshot_entries.snapshot_id
        and public.can_access_budget(snapshot.user_id)
    )
  );

grant execute on function public.can_read_budget_collaborators(uuid) to authenticated;
grant execute on function public.shares_budget_with(uuid) to authenticated;
grant execute on function public.upsert_profile() to authenticated;
grant execute on function public.link_pending_invites() to authenticated;
grant execute on function public.invite_budget_collaborator(text) to authenticated;
grant execute on function public.remove_budget_collaborator(uuid) to authenticated;
grant execute on function public.resolve_budget_user_id() to authenticated;

-- Backfill profiles for existing users
insert into public.profiles (id, email, display_name, avatar_url)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
from auth.users u
on conflict (id) do nothing;
