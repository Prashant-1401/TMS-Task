/* eslint-disable react-refresh/only-export-components */

export const todayStr = () => new Date().toISOString().split("T")[0];

export const fmt = s => { if (!s) return "—"; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };

export const todayLocal = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

export const isOverdue = a => { if (!a.due || a.status === "COMPLETED" || a.status === "DROPPED") return false; const due = new Date(a.due + "T23:59:59"); return due < todayLocal(); };

export const daysOver = a => { if (!isOverdue(a)) return 0; const due = new Date(a.due + "T23:59:59"); return Math.floor((todayLocal() - due) / 86400000); };

export const getU = (name, users = []) => (users || []).find(u => u.name === name) || { initials: (name || "?").slice(0, 2).toUpperCase(), color: "#7C80B0", name: name || "Unknown" };

export const nextSN = arr => "ACT-" + String(arr.length + 1).padStart(3, "0");
// Get all superiors of a user walking up the chain

// Get all superiors of a user walking up the chain
export const getSuperiors = (userName, allUsers) => {
  const chain = [];
  let cur = allUsers.find(u => u.name === userName);
  while (cur && cur.superior) {
    const sup = allUsers.find(u => u.name === cur.superior);
    if (!sup || chain.find(x => x.name === sup.name)) break;
    chain.push(sup);
    cur = sup;
  }
  return chain;
};
// ── USER-BASED ESCALATION MATRIX ──────────────────────────────────────────
// When an action becomes overdue, alerts are sent to the specific user
// configured in each tier of the escalation matrix. Each tier maps a
// responsible person to a target user who gets notified.
//
