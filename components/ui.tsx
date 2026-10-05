import type { ReactNode } from "react";

export function Card({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`card${wide ? " wide" : ""}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid">{children}</div>;
}

export function List({ items }: { items: ReactNode[] }) {
  return <ul className="list">{items.map((i, n) => <li key={n}>{i}</li>)}</ul>;
}

export function Badge({ tone, children }: { tone: "green" | "yellow" | "red" | "gray"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="disclaimer">{children}</p>;
}
