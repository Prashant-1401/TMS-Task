/* eslint-disable react-refresh/only-export-components */
import { WEEKDAY_NAMES } from "../utils/constants.js";
import { todayStr } from "../utils/helpers.js";
import { isUserAdmin } from "../utils/permissions.js";

/* ─── Resolve display names → FK IDs for actions & meetings ────── */
export function resolveRecordIds(record, plants, depts, machines, projects, meetings) {
  const r = { ...record };
  // Action: plant name → plant_id
  if (r.plant && !r.plant_id) {
    const match = (plants || []).find(p => p.name === r.plant || p.id === r.plant);
    if (match) { r.plant_id = match.id; delete r.plant; }
  }
  // Action: section (dept name) → dept_id
  if (r.section && !r.dept_id) {
    const match = (depts || []).find(d => d.name === r.section || d.id === r.section);
    if (match) { r.dept_id = match.id; }
  }
  // Action: machineName → machine_id
  if (r.machineName && !r.machine_id) {
    const match = (machines || []).find(m => m.name === r.machineName || m.id === r.machineName);
    if (match) { r.machine_id = match.id; delete r.machineName; }
  }
  // Action/Meeting: project name → project_id
  if (r.project && !r.project_id) {
    const match = (projects || []).find(p => p.name === r.project || p.id === r.project);
    if (match) { r.project_id = match.id; }
  }
  // Action: meeting id → meetingid + denormalized meeting_name
  if (r.meeting && !r.meetingid) {
    const mtg = (meetings || []).find(m => m.id === r.meeting || m.name === r.meeting);
    if (mtg) {
      r.meetingid = mtg.id;
      r.meeting_name = mtg.name || mtg.type || null;
    }
  }
  return r;
}

/* ─── Smart name matching for responsible fields ────────────────
   Action responsible values can be compound like "Mr. Umesh Kothare and Mr. A B Banerjee"
   or "Mrs. Aarti Harode/ Mrs. Khushbu Jaiswal". User names may have trailing spaces,
   "Mr." prefixes, or differ slightly. This function extracts individual name tokens
   from the responsible field and checks if any match any known user name.
*/

export function responsibleMatchesUsers(responsible, userNamesLower) {
  if (!responsible || !userNamesLower.length) return false;
  const resp = responsible.toLowerCase();
  // Quick: direct contains check (fast path for common case)
  if (userNamesLower.some(n => resp.includes(n))) return true;
  // Split compound responsible into individual name parts
  const parts = resp.split(/\/|,|\band\b|&/).map(s => s.trim());
  for (const part of parts) {
    // Strip titles, parenthetical notes, department labels
    const cleaned = part
      .replace(/\b(mr|mrs|ms|dr)\.?\s*/gi, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\bproduction department\b/gi, "")
      .trim();
    if (!cleaned) continue;
    // Check if cleaned name matches any user name
    if (userNamesLower.some(n => cleaned === n || n.includes(cleaned) || cleaned.includes(n))) return true;
    // Check individual words (handles "V R Kulkarni" vs "V. R. Kulkarni")
    const words = cleaned.split(/\s+/).filter(w => w.length > 2);
    if (words.some(w => userNamesLower.some(n => n.includes(w) || w.includes(n)))) return true;
  }
  return false;
}

export function resolveForeignKeys(items, plants, depts, projects) {
  const pName = {}, dName = {}, prName = {};
  (plants || []).forEach(p => { pName[p.id] = p.name; });
  (depts || []).forEach(d => { dName[d.id] = d.name; });
  (projects || []).forEach(p => { prName[p.id] = p.name; });
  return (items || []).map(item => {
    const out = { ...item };
    if (out.plantId && pName[out.plantId]) out.plant = pName[out.plantId];
    if (out.deptId && dName[out.deptId]) out.dept = dName[out.deptId];
    if (out.projectId && prName[out.projectId]) out.project = prName[out.projectId];
    return out;
  });
}

/* ─── Plant scoping that tolerates user.plant being an ID OR a name ─
   resolveForeignKeys turns item.plant_id → item.plant (NAME). But a
   user's stored plant can be either a plant ID (e.g. "P2") or a name
   (e.g. "Adroit Driveshaft"). Comparing name===ID hides every meeting
   for that user, so we match on BOTH forms. ─────────────────────────── */

export function plantVisible(user, item) {
  const up = user?.plant;
  if (!up || up === "All") return true;
  if (!item.plant && !item.plantId) return true;
  return item.plantId === up || item.plant === up || item.plant === "All";
}

// A meeting is accessible only to its attendees + facilitator (admins always)

// A meeting is accessible only to its attendees + facilitator (admins always)
export function meetingAccessNames(m, mtgPresets) {
  const list = ensureArray(m.attendees || (mtgPresets?.attendeeMap?.[m.type]) || []);
  const names = list.map(a => (a || "").toString().trim().toLowerCase()).filter(Boolean);
  const fac = (m.facilitator || "").toString().trim().toLowerCase();
  if (fac) names.push(fac);
  return names;
}

export function canAccessMeeting(user, m, _mtgPresets) {
  if (!m || !user) return false;
  if (isUserAdmin(user)) return true;
  const up = user.plant;
  if (!up || up === "All") return true;
  if (m.plant && m.plant !== "All" && m.plant !== up) return false;
  return true;
}

export function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) {
    const trimmed = val.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_e) {}
    }
    return trimmed.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/* ─── Weekly meeting belt ──────────────────────────────────────────
   Returns the 7 days (Mon–Sun) of the current week with, for each day:
   - hasSession: a visible meeting ran a completed session that day
   - count / done: actions created that day (dateOfAction) and how many
     are COMPLETED
   - color: green = all done, amber = partial, red = session but none
     done, null = no session / no actions (neutral)
*/

export function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // back to Monday
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function buildWeekBelt(meetings, actions) {
  const monday = startOfWeekMonday(new Date());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const sessionDates = new Set();
    (meetings || []).forEach(m => (m.completedSessions || []).forEach(s => {
      if (s.date === dateStr) sessionDates.add(s.date);
    }));
    const hasSession = sessionDates.size > 0;
    const dayActions = (actions || []).filter(a => a.dateOfAction === dateStr || a.created === dateStr);
    const count = dayActions.length;
    const done = dayActions.filter(a => a.status === "COMPLETED" || a.status === "DROPPED").length;
    let color = null;
    if (hasSession || count > 0) {
      if (count > 0 && done === count) color = "green";
      else if (done > 0) color = "amber";
      else color = "red";
    }
    days.push({
      dateStr, dayName: WEEKDAY_NAMES[i], dayNum: d.getDate(),
      hasSession, count, done, color,
      isToday: dateStr === new Date().toISOString().split("T")[0],
    });
  }
  return days;
}

/* ─── usePostgresDB hook ───────────────────────────────────────────────── */

// ─── Single source of truth for action status patch normalization ────────────
// Every place that updates an action status must call this to keep
// pendingConfirmation and closedOn in sync with the new status.
//
// Rules:
//   PENDING CONFIRM  → pendingConfirmation=true,  closedOn=null
//   COMPLETED        → pendingConfirmation=false, closedOn=today (if missing)
//   DROPPED          → pendingConfirmation=false, closedOn=today (if missing)
//   anything else    → pendingConfirmation=false, closedOn=null
//
// Does NOT enforce who is allowed to make the transition — the backend does
// that. Here we just make sure the flags are consistent.
export function normalizeActionPatch(patch) {
  const p = { ...patch };
  if (p.status === "PENDING CONFIRM") {
    p.pendingConfirmation = true;
    p.closedOn = null;
  } else if (p.status === "COMPLETED") {
    p.pendingConfirmation = false;
    if (!p.closedOn) p.closedOn = todayStr();
  } else if (p.status === "DROPPED") {
    p.pendingConfirmation = false;
    if (!p.closedOn) p.closedOn = todayStr();
  } else if (p.status) {
    p.pendingConfirmation = false;
    p.closedOn = null;
  }
  return p;
}
