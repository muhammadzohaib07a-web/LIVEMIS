-- Admin-managed departments and issue categories for the MIS support hub.
-- Existing ticket category values are preserved while allowing new categories.

alter table public.tickets
  alter column category drop default;

alter table public.tickets
  alter column category type text using category::text;

alter table public.tickets
  alter column category set default 'other';

alter table public.tickets
  add constraint tickets_category_valid
  check (char_length(btrim(category)) between 1 and 80);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_name_valid check (char_length(btrim(name)) between 2 and 100)
);

create table if not exists public.issue_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text,
  group_name text not null default 'General MIS',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issue_categories_slug_valid
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint issue_categories_name_valid check (char_length(btrim(name)) between 2 and 100)
);

create index if not exists departments_active_sort_idx
  on public.departments (active, sort_order, name);

create index if not exists issue_categories_active_group_sort_idx
  on public.issue_categories (active, group_name, sort_order, name);

drop trigger if exists update_departments_updated_at on public.departments;
create trigger update_departments_updated_at
  before update on public.departments
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_issue_categories_updated_at on public.issue_categories;
create trigger update_issue_categories_updated_at
  before update on public.issue_categories
  for each row execute function public.update_updated_at_column();

alter table public.departments enable row level security;
alter table public.issue_categories enable row level security;

drop policy if exists "Authenticated users can read active departments" on public.departments;
create policy "Authenticated users can read active departments"
  on public.departments for select
  to authenticated
  using (active or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can create departments" on public.departments;
create policy "Admins can create departments"
  on public.departments for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update departments" on public.departments;
create policy "Admins can update departments"
  on public.departments for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can delete departments" on public.departments;
create policy "Admins can delete departments"
  on public.departments for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Authenticated users can read active categories" on public.issue_categories;
create policy "Authenticated users can read active categories"
  on public.issue_categories for select
  to authenticated
  using (active or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can create categories" on public.issue_categories;
create policy "Admins can create categories"
  on public.issue_categories for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update categories" on public.issue_categories;
create policy "Admins can update categories"
  on public.issue_categories for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can delete categories" on public.issue_categories;
create policy "Admins can delete categories"
  on public.issue_categories for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.issue_categories to authenticated;

insert into public.departments (name, description, sort_order)
values
  ('MIS', 'Management Information Systems and Odoo development team', 10),
  ('Accounts', 'Finance, accounts and taxation', 20),
  ('Inventory', 'Inventory control and stock operations', 30),
  ('Quality', 'Quality assurance and quality control', 40),
  ('Production', 'Textile mill production operations', 50),
  ('Warehouse', 'Warehousing, dispatch and material handling', 60)
on conflict (name) do update
set description = excluded.description,
    sort_order = excluded.sort_order;

insert into public.issue_categories
  (slug, name, description, group_name, sort_order)
values
  ('hardware', 'Computer / Laptop', 'PC, laptop, monitor, keyboard and mouse issues', 'General MIS', 10),
  ('printer', 'Printer / Scanner', 'Printing, labels and scanning issues', 'General MIS', 20),
  ('software', 'Software', 'Windows, Office and installed application issues', 'General MIS', 30),
  ('network', 'Network / Wi-Fi', 'Internet, LAN, Wi-Fi and VPN issues', 'General MIS', 40),
  ('email', 'Email / Outlook', 'Mailbox and email delivery issues', 'General MIS', 50),
  ('access', 'User Access', 'Accounts, passwords and permissions', 'General MIS', 60),
  ('odoo', 'Odoo General Support', 'General Odoo issue or request', 'General MIS', 70),
  ('erp', 'Other ERP', 'Non-Odoo business system issues', 'General MIS', 80),
  ('server', 'Server', 'Server availability and service issues', 'General MIS', 90),
  ('backup', 'Backup', 'Backup, restore and recovery', 'General MIS', 100),
  ('cctv', 'CCTV', 'Cameras, NVR and monitoring', 'General MIS', 110),
  ('attendance', 'Attendance System', 'Biometric device and attendance synchronization', 'General MIS', 120),
  ('other', 'Other MIS Issue', 'Any other MIS-related request', 'General MIS', 130),
  ('odoo-functional-support', 'Odoo Functional Support', 'Configuration and functional guidance for Odoo users', 'Odoo & Textile', 210),
  ('odoo-custom-development', 'Odoo Custom Development', 'New modules, fields, screens and custom business logic', 'Odoo & Textile', 220),
  ('odoo-bug-fix', 'Odoo Bug Fix', 'Errors, broken functionality and unexpected Odoo behavior', 'Odoo & Textile', 230),
  ('odoo-report-development', 'Odoo Report Development', 'QWeb, PDF, Excel and management reports', 'Odoo & Textile', 240),
  ('odoo-workflow-approval', 'Odoo Workflow / Approval', 'Business workflows, approvals and escalation rules', 'Odoo & Textile', 250),
  ('odoo-user-access-security', 'Odoo User Access / Security', 'User roles, record rules and access rights', 'Odoo & Textile', 260),
  ('odoo-api-integration', 'Odoo API / Integration', 'API, third-party software and device integrations', 'Odoo & Textile', 270),
  ('odoo-performance', 'Odoo Performance', 'Slow screens, queries, jobs and performance tuning', 'Odoo & Textile', 280),
  ('odoo-inventory', 'Odoo Inventory', 'Stock moves, valuation, lots, serials and replenishment', 'Odoo & Textile', 290),
  ('odoo-manufacturing', 'Odoo Manufacturing', 'MRP, work orders, BOMs and production execution', 'Odoo & Textile', 300),
  ('odoo-quality', 'Odoo Quality', 'Quality checks, alerts and inspection workflows', 'Odoo & Textile', 310),
  ('odoo-purchase', 'Odoo Purchase', 'RFQs, purchase orders and vendor processes', 'Odoo & Textile', 320),
  ('odoo-sales', 'Odoo Sales', 'Quotations, sales orders and customer processes', 'Odoo & Textile', 330),
  ('odoo-accounting', 'Odoo Accounting', 'Invoices, payments, journals and financial reporting', 'Odoo & Textile', 340),
  ('odoo-warehouse', 'Odoo Warehouse', 'Receipts, deliveries, transfers and warehouse operations', 'Odoo & Textile', 350),
  ('textile-weaving', 'Textile Weaving', 'Loom planning, weaving production and efficiency', 'Odoo & Textile', 360),
  ('textile-dyeing', 'Textile Dyeing', 'Dyeing batches, recipes, lab and process tracking', 'Odoo & Textile', 370),
  ('textile-finishing', 'Textile Finishing', 'Finishing processes, inspection and dispatch readiness', 'Odoo & Textile', 380),
  ('textile-planning', 'Textile Production Planning', 'Demand, capacity, scheduling and material planning', 'Odoo & Textile', 390),
  ('textile-costing', 'Textile Costing', 'Yarn, chemicals, process and order costing', 'Odoo & Textile', 400)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    group_name = excluded.group_name,
    sort_order = excluded.sort_order;
