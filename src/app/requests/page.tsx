import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RequestsListClient } from "@/components/requests-list-client";

export default function RequestsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Requests"
        title="Purchase requests"
        description="Search and filter requests by item, employee, truck number, vendor, or status."
      />
      <RequestsListClient />
    </AppShell>
  );
}
