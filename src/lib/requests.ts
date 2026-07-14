import type { RequestPriority, RequestStatus } from "@/lib/supabase/database.types";

export const REQUEST_STATUSES: RequestStatus[] = [
  "Need to Order",
  "Ordered",
  "Waiting on Vendor",
  "Backordered",
  "Shipped",
  "Received",
  "Cancelled",
];

export const REQUEST_PRIORITIES: RequestPriority[] = [
  "Emergency",
  "Today",
  "This Week",
  "Whenever",
];

export function getStatusBadgeClass(status: RequestStatus) {
  switch (status) {
    case "Need to Order":
      return "bg-yellow-100 text-yellow-950 dark:bg-yellow-950/40 dark:text-yellow-100";
    case "Ordered":
    case "Waiting on Vendor":
      return "bg-blue-100 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100";
    case "Backordered":
      return "bg-orange-100 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100";
    case "Shipped":
      return "bg-purple-100 text-purple-950 dark:bg-purple-950/40 dark:text-purple-100";
    case "Received":
      return "bg-green-100 text-green-950 dark:bg-green-950/40 dark:text-green-100";
    case "Cancelled":
      return "bg-surface-muted text-muted";
    default:
      return "bg-surface-muted text-muted";
  }
}

export function getPriorityBadgeClass(priority: RequestPriority) {
  switch (priority) {
    case "Emergency":
      return "bg-red-100 text-red-950 dark:bg-red-950/40 dark:text-red-100";
    case "Today":
      return "bg-orange-100 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100";
    case "This Week":
      return "bg-blue-100 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100";
    case "Whenever":
      return "bg-surface-muted text-muted";
    default:
      return "bg-surface-muted text-muted";
  }
}
