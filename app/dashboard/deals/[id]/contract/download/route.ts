import { getSession } from "@/lib/session";
import { capacityOn, getDeal } from "@/lib/dealsdb";
import { getContract } from "@/lib/contractdb";
import { renderSignaturePage } from "@/lib/contract";

/** The exact agreement text plus its signature page, for parties and (current) guardians only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  const { id } = await params;
  if (!s || !s.emailVerified) return new Response("Unauthorized", { status: 401 });
  const d = await getDeal(s.userId, id);
  const k = d && (await capacityOn(s.userId, d)) ? await getContract(id) : null;
  if (!k) return new Response("Not found", { status: 404 });
  const text = `${k.body}\n\n${renderSignaturePage(k.sha256, k.signatures.map((x) => ({ role: x.role, typedName: x.typedName, signedAt: x.signedAt.toISOString(), consentVersion: x.consentVersion })))}\n${k.executedAt ? `\nFULLY EXECUTED ${k.executedAt.toISOString()}` : k.voidedAt ? "\nVOIDED" : "\nNOT YET EXECUTED"}\n`;
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="agreement-${id.slice(0, 8)}.txt"`, "Cache-Control": "no-store" },
  });
}
