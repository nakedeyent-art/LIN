import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { capacityOn, getDeal } from "@/lib/dealsdb";

/** Download only — never rendered inline, never sniffed, never cached. Visible to the same people as the thread. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) {
  const s = await getSession();
  if (!s || !s.emailVerified) return new NextResponse(null, { status: 401 });
  const { id, aid } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(aid)) return new NextResponse(null, { status: 404 });
  const d = await getDeal(s.userId, id);
  const who = d ? await capacityOn(s.userId, d) : null;
  if (!d || !who || (who === "guardian" && !d.athlete_minor)) return new NextResponse(null, { status: 404 });
  const a = (await db().query(
    `SELECT a.filename, a.content_type, a.data FROM deal_attachments a JOIN deal_messages m ON m.id = a.message_id
      WHERE a.id=$1 AND a.deal_id=$2 AND m.hidden_at IS NULL`, [aid, id])).rows[0];
  if (!a) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(a.data as Buffer), { headers: {
    "Content-Type": a.content_type,
    "Content-Disposition": `attachment; filename="${String(a.filename).replace(/[^A-Za-z0-9 ._-]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "Cache-Control": "private, no-store",
  } });
}
