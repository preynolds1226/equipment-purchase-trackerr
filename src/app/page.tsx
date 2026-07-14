import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Shop purchasing at a glance"
        description="Track the parts, tools, and supplies your repair team needs without losing the thread between request and delivery."
      />
      <DashboardClient />
    </AppShell>
  );
}
