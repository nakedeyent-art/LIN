"use client";

import { useState } from "react";
import Link from "next/link";

export interface ActionQueueItem {
  id: string;
  category: "deal_approval" | "deliverable_proof" | "escrow_funding" | "contract_signature" | "academic_gate" | "scouting_review";
  urgency: "high" | "medium" | "normal";
  title: string;
  subtitle: string;
  dueDate?: string;
  href: string;
  ctaText: string;
  badgeText: string;
}

interface ActionCommandQueueProps {
  viewerRole: string;
  items?: ActionQueueItem[];
}

export const SAMPLE_ACTION_ITEMS: Record<string, ActionQueueItem[]> = {
  athlete: [
    {
      id: "act-1",
      category: "deliverable_proof",
      urgency: "high",
      title: "Submit TikTok Reel Proof for Apex Hydration",
      subtitle: "Sponsored post deliverable · Due in 2 days",
      dueDate: "Nov 3, 2026",
      href: "/dashboard/deals",
      ctaText: "Submit Proof",
      badgeText: "Due Soon",
    },
    {
      id: "act-2",
      category: "contract_signature",
      urgency: "medium",
      title: "Countersign Summer Camp Term Sheet",
      subtitle: "Digital signature requested by Metro Hoops",
      href: "/dashboard/signing",
      ctaText: "Sign Envelope",
      badgeText: "Signature Required",
    },
    {
      id: "act-3",
      category: "academic_gate",
      urgency: "normal",
      title: "Log 60m Study Hall for Competition Clearance",
      subtitle: "Weekly academic threshold: 85m remaining",
      href: "/dashboard/academics",
      ctaText: "Study Timer",
      badgeText: "Gate Check",
    },
  ],
  parent: [
    {
      id: "act-p1",
      category: "deal_approval",
      urgency: "high",
      title: "Approve Apex Performance NIL Offer for Marcus",
      subtitle: "$1,250 sponsor campaign held in parental review",
      href: "/dashboard/safety",
      ctaText: "Review & Co-Sign",
      badgeText: "Guardian Action",
    },
    {
      id: "act-p2",
      category: "deal_approval",
      urgency: "medium",
      title: "Verify Fall Semester Progress Report",
      subtitle: "2 new study sessions submitted by athlete",
      href: "/dashboard/academics",
      ctaText: "Verify Hours",
      badgeText: "Academic Verification",
    },
  ],
  sponsor: [
    {
      id: "act-s1",
      category: "deliverable_proof",
      urgency: "high",
      title: "Review Submitted Instagram Reel from Devon Brooks",
      subtitle: "Proof submitted with #ad disclosure · $1,200 escrow pending release",
      href: "/dashboard/deals",
      ctaText: "Review Proof",
      badgeText: "Proof Ready",
    },
    {
      id: "act-s2",
      category: "escrow_funding",
      urgency: "medium",
      title: "Deposit Escrow for Accepted National Campaign Offers",
      subtitle: "3 athletes accepted terms · Pre-funding required",
      href: "/dashboard/athletes",
      ctaText: "Fund Escrow",
      badgeText: "Funding Needed",
    },
  ],
  recruiter: [
    {
      id: "act-r1",
      category: "scouting_review",
      urgency: "high",
      title: "Review New 4K Film Clip for Tyler Scott (GA)",
      subtitle: "Pitcher · 89mph fastball video added to prospect vault",
      href: "/dashboard/scouting",
      ctaText: "Watch Film",
      badgeText: "New Film",
    },
    {
      id: "act-r2",
      category: "scouting_review",
      urgency: "normal",
      title: "Touring Itinerary: Check Showcases in Florida",
      subtitle: "3 tracked prospects attending Sunshine State Classic",
      href: "/dashboard/routes",
      ctaText: "View Route",
      badgeText: "Travel Link",
    },
  ],
};

export function ActionCommandQueue({ viewerRole, items }: ActionCommandQueueProps) {
  const [filter, setFilter] = useState<"all" | "high">("all");
  const displayItems = items && items.length > 0 ? items : SAMPLE_ACTION_ITEMS[viewerRole] || SAMPLE_ACTION_ITEMS.athlete;

  const filtered = filter === "high" ? displayItems.filter((i) => i.urgency === "high") : displayItems;

  const highCount = displayItems.filter((i) => i.urgency === "high").length;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 20,
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge teal">Prioritized Workflow</span>
            {highCount > 0 && <span className="badge red">{highCount} Urgent</span>}
          </div>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
            Next-Action Command Queue
          </h3>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
            Immediate operational next-steps requiring your decision, signature, or review.
          </p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`btn small ${filter === "all" ? "" : "ghost"}`}
            style={{ fontSize: 12 }}
          >
            All Actions ({displayItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("high")}
            className={`btn small ${filter === "high" ? "" : "ghost"}`}
            style={{ fontSize: 12 }}
          >
            Urgent Only ({highCount})
          </button>
        </div>
      </div>

      {/* Action Items List */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: item.urgency === "high" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--line)",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background:
                      item.urgency === "high"
                        ? "rgba(239, 68, 68, 0.15)"
                        : item.urgency === "medium"
                        ? "rgba(234, 179, 8, 0.15)"
                        : "rgba(56, 189, 248, 0.15)",
                    color:
                      item.urgency === "high"
                        ? "#f87171"
                        : item.urgency === "medium"
                        ? "#facc15"
                        : "#38bdf8",
                  }}
                >
                  {item.badgeText}
                </span>

                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {item.title}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {item.subtitle}
              </div>
            </div>

            <Link
              href={item.href}
              className={`btn small ${item.urgency === "high" ? "" : "ghost"}`}
              style={{
                textDecoration: "none",
                fontSize: 12,
                background: item.urgency === "high" ? "var(--primary, #f97316)" : undefined,
                whiteSpace: "nowrap",
              }}
            >
              {item.ctaText} →
            </Link>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="muted" style={{ margin: 0, textAlign: "center", padding: 20 }}>
            No pending action items right now. All workflows are up to date!
          </p>
        )}
      </div>
    </div>
  );
}
