import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { VendorsClient } from "@/components/vendors-client";

export default function VendorsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Vendors"
        title="Vendor directory"
        description="Keep supplier contact details, sales reps, and ordering notes easy to reach from the shop or office."
      />
      <VendorsClient />
    </AppShell>
  );
}
