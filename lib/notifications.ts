/** Pure notification rules: kinds, safe links, wording. Text never contains amounts or message bodies. */
export type NotificationKind = "deal" | "message" | "payment" | "guardian" | "account";
export const KIND_LABEL: Record<NotificationKind, string> = { deal: "Deals", message: "Messages", payment: "Payments", guardian: "Family", account: "Account" };
export const NOTIFICATION_RETENTION_DAYS = 90;
export const PAGE_SIZE = 50;

/** In-app links must stay inside the dashboard. */
export const isSafeHref = (h: string | null | undefined): h is string =>
  !!h && h.startsWith("/dashboard") && !h.startsWith("//") && !/[\\\r\n]/.test(h);

export const messageTitle = (dealTitle: string, count: number) =>
  count > 1 ? `${count} new messages on "${dealTitle}"` : `New message on "${dealTitle}"`;

export const countLabel = (n: number) => (n > 99 ? "99+" : String(n));
