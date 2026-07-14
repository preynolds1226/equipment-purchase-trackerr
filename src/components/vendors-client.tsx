"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Field, Message, TextArea, TextInput } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import {
  cleanOptionalText,
  formatDateTime,
  getPhoneHref,
  getWebsiteHref,
} from "@/lib/format";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];

type VendorForm = {
  name: string;
  phone: string;
  email: string;
  website: string;
  sales_rep: string;
  notes: string;
};

const emptyForm: VendorForm = {
  name: "",
  phone: "",
  email: "",
  website: "",
  sales_rep: "",
  notes: "",
};

export function VendorsClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof VendorForm, string>>>({});

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const loadVendors = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setMessage({
        kind: "info",
        text: "Supabase is not configured yet. Add your project URL and anon key to .env.local.",
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setVendors(data ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadVendors();
    });
  }, [loadVendors]);

  const visibleVendors = vendors.filter((vendor) => {
    if (!showInactive && !vendor.active) {
      return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [
      vendor.name,
      vendor.phone ?? "",
      vendor.email ?? "",
      vendor.website ?? "",
      vendor.sales_rep ?? "",
      vendor.notes ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });

  function validate() {
    const nextErrors: Partial<Record<keyof VendorForm, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Vendor name is required.";
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (form.website.trim()) {
      try {
        const url = new URL(getWebsiteHref(form.website));
        if (!["http:", "https:"].includes(url.protocol)) {
          nextErrors.website = "Website must start with http or https.";
        }
      } catch {
        nextErrors.website = "Enter a valid website.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function startEdit(vendor: Vendor) {
    setEditing(vendor);
    setForm({
      name: vendor.name,
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      website: vendor.website ?? "",
      sales_rep: vendor.sales_rep ?? "",
      notes: vendor.notes ?? "",
    });
    setErrors({});
    setMessage(null);
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage({ kind: "error", text: "Supabase environment variables are missing." });
      return;
    }

    if (!validate()) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = {
      name: form.name.trim(),
      phone: cleanOptionalText(form.phone),
      email: cleanOptionalText(form.email),
      website: form.website.trim() ? getWebsiteHref(form.website) : null,
      sales_rep: cleanOptionalText(form.sales_rep),
      notes: cleanOptionalText(form.notes),
    };

    const result = editing
      ? await supabase.from("vendors").update(payload).eq("id", editing.id).select().single()
      : await supabase.from("vendors").insert(payload).select().single();

    if (result.error) {
      setMessage({ kind: "error", text: result.error.message });
    } else {
      await loadVendors();
      resetForm();
      setMessage({
        kind: "success",
        text: editing ? "Vendor updated." : "Vendor added.",
      });
    }

    setSaving(false);
  }

  async function setVendorActive(vendor: Vendor, active: boolean) {
    if (!supabase) {
      setMessage({ kind: "error", text: "Supabase environment variables are missing." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("vendors").update({ active }).eq("id", vendor.id);

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      await loadVendors();
      setMessage({
        kind: "success",
        text: active ? "Vendor restored." : "Vendor marked inactive.",
      });
    }

    setSaving(false);
  }

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <Field label="Search vendors">
            <TextInput
              type="search"
              placeholder="Name, rep, phone, email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-base font-semibold">{editing ? "Edit vendor" : "Add vendor"}</h2>
          <p className="text-sm text-muted">Inactive vendors stay in history but are hidden by default.</p>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Vendor name" error={errors.name}>
              <TextInput
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Vendor name"
              />
            </Field>
            <Field label="Sales representative">
              <TextInput
                value={form.sales_rep}
                onChange={(event) => setForm((current) => ({ ...current, sales_rep: event.target.value }))}
                placeholder="Rep name"
              />
            </Field>
            <Field label="Phone">
              <TextInput
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="(555) 555-5555"
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <TextInput
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="parts@example.com"
              />
            </Field>
            <Field label="Website" error={errors.website}>
              <TextInput
                inputMode="url"
                value={form.website}
                onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                placeholder="vendor.com"
              />
            </Field>
          </div>
          <Field label="Notes">
            <TextArea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Account number, delivery notes, ordering preferences..."
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {editing ? (
              <button
                className="h-11 rounded-md border border-border px-4 text-sm font-semibold"
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>
            ) : null}
            <button
              className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Add vendor"}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <LoadingState title="Loading vendors" description="Getting vendor records from Supabase." />
      ) : visibleVendors.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <EmptyState title="No vendors found" description="Add a vendor or adjust the search and inactive filters." />
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:hidden">
            {visibleVendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                saving={saving}
                onEdit={startEdit}
                onSetActive={setVendorActive}
              />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Rep</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{vendor.name}</div>
                      {vendor.website ? (
                        <a className="text-sm text-accent hover:underline" href={getWebsiteHref(vendor.website)} target="_blank" rel="noreferrer">
                          {vendor.website}
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <VendorLinks vendor={vendor} />
                    </td>
                    <td className="px-4 py-3 text-muted">{vendor.sales_rep ?? "No rep listed"}</td>
                    <td className="px-4 py-3">
                      <StatusPill active={vendor.active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-md border border-border px-3 py-2 font-semibold" onClick={() => startEdit(vendor)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-border px-3 py-2 font-semibold"
                          disabled={saving}
                          onClick={() => setVendorActive(vendor, !vendor.active)}
                          type="button"
                        >
                          {vendor.active ? "Mark inactive" : "Restore"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function VendorCard({
  vendor,
  saving,
  onEdit,
  onSetActive,
}: {
  vendor: Vendor;
  saving: boolean;
  onEdit: (vendor: Vendor) => void;
  onSetActive: (vendor: Vendor, active: boolean) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{vendor.name}</h2>
          <p className="text-sm text-muted">{vendor.sales_rep ? `Rep: ${vendor.sales_rep}` : "No rep listed"}</p>
        </div>
        <StatusPill active={vendor.active} />
      </div>
      <div className="mt-3">
        <VendorLinks vendor={vendor} />
      </div>
      {vendor.notes ? <p className="mt-3 text-sm leading-6 text-muted">{vendor.notes}</p> : null}
      <p className="mt-3 text-xs text-muted">Updated {formatDateTime(vendor.updated_at)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="h-10 rounded-md border border-border text-sm font-semibold" onClick={() => onEdit(vendor)} type="button">
          Edit
        </button>
        <button
          className="h-10 rounded-md border border-border text-sm font-semibold"
          disabled={saving}
          onClick={() => onSetActive(vendor, !vendor.active)}
          type="button"
        >
          {vendor.active ? "Inactive" : "Restore"}
        </button>
      </div>
    </article>
  );
}

function VendorLinks({ vendor }: { vendor: Vendor }) {
  const phoneHref = vendor.phone ? getPhoneHref(vendor.phone) : "";
  const websiteHref = vendor.website ? getWebsiteHref(vendor.website) : "";

  return (
    <div className="grid gap-1 text-sm">
      {vendor.phone && phoneHref ? (
        <a className="text-accent hover:underline" href={phoneHref}>
          {vendor.phone}
        </a>
      ) : null}
      {vendor.email ? (
        <a className="text-accent hover:underline" href={`mailto:${vendor.email}`}>
          {vendor.email}
        </a>
      ) : null}
      {vendor.website && websiteHref ? (
        <a className="text-accent hover:underline md:hidden" href={websiteHref} target="_blank" rel="noreferrer">
          {vendor.website}
        </a>
      ) : null}
      {!vendor.phone && !vendor.email && !vendor.website ? (
        <span className="text-muted">No contact info</span>
      ) : null}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-100"
          : "bg-surface-muted text-muted"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
