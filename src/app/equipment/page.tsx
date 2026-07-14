import { AppShell } from "@/components/app-shell";
import { EquipmentClient } from "@/components/equipment-client";
import { PageHeader } from "@/components/page-header";

export default function EquipmentPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Equipment"
        title="Equipment home"
        description="Search a truck or unit number to see current requests, old PO history, and parts ordered before."
      />
      <EquipmentClient />
    </AppShell>
  );
}
