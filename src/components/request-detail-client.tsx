"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Field, Message, TextArea, TextInput } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import {
  cleanOptionalText,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPlainNumber,
  getWebsiteHref,
  parseOptionalNumber,
} from "@/lib/format";
import { getPriorityBadgeClass, getStatusBadgeClass, REQUEST_STATUSES } from "@/lib/requests";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database, RequestStatus } from "@/lib/supabase/database.types";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"] & {
  employees: Pick<Database["public"]["Tables"]["employees"]["Row"], "name" | "department"> | null;
  vendors: Pick<Database["public"]["Tables"]["vendors"]["Row"], "name" | "website"> | null;
};
type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
type Activity = Database["public"]["Tables"]["request_activity"]["Row"];
type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];

type DetailForm = {
  vendor_id: string;
  vendorSearch: string;
  status: RequestStatus;
  order_number: string;
  quantity: string;
  unit_cost: string;
  eta: string;
  tracking_number: string;
  tracking_url: string;
  notes: string;
};

const fieldLabels: Record<keyof DetailForm | "total_cost" | "ordered_at" | "received_at", string> = {
  vendor_id: "Vendor",
  vendorSearch: "Vendor",
  status: "Status",
  order_number: "Order number",
  quantity: "Quantity",
  unit_cost: "Unit cost",
  total_cost: "Total cost",
  eta: "ETA",
  tracking_number: "Tracking number",
  tracking_url: "Tracking URL",
  notes: "Notes",
  ordered_at: "Ordered timestamp",
  received_at: "Received timestamp",
};

export function RequestDetailClient({
  requestId,
  initialSuccess,
  returnTo,
}: {
  requestId: string;
  initialSuccess: boolean;
  returnTo: string;
}) {
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [form, setForm] = useState<DetailForm | null>(null);
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(
    initialSuccess ? { kind: "success", text: "Request saved. You can add ordering details here." } : null,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof DetailForm, string>>>({});

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const loadDetail = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setMessage({
        kind: "info",
        text: "Supabase is not configured yet. Add your project URL and anon key to .env.local.",
      });
      return;
    }

    setLoading(true);
    const [requestResult, vendorsResult, activityResult] = await Promise.all([
      supabase
        .from("requests")
        .select("*, employees(name, department), vendors(name, website)")
        .eq("id", requestId)
        .single(),
      supabase.from("vendors").select("*").order("active", { ascending: false }).order("name"),
      supabase
        .from("request_activity")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
    ]);

    if (requestResult.error) {
      setMessage({ kind: "error", text: requestResult.error.message });
      setLoading(false);
      return;
    }

    if (vendorsResult.error) {
      setMessage({ kind: "error", text: vendorsResult.error.message });
      setLoading(false);
      return;
    }

    if (activityResult.error) {
      setMessage({ kind: "error", text: activityResult.error.message });
      setLoading(false);
      return;
    }

    const loadedRequest = requestResult.data as RequestRow;
    setRequest(loadedRequest);
    setVendors((vendorsResult.data ?? []) as Vendor[]);
    setActivity(activityResult.data ?? []);
    setForm({
      vendor_id: loadedRequest.vendor_id ?? "",
      vendorSearch: loadedRequest.vendors?.name ?? loadedRequest.vendor_name_override ?? "",
      status: loadedRequest.status,
      order_number: loadedRequest.order_number ?? "",
      quantity: formatPlainNumber(loadedRequest.quantity),
      unit_cost: formatPlainNumber(loadedRequest.unit_cost),
      eta: loadedRequest.eta ?? "",
      tracking_number: loadedRequest.tracking_number ?? "",
      tracking_url: loadedRequest.tracking_url ?? "",
      notes: loadedRequest.notes ?? "",
    });
    setLoading(false);
  }, [requestId, supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDetail();
    });
  }, [loadDetail]);

  const calculatedTotal = useMemo(() => {
    if (!form) {
      return null;
    }

    const quantity = parseOptionalNumber(form.quantity);
    const unitCost = parseOptionalNumber(form.unit_cost);

    if (quantity === null || unitCost === null || !Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
      return null;
    }

    return quantity * unitCost;
  }, [form]);

  const filteredVendors = vendors.filter((vendor) => {
    const query = form?.vendorSearch.trim().toLowerCase() ?? "";
    if (!query) {
      return true;
    }

    return vendor.name.toLowerCase().includes(query);
  });

  function validate() {
    if (!form) {
      return false;
    }

    const nextErrors: Partial<Record<keyof DetailForm, string>> = {};
    const quantity = parseOptionalNumber(form.quantity);
    const unitCost = parseOptionalNumber(form.unit_cost);

    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      nextErrors.quantity = "Quantity must be a positive number.";
    }

    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      nextErrors.unit_cost = "Unit cost must be a positive number.";
    }

    if (form.tracking_url.trim()) {
      try {
        const url = new URL(getWebsiteHref(form.tracking_url));
        if (!["http:", "https:"].includes(url.protocol)) {
          nextErrors.tracking_url = "Tracking URL must start with http or https.";
        }
      } catch {
        nextErrors.tracking_url = "Enter a valid tracking URL.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function selectVendor(vendor: Vendor) {
    setForm((current) =>
      current
        ? {
            ...current,
            vendor_id: vendor.id,
            vendorSearch: vendor.name,
          }
        : current,
    );
    setVendorPickerOpen(false);
  }

  async function getOrCreateVendor() {
    if (!supabase || !form) {
      throw new Error("Request details are not ready to save.");
    }

    if (form.vendor_id) {
      return {
        vendorId: form.vendor_id,
        vendorList: vendors,
      };
    }

    const typedName = form.vendorSearch.trim();

    if (!typedName) {
      return {
        vendorId: null,
        vendorList: vendors,
      };
    }

    const existingVendor = vendors.find(
      (vendor) => vendor.name.trim().toLowerCase() === typedName.toLowerCase(),
    );

    if (existingVendor) {
      return {
        vendorId: existingVendor.id,
        vendorList: vendors,
      };
    }

    const { data: newVendor, error } = await supabase
      .from("vendors")
      .insert({
        name: typedName,
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const nextVendors = [...vendors, newVendor].sort((a, b) => a.name.localeCompare(b.name));
    setVendors(nextVendors);

    return {
      vendorId: newVendor.id,
      vendorList: nextVendors,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !request || !form) {
      setMessage({ kind: "error", text: "Request details are not ready to save." });
      return;
    }

    if (!validate()) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const quantity = parseOptionalNumber(form.quantity);
    const unitCost = parseOptionalNumber(form.unit_cost);
    const totalCost = quantity !== null && unitCost !== null ? quantity * unitCost : null;
    const now = new Date().toISOString();
    const normalizedTrackingUrl = form.tracking_url.trim() ? getWebsiteHref(form.tracking_url) : null;
    let vendorResult: Awaited<ReturnType<typeof getOrCreateVendor>>;

    try {
      vendorResult = await getOrCreateVendor();
    } catch (vendorError) {
      setMessage({
        kind: "error",
        text: vendorError instanceof Error ? vendorError.message : "Unable to save vendor.",
      });
      setSaving(false);
      return;
    }

    const update: RequestUpdate = {
      vendor_id: vendorResult.vendorId,
      status: form.status,
      order_number: cleanOptionalText(form.order_number),
      quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      eta: form.eta || null,
      tracking_number: cleanOptionalText(form.tracking_number),
      tracking_url: normalizedTrackingUrl,
      notes: cleanOptionalText(form.notes),
    };

    if (request.status !== "Ordered" && form.status === "Ordered" && !request.ordered_at) {
      update.ordered_at = now;
    }

    if (request.status !== "Received" && form.status === "Received" && !request.received_at) {
      update.received_at = now;
    }

    const changes = buildChanges(request, update, vendorResult.vendorList);

    if (changes.length === 0) {
      setMessage({ kind: "info", text: "No changes to save." });
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.from("requests").update(update).eq("id", request.id);

    if (updateError) {
      setMessage({ kind: "error", text: updateError.message });
      setSaving(false);
      return;
    }

    const { error: activityError } = await supabase.from("request_activity").insert(
      changes.map((change) => ({
        request_id: request.id,
        action: `${change.label} changed`,
        field_name: change.field,
        old_value: change.oldValue,
        new_value: change.newValue,
      })),
    );

    if (activityError) {
      setMessage({ kind: "error", text: activityError.message });
      setSaving(false);
      return;
    }

    await loadDetail();
    setMessage({ kind: "success", text: "Request updated and timeline recorded." });
    setSaving(false);
  }

  if (loading) {
    return <LoadingState title="Loading request" description="Getting request details and activity from Supabase." />;
  }

  if (!request || !form) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <EmptyState title="Request not found" description="The request could not be loaded." />
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
              {request.request_number ?? "Request"}
            </p>
            <h2 className="mt-2 text-xl font-bold">{request.item_description}</h2>
            <p className="mt-2 text-sm text-muted">
              Requested by {request.employees?.name ?? "Unknown employee"} on {formatDateTime(request.requested_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(request.status)}`}>
              {request.status}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityBadgeClass(request.priority)}`}>
              {request.priority}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyItem label="Equipment" value={request.equipment_number ?? "Not set"} />
          <ReadOnlyItem label="Vendor" value={request.vendors?.name ?? request.vendor_name_override ?? "Not set"} />
          <ReadOnlyItem label="Quantity" value={formatPlainNumber(request.quantity) || "Not set"} />
          <ReadOnlyItem label="Unit cost" value={formatCurrency(request.unit_cost)} />
          <ReadOnlyItem label="Total cost" value={formatCurrency(request.total_cost)} />
          <ReadOnlyItem label="ETA" value={request.eta ? formatDate(request.eta) : "Not set"} />
          <ReadOnlyItem label="Ordered" value={request.ordered_at ? formatDateTime(request.ordered_at) : "Not set"} />
          <ReadOnlyItem label="Received" value={request.received_at ? formatDateTime(request.received_at) : "Not set"} />
          <ReadOnlyItem label="Order number" value={request.order_number ?? "Not set"} />
          <ReadOnlyItem label="Tracking" value={request.tracking_number ?? "Not set"} />
          <ReadOnlyItem label="Tracking link" value={request.tracking_url ?? "Not set"} href={request.tracking_url ?? undefined} />
          <ReadOnlyItem label="Notes" value={request.notes ?? "Not set"} />
        </div>
      </section>

      <form className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-base font-semibold">Update purchasing details</h2>
          <p className="text-sm text-muted">Status timestamps and total cost are calculated automatically.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Vendor">
            <div className="relative">
              <TextInput
                value={form.vendorSearch}
                onChange={(event) => {
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          vendor_id: "",
                          vendorSearch: event.target.value,
                        }
                      : current,
                  );
                  setVendorPickerOpen(true);
                }}
                onFocus={() => setVendorPickerOpen(true)}
                placeholder="Type vendor name or search existing vendors"
              />
              {vendorPickerOpen ? (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg">
                  {filteredVendors.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted">
                      No vendor found. This vendor will be added when you save.
                    </div>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <button
                        className="block w-full rounded px-3 py-3 text-left text-sm hover:bg-surface-muted"
                        key={vendor.id}
                        onClick={() => selectVendor(vendor)}
                        type="button"
                      >
                        <span className="font-semibold">{vendor.name}</span>
                        {!vendor.active ? <span className="block text-muted">Inactive vendor</span> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              {!form.vendor_id && form.vendorSearch.trim() ? (
                <p className="mt-2 text-sm text-muted">
                  If this vendor is not already listed, it will be added automatically.
                </p>
              ) : null}
            </div>
          </Field>

          <Field label="Status">
            <select
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={form.status}
              onChange={(event) => setForm((current) => current ? { ...current, status: event.target.value as RequestStatus } : current)}
            >
              {REQUEST_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </Field>

          <Field label="Order number">
            <TextInput
              value={form.order_number}
              onChange={(event) => setForm((current) => current ? { ...current, order_number: event.target.value } : current)}
            />
          </Field>

          <Field label="ETA">
            <TextInput
              type="date"
              value={form.eta}
              onChange={(event) => setForm((current) => current ? { ...current, eta: event.target.value } : current)}
            />
          </Field>

          <Field label="Quantity" error={errors.quantity}>
            <TextInput
              inputMode="decimal"
              min="0"
              step="any"
              type="number"
              value={form.quantity}
              onChange={(event) => setForm((current) => current ? { ...current, quantity: event.target.value } : current)}
            />
          </Field>

          <Field label="Unit cost" error={errors.unit_cost}>
            <TextInput
              inputMode="decimal"
              min="0"
              step="any"
              type="number"
              value={form.unit_cost}
              onChange={(event) => setForm((current) => current ? { ...current, unit_cost: event.target.value } : current)}
            />
          </Field>

          <Field label="Tracking number">
            <TextInput
              value={form.tracking_number}
              onChange={(event) => setForm((current) => current ? { ...current, tracking_number: event.target.value } : current)}
            />
          </Field>

          <Field label="Tracking URL" error={errors.tracking_url}>
            <TextInput
              inputMode="url"
              value={form.tracking_url}
              onChange={(event) => setForm((current) => current ? { ...current, tracking_url: event.target.value } : current)}
              placeholder="https://..."
            />
          </Field>
        </div>

        <div className="rounded-md border border-dashed border-border bg-surface-muted p-3 text-sm text-muted">
          Calculated total cost: {formatCurrency(calculatedTotal)}
        </div>

        <Field label="Notes">
          <TextArea
            value={form.notes}
            onChange={(event) => setForm((current) => current ? { ...current, notes: event.target.value } : current)}
          />
        </Field>

        <div className="sticky bottom-[4.75rem] z-10 rounded-lg border border-border bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-4 lg:flex lg:justify-end">
          <button
            className="h-12 w-full rounded-md bg-accent px-4 text-base font-semibold text-accent-foreground disabled:opacity-60 lg:w-auto"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving changes..." : "Save changes"}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Activity timeline</h2>
          <Link className="text-sm font-semibold text-accent" href={returnTo}>
            Back to requests
          </Link>
        </div>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Changes will appear here after the request is updated." />
        ) : (
          <ol className="grid gap-3">
            {activity.map((item) => (
              <li className="rounded-md border border-border bg-background p-3" key={item.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.action}</p>
                    {item.field_name ? (
                      <p className="mt-1 text-sm text-muted">
                        {fieldLabels[item.field_name as keyof typeof fieldLabels] ?? item.field_name}:{" "}
                        {item.old_value ?? "blank"} to {item.new_value ?? "blank"}
                      </p>
                    ) : null}
                  </div>
                  <time className="text-xs text-muted">{formatDateTime(item.created_at)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ReadOnlyItem({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      {href ? (
        <a className="mt-1 block break-words text-sm font-semibold text-accent hover:underline" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <p className="mt-1 break-words text-sm font-semibold">{value}</p>
      )}
    </div>
  );
}

function buildChanges(request: RequestRow, update: RequestUpdate, vendors: Vendor[]) {
  const vendorNameById = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const requestValues: Record<string, string | null> = {
    vendor_id: request.vendor_id ? vendorNameById.get(request.vendor_id) ?? request.vendor_id : null,
    status: request.status,
    order_number: request.order_number,
    quantity: formatNullableNumber(request.quantity),
    unit_cost: formatNullableNumber(request.unit_cost),
    total_cost: formatNullableNumber(request.total_cost),
    eta: request.eta,
    tracking_number: request.tracking_number,
    tracking_url: request.tracking_url,
    notes: request.notes,
    ordered_at: request.ordered_at,
    received_at: request.received_at,
  };

  const updateValues: Record<string, string | null> = {
    vendor_id: update.vendor_id ? vendorNameById.get(update.vendor_id) ?? update.vendor_id : null,
    status: update.status ?? null,
    order_number: update.order_number ?? null,
    quantity: formatNullableNumber(update.quantity ?? null),
    unit_cost: formatNullableNumber(update.unit_cost ?? null),
    total_cost: formatNullableNumber(update.total_cost ?? null),
    eta: update.eta ?? null,
    tracking_number: update.tracking_number ?? null,
    tracking_url: update.tracking_url ?? null,
    notes: update.notes ?? null,
    ordered_at: update.ordered_at ?? request.ordered_at,
    received_at: update.received_at ?? request.received_at,
  };

  return Object.keys(updateValues)
    .filter((field) => requestValues[field] !== updateValues[field])
    .map((field) => ({
      field,
      label: fieldLabels[field as keyof typeof fieldLabels] ?? field,
      oldValue: requestValues[field],
      newValue: updateValues[field],
    }));
}

function formatNullableNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}
