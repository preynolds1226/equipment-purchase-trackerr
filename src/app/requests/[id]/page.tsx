import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RequestDetailClient } from "@/components/request-detail-client";

export default async function RequestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; returnTo?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = query.returnTo ?? "/requests";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Request Details"
        title="Purchase request"
        description="Review the original request, update ordering details, and follow the full activity timeline."
      />
      <RequestDetailClient requestId={id} initialSuccess={query.created === "1"} returnTo={returnTo} />
    </AppShell>
  );
}
