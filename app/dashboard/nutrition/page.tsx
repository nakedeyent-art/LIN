import { requireAccess } from "@/lib/session";
import { Card, Disclaimer, Grid, List, Stat } from "@/components/ui";
import { athlete, compliance14d, mealPlan } from "@/lib/mock";
import { bmr, dailyCalories, macroSplit } from "@/lib/calc";

export default async function Nutrition() {
  await requireAccess("/dashboard/nutrition");
  const base = bmr(athlete.weightKg, athlete.heightCm, athlete.age, "male");
  const kcal = dailyCalories(base, 1.7, "lean_fast_twitch", athlete.isMinor);
  const m = macroSplit(kcal, "lean_fast_twitch");
  return (
    <>
      <h1>Competition Nutrition</h1>
      <div className="tag">Target profile: Lean Fast-Twitch &amp; Aerobic Capacity ({athlete.position})</div>
      <Grid>
        <Card title="Daily Targets">
          <Stat label="Calories" value={`${m.calories}`} hint={`BMR ${base} kcal x 1.7 activity`} />
          <Stat label="Protein / Carbs / Fats" value={`${m.protein}g / ${m.carbs}g / ${m.fats}g`} />
        </Card>
        <Card title="Compliance"><Stat label="Macro compliance, last 14 days" value={`${compliance14d}%`} /></Card>
        <Card title="Today's Roadmap" wide>
          <List items={mealPlan.map((x) => <><strong>{x.time}</strong> — {x.name}: {x.detail}</>)} />
        </Card>
        <Card title="Tools"><List items={["Photo food logging with AI macro estimate (planned)", "Dietary presets: vegan, gluten-free, dairy-free, nut allergy", "Grocery list", "Hydration & electrolyte schedule"]} /></Card>
      </Grid>
      <Disclaimer>Educational guidance only. Plans for athletes must be sourced from a Registered Dietitian. The app never prescribes calories below BMR for minors.</Disclaimer>
    </>
  );
}
