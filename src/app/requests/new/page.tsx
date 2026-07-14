import { AppShell } from "@/components/app-shell";
import { NewRequestClient } from "@/components/new-request-client";
import { PageHeader } from "@/components/page-header";

export default function NewRequestPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="New Request"
        title="Log a purchase request"
        description="Capture the essentials first. Ordering details can be added later when the item is purchased."
      />
      <NewRequestClient />
    </AppShell>
  );
}
