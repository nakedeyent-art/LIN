import { createHash } from "node:crypto";
import { authorizeCron } from "@/lib/jobs/adulthood";
import { runDaily } from "@/lib/jobs/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Trigger for the scheduled jobs. Call daily with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this
 * automatically when CRON_SECRET is set). Refuses to run at all if the secret is missing or short.
 * `?dry=1` reports what would happen without sending mail or changing anything.
 */
async function handle(req: Request) {
  const auth = authorizeCron(req.headers.get("authorization"), process.env.CRON_SECRET, digest);
  if (auth === "unconfigured") return Response.json({ error: "CRON_SECRET is not configured (min 16 chars)" }, { status: 503 });
  if (auth === "denied") return Response.json({ error: "unauthorized" }, { status: 401 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const summary = await runDaily({ dry });
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
