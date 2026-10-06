"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { markAllRead, markOneRead } from "@/lib/notificationsdb";
import { isSafeHref } from "@/lib/notifications";

export async function openNotification(formData: FormData) {
  const s = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) redirect("/dashboard/notifications");
  const href = await markOneRead(s.userId, id);
  redirect(isSafeHref(href) ? href : "/dashboard/notifications");
}

export async function markAllNotificationsRead() {
  const s = await requireUser();
  await markAllRead(s.userId);
  redirect("/dashboard/notifications");
}
