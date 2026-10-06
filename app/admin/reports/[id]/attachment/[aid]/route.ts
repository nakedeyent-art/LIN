import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/admindb";

/** Admins can fetch only the attachments on a message that someone reported (and the download is audited). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) {
  const s = await getSession();
  if (!s || !s.emailVerified || !s.isAdmin) return new NextResponse(null, { status: 404 });
  const { id, aid } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(aid)) return new NextResponse(null, { status: 404 });
  const a = (await db().query(
    `SELECT a.filename, a.content_type, a.data, a.deal_id, a.uploader_id FROM deal_attachments a JOIN message_reports r ON r.message_id = a.message_id WHERE r.id=$1 AND a.id=$2`, [id, aid])).rows[0];
  if (!a) return new NextResponse(null, { status: 404 });
  await audit(s.userId, "view_attachment", { userId: a.uploader_id, dealId: a.deal_id, detail: `report ${id}, file ${aid}` });
  return new NextResponse(new Uint8Array(a.data as Buffer), { headers: {
    "Content-Type": a.content_type, "Content-Disposition": `attachment; filename="${String(a.filename).replace(/[^A-Za-z0-9 ._-]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Cache-Control": "private, no-store" } });
}
