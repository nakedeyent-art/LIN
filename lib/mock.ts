import type { Course, WorkoutStatus } from "./calc";

export const athlete = {
  name: "Jordan Reyes", sport: "Basketball", position: "Point Guard", grade: "Junior (HS)",
  school: "Lincoln High", state: "TX", gradYear: 2027, heightCm: 185, weightKg: 80, age: 17,
  followers: 18400, nilValue: 12500, isMinor: true,
};

export const courses: Course[] = [
  { name: "Core Math", grade: 74, previousGrade: 83 },
  { name: "English 11", grade: 91, previousGrade: 90 },
  { name: "Chemistry", grade: 82, previousGrade: 85 },
  { name: "US History", grade: 88 },
];

export const studyLog = { minutesThisWeek: 215, proofVerified: true };

export const weekStatuses: WorkoutStatus[] = ["completed", "completed", "missed", "completed", "assigned"];

export const workout = {
  focus: "Deceleration & First-Step Explosiveness",
  phases: [
    { phase: "warmup", title: "Dynamic Warmup & Mobility", detail: "10 min" },
    { phase: "plyometrics", title: "Plyometrics & Force Absorption", detail: "3 exercises, 4 sets" },
    { phase: "strength", title: "Strength Compound Work", detail: "3 exercises, 5 sets" },
    { phase: "skill", title: "Sport-Specific Skill Finisher & Cool-down", detail: "15 min" },
  ],
  current: {
    exercise: "Banded Hex Bar Deadlift", sets: 4, reps: 5, intensity: "80% 1RM", tempo: "2-0-X-1", restSec: 90,
    cue: "Drive through heels, brace core, explosive lock.",
    checklist: ["Feet hip-width, bar centered", "Neutral spine, lats engaged", "Hips and shoulders rise together", "Full lockout, no hyperextension"],
  },
};

export const mealPlan = [
  { time: "6:30 AM", name: "Pre-school breakfast", detail: "Oats, eggs, banana" },
  { time: "12:00 PM", name: "Lunch", detail: "Chicken, rice, vegetables" },
  { time: "3:30 PM", name: "Pre-practice fuel", detail: "Carb load: rice cakes, honey, fruit" },
  { time: "6:00 PM", name: "Post-workout recovery (30-60 min window)", detail: "Whey shake + chocolate milk" },
  { time: "7:30 PM", name: "Dinner", detail: "Salmon, sweet potato, greens" },
];

export const compliance14d = 92;

/** Per-role headline data for the home dashboards. */
export const board = {
  sponsorPipeline: [
    { name: "Jordan Reyes", sport: "Basketball", reach: "18.4K", fit: 94 },
    { name: "Maya Okafor", sport: "Soccer", reach: "31.2K", fit: 88 },
    { name: "Eli Brandt", sport: "Football", reach: "9.8K", fit: 81 },
  ],
  recruitBoard: [
    { name: "Jordan Reyes", pos: "PG", gpa: "3.4", status: "Eligible", stage: "Evaluating" },
    { name: "Dre Walker", pos: "SF", gpa: "2.6", status: "At risk", stage: "Watching" },
    { name: "Sam Ito", pos: "C", gpa: "3.8", status: "Eligible", stage: "Contacted" },
  ],
  events: [
    { name: "Spring Hoops Classic", teams: 48, status: "Registration open" },
    { name: "Showcase Series #2", teams: 24, status: "Brackets drafted" },
  ],
};
