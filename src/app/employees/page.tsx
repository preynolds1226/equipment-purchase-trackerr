import { AppShell } from "@/components/app-shell";
import { EmployeesClient } from "@/components/employees-client";
import { PageHeader } from "@/components/page-header";

export default function EmployeesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Employees"
        title="Requesting employees"
        description="Manage the people who request parts, tools, and supplies for repair work."
      />
      <EmployeesClient />
    </AppShell>
  );
}
