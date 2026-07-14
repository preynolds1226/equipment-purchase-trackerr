import type { ComponentPropsWithoutRef, ReactNode } from "react";

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-700 dark:text-red-300">{error}</span> : null}
    </label>
  );
}

export function TextInput(props: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${
        props.className ?? ""
      }`}
    />
  );
}

export function TextArea(props: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Message({
  kind,
  children,
}: {
  kind: "success" | "error" | "info";
  children: ReactNode;
}) {
  const styles = {
    success:
      "border-green-300 bg-green-50 text-green-950 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100",
    error:
      "border-red-300 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
    info: "border-border bg-surface-muted text-muted",
  };

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${styles[kind]}`} role="status">
      {children}
    </div>
  );
}
