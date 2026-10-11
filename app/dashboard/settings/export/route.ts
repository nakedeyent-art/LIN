import { getSession } from "@/lib/session";
import { buildExport } from "@/lib/data-export";

/** POST (not GET) so a link on another site can't trigger it. Returns only the signed-in user's own data. */
export async function POST() {
  const s = await getSession();
  if (!s || !s.emailVerified) return new Response("Unauthorized", { status: 401 });
  const data = await buildExport(s.userId);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lin-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
