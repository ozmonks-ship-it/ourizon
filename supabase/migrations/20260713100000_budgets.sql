-- Named budgets for specific occasions (e.g. an annual bonus) with a target amount
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(15, 2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budgets_user_id_idx on public.budgets (user_id, sort_order);

-- Expenses captured against a budget (e.g. flights to Turkiye)
create table public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  name text not null,
  amount numeric(15, 2) not null default 0 check (amount >= 0),
  incurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index budget_expenses_budget_id_idx on public.budget_expenses (budget_id, incurred_at);

create trigger budgets_set_updated_at
before update on public.budgets
for each row
execute function public.set_updated_at();

alter table public.budgets enable row level security;
alter table public.budget_expenses enable row level security;

create policy "Budget members manage budgets"
  on public.budgets
  for all
  to authenticated
  using (public.can_access_budget(user_id))
  with check (public.can_access_budget(user_id));

create policy "Budget members manage budget expenses"
  on public.budget_expenses
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.budgets budget
      where budget.id = budget_expenses.budget_id
        and public.can_access_budget(budget.user_id)
    )
  )
  with check (
    exists (
      select 1
      from public.budgets budget
      where budget.id = budget_expenses.budget_id
        and public.can_access_budget(budget.user_id)
    )
  );
