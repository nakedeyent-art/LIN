import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { subjectsFor, canEditFamily } from '@/lib/access';
import { db } from '@/lib/db';
import { TravelLogisticsHub } from '@/components/travel-logistics-hub';
import { loadRealTravelLogistics } from '@/lib/travel-logistics-server';
import { createRoute } from './actions';

export default async function Routes({ searchParams }: { searchParams: Promise<{ athlete?: string; error?: string }> }) {
  const s = await requireUser();
  const p = await searchParams;
  const athletes = (await subjectsFor(s)).filter(canEditFamily);
  const a = athletes.find(a => a.id === p.athlete) ?? athletes[0];
  const rows = a ? (await db().query('SELECT * FROM travel_routes WHERE athlete_id=$1 ORDER BY created_at DESC', [a.id])).rows : [];
  const primaryTrip = rows[0] ? await loadRealTravelLogistics(rows[0].id) : null;

  return (
    <>
      <p className="eyebrow">Sports operations</p>
      <h1>Travel Logistics & Routes</h1>
      <p className="tag">Flight itineraries, hotel room blocks, chaperone check-ins, and per diem tracking.</p>
      {p.error && <p className="error">{p.error}</p>}

      {/* Team & Athlete Travel Logistics Hub */}
      <TravelLogisticsHub
        initialTrip={primaryTrip}
        tripName={rows[0]?.name || "Team & Athlete Travel Logistics"}
        destination={primaryTrip?.destination || (a ? `${a.name}'s Route` : undefined)}
      />

      <form className="filter-bar">
        <label>
          Athlete
          <select name="athlete" defaultValue={a?.id}>
            {athletes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <button className="btn ghost">Show routes</button>
      </form>

      {a && (
        <form className="filter-bar" action={createRoute}>
          <input type="hidden" name="athlete_id" value={a.id} />
          <label>
            New route name
            <input type="text" name="name" required maxLength={120} />
          </label>
          <button className="btn">Create route</button>
        </form>
      )}

      <section className="work-panel">
        <table>
          <thead>
            <tr>
              <th>Route</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><Link className="record-link" href={`/dashboard/routes/${r.id}`}>{r.name}</Link></td>
                <td>{new Date(r.created_at).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty-state">No custom routes recorded yet.</p>}
      </section>
    </>
  );
}

