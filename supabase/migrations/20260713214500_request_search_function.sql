create or replace function public.search_requests(
  p_search text default null,
  p_employee_id uuid default null,
  p_vendor_id uuid default null,
  p_status text default null,
  p_priority text default null,
  p_equipment_number text default null,
  p_requested_from date default null,
  p_requested_to date default null,
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
        p_show_completed
        or p_status is not null
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
