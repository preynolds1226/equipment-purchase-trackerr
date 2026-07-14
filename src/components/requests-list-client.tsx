"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Field, Message, TextInput } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import { cleanOptionalText, formatCurrency, formatDateTime } from "@/lib/format";
import {
  getPriorityBadgeClass,
  getStatusBadgeClass,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
} from "@/lib/requests";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database, RequestPriority, RequestStatus } from "@/lib/supabase/database.types";

type RequestSearchRow = Database["public"]["Functions"]["search_requests"]["Returns"][number];
type Employee = Pick<Database["public"]["Tables"]["employees"]["Row"], "id" | "name" | "department" | "active">;
type Vendor = Pick<Database["public"]["Tables"]["vendors"]["Row"], "id" | "name" | "active">;
type SortOption = "newest" | "oldest" | "eta" | "employee" | "priority";

const PAGE_SIZE = 25;
const quickFilters: Array<{ label: string; status?: RequestStatus; priority?: RequestPriority }> = [
  { label: "Need to Order", status: "Need to Order" },
  { label: "Ordered", status: "Ordered" },
  { label: "Waiting on Vendor", status: "Waiting on Vendor" },
  { label: "Backordered", status: "Backordered" },
  { label: "Shipped", status: "Shipped" },
  { label: "Received", status: "Received" },
  { label: "Emergency", priority: "Emergency" },
];

export function RequestsListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<RequestSearchRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [employeeId, setEmployeeId] = useState(searchParams.get("employee") ?? "");
  const [vendorId, setVendorId] = useState(searchParams.get("vendor") ?? "");
  const [status, setStatus] = useState<"" | RequestStatus>((searchParams.get("status") as RequestStatus | null) ?? "");
  const [priority, setPriority] = useState<"" | RequestPriority>((searchParams.get("priority") as RequestPriority | null) ?? "");
  const [equipment, setEquipment] = useState(searchParams.get("equipment") ?? "");
  const [fromDate, setFromDate] = useState(searchParams.get("from") ?? "");
  const [toDate, setToDate] = useState(searchParams.get("to") ?? "");
  const [etaFrom, setEtaFrom] = useState(searchParams.get("etaFrom") ?? "");
  const [etaTo, setEtaTo] = useState(searchParams.get("etaTo") ?? "");
  const [receivedFrom, setReceivedFrom] = useState(searchParams.get("receivedFrom") ?? "");
  const [receivedTo, setReceivedTo] = useState(searchParams.get("receivedTo") ?? "");
  const [overdueEta, setOverdueEta] = useState(searchParams.get("overdueEta") === "1");
  const [showCompleted, setShowCompleted] = useState(searchParams.get("completed") === "1");
  const [sort, setSort] = useState<SortOption>((searchParams.get("sort") as SortOption | null) ?? "newest");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const returnTo = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentOffset = (Math.max(1, page) - 1) * PAGE_SIZE;

  const syncUrl = useCallback(
    (nextPage = 1) => {
      const params = new URLSearchParams();
      setQueryParam(params, "q", search);
      setQueryParam(params, "employee", employeeId);
      setQueryParam(params, "vendor", vendorId);
      setQueryParam(params, "status", status);
      setQueryParam(params, "priority", priority);
      setQueryParam(params, "equipment", equipment);
      setQueryParam(params, "from", fromDate);
      setQueryParam(params, "to", toDate);
      setQueryParam(params, "etaFrom", etaFrom);
      setQueryParam(params, "etaTo", etaTo);
      setQueryParam(params, "receivedFrom", receivedFrom);
      setQueryParam(params, "receivedTo", receivedTo);
      setQueryParam(params, "sort", sort === "newest" ? "" : sort);

      if (overdueEta) {
        params.set("overdueEta", "1");
      }

      if (showCompleted) {
        params.set("completed", "1");
      }

      if (nextPage > 1) {
        params.set("page", String(nextPage));
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      setPage(nextPage);
    },
    [
      employeeId,
      equipment,
      etaFrom,
      etaTo,
      fromDate,
      overdueEta,
      pathname,
      priority,
      receivedFrom,
      receivedTo,
      router,
      search,
      showCompleted,
      sort,
      status,
      toDate,
      vendorId,
    ],
  );

  const loadFilterOptions = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const [employeeResult, vendorResult] = await Promise.all([
      supabase.from("employees").select("id, name, department, active").order("active", { ascending: false }).order("name"),
      supabase.from("vendors").select("id, name, active").order("active", { ascending: false }).order("name"),
    ]);

    if (employeeResult.error) {
      setMessage({ kind: "error", text: employeeResult.error.message });
    } else {
      setEmployees(employeeResult.data ?? []);
    }

    if (vendorResult.error) {
      setMessage({ kind: "error", text: vendorResult.error.message });
    } else {
      setVendors(vendorResult.data ?? []);
    }
  }, [supabase]);

  const loadRequests = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setMessage({
        kind: "info",
        text: "Supabase is not configured yet. Add your project URL and anon key to .env.local.",
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc("search_requests", {
      p_search: cleanOptionalText(search),
      p_employee_id: employeeId || null,
      p_vendor_id: vendorId || null,
      p_status: status || null,
      p_priority: priority || null,
      p_equipment_number: cleanOptionalText(equipment),
      p_requested_from: fromDate || null,
      p_requested_to: toDate || null,
      p_eta_from: etaFrom || null,
      p_eta_to: etaTo || null,
      p_received_from: receivedFrom || null,
      p_received_to: receivedTo || null,
      p_overdue_eta: overdueEta,
      p_show_completed: showCompleted,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: currentOffset,
    });

    if (error) {
      setMessage({ kind: "error", text: error.message });
      setRequests([]);
      setTotalCount(0);
    } else {
      const rows = data ?? [];
      setRequests(rows);
      setTotalCount(rows[0]?.total_count ?? 0);
    }

    setLoading(false);
  }, [
    currentOffset,
    employeeId,
    equipment,
    etaFrom,
    etaTo,
    fromDate,
    overdueEta,
    priority,
    receivedFrom,
    receivedTo,
    search,
    showCompleted,
    sort,
    status,
    supabase,
    toDate,
    vendorId,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadFilterOptions();
    });
  }, [loadFilterOptions]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRequests();
    });
  }, [loadRequests]);

  function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    syncUrl(1);
  }

  function clearFilters() {
    setSearch("");
    setEmployeeId("");
    setVendorId("");
    setStatus("");
    setPriority("");
    setEquipment("");
    setFromDate("");
    setToDate("");
    setEtaFrom("");
    setEtaTo("");
    setReceivedFrom("");
    setReceivedTo("");
    setOverdueEta(false);
    setShowCompleted(false);
    setSort("newest");
    router.replace(pathname, { scroll: false });
    setPage(1);
  }

  function applyQuickFilter(filter: (typeof quickFilters)[number]) {
    setStatus(filter.status ?? "");
    setPriority(filter.priority ?? "");
    setShowCompleted(filter.status === "Received" ? true : showCompleted);
    setPage(1);

    const params = new URLSearchParams(searchParams.toString());
    if (filter.status) {
      params.set("status", filter.status);
      params.delete("priority");
    }
    if (filter.priority) {
      params.set("priority", filter.priority);
      params.delete("status");
    }
    if (filter.status === "Received") {
      params.set("completed", "1");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <form className="grid gap-4" onSubmit={applyFilters}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <Field label="Search requests">
              <TextInput
                placeholder="Floyd, truck number, part, vendor, order number..."
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <Link
              className="grid h-11 place-items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
              href="/requests/new"
            >
              New request
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => {
              const active = (filter.status && status === filter.status) || (filter.priority && priority === filter.priority);
              return (
                <button
                  className={`h-9 rounded-full border px-3 text-xs font-semibold ${
                    active
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted"
                  }`}
                  key={filter.label}
                  onClick={() => applyQuickFilter(filter)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Employee">
              <select className={selectClassName} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}{employee.department ? ` - ${employee.department}` : ""}{employee.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Vendor">
              <select className={selectClassName} value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
                <option value="">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}{vendor.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select className={selectClassName} value={status} onChange={(event) => setStatus(event.target.value as "" | RequestStatus)}>
                <option value="">Active statuses</option>
                {REQUEST_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select className={selectClassName} value={priority} onChange={(event) => setPriority(event.target.value as "" | RequestPriority)}>
                <option value="">All priorities</option>
                {REQUEST_PRIORITIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>

            <Field label="Equipment number">
              <TextInput value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Truck or unit" />
            </Field>

            <Field label="Requested from">
              <TextInput type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>

            <Field label="Requested to">
              <TextInput type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>

            <Field label="ETA from">
              <TextInput type="date" value={etaFrom} onChange={(event) => setEtaFrom(event.target.value)} />
            </Field>

            <Field label="ETA to">
              <TextInput type="date" value={etaTo} onChange={(event) => setEtaTo(event.target.value)} />
            </Field>

            <Field label="Received from">
              <TextInput type="date" value={receivedFrom} onChange={(event) => setReceivedFrom(event.target.value)} />
            </Field>

            <Field label="Received to">
              <TextInput type="date" value={receivedTo} onChange={(event) => setReceivedTo(event.target.value)} />
            </Field>

            <Field label="Sort">
              <select className={selectClassName} value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
                <option value="newest">Newest requested</option>
                <option value="oldest">Oldest requested</option>
                <option value="eta">ETA</option>
                <option value="employee">Employee</option>
                <option value="priority">Priority</option>
              </select>
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={overdueEta}
                onChange={(event) => setOverdueEta(event.target.checked)}
              />
              Overdue ETA only
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
              />
              Include received and cancelled
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="h-11 rounded-md border border-border px-4 text-sm font-semibold" onClick={clearFilters} type="button">
                Clear
              </button>
              <button className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground" type="submit">
                Apply filters
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {requests.length === 0 ? 0 : currentOffset + 1}-{currentOffset + requests.length} of {totalCount}
        </p>
        <p>Active requests are shown by default.</p>
      </div>

      {loading ? (
        <LoadingState title="Loading requests" description="Getting the filtered request list from Supabase." />
      ) : requests.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <EmptyState title="No matching requests" description="Try a broader search, clear a filter, or include completed requests." />
        </section>
      ) : (
        <>
          <section className="grid gap-3 lg:hidden">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} returnTo={returnTo} />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-sm lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">ETA</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((request) => (
                  <tr className="transition hover:bg-surface-muted" key={request.id}>
                    <td className="px-4 py-3">
                      <Link className="block" href={detailHref(request.id, returnTo)}>
                        <span className="font-semibold text-accent">{request.request_number ?? "Request"}</span>
                        <span className="mt-1 line-clamp-2 block max-w-sm text-foreground">{request.item_description}</span>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClass(request.priority)}`}>
                          {request.priority}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{request.employee_name ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-muted">{request.equipment_number ?? "Not set"}</td>
                    <td className="px-4 py-3 text-muted">{request.vendor_name ?? request.vendor_name_override ?? "Not set"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(request.requested_at)}</td>
                    <td className="px-4 py-3 text-muted">{request.eta ?? "Not set"}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatCurrency(request.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={(nextPage) => syncUrl(nextPage)}
          />
        </>
      )}
    </div>
  );
}

function RequestCard({ request, returnTo }: { request: RequestSearchRow; returnTo: string }) {
  return (
    <Link className="rounded-lg border border-border bg-surface p-4 shadow-sm" href={detailHref(request.id, returnTo)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-accent">{request.request_number ?? "Request"}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(request.status)}`}>
          {request.status}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClass(request.priority)}`}>
          {request.priority}
        </span>
      </div>
      <p className="mt-3 font-semibold leading-6">{request.item_description}</p>
      <dl className="mt-3 grid gap-2 text-sm text-muted">
        <InfoLine label="Requested by" value={request.employee_name ?? "Unknown"} />
        <InfoLine label="Equipment" value={request.equipment_number ?? "Not set"} />
        <InfoLine label="Vendor" value={request.vendor_name ?? request.vendor_name_override ?? "Not set"} />
        <InfoLine label="Requested" value={formatDateTime(request.requested_at)} />
      </dl>
    </Link>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
      <button
        className="h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        Previous
      </button>
      <span className="text-sm text-muted">
        Page {page} of {pageCount}
      </span>
      <button
        className="h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function detailHref(id: string, returnTo: string) {
  return `/requests/${id}?returnTo=${encodeURIComponent(returnTo)}`;
}

function setQueryParam(params: URLSearchParams, key: string, value: string) {
  const cleaned = value.trim();

  if (cleaned) {
    params.set(key, cleaned);
  }
}

const selectClassName =
  "h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
