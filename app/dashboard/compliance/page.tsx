import { requireAccess } from "@/lib/session";
import { Card, Disclaimer, Grid, List } from "@/components/ui";
import { TaxEstimator } from "@/components/tax-estimator";
import { CollectiveAuditSuite } from "@/components/collective-audit";
import { StateEligibilityChecker } from "@/components/state-eligibility-checker";
import { TaxEscrowCenter } from "@/components/tax-escrow-center";
import { InstitutionalDisclosureHub } from "@/components/institutional-disclosure-hub";
import { HouseRevSharingPortal } from "@/components/house-rev-sharing-portal";
import { SocialFtcAuditor } from "@/components/social-ftc-auditor";
import { VisaSafeHarborCard } from "@/components/visa-safe-harbor-card";
import { loadRealCollectiveGrants } from "@/lib/collective-audit-server";

export default async function Compliance() {
  await requireAccess("/dashboard/compliance");
  const grants = await loadRealCollectiveGrants();
  return (
    <>
      <h1>Compliance & Financial Guardrails</h1>
      <div className="tag">Rules built into the product, not bolted on.</div>
      <StateEligibilityChecker />
      <TaxEscrowCenter />
      <InstitutionalDisclosureHub />
      <HouseRevSharingPortal />
      <SocialFtcAuditor />
      <VisaSafeHarborCard />
      <CollectiveAuditSuite initialGrants={grants} />
      <TaxEstimator />

      <Grid>
        <Card title="Agent & SPARTA">
          <p>Managers must declare a role: Marketing Agent, Certified Strength Coach, or Mentor. Agency agreements disclose all representation terms.</p>
        </Card>
        <Card title="High-School Season Toggle">
          <p>In-season, training is limited to recovery, injury prevention and skill work; school coaches own primary load.</p>
        </Card>
        <Card title="Safety & Liability">
          <List items={["Credentialed sources only (CSCS/NSCA, Registered Dietitian)", "No sub-BMR calorie targets for minors", "Disclaimer acceptance recorded per athlete/guardian"]} />
        </Card>
        <Card title="Minors & Consent">
          <p>Guardian approval required on deals and data sharing for athletes under 18.</p>
        </Card>
      </Grid>
      <Disclaimer>This product provides workflow support, not legal advice. Have counsel review rules for each state/association before launch.</Disclaimer>
    </>
  );
}
