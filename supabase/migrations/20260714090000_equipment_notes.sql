alter table public.equipment
add column if not exists notes text;

create index if not exists equipment_notes_search_idx on public.equipment using gin (
  to_tsvector('simple', coalesce(notes, '') || ' ' || coalesce(parts_ordered, ''))
);

create or replace function public.search_equipment_with_parts(
  p_search text default null,
  p_limit integer default 50
)
returns jsonb
language sql
stable
as $$
  with matching_equipment as (
    select
      e.id,
      e.equipment_number,
      e.description,
      e.active,
      e.prefix,
      e.unit_number,
      e.make,
      e.model,
      e.model_year,
      e.serial_number,
      e.driver,
      e.inspection_required,
      e.last_service_date,
      e.last_service_mileage,
      e.parts_ordered,
      e.notes,
      e.created_at,
      e.updated_at
    from public.equipment e
    where
      p_search is null
      or p_search = ''
      or e.equipment_number ilike '%' || p_search || '%'
      or e.unit_number ilike '%' || p_search || '%'
      or e.prefix ilike '%' || p_search || '%'
      or e.description ilike '%' || p_search || '%'
      or e.make ilike '%' || p_search || '%'
      or e.model ilike '%' || p_search || '%'
      or e.serial_number ilike '%' || p_search || '%'
      or e.driver ilike '%' || p_search || '%'
      or e.parts_ordered ilike '%' || p_search || '%'
      or e.notes ilike '%' || p_search || '%'
    order by e.equipment_number asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ),
  request_numbers as (
    select distinct r.equipment_number
    from public.requests r
    where
      r.equipment_number is not null
      and not exists (
        select 1
        from matching_equipment me
        where lower(me.equipment_number) = lower(r.equipment_number)
      )
      and (
        p_search is null
        or p_search = ''
        or r.equipment_number ilike '%' || p_search || '%'
      )
    order by r.equipment_number asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ),
  purchase_numbers as (
    select distinct ph.equipment_number
    from public.purchase_history ph
    where
      ph.equipment_number is not null
      and not exists (
        select 1
        from matching_equipment me
        where lower(me.equipment_number) = lower(ph.equipment_number)
      )
      and not exists (
        select 1
        from request_numbers rn
        where lower(rn.equipment_number) = lower(ph.equipment_number)
      )
      and (
        p_search is null
        or p_search = ''
        or ph.equipment_number ilike '%' || p_search || '%'
      )
    order by ph.equipment_number asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ),
  equipment_rows as (
    select
      me.id,
      me.equipment_number,
      me.description,
      me.active,
      me.prefix,
      me.unit_number,
      me.make,
      me.model,
      me.model_year,
      me.serial_number,
      me.driver,
      me.inspection_required,
      me.last_service_date,
      me.last_service_mileage,
      me.parts_ordered,
      me.notes,
      'equipment' as source
    from matching_equipment me
    union all
    select
      null::uuid as id,
      rn.equipment_number,
      null::text as description,
      true as active,
      null::text as prefix,
      null::text as unit_number,
      null::text as make,
      null::text as model,
      null::text as model_year,
      null::text as serial_number,
      null::text as driver,
      null::text as inspection_required,
      null::date as last_service_date,
      null::numeric as last_service_mileage,
      null::text as parts_ordered,
      null::text as notes,
      'requests' as source
    from request_numbers rn
    union all
    select
      null::uuid as id,
      pn.equipment_number,
      null::text as description,
      true as active,
      null::text as prefix,
      null::text as unit_number,
      null::text as make,
      null::text as model,
      null::text as model_year,
      null::text as serial_number,
      null::text as driver,
      null::text as inspection_required,
      null::date as last_service_date,
      null::numeric as last_service_mileage,
      null::text as parts_ordered,
      null::text as notes,
      'purchase_history' as source
    from purchase_numbers pn
  ),
  limited_equipment as (
    select *
    from equipment_rows
    order by equipment_number asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ),
  request_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select
        r.id,
        r.request_number,
        r.equipment_number,
        r.item_description,
        r.status,
        r.priority,
        r.vendor_name_override,
        v.name as vendor_name,
        r.order_number,
        r.quantity,
        r.unit_cost,
        r.total_cost,
        r.requested_at,
        r.ordered_at,
        r.received_at,
        r.eta
      from public.requests r
      left join public.vendors v on v.id = r.vendor_id
      where
        r.equipment_number is not null
        and exists (
          select 1
          from limited_equipment le
          where lower(le.equipment_number) = lower(r.equipment_number)
        )
      order by r.requested_at desc
      limit 100
    ) row_data
  ),
  purchase_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) as rows
    from (
      select
        ph.id,
        ph.equipment_number,
        ph.part_description,
        ph.part_number,
        ph.vendor_name,
        ph.purchase_date,
        ph.quantity,
        ph.unit_cost,
        ph.total_cost,
        ph.po_number,
        ph.invoice_number,
        ph.notes
      from public.purchase_history ph
      where
        ph.equipment_number is not null
        and exists (
          select 1
          from limited_equipment le
          where lower(le.equipment_number) = lower(ph.equipment_number)
        )
      order by ph.purchase_date desc nulls last, ph.imported_at desc
      limit 100
    ) row_data
  )
  select jsonb_build_object(
    'equipment', coalesce((select jsonb_agg(to_jsonb(limited_equipment)) from limited_equipment), '[]'::jsonb),
    'requests', request_rows.rows,
    'purchase_history', purchase_rows.rows
  )
  from request_rows, purchase_rows;
$$;
