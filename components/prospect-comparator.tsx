"use client";

import { useState } from "react";
import Link from "next/link";

export type ProspectSummary = {
  id: string;
  name: string;
  sport: string;
  position: string | null;
  level: string;
  gradYear: number | null;
  stage: string;
};

export function ProspectComparator({ prospects }: { prospects: ProspectSummary[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    prospects.slice(0, Math.min(3, prospects.length)).map((p) => p.id)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const selectedProspects = prospects.filter((p) => selectedIds.includes(p.id));

  if (!prospects.length) return null;

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <span className="badge green">Comparison Engine</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>Side-by-Side Prospect Matrix</h3>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Select up to 3 tracked athletes to compare key attributes.
        </p>
      </div>

      {/* Athlete selector pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {prospects.map((p) => {
          const isSelected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleSelect(p.id)}
              className={`btn small ${isSelected ? "needs" : "ghost"}`}
              style={{ fontSize: 12 }}
            >
              <span>{isSelected ? "✓" : "+"}</span>
              <span>{p.name} ({p.sport})</span>
            </button>
          );
        })}
      </div>

      {selectedProspects.length === 0 ? (
        <p className="muted">Click athletes above to add them to this comparison view.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Attribute</th>
                {selectedProspects.map((p) => (
                  <th key={p.id} style={{ minWidth: 160, color: "var(--primary)" }}>
                    <Link href={`/dashboard/scouting/${p.id}`} className="record-link">
                      {p.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 650, color: "var(--muted)" }}>Sport / Position</td>
                {selectedProspects.map((p) => (
                  <td key={p.id}>
                    {p.sport} {p.position ? `· ${p.position}` : ""}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 650, color: "var(--muted)" }}>Class / Grad Year</td>
                {selectedProspects.map((p) => (
                  <td key={p.id}>{p.gradYear ?? "—"}</td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 650, color: "var(--muted)" }}>Level</td>
                {selectedProspects.map((p) => (
                  <td key={p.id}>{p.level.replaceAll("_", " ")}</td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 650, color: "var(--muted)" }}>Recruiting Stage</td>
                {selectedProspects.map((p) => (
                  <td key={p.id}>
                    <span className="badge yellow">{p.stage}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 650, color: "var(--muted)" }}>Private Report</td>
                {selectedProspects.map((p) => (
                  <td key={p.id}>
                    <Link href={`/dashboard/scouting/${p.id}`} className="btn ghost small">
                      Open Evaluation →
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
