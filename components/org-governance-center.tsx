"use client";

import { useState } from "react";
import {
  evaluateSoleOwnerDeparture,
  SAMPLE_ORG_POLICIES,
  validateOrganizationTransfer,
  type OrgGovernancePolicy,
} from "@/lib/org-lifecycle-governance";

interface OrgGovernanceCenterProps {
  currentUserId?: string;
}

export function OrgGovernanceCenter({ currentUserId = "user-me" }: OrgGovernanceCenterProps) {
  const [orgs, setOrgs] = useState<OrgGovernancePolicy[]>(SAMPLE_ORG_POLICIES);
  const [transferTarget, setTransferTarget] = useState<string>("member-sarah");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTransferOwnership = (orgId: string) => {
    setErrorMsg(null);
    const targetOrg = orgs.find((o) => o.orgId === orgId);
    if (!targetOrg) return;

    const check = validateOrganizationTransfer({
      policy: targetOrg,
      initiatingOwnerId: currentUserId,
      targetMemberId: transferTarget,
      targetMemberRole: "member",
    });

    if (!check.allowed) {
      setErrorMsg(check.error ?? "Transfer not permitted.");
      return;
    }

    setOrgs((prev) =>
      prev.map((o) =>
        o.orgId === orgId
          ? {
              ...o,
              currentOwnersCount: o.currentOwnersCount + 1,
            }
          : o
      )
    );
    setStatusMsg(
      `Appointed ${transferTarget} as co-owner of ${targetOrg.name}. Succession plan secured; you may now leave or archive safely.`
    );
  };

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="badge teal">Organization Lifecycle &amp; Governance</span>
            <span className="badge green">Strict Athlete Privacy Boundary</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Ownership Transfer, Co-Owners &amp; Succession Plan Safeguards
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Prevents stranded organizations when sole owners depart. Organization membership alone never grants access to private athlete medical, academic, or tax records.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.14)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#5eead4",
            fontSize: 12,
          }}
        >
          ✓ {statusMsg}
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="error" style={{ marginBottom: 12, fontSize: 12 }}>
          {errorMsg}
        </p>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {orgs.map((org) => {
          const check = evaluateSoleOwnerDeparture(org, currentUserId, "owner");
          return (
            <div
              key={org.orgId}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: check.requiresSuccessionPlan
                  ? "1px solid rgba(234, 179, 8, 0.45)"
                  : "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{org.name}</strong>
                  <span
                    className={`badge ${check.requiresSuccessionPlan ? "yellow" : "green"}`}
                    style={{ fontSize: 11 }}
                  >
                    {check.requiresSuccessionPlan
                      ? "Sole Owner (Succession Plan Required)"
                      : `${org.currentOwnersCount} Co-Owners (Governance Stable)`}
                  </span>
                  <span className="badge gray" style={{ fontSize: 11 }}>
                    {org.totalMembersCount} Members
                  </span>
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Privacy Boundary:{" "}
                  <strong style={{ color: "#4ade80" }}>
                    Athlete records restricted to family consent
                  </strong>{" "}
                  · Status: {org.isArchived ? "Archived (Revoked Access)" : "Active Organization"}
                </div>

                {check.blockReason && (
                  <div style={{ fontSize: 12, color: "#fde047", marginTop: 4 }}>
                    ⚠ {check.blockReason}
                  </div>
                )}
              </div>

              {check.requiresSuccessionPlan && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "var(--bg)",
                      color: "var(--text)",
                      border: "1px solid var(--line)",
                      fontSize: 12,
                    }}
                  >
                    <option value="member-sarah">Sarah Jenkins (Senior Coach)</option>
                    <option value="member-dave">Dave Miller (Athletic Director)</option>
                  </select>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => handleTransferOwnership(org.orgId)}
                  >
                    Appoint Co-Owner
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

