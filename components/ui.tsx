import type { ReactNode } from "react";
import Link from "next/link";

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

/* ---- Feed-first shell (direction C) ---------------------------------- */

/** Page title row used by feed-style pages. */
export function PageHead({ eyebrow, title, tag, children }: { eyebrow?: string; title: ReactNode; tag?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{tag && <p className="tag">{tag}</p>}</div>
      {children}
    </header>
  );
}

export function FeedSection({ children, needs, id }: { children: ReactNode; needs?: boolean; id?: string }) {
  return <h2 id={id} className={`feed-section${needs ? " needs" : ""}`}>{children}</h2>;
}

/** One card, one action. `needs` marks a decision only the viewer can make (orange). */
export function FeedCard({ icon, title, href, detail, cta, needs }: { icon: string; title: string; href: string; detail?: ReactNode; cta?: string; needs?: boolean }) {
  return (
    <article className={`feed-card${needs ? " needs" : ""}`}>
      <span className="feed-icon" aria-hidden>{icon}</span>
      <div><div className="feed-title"><Link href={href}>{title}</Link></div>{detail && <div className="feed-detail">{detail}</div>}</div>
      {cta && <div className="feed-action"><Link className={`btn${needs ? " needs" : " ghost"}`} href={href} aria-label={`${cta}: ${title}`}>{cta}</Link></div>}
    </article>
  );
}

export function FeedEmpty({ children }: { children: ReactNode }) {
  return <p className="feed-empty">{children}</p>;
}

/* ---- Clean record (direction B) -------------------------------------- */

/** Paper sheet for deals, agreements, signing and documents: serif headings, numbered sections, blue accent. */
export function RecordSheet({ children }: { children: ReactNode }) {
  return <div className="record-sheet">{children}</div>;
}

/** Progress steps. The first incomplete step is highlighted as "next". */
export function Steps({ steps }: { steps: [boolean, string][] }) {
  const next = steps.findIndex(([ok]) => !ok);
  return (
    <ol className="steps">{steps.map(([ok, label], i) => (
      <li key={label} className={ok ? "done" : i === next ? "next" : undefined}>
        <span className="tick" aria-hidden>{ok ? "✓" : ""}</span>
        <span><span className="sr-only">{ok ? "Done: " : i === next ? "Next: " : "Pending: "}</span>{label}</span>
      </li>))}
    </ol>
  );
}
