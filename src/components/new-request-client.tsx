"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, Message, TextArea, TextInput } from "@/components/forms";
import { cleanOptionalText, parseOptionalNumber } from "@/lib/format";
import { REQUEST_PRIORITIES } from "@/lib/requests";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database, EquipmentSummary, RequestPriority } from "@/lib/supabase/database.types";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
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

type RequestForm = {
  requested_by_employee_id: string;
  employeeSearch: string;
  item_description: string;
  equipment_number: string;
  quantity: string;
  priority: RequestPriority;
  notes: string;
};

const emptyForm: RequestForm = {
  requested_by_employee_id: "",
  employeeSearch: "",
  item_description: "",
  equipment_number: "",
  quantity: "",
  priority: "This Week",
  notes: "",
};

export function NewRequestClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEquipmentNumber = searchParams.get("equipment") ?? "";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<RequestForm>({
    ...emptyForm,
    equipment_number: initialEquipmentNumber,
  });
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
  const [equipmentMatches, setEquipmentMatches] = useState<EquipmentSummary[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof RequestForm, string>>>({});

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const loadEmployees = useCallback(async () => {
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
      .from("employees")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setEmployees(data ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadEmployees();
    });
  }, [loadEmployees]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const query = form.equipment_number.trim();
    if (query.length < 2) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setLoadingEquipment(true);
      const pattern = `%${query.replaceAll(",", " ")}%`;
      void supabase
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
        .limit(50)
        .then(({ data, error }) => {
          if (cancelled) {
            return;
          }

          setEquipmentMatches(error ? [] : rankEquipmentMatches(data ?? [], query).slice(0, 8));
          setLoadingEquipment(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.equipment_number, supabase]);

  const filteredEmployees = employees.filter((employee) => {
    const query = form.employeeSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [employee.name, employee.department ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  function selectEmployee(employee: Employee) {
    setForm((current) => ({
      ...current,
      requested_by_employee_id: employee.id,
      employeeSearch: employee.department
        ? `${employee.name} - ${employee.department}`
        : employee.name,
    }));
    setEmployeePickerOpen(false);
    setErrors((current) => ({ ...current, requested_by_employee_id: undefined }));
  }

  function selectEquipment(item: EquipmentSummary) {
    setForm((current) => ({
      ...current,
      equipment_number: item.equipment_number,
    }));
    setEquipmentPickerOpen(false);
  }

  function validate() {
    const nextErrors: Partial<Record<keyof RequestForm, string>> = {};
    const quantity = form.quantity.trim() ? Number(form.quantity) : null;

    if (!form.employeeSearch.trim()) {
      nextErrors.requested_by_employee_id = "Type or choose the employee requesting this item.";
    }

    if (!form.item_description.trim()) {
      nextErrors.item_description = "Item description is required.";
    }

    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      nextErrors.quantity = "Quantity must be a positive number.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function getOrCreateEmployeeId() {
    if (!supabase) {
      throw new Error("Supabase environment variables are missing.");
    }

    if (form.requested_by_employee_id) {
      return form.requested_by_employee_id;
    }

    const typedName = form.employeeSearch.trim();
    const existingEmployee = employees.find(
      (employee) => employee.name.trim().toLowerCase() === typedName.toLowerCase(),
    );

    if (existingEmployee) {
      return existingEmployee.id;
    }

    const { data: newEmployee, error } = await supabase
      .from("employees")
      .insert({
        name: typedName,
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    setEmployees((current) => [...current, newEmployee].sort((a, b) => a.name.localeCompare(b.name)));
    return newEmployee.id;
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

    let requestedByEmployeeId = "";

    try {
      requestedByEmployeeId = await getOrCreateEmployeeId();
    } catch (employeeError) {
      setMessage({
        kind: "error",
        text: employeeError instanceof Error ? employeeError.message : "Unable to save employee.",
      });
      setSaving(false);
      return;
    }

    const { data: request, error } = await supabase
      .from("requests")
      .insert({
        requested_by_employee_id: requestedByEmployeeId,
        item_description: form.item_description.trim(),
        equipment_number: cleanOptionalText(form.equipment_number),
        quantity: parseOptionalNumber(form.quantity),
        priority: form.priority,
        status: "Need to Order",
        notes: cleanOptionalText(form.notes),
      })
      .select()
      .single();

    if (error) {
      setMessage({ kind: "error", text: error.message });
      setSaving(false);
      return;
    }

    const activityText = `Created request ${request.request_number ?? "without a request number"}`;
    const { error: activityError } = await supabase.from("request_activity").insert({
      request_id: request.id,
      action: activityText,
      field_name: "request",
      old_value: null,
      new_value: request.request_number,
    });

    if (activityError) {
      setMessage({ kind: "error", text: activityError.message });
      setSaving(false);
      return;
    }

    setMessage({ kind: "success", text: `Saved ${request.request_number}. Opening details...` });
    router.push(`/requests/${request.id}?created=1`);
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Requested By" error={errors.requested_by_employee_id}>
            <div className="relative">
              <TextInput
                className="h-12 text-base"
                disabled={loading}
                value={form.employeeSearch}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    requested_by_employee_id: "",
                    employeeSearch: event.target.value,
                  }));
                  setEmployeePickerOpen(true);
                }}
                onFocus={() => setEmployeePickerOpen(true)}
                placeholder={loading ? "Loading employees..." : "Type a name or search existing employees"}
              />
              {employeePickerOpen ? (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted">
                      No employee found. This name will be added when you save.
                    </div>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <button
                        className="block w-full rounded px-3 py-3 text-left text-sm hover:bg-surface-muted"
                        key={employee.id}
                        onClick={() => selectEmployee(employee)}
                        type="button"
                      >
                        <span className="font-semibold">{employee.name}</span>
                        {employee.department ? (
                          <span className="block text-muted">{employee.department}</span>
                        ) : null}
                        {!employee.active ? (
                          <span className="block text-muted">Inactive employee</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              {!form.requested_by_employee_id && form.employeeSearch.trim() ? (
                <p className="mt-2 text-sm text-muted">
                  If this name is not already listed, it will be added automatically.
                </p>
              ) : null}
            </div>
          </Field>

          <Field label="Equipment or Truck Number">
            <div className="relative">
              <TextInput
                className="h-12 text-base"
                value={form.equipment_number}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setForm((current) => ({ ...current, equipment_number: nextValue }));
                  if (nextValue.trim().length < 2) {
                    setEquipmentMatches([]);
                    setLoadingEquipment(false);
                  }
                  setEquipmentPickerOpen(true);
                }}
                onFocus={() => setEquipmentPickerOpen(true)}
                placeholder="Type UT2000, 2000, truck number..."
              />
              {equipmentPickerOpen && form.equipment_number.trim().length >= 2 ? (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg">
                  {loadingEquipment ? (
                    <div className="px-3 py-3 text-sm text-muted">Searching equipment...</div>
                  ) : equipmentMatches.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted">
                      No imported equipment found. The typed number will still be saved.
                    </div>
                  ) : (
                    equipmentMatches.map((item) => (
                      <button
                        className="block w-full rounded px-3 py-3 text-left text-sm hover:bg-surface-muted"
                        key={`${item.source}-${item.equipment_number}-${item.id ?? "new-request"}`}
                        onClick={() => selectEquipment(item)}
                        type="button"
                      >
                        <span className="font-semibold">{item.equipment_number}</span>
                        <span className="block text-muted">{equipmentDescription(item)}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <p className="mt-2 text-sm text-muted">
                Pick imported equipment when it appears, or type a new number.
              </p>
            </div>
          </Field>
        </div>

        <Field label="Item Description" error={errors.item_description}>
          <TextArea
            className="min-h-32 text-base"
            value={form.item_description}
            onChange={(event) => setForm((current) => ({ ...current, item_description: event.target.value }))}
            placeholder="Part, tool, supply, or repair item..."
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Quantity" error={errors.quantity}>
            <TextInput
              className="h-12 text-base"
              inputMode="decimal"
              min="0"
              step="any"
              type="number"
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="1"
            />
          </Field>

          <Field label="Priority">
            <select
              className="h-12 w-full rounded-md border border-border bg-background px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({ ...current, priority: event.target.value as RequestPriority }))
              }
            >
              {REQUEST_PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <TextArea
            className="min-h-28 text-base"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Anything purchasing should know..."
          />
        </Field>

        <div className="rounded-md border border-dashed border-border bg-surface-muted p-3 text-sm text-muted">
          Requested date and time will be recorded automatically. Status starts as Need to Order.
        </div>
      </section>

      <div className="sticky bottom-[4.75rem] z-10 rounded-lg border border-border bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <button
          className="h-12 w-full rounded-md bg-accent px-4 text-base font-semibold text-accent-foreground disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving request..." : "Save request"}
        </button>
      </div>
    </form>
  );
}

function equipmentDescription(item: EquipmentSummary) {
  const details = [item.model_year, item.make, item.model].filter(Boolean).join(" ");

  if (details) {
    return details;
  }

  return item.description ?? item.driver ?? "Imported equipment";
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
