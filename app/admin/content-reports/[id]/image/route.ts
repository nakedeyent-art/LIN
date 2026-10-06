import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/admindb";

/** Admins can view a picture only through a report about its post (and the view is audited). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !s.emailVerified || !s.isAdmin) return new NextResponse(null, { status: 404 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const img = (await db().query(
    `SELECT i.content_type, i.data, p.author_id FROM content_reports r JOIN post_images i ON i.post_id = r.post_id JOIN posts p ON p.id = r.post_id WHERE r.id=$1 AND r.kind='post'`, [id])).rows[0];
  if (!img) return new NextResponse(null, { status: 404 });
  await audit(s.userId, "view_content_image", { userId: img.author_id, detail: `report ${id}` });
  return new NextResponse(new Uint8Array(img.data as Buffer), { headers: { "Content-Type": img.content_type, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Cache-Control": "private, no-store" } });
}
