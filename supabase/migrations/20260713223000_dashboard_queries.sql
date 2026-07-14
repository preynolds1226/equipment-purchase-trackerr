create index if not exists requests_status_eta_idx on public.requests(status, eta);
create index if not exists requests_status_requested_at_idx on public.requests(status, requested_at);
create index if not exists requests_status_received_at_idx on public.requests(status, received_at);
create index if not exists requests_priority_status_idx on public.requests(priority, status);
create index if not exists requests_eta_idx on public.requests(eta);

create or replace function public.search_requests(
  p_search text default null,
  p_employee_id uuid default null,
  p_vendor_id uuid default null,
  p_status text default null,
  p_priority text default null,
  p_equipment_number text default null,
  p_requested_from date default null,
  p_requested_to date default null,
  p_eta_from date default null,
  p_eta_to date default null,
  p_received_from date default null,
  p_received_to date default null,
  p_overdue_eta boolean default false,
  p_show_completed boolean default false,
  p_sort text default 'newest',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  request_number text,
  requested_by_employee_id uuid,
  employee_name text,
  employee_department text,
  item_description text,
  equipment_number text,
  priority text,
  status text,
  vendor_id uuid,
  vendor_name text,
  vendor_name_override text,
  order_number text,
  quantity numeric,
  unit_cost numeric,
  total_cost numeric,
  eta date,
  tracking_number text,
  tracking_url text,
  notes text,
  requested_at timestamptz,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select
      r.id,
      r.request_number,
      r.requested_by_employee_id,
      e.name as employee_name,
      e.department as employee_department,
      r.item_description,
      r.equipment_number,
      r.priority,
      r.status,
      r.vendor_id,
      v.name as vendor_name,
      r.vendor_name_override,
      r.order_number,
      r.quantity,
      r.unit_cost,
      r.total_cost,
      r.eta,
      r.tracking_number,
      r.tracking_url,
      r.notes,
      r.requested_at,
      r.ordered_at,
      r.received_at,
      r.created_at,
      r.updated_at
    from public.requests r
    left join public.employees e on e.id = r.requested_by_employee_id
    left join public.vendors v on v.id = r.vendor_id
    where
      (p_employee_id is null or r.requested_by_employee_id = p_employee_id)
      and (p_vendor_id is null or r.vendor_id = p_vendor_id)
      and (p_status is null or r.status = p_status)
      and (p_priority is null or r.priority = p_priority)
      and (
        p_equipment_number is null
        or r.equipment_number ilike '%' || p_equipment_number || '%'
      )
      and (
        p_requested_from is null
        or r.requested_at >= p_requested_from::timestamptz
      )
      and (
        p_requested_to is null
        or r.requested_at < (p_requested_to + 1)::timestamptz
      )
      and (
        p_eta_from is null
        or r.eta >= p_eta_from
      )
      and (
        p_eta_to is null
        or r.eta <= p_eta_to
      )
      and (
        p_received_from is null
        or r.received_at >= p_received_from::timestamptz
      )
      and (
        p_received_to is null
        or r.received_at < (p_received_to + 1)::timestamptz
      )
      and (
        not p_overdue_eta
        or (
          r.eta < current_date
          and r.status not in ('Received', 'Cancelled')
        )
      )
      and (
        p_show_completed
        or p_status is not null
        or p_received_from is not null
        or p_received_to is not null
        or r.status not in ('Received', 'Cancelled')
      )
      and (
        p_search is null
        or p_search = ''
        or r.request_number ilike '%' || p_search || '%'
        or e.name ilike '%' || p_search || '%'
        or r.item_description ilike '%' || p_search || '%'
        or r.equipment_number ilike '%' || p_search || '%'
        or v.name ilike '%' || p_search || '%'
        or r.vendor_name_override ilike '%' || p_search || '%'
        or r.order_number ilike '%' || p_search || '%'
        or r.tracking_number ilike '%' || p_search || '%'
        or r.notes ilike '%' || p_search || '%'
      )
  )
  select
    filtered.*,
    count(*) over() as total_count
  from filtered
  order by
    case when p_sort = 'oldest' then filtered.requested_at end asc,
    case when p_sort = 'eta' then filtered.eta end asc nulls last,
    case when p_sort = 'employee' then filtered.employee_name end asc nulls last,
    case
      when p_sort = 'priority' and filtered.priority = 'Emergency' then 1
      when p_sort = 'priority' and filtered.priority = 'Today' then 2
      when p_sort = 'priority' and filtered.priority = 'This Week' then 3
      when p_sort = 'priority' and filtered.priority = 'Whenever' then 4
    end asc nulls last,
    filtered.requested_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.get_purchasing_dashboard(p_today date default current_date)
returns jsonb
language sql
stable
as $$
  with open_requests as (
    select r.*, e.name as employee_name, v.name as vendor_name
    from public.requests r
    left join public.employees e on e.id = r.requested_by_employee_id
    left join public.vendors v on v.id = r.vendor_id
    where r.status not in ('Received', 'Cancelled')
  ),
  counts as (
    select
      count(*) filter (where status = 'Need to Order') as need_to_order,
      count(*) filter (where status = 'Ordered') as ordered,
      count(*) filter (where status = 'Waiting on Vendor') as waiting_on_vendor,
      count(*) filter (where status = 'Backordered') as backordered,
      count(*) filter (where eta = p_today and status not in ('Received', 'Cancelled')) as arriving_today,
      count(*) filter (where eta < p_today and status not in ('Received', 'Cancelled')) as overdue_eta,
      (
        select count(*)
        from public.requests received
        where received.status = 'Received'
          and received.received_at >= p_today::timestamptz
          and received.received_at < (p_today + 1)::timestamptz
      ) as received_today
    from public.requests
  ),
  emergency as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select id, request_number, item_description, equipment_number, status, priority, employee_name, vendor_name, requested_at, eta
      from open_requests
      where priority = 'Emergency'
      order by requested_at asc
      limit 6
    ) row_data
  ),
  oldest_need as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select id, request_number, item_description, equipment_number, status, priority, employee_name, vendor_name, requested_at, eta
      from open_requests
      where status = 'Need to Order'
      order by requested_at asc
      limit 6
    ) row_data
  ),
  overdue as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select id, request_number, item_description, equipment_number, status, priority, employee_name, vendor_name, requested_at, eta
      from open_requests
      where eta < p_today
      order by eta asc, requested_at asc
      limit 6
    ) row_data
  ),
  activity as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select
        a.id,
        a.request_id,
        a.action,
        a.field_name,
        a.old_value,
        a.new_value,
        a.created_at,
        r.request_number,
        r.item_description
      from public.request_activity a
      join public.requests r on r.id = a.request_id
      order by a.created_at desc
      limit 8
    ) row_data
  ),
  by_employee as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select
        requested_by_employee_id as employee_id,
        coalesce(employee_name, 'Unknown employee') as employee_name,
        count(*) as request_count
      from open_requests
      group by requested_by_employee_id, employee_name
      order by count(*) desc, employee_name asc
      limit 8
    ) row_data
  ),
  by_vendor as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select
        vendor_id,
        coalesce(vendor_name, vendor_name_override, 'No vendor selected') as vendor_name,
        count(*) as request_count
      from open_requests
      group by vendor_id, coalesce(vendor_name, vendor_name_override, 'No vendor selected')
      order by count(*) desc, vendor_name asc
      limit 8
    ) row_data
  )
  select jsonb_build_object(
    'counts', to_jsonb(counts),
    'emergency_requests', emergency.rows,
    'oldest_need_to_order', oldest_need.rows,
    'overdue_etas', overdue.rows,
    'recent_activity', activity.rows,
    'open_by_employee', by_employee.rows,
    'open_by_vendor', by_vendor.rows
  )
  from counts, emergency, oldest_need, overdue, activity, by_employee, by_vendor;
$$;
