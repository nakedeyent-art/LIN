"use client";

import { useState } from "react";
import {
  generateVerifiableNilCredential,
  generateAppleWalletPass,
  type AthleteNilCredentialInput,
} from "@/lib/digital-nil-pass";

export function DigitalNilPassCard({
  defaultAthleteName = "Devon Brooks",
  defaultSport = "Football",
  defaultSchool = "University of Miami",
  defaultState = "FL",
}: {
  defaultAthleteName?: string;
  defaultSport?: string;
  defaultSchool?: string;
  defaultState?: string;
}) {
  const [athleteName, setAthleteName] = useState<string>(defaultAthleteName);
  const [sport, setSport] = useState<string>(defaultSport);
  const [position, setPosition] = useState<string>("Quarterback");
  const [school, setSchool] = useState<string>(defaultSchool);
  const [stateCode, setStateCode] = useState<string>(defaultState);
  const [level, setLevel] = useState<"Collegiate (NCAA)" | "High School (NFHS)">("Collegiate (NCAA)");
  const [isMinor, setIsMinor] = useState<boolean>(false);
  const [repStatus, setRepStatus] = useState<"Self-Represented" | "SPARTA Registered Agent">("SPARTA Registered Agent");
  const [agentName, setAgentName] = useState<string>("Elite Sports Agency");

  const [socialRate, setSocialRate] = useState<number>(1200);
  const [appearanceRate, setAppearanceRate] = useState<number>(1800);
  const [clinicRate, setClinicRate] = useState<number>(1500);
  const [commercialRate, setCommercialRate] = useState<number>(4500);

  const [downloaded, setDownloaded] = useState<boolean>(false);

  const input: AthleteNilCredentialInput = {
    athleteId: "ath-current-user",
    athleteName,
    sport,
    position,
    institutionOrSchool: school,
    stateCode,
    level,
    isMinor,
    guardianVerified: true,
    representationStatus: repStatus,
    agentName: repStatus === "SPARTA Registered Agent" ? agentName : undefined,
    rateCard: {
      socialMediaPostDollars: socialRate,
      inPersonAppearanceDollars: appearanceRate,
      skillsClinicDollars: clinicRate,
      brandCommercialDollars: commercialRate,
    },
  };

  const credential = generateVerifiableNilCredential(input);
  const walletPass = generateAppleWalletPass(credential);

  const handleDownloadWalletPass = () => {
    const jsonString = JSON.stringify(walletPass, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${athleteName.replaceAll(" ", "_")}_NIL_AppleWallet_Pass.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 20,
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🪪</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Digital Athlete NIL Credential & Apple Wallet Pass</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "rgba(234, 179, 8, 0.15)",
                color: "#eab308",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(234, 179, 8, 0.3)",
              }}
            >
              Verified PKPass
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Cryptographically signed athlete identity credential, amateurism eligibility proof, and verified rate card pass.
          </p>
        </div>

        <button
          type="button"
          className="btn small"
          onClick={handleDownloadWalletPass}
          style={{ fontSize: 12 }}
        >
          {downloaded ? "✓ Pass Exported!" : "📲 Add to Apple Wallet (.json)"}
        </button>
      </div>

      {/* Two Column Layout: Controls on Left, Digital Pass Card on Right */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {/* Left: Interactive Controls */}
        <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>Credential Configuration</strong>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12 }}>
              Athlete Name
              <input
                type="text"
                value={athleteName}
                onChange={(e) => setAthleteName(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Sport & Position
              <input
                type="text"
                value={`${sport} - ${position}`}
                onChange={(e) => {
                  const parts = e.target.value.split("-");
                  setSport(parts[0]?.trim() || "");
                  if (parts[1]) setPosition(parts[1].trim());
                }}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              School / Institution
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Level / Amateurism
              <select
                value={level}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setLevel(val);
                  setIsMinor(val === "High School (NFHS)");
                }}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              >
                <option value="Collegiate (NCAA)">Collegiate (NCAA)</option>
                <option value="High School (NFHS)">High School (NFHS)</option>
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              Representation
              <select
                value={repStatus}
                onChange={(e) => setRepStatus(e.target.value as any)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              >
                <option value="SPARTA Registered Agent">SPARTA Registered Agent</option>
                <option value="Self-Represented">Self-Represented</option>
              </select>
            </label>

            {repStatus === "SPARTA Registered Agent" && (
              <label style={{ fontSize: 12 }}>
                Agency Name
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
                />
              </label>
            )}
          </div>

          <strong style={{ fontSize: 12, display: "block", margin: "12px 0 6px" }}>Verified Rate Card ($)</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 11 }}>
              Sponsored Reel
              <input
                type="number"
                step={100}
                value={socialRate}
                onChange={(e) => setSocialRate(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 2, padding: "4px 8px" }}
              />
            </label>
            <label style={{ fontSize: 11 }}>
              In-Person Appearance
              <input
                type="number"
                step={100}
                value={appearanceRate}
                onChange={(e) => setAppearanceRate(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 2, padding: "4px 8px" }}
              />
            </label>
            <label style={{ fontSize: 11 }}>
              Skills Clinic
              <input
                type="number"
                step={100}
                value={clinicRate}
                onChange={(e) => setClinicRate(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 2, padding: "4px 8px" }}
              />
            </label>
            <label style={{ fontSize: 11 }}>
              Commercial Shoot
              <input
                type="number"
                step={250}
                value={commercialRate}
                onChange={(e) => setCommercialRate(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 2, padding: "4px 8px" }}
              />
            </label>
          </div>
        </div>

        {/* Right: Apple Wallet Pass Visualizer */}
        <div
          style={{
            background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
            color: "#fff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Card Top: Header & Badges */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", color: "#eab308" }}>
                  LIN NIL VERIFIED PASS
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  background: "rgba(34, 197, 94, 0.2)",
                  color: "var(--ok, #22c55e)",
                  padding: "2px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                }}
              >
                {credential.badges.amateurismEligibility === "NFHS_COMPLIANT" ? "✓ NFHS PREP VALID" : "✓ NCAA ELIGIBLE"}
              </span>
            </div>

            {/* Primary Field */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Student-Athlete
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{athleteName}</div>
              <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)", marginTop: 2 }}>
                {position} · {sport} · {school} ({stateCode})
              </div>
            </div>

            {/* Rate Card Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                background: "rgba(0, 0, 0, 0.25)",
                padding: 10,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 9, color: "#eab308", textTransform: "uppercase" }}>Sponsored Reel</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>${socialRate}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#eab308", textTransform: "uppercase" }}>Appearance / Clinic</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>${appearanceRate}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#eab308", textTransform: "uppercase" }}>Commercial Shoot</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>${commercialRate}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#eab308", textTransform: "uppercase" }}>Agent Status</div>
                <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {repStatus === "SPARTA Registered Agent" ? agentName : "Self-Rep"}
                </div>
              </div>
            </div>
          </div>

          {/* Card Bottom: QR Code Verification Strip */}
          <div style={{ borderTop: "1px dashed rgba(255, 255, 255, 0.15)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255, 255, 255, 0.5)" }}>SCAN TO VERIFY CREDENTIAL</div>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "#eab308", marginTop: 2 }}>
                {credential.credentialId}
              </div>
              <div style={{ fontSize: 8, color: "rgba(255, 255, 255, 0.4)", marginTop: 2 }}>
                SHA-256: {credential.digitalSignatureSha256.slice(0, 16)}...
              </div>
            </div>

            {/* Simulated QR Code box */}
            <div
              style={{
                width: 48,
                height: 48,
                background: "#fff",
                borderRadius: 4,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 2,
                padding: 4,
              }}
            >
              <div style={{ background: "#000" }} />
              <div style={{ background: "#fff" }} />
              <div style={{ background: "#000" }} />
              <div style={{ background: "#fff" }} />
              <div style={{ background: "#000" }} />
              <div style={{ background: "#fff" }} />
              <div style={{ background: "#000" }} />
              <div style={{ background: "#fff" }} />
              <div style={{ background: "#000" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
