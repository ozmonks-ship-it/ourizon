-- Fix infinite recursion in budget_collaborators RLS (caused 500 errors on SELECT)

drop policy if exists "Collaborators read budget membership" on public.budget_collaborators;
drop policy if exists "Users read related profiles" on public.profiles;

-- Security-definer helpers bypass RLS when checking membership
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

grant execute on function public.can_read_budget_collaborators(uuid) to authenticated;
grant execute on function public.shares_budget_with(uuid) to authenticated;

create policy "Members read budget collaborators"
  on public.budget_collaborators
  for select
  to authenticated
  using (public.can_read_budget_collaborators(owner_id));

create policy "Users read related profiles"
  on public.profiles
  for select
  to authenticated
  using (public.shares_budget_with(id));
