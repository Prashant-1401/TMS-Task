/* eslint-disable react-refresh/only-export-components */
import { API_BASE_URL, apiPost } from "../api/client.js";
import { T } from "../utils/theme.js";

// ── USER-BASED ESCALATION MATRIX ──────────────────────────────────────────
// When an action becomes overdue, alerts are sent to the specific user
// configured in each tier of the escalation matrix. Each tier maps a
// responsible person to a target user who gets notified.
//

export const DEFAULT_ESC_MATRIX = [];

export const getEscBadgeStyle = (lvl) => {
  const num = Number(lvl);
  if (num >= 5) return { bg: T.redL, color: T.red };
  if (num === 4) return { bg: "#FADBD8", color: "#C0392B" };
  if (num === 3) return { bg: "#FDEBD0", color: "#D35400" };
  if (num === 2) return { bg: "#FFF3CD", color: "#E67E22" };
  return { bg: "#FFF9E7", color: "#E69903" };
};

// Shared helper: resolve the current escalation state (if any) for a single action.
// Used by the Escalations page and the Team page (Master Setup) so the "who is
// currently escalated, and to which level/superiors" logic lives in one place.

// Shared helper: resolve the current escalation state (if any) for a single action.
// Used by the Escalations page and the Team page (Master Setup) so the "who is
// currently escalated, and to which level/superiors" logic lives in one place.
export function resolveEscalationState(action, matrix, _users) {
  if (action.status === "COMPLETED" || action.status === "DROPPED" || !action.due) return null;
  const now = new Date();
  const due = new Date(action.due + "T23:59:59");
  const hrsOverdue = (now - due) / 3600000;
  if (hrsOverdue < 0) return null;

  const normP = (p) => Array.isArray(p) ? p : (typeof p === "string" && p.trim() ? p.split(",").map(x => x.trim()).filter(Boolean) : ["CRITICAL", "WARNING", "NORMAL"]);
  const activeTiers = (matrix || DEFAULT_ESC_MATRIX)
    .filter(t => t.active)
    .map(t => ({ ...t, priorities: normP(t.priorities) }));

  const respNames = (action.responsible || "").split(",").map(n => n.trim()).filter(Boolean);
  let bestResult = null;

  for (const name of respNames) {
    const matched = activeTiers
      .filter(t => (t.fromUser || "").trim() === name && hrsOverdue >= t.overdueHrs && t.priorities.includes(action.priority || "NORMAL"))
      .sort((a, b) => a.level - b.level);

    if (matched.length > 0) {
      const highestLevel = matched[matched.length - 1].level;
      if (!bestResult || highestLevel > bestResult.tier.level) {
        bestResult = {
          tier: matched[matched.length - 1],
          allMatchedTiers: matched,
          hrsOverdue,
          daysOverdue: Math.floor(hrsOverdue / 24),
          fromUser: name,
        };
      }
    }
  }

  return bestResult;
}

export function runEscalation(actions, setAudit, matrix, _users) {
  const normP = (p) => Array.isArray(p) ? p : (typeof p === "string" && p.trim() ? p.split(",").map(x => x.trim()).filter(Boolean) : ["CRITICAL", "WARNING", "NORMAL"]);
  const allTiers = (matrix || DEFAULT_ESC_MATRIX)
    .filter(t => t.active)
    .map(t => ({ ...t, priorities: normP(t.priorities) }));
  const byUser = {};
  allTiers.forEach(t => {
    const key = (t.fromUser || "").trim();
    if (!key) return;
    if (!byUser[key]) byUser[key] = [];
    byUser[key].push(t);
  });

  const now = new Date(), alerts = [];

  actions.forEach(a => {
    if (a.status === "COMPLETED" || a.status === "DROPPED" || !a.due) return;
    const hrs = (now - new Date(a.due + "T23:59:59")) / 3600000;
    if (hrs < 0) return;

    const respNames = (a.responsible || "").split(",").map(n => n.trim()).filter(Boolean);
    respNames.forEach(name => {
      const applicableTiers = byUser[name] || [];

      applicableTiers
        .filter(t => hrs >= t.overdueHrs && t.priorities.includes(a.priority || "NORMAL"))
        .sort((x, y) => x.level - y.level)
        .forEach(tier => {
          alerts.push({
            id: Date.now() + Math.random(),
            ts: now.toISOString(),
            sn: a.sn,
            text: a.text,
            level: tier.level,
            target: tier.targetUser || "",
            fromUser: tier.fromUser,
            targetUser: tier.targetUser,
            reason: `${Math.floor(hrs)}h overdue — ${tier.fromUser} → ${tier.targetUser} (Level ${tier.level})`,
          });
        });
    });
  });

  const seen = new Set();
  const deduped = alerts.filter(a => {
    const key = `${a.sn}_${a.level}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length) setAudit(p => {
    const existing = Array.isArray(p) ? p : [];
    const existingKeys = new Set(existing.map(e => `${e.sn}_${e.level}`));
    const fresh = deduped.filter(a => !existingKeys.has(`${a.sn}_${a.level}`));
    return [...fresh, ...existing].slice(0, 100);
  });

  if (API_BASE_URL) {
    apiPost("/api/escalation/email/escalate", {}).catch(e => console.warn("Escalation email failed", e));
  }
}

/* ===================== DESIGN TOKENS & CSS ===================== */
