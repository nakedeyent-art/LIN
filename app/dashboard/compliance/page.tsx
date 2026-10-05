import { requireAccess } from "@/lib/session";
import { Card, Disclaimer, Grid, List } from "@/components/ui";

export default async function Compliance() {
  await requireAccess("/dashboard/compliance");
  return (
    <>
      <h1>Compliance Guardrails</h1>
      <div className="tag">Rules built into the product, not bolted on.</div>
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
