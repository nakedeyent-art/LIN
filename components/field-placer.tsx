"use client";
import { useEffect, useRef, useState } from "react";

type Field = { id: string; page: number; x: number; y: number; width: number; label: string; kind: string; recipient: string };
type Props = {
  src: string; fields: Field[]; recipients: { id: string; name: string }[]; kinds: readonly string[]; envelopeId: string;
  action: (form: FormData) => Promise<void>;
};
const PAGE_WIDTH = 640, MIN_WIDTH = 5;

/**
 * Visual placement for signing fields. The document is rendered page by page (pdf.js, in the browser only); clicking a page puts the new
 * field there and dragging sets its width, while the numeric inputs stay editable and are what the form actually submits — so keyboard and
 * screen-reader users place fields exactly as before, and a failed render degrades to the plain form.
 */
export function FieldPlacer({ src, fields, recipients, kinds, envelopeId, action }: Props) {
  const [pages, setPages] = useState<{ width: number; height: number }[]>([]);
  const [renderError, setRenderError] = useState("");
  const [pos, setPos] = useState({ page: 1, x: 10, y: 70, width: 40 });
  const [drag, setDrag] = useState<{ page: number; x: number; y: number } | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: src, withCredentials: true }).promise;
        if (cancelled) return;
        const sizes: { width: number; height: number }[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n), base = page.getViewport({ scale: 1 }), scale = PAGE_WIDTH / base.width, viewport = page.getViewport({ scale });
          sizes.push({ width: viewport.width, height: viewport.height });
          setPages([...sizes]);
          await new Promise((r) => setTimeout(r, 0));          // let React mount the canvas before drawing on it
          const canvas = canvases.current[n - 1]; if (!canvas || cancelled) continue;
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
      } catch { if (!cancelled) setRenderError("The page preview could not be drawn here. Use the position fields below, or the PDF download, to place fields."); }
    })();
    return () => { cancelled = true; };
  }, [src]);

  const pct = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(90, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 100))), y: Math.min(95, Math.max(0, Math.round(((e.clientY - r.top) / r.height) * 100))) };
  };
  const onDown = (page: number) => (e: React.MouseEvent<HTMLDivElement>) => { const p = pct(e); setDrag({ page, ...p }); setPos((o) => ({ ...o, page, x: p.x, y: p.y, width: Math.min(o.width, 100 - p.x) })); };
  const onUp = (page: number) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag || drag.page !== page) return setDrag(null);
    const p = pct(e), width = Math.max(MIN_WIDTH, Math.min(100 - drag.x, p.x - drag.x));
    setPos((o) => ({ ...o, width: p.x - drag.x >= MIN_WIDTH ? width : o.width })); setDrag(null);
  };
  const touchAt = (t: React.TouchEvent<HTMLDivElement>) => { const r = t.currentTarget.getBoundingClientRect(), p = t.changedTouches[0]; return { x: Math.min(90, Math.max(0, Math.round(((p.clientX - r.left) / r.width) * 100))), y: Math.min(95, Math.max(0, Math.round(((p.clientY - r.top) / r.height) * 100))) }; };
  const onTouchStart = (page: number) => (t: React.TouchEvent<HTMLDivElement>) => { const p = touchAt(t); setDrag({ page, ...p }); setPos((o) => ({ ...o, page, x: p.x, y: p.y, width: Math.min(o.width, 100 - p.x) })); };
  const onTouchEnd = (page: number) => (t: React.TouchEvent<HTMLDivElement>) => { if (!drag || drag.page !== page) return setDrag(null); const p = touchAt(t), w = p.x - drag.x; setPos((o) => ({ ...o, width: w >= MIN_WIDTH ? Math.min(100 - drag.x, w) : o.width })); setDrag(null); };
  const num = (k: keyof typeof pos, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => { const v = Number(e.target.value); if (Number.isFinite(v)) setPos((o) => ({ ...o, [k]: Math.min(max, Math.max(min, v)) })); };
  const who = (id: string) => recipients.find((r) => r.id === id)?.name ?? "";

  return <div className="field-placer">
    <p className="muted">Click a page to place the field, then drag sideways to set its width. Existing fields are shown in grey; the new one in colour.</p>
    {renderError && <p role="status" className="muted">{renderError}</p>}
    <div className="placer-pages">
      {pages.map((size, i) => {
        const page = i + 1;
        return <div key={page} className="placer-page" style={{ width: size.width, height: size.height }} onMouseDown={onDown(page)} onMouseUp={onUp(page)} onTouchStart={onTouchStart(page)} onTouchEnd={onTouchEnd(page)} role="img" aria-label={`Page ${page} of the agreement`}>
          <canvas ref={(el) => { canvases.current[i] = el; }} aria-hidden="true" />
          {fields.filter((f) => f.page === page).map((f) => <div key={f.id} className="placer-field existing" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%` }} title={`${f.label} · ${who(f.recipient)}`}>{f.label}</div>)}
          {pos.page === page && <div className="placer-field pending" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.width}%` }}>New field</div>}
        </div>;
      })}
    </div>
    <form action={action} className="operation-form">
      <input type="hidden" name="envelope_id" value={envelopeId} /><input type="hidden" name="action" value="field" />
      <label>Recipient<select name="recipient_id" required>{recipients.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Field type<select name="kind">{kinds.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <label>Label<input type="text" name="label" maxLength={120} required /></label>
      <div className="filter-bar">
        <label>Page<input type="number" name="page" min="1" max="200" required value={pos.page} onChange={num("page", 1, 200)} /></label>
        <label>Left (%)<input type="number" name="x" min="0" max="90" required value={pos.x} onChange={(e) => { num("x", 0, 90)(e); setPos((o) => ({ ...o, width: Math.min(o.width, 100 - o.x) })); }} /></label>
        <label>Top (%)<input type="number" name="y" min="0" max="95" required value={pos.y} onChange={num("y", 0, 95)} /></label>
        <label>Width (%)<input type="number" name="width" min="5" max={100 - pos.x} required value={pos.width} onChange={num("width", 5, 100 - pos.x)} /></label>
      </div>
      <label><span><input name="required" type="checkbox" defaultChecked /> Required field</span></label>
      <button className="btn" type="submit">Add field</button>
    </form>
  </div>;
}
