"use client";

import { useState } from "react";
import { ClauseBuilder } from "./clause-builder";
import { Disclaimer } from "./ui";

export function DealOfferForm({
  athleteId,
  athleteName,
  sport,
  isMinor,
  error,
  action,
}: {
  athleteId: string;
  athleteName: string;
  sport: string;
  isMinor: boolean;
  error?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [title, setTitle] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [deliverables, setDeliverables] = useState<string>("");

  const handleApplyClauses = (presetTitle: string, suggestedAmount: number, generatedTerms: string) => {
    if (!title) setTitle(presetTitle);
    if (!amount) setAmount(String(suggestedAmount));
    setDeliverables(generatedTerms);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Make an NIL Offer</h1>
      <div className="tag" style={{ marginBottom: 16 }}>
        To {athleteName} · {sport}
        {isMinor ? " · under 18: a parent/guardian must approve" : ""}
      </div>

      {error && (
        <p role="alert" className="error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* Interactive Clause & Term Sheet Builder */}
      <ClauseBuilder
        athleteName={athleteName}
        isMinor={isMinor}
        onApply={handleApplyClauses}
      />

      <form action={action} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="athlete_id" value={athleteId} />

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Offer Title:
          </label>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Social media ambassador)"
            maxLength={100}
            required
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            Total Compensation (USD):
          </label>
          <input
            type="text"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in USD (e.g. 1500)"
            inputMode="decimal"
            required
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Deliverables & Legal Clauses:
            </label>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--mono)",
                color: deliverables.length >= 20 && deliverables.length <= 2000 ? "var(--ok)" : "var(--muted)",
              }}
            >
              {deliverables.length} / 2,000 characters
            </span>
          </div>
          <textarea
            name="deliverables"
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            placeholder="What will the athlete do in return? Be specific: posts, appearances, dates, and compliance terms."
            rows={8}
            maxLength={2000}
            required
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--mono)",
              lineHeight: 1.45,
            }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
          <input type="checkbox" name="attest" required style={{ marginTop: 2 }} />
          <span>
            I confirm this compensation is for NIL deliverables at fair market value — not for enrollment, recruitment, or athletic performance.
          </span>
        </label>

        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          Send Offer →
        </button>

        <Disclaimer>
          The offer expires in 14 days. The athlete (and, if under 18, a linked guardian) must accept before it becomes active.
        </Disclaimer>
      </form>
    </div>
  );
}
