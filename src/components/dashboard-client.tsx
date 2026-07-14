"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Message } from "@/components/forms";
import { EmptyState, LoadingState } from "@/components/ui-states";
import { formatDateTime } from "@/lib/format";
import { getPriorityBadgeClass, getStatusBadgeClass } from "@/lib/requests";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import type {
  DashboardActivity,
  DashboardRequest,
  Database,
} from "@/lib/supabase/database.types";

type DashboardData = Database["public"]["Functions"]["get_purchasing_dashboard"]["Returns"];

const today = new Date().toLocaleDateString("en-CA");

const summaryCards = [
  { key: "need_to_order", label: "Need to Order", href: "/requests?status=Need+to+Order" },
  { key: "ordered", label: "Ordered", href: "/requests?status=Ordered" },
  { key: "waiting_on_vendor", label: "Waiting on Vendor", href: "/requests?status=Waiting+on+Vendor" },
  { key: "backordered", label: "Backordered", href: "/requests?status=Backordered" },
  { key: "arriving_today", label: "Arriving Today", href: `/requests?etaFrom=${today}&etaTo=${today}` },
  { key: "overdue_eta", label: "Overdue ETA", href: "/requests?overdueEta=1&sort=eta" },
  { key: "received_today", label: "Received Today", href: `/requests?status=Received&completed=1&receivedFrom=${today}&receivedTo=${today}` },
] as const;

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setMessage({
        kind: "info",
        text: "Supabase is not configured yet. Add your project URL and anon key to .env.local.",
      });
      return;
    }

    setLoading(true);
    const { data: dashboard, error } = await supabase.rpc("get_purchasing_dashboard", {
      p_today: today,
    });

    if (error) {
      setMessage({ kind: "error", text: error.message });
      setData(null);
    } else {
      setData(dashboard);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDashboard();
    });
  }, [loadDashboard]);

  if (loading) {
    return <LoadingState title="Loading dashboard" description="Getting live purchasing numbers from Supabase." />;
  }

  const counts = data?.counts ?? {};

  return (
    <div className="grid gap-5">
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {summaryCards.map((card) => (
          <Link
            className="rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:border-accent"
            href={card.href}
            key={card.key}
          >
            <p className="text-sm font-medium text-muted">{card.label}</p>
            <p className="mt-3 text-3xl font-bold">{counts[card.key] ?? 0}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <DashboardRequestSection
          title="Emergency requests"
          description="Open requests marked Emergency."
          empty="No emergency requests right now."
          requests={data?.emergency_requests ?? []}
          viewAllHref="/requests?priority=Emergency"
        />
        <DashboardRequestSection
          title="Oldest needs to order"
          description="Oldest requests still waiting for ordering."
          empty="No requests are waiting to be ordered."
          requests={data?.oldest_need_to_order ?? []}
          viewAllHref="/requests?status=Need+to+Order&sort=oldest"
        />
        <DashboardRequestSection
          title="Overdue ETAs"
          description="Open requests with ETAs before today."
          empty="No overdue ETAs."
          requests={data?.overdue_etas ?? []}
          viewAllHref="/requests?overdueEta=1&sort=eta"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ActivitySection activity={data?.recent_activity ?? []} />
        <GroupSection
          title="Open requests by employee"
          empty="No open employee request groups."
          groups={(data?.open_by_employee ?? []).map((item) => ({
            id: item.employee_id,
            label: item.employee_name,
            count: item.request_count,
            href: item.employee_id ? `/requests?employee=${item.employee_id}` : "/requests?q=Unknown",
          }))}
        />
        <GroupSection
          title="Open requests by vendor"
          empty="No open vendor request groups."
          groups={(data?.open_by_vendor ?? []).map((item) => ({
            id: item.vendor_id,
            label: item.vendor_name,
            count: item.request_count,
            href: item.vendor_id ? `/requests?vendor=${item.vendor_id}` : "/requests?vendor=&q=No+vendor+selected",
          }))}
        />
      </section>
    </div>
  );
}

function DashboardRequestSection({
  title,
  description,
  empty,
  requests,
  viewAllHref,
}: {
  title: string;
  description: string;
  empty: string;
  requests: DashboardRequest[];
  viewAllHref: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <SectionHeader title={title} description={description} href={viewAllHref} />
      {requests.length === 0 ? (
        <EmptyState title={empty} description="Nothing needs attention in this section." />
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <Link className="rounded-md border border-border bg-background p-3 hover:border-accent" href={`/requests/${request.id}`} key={request.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-accent">{request.request_number ?? "Request"}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(request.status)}`}>
                  {request.status}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClass(request.priority)}`}>
                  {request.priority}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6">{request.item_description}</p>
              <p className="mt-1 text-sm text-muted">
                {request.employee_name ?? "Unknown employee"}
                {request.equipment_number ? ` - ${request.equipment_number}` : ""}
                {request.vendor_name ? ` - ${request.vendor_name}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                Requested {formatDateTime(request.requested_at)}
                {request.eta ? ` - ETA ${request.eta}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivitySection({ activity }: { activity: DashboardActivity[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <SectionHeader title="Recent activity" description="Latest request changes." href="/requests" />
      {activity.length === 0 ? (
        <EmptyState title="No recent activity" description="Request changes will appear here." />
      ) : (
        <div className="grid gap-3">
          {activity.map((item) => (
            <Link className="rounded-md border border-border bg-background p-3 hover:border-accent" href={`/requests/${item.request_id}`} key={item.id}>
              <p className="font-semibold">{item.action}</p>
              <p className="mt-1 text-sm text-muted">
                {item.request_number ?? "Request"} - {item.item_description}
              </p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(item.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupSection({
  title,
  empty,
  groups,
}: {
  title: string;
  empty: string;
  groups: Array<{ id: string | null; label: string; count: number; href: string }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <SectionHeader title={title} description="Open request workload." href="/requests" />
      {groups.length === 0 ? (
        <EmptyState title={empty} description="Open requests will appear here when available." />
      ) : (
        <div className="grid gap-2">
          {groups.map((group) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 hover:border-accent"
              href={group.href}
              key={`${group.label}-${group.id ?? "none"}`}
            >
              <span className="font-semibold">{group.label}</span>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-bold">{group.count}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <Link className="shrink-0 text-sm font-semibold text-accent" href={href}>
        View
      </Link>
    </div>
  );
}
