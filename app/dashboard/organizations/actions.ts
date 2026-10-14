"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import * as org from "@/lib/organizations";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (r: org.Result, ok?: string): never => redirect(`/dashboard/organizations?${r.ok ? "msg" : "error"}=${encodeURIComponent(r.ok ? r.message ?? ok ?? "Done." : r.error)}`);

export async function createOrganization(form: FormData) {
  const s = await requireUser();
  back(await org.createOrganization(s.userId, str(form, "name")), "Organization created.");
}
export async function inviteOrganizationMember(form: FormData) {
  const s = await requireUser();
  back(await org.inviteMember(s.userId, str(form, "organization_id"), str(form, "email")));
}
export async function respondOrganizationInvite(form: FormData) {
  const s = await requireUser();
  const accept = form.get("accept") === "1";
  back(await org.respondInvite(s.userId, str(form, "invite_id"), accept), accept ? "You joined the organization." : "Invitation declined.");
}
export async function revokeOrganizationInvite(form: FormData) {
  const s = await requireUser();
  back(await org.revokeInvite(s.userId, str(form, "invite_id")), "Invitation cancelled.");
}
export async function removeOrganizationMember(form: FormData) {
  const s = await requireUser();
  back(await org.removeMember(s.userId, str(form, "organization_id"), str(form, "user_id")), "Member removed.");
}
export async function leaveOrganization(form: FormData) {
  const s = await requireUser();
  back(await org.leaveOrganization(s.userId, str(form, "organization_id")), "You left the organization.");
}
export async function setOrganizationRole(form: FormData) {
  const s = await requireUser();
  const role = str(form, "role") === "owner" ? "owner" : "member";
  back(await org.setRole(s.userId, str(form, "organization_id"), str(form, "user_id"), role), role === "owner" ? "Owner added." : "Role updated.");
}
export async function archiveOrganization(form: FormData) {
  const s = await requireUser();
  const archive = str(form, "archive") === "1";
  back(await org.setArchived(s.userId, str(form, "organization_id"), archive), archive ? "Organization archived." : "Organization restored.");
}
