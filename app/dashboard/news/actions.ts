"use server";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { parseFilter } from "@/lib/news";
import { savePrefs } from "@/lib/newsdb";

export async function saveNewsFilters(formData: FormData) {
  const s = await requireAccess("/dashboard/news");
  const f = parseFilter((k) => formData.getAll(k).map(String));
  await savePrefs(s.userId, f);
  redirect("/dashboard/news?saved=1");
}
export async function clearNewsFilters() {
  const s = await requireAccess("/dashboard/news");
  await savePrefs(s.userId, { categories: [], levels: [], sports: [], q: "", days: 30 });
  redirect("/dashboard/news?all=1");
}
