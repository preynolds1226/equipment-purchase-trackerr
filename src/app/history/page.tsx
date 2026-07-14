import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PurchaseHistoryClient } from "@/components/purchase-history-client";

export default function PurchaseHistoryPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Purchase History"
        title="Imported PO history"
        description="Search old purchases by equipment, part, vendor, PO number, or invoice."
      />
      <PurchaseHistoryClient />
    </AppShell>
  );
}
