"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRole } from "@/lib/roles";

export async function login(formData: FormData) {
  const role = String(formData.get("role") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || "Demo User";
  if (!isRole(role)) redirect("/login");
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };
  jar.set("lin_role", role, opts);
  jar.set("lin_name", name, opts);
  redirect("/dashboard");
}

export async function logout() {
  const jar = await cookies();
  jar.delete("lin_role");
  jar.delete("lin_name");
  redirect("/login");
}
