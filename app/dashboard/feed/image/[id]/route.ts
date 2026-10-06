import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPost } from "@/lib/socialdb";

/** Post pictures: only for people who may see the post. Shown inline but sandboxed, never sniffed, never cached by shared caches. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !s.emailVerified) return new NextResponse(null, { status: 401 });
  const id = Number((await ctx.params).id);
  const p = await getPost(s.userId, id);
  if (!p || !p.has_image) return new NextResponse(null, { status: 404 });
  const img = (await db().query("SELECT content_type, data FROM post_images WHERE post_id=$1", [id])).rows[0];
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(img.data as Buffer), { headers: {
    "Content-Type": img.content_type, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Cache-Control": "private, no-store" } });
}
