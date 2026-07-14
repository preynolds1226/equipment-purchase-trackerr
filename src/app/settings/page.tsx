import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Settings"
        title="Tracker settings"
        description="Theme, account, and company setup controls will live here."
      />
      <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted p-3">
          <div>
            <h2 className="text-sm font-semibold">Theme support</h2>
            <p className="text-sm text-muted">The interface follows the device light or dark preference.</p>
          </div>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted">
            Ready
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted p-3">
          <div>
            <h2 className="text-sm font-semibold">Supabase connection</h2>
            <p className="text-sm text-muted">Database and authentication setup is planned for the next phase.</p>
          </div>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted">
            Not connected
          </span>
        </div>
      </section>
    </AppShell>
  );
}
