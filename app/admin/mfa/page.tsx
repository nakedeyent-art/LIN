import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { recoveryRemaining, MFA_MAX_AGE_HOURS } from "@/lib/mfa";
import { Badge, Card, Grid } from "@/components/ui";
import { CodesForm } from "@/components/mfa-ui";
import { regenerateCodes } from "../mfa-actions";

export default async function AdminMfa({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const s = await requireAdmin();
  const left = await recoveryRemaining(s.userId);
  const { msg } = await searchParams;
  return (
    <>
      <h1>Security</h1>
      <div className="tag">Two-factor authentication for {s.email}</div>
      {msg && <p className="ok">{msg}</p>}
      <Grid>
        <Card title="Status" wide>
          <p><Badge tone="green">Two-factor is on</Badge> Admin pages ask for a code once per session and again after {MFA_MAX_AGE_HOURS} hours.</p>
          <p>{left <= 2 ? <Badge tone={left === 0 ? "red" : "yellow"}>{left} recovery code{left === 1 ? "" : "s"} left</Badge> : <Badge tone="gray">{left} recovery codes left</Badge>} {left <= 2 && "Generate new ones below."}</p>
          <p className="muted">Lost your phone and your recovery codes? Whoever runs the server resets it with <code>scripts/reset-admin-mfa.mjs</code>; you then enrol again. Admins can&apos;t turn two-factor off themselves.</p>
        </Card>
        <Card title="New recovery codes" wide>
          <CodesForm action={regenerateCodes} button="Generate new codes" continueHref="/admin/mfa" hint="Enter the current code from your authenticator app. Your old recovery codes stop working." />
        </Card>
      </Grid>
      <p><Link href="/admin">← Overview</Link></p>
    </>
  );
}
