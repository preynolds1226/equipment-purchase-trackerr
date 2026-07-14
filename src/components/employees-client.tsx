"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Field, Message, TextInput } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import { cleanOptionalText, formatDateTime } from "@/lib/format";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Employee = Database["public"]["Tables"]["employees"]["Row"];

type EmployeeForm = {
  name: string;
  department: string;
};

const emptyForm: EmployeeForm = {
  name: "",
  department: "",
};

export function EmployeesClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeForm, string>>>({});

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

  const visibleEmployees = employees.filter((employee) => {
    if (!showInactive && !employee.active) {
      return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [employee.name, employee.department ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  function validate() {
    const nextErrors: Partial<Record<keyof EmployeeForm, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Employee name is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function startEdit(employee: Employee) {
    setEditing(employee);
    setForm({
      name: employee.name,
      department: employee.department ?? "",
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
      department: cleanOptionalText(form.department),
    };

    const result = editing
      ? await supabase.from("employees").update(payload).eq("id", editing.id).select().single()
      : await supabase.from("employees").insert(payload).select().single();

    if (result.error) {
      setMessage({ kind: "error", text: result.error.message });
    } else {
      await loadEmployees();
      resetForm();
      setMessage({
        kind: "success",
        text: editing ? "Employee updated." : "Employee added.",
      });
    }

    setSaving(false);
  }

  async function setEmployeeActive(employee: Employee, active: boolean) {
    if (!supabase) {
      setMessage({ kind: "error", text: "Supabase environment variables are missing." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("employees").update({ active }).eq("id", employee.id);

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      await loadEmployees();
      setMessage({
        kind: "success",
        text: active ? "Employee restored." : "Employee marked inactive.",
      });
    }

    setSaving(false);
  }

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <Field label="Search employees">
            <TextInput
              type="search"
              placeholder="Name or department..."
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
          <h2 className="text-base font-semibold">{editing ? "Edit employee" : "Add employee"}</h2>
          <p className="text-sm text-muted">Inactive employees stay in history but are hidden by default.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
          <Field label="Name" error={errors.name}>
            <TextInput
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Employee name"
            />
          </Field>
          <Field label="Department">
            <TextInput
              value={form.department}
              onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
              placeholder="Shop, parts, service..."
            />
          </Field>
          <div className="flex flex-col gap-2 md:justify-end">
            <button
              className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Add employee"}
            </button>
            {editing ? (
              <button
                className="h-11 rounded-md border border-border px-4 text-sm font-semibold"
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {loading ? (
        <LoadingState title="Loading employees" description="Getting employee records from Supabase." />
      ) : visibleEmployees.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <EmptyState title="No employees found" description="Add an employee or adjust the search and inactive filters." />
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:hidden">
            {visibleEmployees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                saving={saving}
                onEdit={startEdit}
                onSetActive={setEmployeeActive}
              />
            ))}
          </section>

          <section className="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-4 py-3 font-semibold">{employee.name}</td>
                    <td className="px-4 py-3 text-muted">{employee.department ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <StatusPill active={employee.active} />
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(employee.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-md border border-border px-3 py-2 font-semibold" onClick={() => startEdit(employee)} type="button">
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-border px-3 py-2 font-semibold"
                          disabled={saving}
                          onClick={() => setEmployeeActive(employee, !employee.active)}
                          type="button"
                        >
                          {employee.active ? "Mark inactive" : "Restore"}
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

function EmployeeCard({
  employee,
  saving,
  onEdit,
  onSetActive,
}: {
  employee: Employee;
  saving: boolean;
  onEdit: (employee: Employee) => void;
  onSetActive: (employee: Employee, active: boolean) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{employee.name}</h2>
          <p className="text-sm text-muted">{employee.department ?? "Unassigned"}</p>
        </div>
        <StatusPill active={employee.active} />
      </div>
      <p className="mt-3 text-xs text-muted">Updated {formatDateTime(employee.updated_at)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="h-10 rounded-md border border-border text-sm font-semibold" onClick={() => onEdit(employee)} type="button">
          Edit
        </button>
        <button
          className="h-10 rounded-md border border-border text-sm font-semibold"
          disabled={saving}
          onClick={() => onSetActive(employee, !employee.active)}
          type="button"
        >
          {employee.active ? "Inactive" : "Restore"}
        </button>
      </div>
    </article>
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
