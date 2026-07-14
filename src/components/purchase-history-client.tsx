"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Field, Message, TextInput } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import { cleanOptionalText, formatCurrency, formatDate } from "@/lib/format";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type PurchaseHistory = Database["public"]["Tables"]["purchase_history"]["Row"];

const PAGE_SIZE = 30;

export function PurchaseHistoryClient() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("q") ?? "";
  const [rows, setRows] = useState<PurchaseHistory[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const loadHistory = useCallback(
    async (nextPage = page) => {
      if (!supabase) {
        setLoading(false);
        setMessage({
          kind: "info",
          text: "Supabase is not configured yet. Add your project URL and anon key to .env.local.",
        });
        return;
      }

      setLoading(true);
      const from = (nextPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const queryText = cleanOptionalText(search);

      let query = supabase
        .from("purchase_history")
        .select("*")
        .order("purchase_date", { ascending: false, nullsFirst: false })
        .order("imported_at", { ascending: false })
        .range(from, to);

      if (queryText) {
        const safeSearch = queryText.replaceAll(",", " ");
        const pattern = `%${safeSearch}%`;
        query = query.or(
          [
            `equipment_number.ilike.${pattern}`,
            `part_description.ilike.${pattern}`,
            `part_number.ilike.${pattern}`,
            `vendor_name.ilike.${pattern}`,
            `po_number.ilike.${pattern}`,
            `invoice_number.ilike.${pattern}`,
            `notes.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (fromDate) {
        query = query.gte("purchase_date", fromDate);
      }

      if (toDate) {
        query = query.lte("purchase_date", toDate);
      }

      const { data, error } = await query;

      if (error) {
        setMessage({ kind: "error", text: error.message });
        setRows([]);
        setHasMore(false);
      } else {
        const nextRows = data ?? [];
        setRows(nextRows.slice(0, PAGE_SIZE));
        setHasMore(nextRows.length > PAGE_SIZE);
      }

      setLoading(false);
    },
    [fromDate, page, search, supabase, toDate],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadHistory(1);
    });
  }, [loadHistory]);

  function applySearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setPage(1);
    void loadHistory(1);
  }

  function clearSearch() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    void loadHistory(nextPage);
  }

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <form className="grid gap-4" onSubmit={applySearch}>
          <Field label="Search purchase history">
            <TextInput
              placeholder="Equipment, part, vendor, PO number, invoice..."
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
            <Field label="Purchased from">
              <TextInput type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </Field>
            <Field label="Purchased to">
              <TextInput type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </Field>
            <button className="h-11 rounded-md border border-border px-4 text-sm font-semibold" onClick={clearSearch} type="button">
              Clear
            </button>
            <button className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <LoadingState title="Loading purchase history" description="Searching imported PO records." />
      ) : rows.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <EmptyState title="No purchases found" description="Try a broader part, equipment, PO, or vendor search." />
        </section>
      ) : (
        <>
          <section className="grid gap-3 lg:hidden">
            {rows.map((row) => (
              <PurchaseCard key={row.id} row={row} />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-sm lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3">Part</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">PO</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr className="transition hover:bg-surface-muted" key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.part_description ?? row.part_number ?? "Part"}</div>
                      <div className="mt-1 text-xs text-muted">{row.part_number ?? "No part number"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.equipment_number ? (
                        <Link className="font-semibold text-accent" href={`/equipment?search=${encodeURIComponent(row.equipment_number)}`}>
                          {row.equipment_number}
                        </Link>
                      ) : (
                        <span className="text-muted">Not listed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.vendor_name ?? "Not listed"}</td>
                    <td className="px-4 py-3 text-muted">{formatPurchaseDate(row.purchase_date)}</td>
                    <td className="px-4 py-3 text-muted">{row.po_number ?? "Not listed"}</td>
                    <td className="px-4 py-3 text-right text-muted">{formatCurrency(row.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
            <button
              className="h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
              type="button"
            >
              Previous
            </button>
            <span className="text-sm text-muted">Page {page}</span>
            <button
              className="h-10 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-50"
              disabled={!hasMore}
              onClick={() => changePage(page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PurchaseCard({ row }: { row: PurchaseHistory }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{row.part_description ?? row.part_number ?? "Part"}</p>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted">
          {formatCurrency(row.total_cost)}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-muted">
        <InfoLine label="Equipment" value={row.equipment_number ?? "Not listed"} />
        <InfoLine label="Vendor" value={row.vendor_name ?? "Not listed"} />
        <InfoLine label="Date" value={formatPurchaseDate(row.purchase_date)} />
        <InfoLine label="PO" value={row.po_number ?? "Not listed"} />
        <InfoLine label="Invoice" value={row.invoice_number ?? "Not listed"} />
      </dl>
      {row.equipment_number ? (
        <Link
          className="mt-4 grid h-10 place-items-center rounded-md border border-border text-sm font-semibold text-accent"
          href={`/equipment?search=${encodeURIComponent(row.equipment_number)}`}
        >
          Open equipment history
        </Link>
      ) : null}
    </article>
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

function formatPurchaseDate(value: string | null) {
  return value ? formatDate(value) : "Not listed";
}
