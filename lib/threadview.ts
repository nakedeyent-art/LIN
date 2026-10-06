import { displayName } from "./deals";
import { CAPACITY_LABEL, HIDDEN_BODY } from "./messaging";
import type { ThreadMessage } from "./messagesdb";
import type { Capacity } from "./deals";

/** What the browser gets for one message: already resolved for this viewer (names, hidden text, who can be reported). */
export type ViewMsg = {
  id: number; name: string; role: string; mine: boolean; body: string; at: string; hidden: boolean;
  reportable: boolean; reported: boolean; files: { id: string; name: string; size: number }[];
};

export function toView(
  m: ThreadMessage, viewerId: string, who: Capacity,
  d: { athlete_id: string; counterparty_id: string; athlete_name: string; athlete_minor: boolean },
): ViewMsg {
  const isAthlete = m.sender_id === d.athlete_id;
  const role = m.sender_id === d.counterparty_id ? "Sponsor" : isAthlete ? "Athlete" : CAPACITY_LABEL.guardian;
  // Third parties see a minor as "First L."; family and the athlete see the full name.
  const athleteName = who === "guardian" || viewerId === d.athlete_id ? m.sender_name : displayName(m.sender_name, d.athlete_minor);
  const mine = m.sender_id === viewerId;
  return {
    id: m.id, name: mine ? "You" : isAthlete ? athleteName : m.sender_name, role, mine,
    body: m.hidden ? HIDDEN_BODY : m.body, at: new Date(m.created_at).toISOString(), hidden: m.hidden,
    reportable: !mine && !m.hidden && m.body !== "[message removed]", reported: m.reported, files: m.hidden ? [] : m.files,
  };
}
