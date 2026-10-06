/** Email copy for the 18th-birthday transition. Names and counts only — no emails, amounts or deal terms. */

export type Mail = { subject: string; text: string };

const dealLine = (n: number, who: "athlete" | "guardian") =>
  n === 0 ? "" : who === "athlete"
    ? `\n${n} deal${n > 1 ? "s were" : " was"} waiting for a guardian's approval. You now decide ${n > 1 ? "them" : "it"} yourself.\n`
    : `\n${n} deal${n > 1 ? "s were" : " was"} waiting for guardian approval. ${n > 1 ? "They are" : "It is"} now the athlete's decision, not yours.\n`;

export function athleteAdultEmail(i: { name: string; pendingDeals: number; appUrl: string }): Mail {
  return {
    subject: "You're 18 — you now control your LIN account",
    text:
`Hi ${i.name},

Happy 18th birthday! On LIN that means you now control your own information and deals.

What changed:
• Your parent/guardian no longer has access to your academics, nutrition, training or deals.
• You can choose to keep sharing some things with them — view-only, and you can stop any time.
• You manage your own team (coaches, trainers, managers) from now on.
${dealLine(i.pendingDeals, "athlete")}
Review who can see what: ${i.appUrl}/dashboard/team
`,
  };
}

export function guardianAdultEmail(i: { guardianName: string; athleteName: string; pendingDeals: number; appUrl: string }): Mail {
  return {
    subject: `${i.athleteName} turned 18 on LIN`,
    text:
`Hi ${i.guardianName},

${i.athleteName} has turned 18, so your guardian role on LIN has ended and they now control their own information and deals.

• You no longer have access to their academics, nutrition, training or deals.
• ${i.athleteName} can choose to keep sharing some information with you (view-only). If they do, it will appear on your dashboard.
${dealLine(i.pendingDeals, "guardian")}
Thank you for supporting ${i.athleteName} on LIN. ${i.appUrl}/dashboard
`,
  };
}
