create extension if not exists pgcrypto;

create sequence if not exists public.request_number_seq start 1;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  website text,
  sales_rep text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  requested_by_employee_id uuid references public.employees(id) on delete set null,
  item_description text not null,
  equipment_number text,
  priority text not null default 'This Week',
  status text not null default 'Need to Order',
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_name_override text,
  order_number text,
  quantity numeric,
  unit_cost numeric,
  total_cost numeric,
  eta date,
  tracking_number text,
  tracking_url text,
  notes text,
  requested_at timestamptz not null default now(),
  ordered_at timestamptz,
  received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_priority_check check (
    priority in ('Emergency', 'Today', 'This Week', 'Whenever')
  ),
  constraint requests_status_check check (
    status in (
      'Need to Order',
      'Ordered',
      'Waiting on Vendor',
      'Backordered',
      'Shipped',
      'Received',
      'Cancelled'
    )
  ),
  constraint requests_quantity_check check (quantity is null or quantity >= 0),
  constraint requests_unit_cost_check check (unit_cost is null or unit_cost >= 0),
  constraint requests_total_cost_check check (total_cost is null or total_cost >= 0)
);

create table if not exists public.request_activity (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  equipment_number text,
  part_description text,
  part_number text,
  vendor_name text,
  purchase_date date,
  quantity numeric,
  unit_cost numeric,
  total_cost numeric,
  po_number text,
  invoice_number text,
  notes text,
  source_row_id text,
  imported_at timestamptz not null default now(),
  constraint purchase_history_quantity_check check (quantity is null or quantity >= 0),
  constraint purchase_history_unit_cost_check check (unit_cost is null or unit_cost >= 0),
  constraint purchase_history_total_cost_check check (total_cost is null or total_cost >= 0)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_request_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.request_number is null or btrim(new.request_number) = '' then
    new.request_number = 'REQ-' || lpad(nextval('public.request_number_seq')::text, 6, '0');
  end if;

  if new.created_by is null then
    new.created_by = auth.uid();
  end if;

  if new.total_cost is null and new.quantity is not null and new.unit_cost is not null then
    new.total_cost = new.quantity * new.unit_cost;
  end if;

  return new;
end;
$$;

create or replace function public.set_activity_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.performed_by is null then
    new.performed_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

drop trigger if exists set_requests_updated_at on public.requests;
create trigger set_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

drop trigger if exists set_requests_defaults on public.requests;
create trigger set_requests_defaults
before insert or update of quantity, unit_cost, total_cost, request_number, created_by on public.requests
for each row execute function public.set_request_defaults();

drop trigger if exists set_request_activity_defaults on public.request_activity;
create trigger set_request_activity_defaults
before insert on public.request_activity
for each row execute function public.set_activity_defaults();

create index if not exists employees_active_idx on public.employees(active);
create index if not exists employees_name_idx on public.employees(lower(name));
create index if not exists employees_department_idx on public.employees(lower(department));

create index if not exists vendors_active_idx on public.vendors(active);
create index if not exists vendors_name_idx on public.vendors(lower(name));
create index if not exists vendors_email_idx on public.vendors(lower(email));

create index if not exists requests_requested_at_idx on public.requests(requested_at desc);
create index if not exists requests_status_idx on public.requests(status);
create index if not exists requests_priority_idx on public.requests(priority);
create index if not exists requests_equipment_number_idx on public.requests(lower(equipment_number));
create index if not exists requests_order_number_idx on public.requests(lower(order_number));
create index if not exists requests_employee_idx on public.requests(requested_by_employee_id);
create index if not exists requests_vendor_idx on public.requests(vendor_id);
create index if not exists requests_search_idx on public.requests using gin (
  to_tsvector(
    'english',
    coalesce(request_number, '') || ' ' ||
    coalesce(item_description, '') || ' ' ||
    coalesce(equipment_number, '') || ' ' ||
    coalesce(vendor_name_override, '') || ' ' ||
    coalesce(order_number, '') || ' ' ||
    coalesce(tracking_number, '') || ' ' ||
    coalesce(notes, '')
  )
);

create index if not exists request_activity_request_id_idx on public.request_activity(request_id);
create index if not exists request_activity_created_at_idx on public.request_activity(created_at desc);
create index if not exists request_activity_action_idx on public.request_activity(action);

create index if not exists purchase_history_equipment_idx on public.purchase_history(lower(equipment_number));
create index if not exists purchase_history_part_number_idx on public.purchase_history(lower(part_number));
create index if not exists purchase_history_vendor_idx on public.purchase_history(lower(vendor_name));
create index if not exists purchase_history_purchase_date_idx on public.purchase_history(purchase_date desc);
create index if not exists purchase_history_search_idx on public.purchase_history using gin (
  to_tsvector(
    'english',
    coalesce(equipment_number, '') || ' ' ||
    coalesce(part_description, '') || ' ' ||
    coalesce(part_number, '') || ' ' ||
    coalesce(vendor_name, '') || ' ' ||
    coalesce(po_number, '') || ' ' ||
    coalesce(invoice_number, '') || ' ' ||
    coalesce(notes, '')
  )
);

alter table public.employees enable row level security;
alter table public.vendors enable row level security;
alter table public.requests enable row level security;
alter table public.request_activity enable row level security;
alter table public.purchase_history enable row level security;

drop policy if exists "Authenticated users can read employees" on public.employees;
create policy "Authenticated users can read employees"
on public.employees for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert employees" on public.employees;
create policy "Authenticated users can insert employees"
on public.employees for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update employees" on public.employees;
create policy "Authenticated users can update employees"
on public.employees for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete employees" on public.employees;
create policy "Authenticated users can delete employees"
on public.employees for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read vendors" on public.vendors;
create policy "Authenticated users can read vendors"
on public.vendors for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert vendors" on public.vendors;
create policy "Authenticated users can insert vendors"
on public.vendors for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update vendors" on public.vendors;
create policy "Authenticated users can update vendors"
on public.vendors for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete vendors" on public.vendors;
create policy "Authenticated users can delete vendors"
on public.vendors for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read requests" on public.requests;
create policy "Authenticated users can read requests"
on public.requests for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert requests" on public.requests;
create policy "Authenticated users can insert requests"
on public.requests for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update requests" on public.requests;
create policy "Authenticated users can update requests"
on public.requests for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete requests" on public.requests;
create policy "Authenticated users can delete requests"
on public.requests for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read request activity" on public.request_activity;
create policy "Authenticated users can read request activity"
on public.request_activity for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert request activity" on public.request_activity;
create policy "Authenticated users can insert request activity"
on public.request_activity for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update request activity" on public.request_activity;
create policy "Authenticated users can update request activity"
on public.request_activity for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete request activity" on public.request_activity;
create policy "Authenticated users can delete request activity"
on public.request_activity for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read purchase history" on public.purchase_history;
create policy "Authenticated users can read purchase history"
on public.purchase_history for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert purchase history" on public.purchase_history;
create policy "Authenticated users can insert purchase history"
on public.purchase_history for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update purchase history" on public.purchase_history;
create policy "Authenticated users can update purchase history"
on public.purchase_history for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete purchase history" on public.purchase_history;
create policy "Authenticated users can delete purchase history"
on public.purchase_history for delete
to authenticated
using (true);
