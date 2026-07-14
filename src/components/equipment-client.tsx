"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Field, Message, TextArea, TextInput } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import { cleanOptionalText, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { getPriorityBadgeClass, getStatusBadgeClass } from "@/lib/requests";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type {
  Database,
  EquipmentPurchaseHistory,
  EquipmentRequestHistory,
  EquipmentSearchResult,
  EquipmentSummary,
} from "@/lib/supabase/database.types";

type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];
type EquipmentLookupRow = Pick<
  EquipmentRow,
  | "id"
  | "equipment_number"
  | "description"
  | "active"
  | "prefix"
  | "unit_number"
  | "make"
  | "model"
  | "model_year"
  | "serial_number"
  | "driver"
  | "inspection_required"
  | "last_service_date"
  | "last_service_mileage"
  | "parts_ordered"
  | "notes"
>;

type EquipmentDetailForm = {
  description: string;
  make: string;
  model: string;
  model_year: string;
  serial_number: string;
  driver: string;
  inspection_required: string;
  last_service_date: string;
  last_service_mileage: string;
  parts_ordered: string;
  notes: string;
  active: boolean;
};

export function EquipmentClient() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [result, setResult] = useState<EquipmentSearchResult | null>(null);
  const [selectedEquipmentNumber, setSelectedEquipmentNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const searchEquipmentTable = useCallback(
    async (query: string) => {
      if (!supabase) {
        return [];
      }

      const pattern = `%${query.replaceAll(",", " ")}%`;
      const { data } = await supabase
        .from("equipment")
        .select(
          "id, equipment_number, description, active, prefix, unit_number, make, model, model_year, serial_number, driver, inspection_required, last_service_date, last_service_mileage, parts_ordered, notes",
        )
        .or(
          [
            `equipment_number.ilike.${pattern}`,
            `unit_number.ilike.${pattern}`,
            `prefix.ilike.${pattern}`,
            `description.ilike.${pattern}`,
            `make.ilike.${pattern}`,
            `model.ilike.${pattern}`,
            `serial_number.ilike.${pattern}`,
            `driver.ilike.${pattern}`,
            `parts_ordered.ilike.${pattern}`,
            `notes.ilike.${pattern}`,
          ].join(","),
        )
        .limit(50);

      return rankEquipmentMatches(data ?? [], query).slice(0, 50);
    },
    [supabase],
  );

  const loadEquipment = useCallback(
    async (query: string) => {
      if (!supabase) {
        setLoading(false);
        setMessage({
          kind: "info",
          text: "Supabase is not configured yet. Add your project URL and anon key to .env.local.",
        });
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.rpc("search_equipment_with_parts", {
        p_search: cleanOptionalText(query),
        p_limit: 50,
      });

      if (error) {
        setMessage({ kind: "error", text: error.message });
        setResult(null);
      } else {
        const nextResult = data;
        if ((nextResult?.equipment ?? []).length === 0 && query.trim()) {
          const fallbackEquipment = await searchEquipmentTable(query);
          setResult({
            equipment: fallbackEquipment,
            requests: nextResult?.requests ?? [],
            purchase_history: nextResult?.purchase_history ?? [],
          });
        } else {
          setResult(nextResult);
        }
      }

      setLoading(false);
    },
    [searchEquipmentTable, supabase],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadEquipment("");
    });
  }, [loadEquipment]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadEquipment(search);
  }

  const equipment = result?.equipment ?? [];
  const requests = result?.requests ?? [];
  const purchaseHistory = result?.purchase_history ?? [];
  const groupedRequests = groupByEquipment(requests);
  const groupedPurchases = groupPurchasesByEquipment(purchaseHistory);
  const selectedEquipment =
    equipment.find((item) => item.equipment_number === selectedEquipmentNumber) ?? equipment[0] ?? null;
  const selectedKey = selectedEquipment ? normalizeEquipment(selectedEquipment.equipment_number) : "";
  const selectedRequests = groupedRequests.get(selectedKey) ?? [];
  const selectedPurchases = groupedPurchases.get(selectedKey) ?? [];

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleSearch}>
          <Field label="Search equipment number">
            <TextInput
              autoComplete="off"
              placeholder="Type UT2000, 2000, truck number..."
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <button className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground md:self-end" type="submit">
            Search
          </button>
        </form>
        <p className="mt-3 text-sm text-muted">
          Search is partial, so typing 2000 will find UT2000 and other matching unit numbers.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          className="rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-accent"
          href={`/requests/new${search ? `?equipment=${encodeURIComponent(search)}` : ""}`}
        >
          <div className="text-sm font-semibold text-accent">New request</div>
          <div className="mt-1 text-sm text-muted">Start an order for this equipment.</div>
        </Link>
        <Link
          className="rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-accent"
          href={`/requests${search ? `?equipment=${encodeURIComponent(search)}` : ""}`}
        >
          <div className="text-sm font-semibold text-accent">Open requests</div>
          <div className="mt-1 text-sm text-muted">See current work tied to this number.</div>
        </Link>
        <Link
          className="rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-accent"
          href={`/history${search ? `?q=${encodeURIComponent(search)}` : ""}`}
        >
          <div className="text-sm font-semibold text-accent">PO history</div>
          <div className="mt-1 text-sm text-muted">Review what was ordered before.</div>
        </Link>
      </section>

      {loading ? (
        <LoadingState title="Loading equipment" description="Searching equipment and ordered parts history." />
      ) : equipment.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <EmptyState title="No equipment found" description="Try a unit number, truck number, or imported equipment ID." />
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {equipment.map((item) => (
            <EquipmentCard
              key={`${item.source}-${item.equipment_number}-${item.id ?? "generated"}`}
              item={item}
              requestCount={groupedRequests.get(normalizeEquipment(item.equipment_number))?.length ?? 0}
              purchaseCount={groupedPurchases.get(normalizeEquipment(item.equipment_number))?.length ?? 0}
              selected={selectedEquipment?.equipment_number === item.equipment_number}
              onSelect={() => setSelectedEquipmentNumber(item.equipment_number)}
            />
          ))}
        </section>
      )}

      {selectedEquipment ? (
        <EquipmentDetailPanel
          key={`${selectedEquipment.id ?? selectedEquipment.equipment_number}`}
          item={selectedEquipment}
          onSaved={(updated) => {
            setResult((current) => {
              if (!current) {
                return current;
              }

              return {
                ...current,
                equipment: (current.equipment ?? []).map((equipmentItem) =>
                  equipmentItem.id === updated.id
                    ? {
                        ...equipmentItem,
                        ...updated,
                        source: "equipment",
                      }
                    : equipmentItem,
                ),
              };
            });
          }}
        />
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <SectionTitle
          title={selectedEquipment ? `Parts and requests for ${selectedEquipment.equipment_number}` : "Parts and requests by equipment"}
          description="Requests and imported purchase history tied to the selected equipment number."
        />
        {!selectedEquipment || (selectedRequests.length === 0 && selectedPurchases.length === 0) ? (
          <EmptyState title="No parts history yet" description="Matching request and purchase history will appear here." />
        ) : (
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold">{selectedEquipment.equipment_number}</h2>
              <Link className="text-sm font-semibold text-accent" href={`/requests?equipment=${encodeURIComponent(selectedEquipment.equipment_number)}`}>
                Open requests
              </Link>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <HistoryList requests={selectedRequests} />
              <PurchaseHistoryList purchases={selectedPurchases} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EquipmentCard({
  item,
  requestCount,
  purchaseCount,
  selected,
  onSelect,
}: {
  item: EquipmentSummary;
  requestCount: number;
  purchaseCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`rounded-lg border bg-surface p-4 shadow-sm ${selected ? "border-accent" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{item.equipment_number}</h2>
          <p className="mt-1 text-sm text-muted">{equipmentDescription(item)}</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted">
          {item.active ? "Active" : "Inactive"}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        <InfoLine label="Serial" value={item.serial_number ?? "Not listed"} />
        <InfoLine label="Driver/notes" value={item.driver ?? "Not listed"} />
        <InfoLine label="Last service" value={item.last_service_date ? formatDate(item.last_service_date) : "Not listed"} />
        <InfoLine label="Mileage/hours" value={item.last_service_mileage === null ? "Not listed" : String(item.last_service_mileage)} />
      </dl>
      {item.parts_ordered ? (
        <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm text-muted">
          Parts ordered: {item.parts_ordered}
        </p>
      ) : null}
      {item.notes ? (
        <p className="mt-3 rounded-md bg-surface-muted p-3 text-sm text-muted">
          Notes: {item.notes}
        </p>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-surface-muted p-3">
          <dt className="text-muted">Requests</dt>
          <dd className="mt-1 text-xl font-bold">{requestCount}</dd>
        </div>
        <div className="rounded-md bg-surface-muted p-3">
          <dt className="text-muted">Purchases</dt>
          <dd className="mt-1 text-xl font-bold">{purchaseCount}</dd>
        </div>
      </dl>
      <button
        className="mt-4 h-10 w-full rounded-md border border-border text-sm font-semibold text-accent"
        onClick={onSelect}
        type="button"
      >
        {selected ? "Selected" : "View details"}
      </button>
    </article>
  );
}

function EquipmentDetailPanel({
  item,
  onSaved,
}: {
  item: EquipmentSummary;
  onSaved: (updated: EquipmentRow) => void;
}) {
  const [form, setForm] = useState<EquipmentDetailForm>(() => equipmentToForm(item));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  async function saveEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !item.id) {
      setMessage({
        kind: "error",
        text: "This equipment record cannot be edited because it was found only from request or PO history.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("equipment")
      .update({
        description: cleanOptionalText(form.description),
        make: cleanOptionalText(form.make),
        model: cleanOptionalText(form.model),
        model_year: cleanOptionalText(form.model_year),
        serial_number: cleanOptionalText(form.serial_number),
        driver: cleanOptionalText(form.driver),
        inspection_required: cleanOptionalText(form.inspection_required),
        last_service_date: cleanOptionalText(form.last_service_date),
        last_service_mileage: form.last_service_mileage.trim()
          ? Number(form.last_service_mileage)
          : null,
        parts_ordered: cleanOptionalText(form.parts_ordered),
        notes: cleanOptionalText(form.notes),
        active: form.active,
      })
      .eq("id", item.id)
      .select()
      .single();

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      onSaved(data);
      setMessage({ kind: "success", text: "Equipment details saved." });
    }

    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Equipment Details
          </div>
          <h2 className="mt-1 text-xl font-bold">{item.equipment_number}</h2>
          <p className="mt-1 text-sm text-muted">{equipmentDescription(item)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="grid h-10 place-items-center rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground"
            href={`/requests/new?equipment=${encodeURIComponent(item.equipment_number)}`}
          >
            New request
          </Link>
          <Link
            className="grid h-10 place-items-center rounded-md border border-border px-3 text-sm font-semibold text-accent"
            href={`/history?q=${encodeURIComponent(item.equipment_number)}`}
          >
            PO history
          </Link>
        </div>
      </div>

      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <form className="mt-4 grid gap-4" onSubmit={saveEquipment}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyDetail label="Equipment number" value={item.equipment_number} />
          <ReadOnlyDetail label="Prefix" value={item.prefix ?? "Not listed"} />
          <ReadOnlyDetail label="Unit number" value={item.unit_number ?? "Not listed"} />
          <ReadOnlyDetail label="Imported from" value={item.source} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Make">
            <TextInput value={form.make} onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))} />
          </Field>
          <Field label="Model">
            <TextInput value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
          </Field>
          <Field label="Year">
            <TextInput value={form.model_year} onChange={(event) => setForm((current) => ({ ...current, model_year: event.target.value }))} />
          </Field>
          <Field label="Serial number">
            <TextInput value={form.serial_number} onChange={(event) => setForm((current) => ({ ...current, serial_number: event.target.value }))} />
          </Field>
          <Field label="Inspection">
            <TextInput value={form.inspection_required} onChange={(event) => setForm((current) => ({ ...current, inspection_required: event.target.value }))} />
          </Field>
          <Field label="Active">
            <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium">
              <input
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                type="checkbox"
              />
              Show as active equipment
            </label>
          </Field>
          <Field label="Last service date">
            <TextInput type="date" value={form.last_service_date} onChange={(event) => setForm((current) => ({ ...current, last_service_date: event.target.value }))} />
          </Field>
          <Field label="Mileage / hours">
            <TextInput inputMode="decimal" type="number" value={form.last_service_mileage} onChange={(event) => setForm((current) => ({ ...current, last_service_mileage: event.target.value }))} />
          </Field>
        </div>

        <Field label="Description">
          <TextArea className="min-h-24" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>

        <Field label="Driver / assigned location">
          <TextArea className="min-h-24" value={form.driver} onChange={(event) => setForm((current) => ({ ...current, driver: event.target.value }))} />
        </Field>

        <Field label="Parts ordered">
          <TextArea
            className="min-h-28"
            value={form.parts_ordered}
            onChange={(event) => setForm((current) => ({ ...current, parts_ordered: event.target.value }))}
            placeholder="Parts commonly ordered or notes from the equipment import..."
          />
        </Field>

        <Field label="Shop notes">
          <TextArea
            className="min-h-32"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Anything the shop should remember about this equipment..."
          />
        </Field>

        <button
          className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-fit"
          disabled={saving || !item.id}
          type="submit"
        >
          {saving ? "Saving..." : "Save equipment details"}
        </button>
      </form>
    </section>
  );
}

function ReadOnlyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function HistoryList({ requests }: { requests: EquipmentRequestHistory[] }) {
  return (
    <section>
      <SectionTitle title="Requests" description="Purchase requests for this equipment." />
      {requests.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted">No requests yet.</p>
      ) : (
        <div className="grid gap-2">
          {requests.map((request) => (
            <Link className="rounded-md border border-border bg-surface p-3 hover:border-accent" href={`/requests/${request.id}`} key={request.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-accent">{request.request_number ?? "Request"}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(request.status)}`}>
                  {request.status}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClass(request.priority)}`}>
                  {request.priority}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold">{request.item_description}</p>
              <p className="mt-1 text-xs text-muted">
                {request.vendor_name ?? request.vendor_name_override ?? "No vendor"} - {formatDateTime(request.requested_at)} - {formatCurrency(request.total_cost)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PurchaseHistoryList({ purchases }: { purchases: EquipmentPurchaseHistory[] }) {
  return (
    <section>
      <SectionTitle title="Imported purchase history" description="Rows imported from your Excel purchasing history." />
      {purchases.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted">No imported purchases yet.</p>
      ) : (
        <div className="grid gap-2">
          {purchases.map((purchase) => (
            <article className="rounded-md border border-border bg-surface p-3" key={purchase.id}>
              <p className="text-sm font-semibold">{purchase.part_description ?? purchase.part_number ?? "Part"}</p>
              <p className="mt-1 text-xs text-muted">
                {purchase.vendor_name ?? "No vendor"} - {purchase.purchase_date ?? "No date"} - {formatCurrency(purchase.total_cost)}
              </p>
              <p className="mt-1 text-xs text-muted">
                PO {purchase.po_number ?? "none"} - Invoice {purchase.invoice_number ?? "none"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function groupByEquipment(requests: EquipmentRequestHistory[]) {
  return requests.reduce((map, request) => {
    const key = normalizeEquipment(request.equipment_number ?? "");
    const items = map.get(key) ?? [];
    items.push(request);
    map.set(key, items);
    return map;
  }, new Map<string, EquipmentRequestHistory[]>());
}

function groupPurchasesByEquipment(purchases: EquipmentPurchaseHistory[]) {
  return purchases.reduce((map, purchase) => {
    const key = normalizeEquipment(purchase.equipment_number ?? "");
    const items = map.get(key) ?? [];
    items.push(purchase);
    map.set(key, items);
    return map;
  }, new Map<string, EquipmentPurchaseHistory[]>());
}

function normalizeEquipment(value: string) {
  return value.trim().toLowerCase();
}

function sourceLabel(source: EquipmentSummary["source"]) {
  switch (source) {
    case "equipment":
      return "Imported equipment record";
    case "requests":
      return "Found from request history";
    case "purchase_history":
      return "Found from purchase history";
    default:
      return "Equipment";
  }
}

function equipmentDescription(item: EquipmentSummary) {
  const details = [item.model_year, item.make, item.model].filter(Boolean).join(" ");

  if (details) {
    return details;
  }

  return item.description ?? sourceLabel(item.source);
}

function rankEquipmentMatches(rows: EquipmentLookupRow[], query: string): EquipmentSummary[] {
  const normalizedQuery = normalizeSearch(query);

  return [...rows]
    .sort((a, b) => {
      const aRank = equipmentRank(a, normalizedQuery);
      const bRank = equipmentRank(b, normalizedQuery);

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      return a.equipment_number.localeCompare(b.equipment_number, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map((row) => ({
      id: row.id,
      equipment_number: row.equipment_number,
      description: row.description,
      active: row.active,
      prefix: row.prefix,
      unit_number: row.unit_number,
      make: row.make,
      model: row.model,
      model_year: row.model_year,
      serial_number: row.serial_number,
      driver: row.driver,
      inspection_required: row.inspection_required,
      last_service_date: row.last_service_date,
      last_service_mileage: row.last_service_mileage,
      parts_ordered: row.parts_ordered,
      notes: row.notes,
      source: "equipment",
    }));
}

function equipmentToForm(item: EquipmentSummary): EquipmentDetailForm {
  return {
    description: item.description ?? "",
    make: item.make ?? "",
    model: item.model ?? "",
    model_year: item.model_year ?? "",
    serial_number: item.serial_number ?? "",
    driver: item.driver ?? "",
    inspection_required: item.inspection_required ?? "",
    last_service_date: item.last_service_date ?? "",
    last_service_mileage: item.last_service_mileage === null ? "" : String(item.last_service_mileage),
    parts_ordered: item.parts_ordered ?? "",
    notes: item.notes ?? "",
    active: item.active,
  };
}

function equipmentRank(row: EquipmentLookupRow, normalizedQuery: string) {
  const equipmentNumber = normalizeSearch(row.equipment_number);
  const unitNumber = normalizeSearch(row.unit_number ?? "");

  if (equipmentNumber === normalizedQuery || unitNumber === normalizedQuery) {
    return 0;
  }

  if (equipmentNumber.startsWith(normalizedQuery) || unitNumber.startsWith(normalizedQuery)) {
    return 1;
  }

  if (equipmentNumber.includes(normalizedQuery) || unitNumber.includes(normalizedQuery)) {
    return 2;
  }

  return 3;
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "");
}
