create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  equipment_number text not null unique,
  description text,
  active boolean not null default true,
  source_row_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_equipment_updated_at on public.equipment;
create trigger set_equipment_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

create index if not exists equipment_active_idx on public.equipment(active);
create index if not exists equipment_number_lower_idx on public.equipment(lower(equipment_number));
create index if not exists requests_equipment_requested_at_idx on public.requests(lower(equipment_number), requested_at desc);
create index if not exists purchase_history_equipment_purchase_date_idx on public.purchase_history(lower(equipment_number), purchase_date desc);

alter table public.equipment enable row level security;

drop policy if exists "Authenticated users can read equipment" on public.equipment;
create policy "Authenticated users can read equipment"
on public.equipment for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert equipment" on public.equipment;
create policy "Authenticated users can insert equipment"
on public.equipment for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update equipment" on public.equipment;
create policy "Authenticated users can update equipment"
on public.equipment for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete equipment" on public.equipment;
create policy "Authenticated users can delete equipment"
on public.equipment for delete
to authenticated
using (true);

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
      e.created_at,
      e.updated_at
    from public.equipment e
    where
      p_search is null
      or p_search = ''
      or e.equipment_number ilike '%' || p_search || '%'
      or e.description ilike '%' || p_search || '%'
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
      'equipment' as source
    from matching_equipment me
    union all
    select
      null::uuid as id,
      rn.equipment_number,
      null::text as description,
      true as active,
      'requests' as source
    from request_numbers rn
    union all
    select
      null::uuid as id,
      pn.equipment_number,
      null::text as description,
      true as active,
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
