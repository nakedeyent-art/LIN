import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { capacityOn, getDeal } from "@/lib/dealsdb";
import { markRead, messagesAfter } from "@/lib/messagesdb";
import { toView } from "@/lib/threadview";

/** Live-update feed for the thread page: only messages newer than ?after=, visible to exactly who may see the deal. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !s.emailVerified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const d = await getDeal(s.userId, id);
  const who = d ? await capacityOn(s.userId, d) : null;
  if (!d || !who || (who === "guardian" && !d.athlete_minor)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  const rows = await messagesAfter(id, s.userId, Number.isFinite(after) && after >= 0 ? after : 0);
  if (rows.length) await markRead(id, s.userId);      // the page is open and visible, so these are read
  return NextResponse.json({ messages: rows.map((m) => toView(m, s.userId, who, d)) }, { headers: { "Cache-Control": "no-store" } });
}
