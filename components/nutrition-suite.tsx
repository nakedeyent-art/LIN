"use client";

import { useState } from "react";

export type NutritionSuiteProps = {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  athleteWeightKg?: number;
  logMealAction: (formData: FormData) => void;
};

// Common athlete meal presets with macro profiles for fast photo/preset logging
const MEAL_PRESETS = [
  { name: "Post-Workout Shake & Banana", kcal: 380, p: 42, c: 45, f: 4, desc: "Whey isolate, 1 large banana, almond milk" },
  { name: "Grilled Chicken, Sweet Potato & Broccoli", kcal: 580, p: 52, c: 65, f: 12, desc: "8oz chicken breast, roasted sweet potato, steamed greens" },
  { name: "Pre-Match Salmon & Quinoa Bowl", kcal: 640, p: 44, c: 58, f: 24, desc: "Wild salmon fillet, cooked quinoa, avocado & olive oil" },
  { name: "Greek Yogurt Parfait & Almonds", kcal: 340, p: 28, c: 32, f: 11, desc: "Nonfat Greek yogurt, mixed berries, honey, raw almonds" },
  { name: "Steak, Brown Rice & Asparagus", kcal: 720, p: 56, c: 62, f: 28, desc: "Sirloin steak, brown rice, olive oil sautéed asparagus" },
  { name: "Egg White & Oatmeal Power Breakfast", kcal: 450, p: 35, c: 55, f: 10, desc: "5 egg whites, 1 whole egg, rolled oats with blueberries" },
];

export function NutritionSuite({
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFats,
  athleteWeightKg = 75,
  logMealAction,
}: NutritionSuiteProps) {
  const [activeTab, setActiveTab] = useState<"quick_log" | "roadmap" | "grocery">("quick_log");

  // Meal form state
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [photoSelected, setPhotoSelected] = useState<string | null>(null);

  // Hydration state (target ~35-40 ml per kg + training loss)
  const hydrationTargetOz = Math.round(athleteWeightKg * 2.2 * 0.65); // approx 65% of weight in lbs
  const [hydrationLoggedOz, setHydrationLoggedOz] = useState(32);

  // Grocery filter
  const [dietaryFilter, setDietaryFilter] = useState<"standard" | "gluten_free" | "dairy_free" | "vegan">("standard");

  const selectPreset = (p: typeof MEAL_PRESETS[number]) => {
    setMealName(p.name);
    setCalories(String(p.kcal));
    setProtein(String(p.p));
    setCarbs(String(p.c));
    setFats(String(p.f));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoSelected(file.name);
      // Auto-suggest default values if meal name is empty
      if (!mealName) {
        setMealName("Snack / Plate");
        setCalories("520");
        setProtein("38");
        setCarbs("55");
        setFats("16");
      }
    }
  };

  // Grocery list data categorized
  const groceryItems = {
    standard: {
      proteins: ["Skinless chicken breasts", "Wild salmon fillets", "93/7 Lean ground turkey", "Liquid egg whites", "Whey isolate protein powder"],
      carbs: ["Rolled oats", "Sweet potatoes", "Jasmine / Brown rice", "Organic bananas & blueberries", "Whole grain / sourdough bread"],
      fats: ["Raw almonds / walnuts", "Hass avocados", "Cold-pressed extra virgin olive oil", "Natural peanut butter"],
      greens: ["Baby spinach & kale", "Broccoli florets", "Asparagus spears", "Electrolyte hydration tablets"],
    },
    gluten_free: {
      proteins: ["Grass-fed flank steak", "Chicken tenderloins", "Atlantic cod / whitefish", "Organic whole eggs"],
      carbs: ["Gluten-free oats", "Red quinoa", "White/Sweet potatoes", "Rice cakes & honey"],
      fats: ["Chia seeds & flaxseeds", "Avocado oil", "Almond butter"],
      greens: ["Zucchini", "Bell peppers", "Mixed salad greens", "Coconut water"],
    },
    dairy_free: {
      proteins: ["Chicken thighs (skinless)", "Canned chunk light tuna in water", "Plant-based pea protein powder", "Eggs"],
      carbs: ["Basmati rice", "Steel-cut oats", "Apples & berries", "Butternut squash"],
      fats: ["Raw pumpkin seeds", "Extra virgin olive oil", "Almonds"],
      greens: ["Cucumber", "Steamed green beans", "Spinach", "Electrolytes"],
    },
    vegan: {
      proteins: ["Organic firm tofu", "Tempeh blocks", "Plant-based protein isolate", "Edamame", "Canned black beans & chickpeas"],
      carbs: ["Quinoa", "Rolled oats", "Sweet potatoes", "Lentil pasta", "Bananas"],
      fats: ["Tahini", "Avocados", "Chia seeds", "Flaxseed oil", "Walnuts"],
      greens: ["Broccoli", "Kale", "Spirulina / Chlorella", "Nutritional yeast"],
    },
  }[dietaryFilter];

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 20 }}>
      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 18 }}>
        <div>
          <span className="badge green">Performance Nutrition Engine</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>Meal Roadmap &amp; Fueling Tools</h3>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`btn small ${activeTab === "quick_log" ? "needs" : "ghost"}`}
            onClick={() => setActiveTab("quick_log")}
          >
            Photo &amp; Macro Logger
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === "roadmap" ? "needs" : "ghost"}`}
            onClick={() => setActiveTab("roadmap")}
          >
            Match-Day Protocol
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === "grocery" ? "needs" : "ghost"}`}
            onClick={() => setActiveTab("grocery")}
          >
            Visual Grocery List
          </button>
        </div>
      </div>

      {/* Tab 1: Photo & Macro Logger */}
      {activeTab === "quick_log" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 14 }}>One-Click Athlete Meal Presets</h4>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
              Select a calibrated staple to auto-fill verified macronutrients, or snap a photo of your plate.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {MEAL_PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectPreset(p)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: mealName === p.name ? "2px solid var(--primary)" : "1px solid var(--line)",
                    background: mealName === p.name ? "var(--primary-soft)" : "var(--panel-2)",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</div>
                  <div style={{ color: "var(--primary)", fontWeight: 600, marginTop: 2 }}>
                    {p.kcal} kcal · {p.p}g P / {p.c}g C / {p.f}g F
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Photo Upload Mock */}
          <div style={{ padding: 14, background: "var(--panel-2)", border: "1px dashed var(--line-strong)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>📸 Photo Meal Estimation</span>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  Snap or upload a photo of your pre/post-workout meal.
                </p>
              </div>
              <label className="btn ghost small" style={{ cursor: "pointer" }}>
                <span>{photoSelected ? `Attached: ${photoSelected}` : "Choose Photo"}</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          {/* Meal Submit Form */}
          <form action={logMealAction} style={{ display: "grid", gap: 12, marginTop: 4 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
              Meal Title
              <input
                type="text"
                name="meal_name"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g., Post-Workout Recovery Bowl"
                required
                style={{ padding: "8px 10px" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Calories (kcal)
                <input
                  type="number"
                  name="calories"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="550"
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Protein (g)
                <input
                  type="number"
                  name="protein"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="45"
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Carbs (g)
                <input
                  type="number"
                  name="carbs"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="60"
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Fats (g)
                <input
                  type="number"
                  name="fats"
                  value={fats}
                  onChange={(e) => setFats(e.target.value)}
                  placeholder="14"
                  required
                />
              </label>
            </div>

            <button type="submit" className="btn" style={{ justifySelf: "start", marginTop: 4 }}>
              Record Meal &amp; Check Compliance
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Match-Day Protocol & Hydration */}
      {activeTab === "roadmap" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: 14, background: "var(--primary-soft)", borderRadius: 8, borderLeft: "4px solid var(--primary)" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "var(--primary)" }}>Pre-Competition Glycogen Loading (3-4h Out)</h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
              Target: 2.0g – 2.5g carbs per kg bodyweight ({Math.round(athleteWeightKg * 2.2)}g total). Low fiber and minimal fats to optimize gastric emptying. Examples: Jasmine rice, ripe bananas, sourdough bread with honey.
            </p>
          </div>

          <div style={{ padding: 14, background: "var(--ok-soft)", borderRadius: 8, borderLeft: "4px solid var(--ok)" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "var(--ok)" }}>Post-Match Anabolic Recovery Window (0–45m Out)</h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
              Target: 0.4g protein per kg ({Math.round(athleteWeightKg * 0.4)}g) + 0.8g high-glycemic carbohydrates. Rapid replenishment triggers protein synthesis and halts catabolic breakdown.
            </p>
          </div>

          {/* Hydration Tracker */}
          <div style={{ padding: 16, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>Hydration Schedule</span>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>
                  {hydrationLoggedOz} / {hydrationTargetOz} oz
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setHydrationLoggedOz((v) => v + 8)}
                >
                  +8 oz (Glass)
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setHydrationLoggedOz((v) => v + 16)}
                >
                  +16 oz (Sports Bottle)
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setHydrationLoggedOz(0)}
                >
                  Reset
                </button>
              </div>
            </div>
            <div style={{ marginTop: 10, width: "100%", height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.round((hydrationLoggedOz / hydrationTargetOz) * 100))}%`,
                  background: "var(--primary)",
                  borderRadius: 99,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Visual Grocery List */}
      {activeTab === "grocery" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Grocery list structured around your {targetCalories} kcal daily target:
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {(["standard", "gluten_free", "dairy_free", "vegan"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn small ${dietaryFilter === mode ? "needs" : "ghost"}`}
                  onClick={() => setDietaryFilter(mode)}
                >
                  {mode === "standard" ? "Standard" : mode === "gluten_free" ? "Gluten-Free" : mode === "dairy_free" ? "Dairy-Free" : "Vegan"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ padding: 12, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", color: "var(--primary)" }}>
                Lean Proteins ({targetProtein}g daily)
              </h5>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {groceryItems.proteins.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>

            <div style={{ padding: 12, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", color: "var(--primary)" }}>
                Complex Carbs ({targetCarbs}g daily)
              </h5>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {groceryItems.carbs.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>

            <div style={{ padding: 12, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", color: "var(--primary)" }}>
                Healthy Fats ({targetFats}g daily)
              </h5>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {groceryItems.fats.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>

            <div style={{ padding: 12, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", color: "var(--primary)" }}>
                Micros &amp; Electrolytes
              </h5>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {groceryItems.greens.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
