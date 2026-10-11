/* eslint-disable react-refresh/only-export-components */


export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ===================== DATA LAYER ===================== */
export const DEFAULT_PLANTS = [];

export const DEFAULT_DEPTS = [];

export const DEFAULT_USERS = [];

export const MEETING_TYPES = ["Furnace Daily Review", "Daily Problem-Solving", "Daily Plant Head Review", "Weekly Plant Head", "Safety Review"];

export const STATUS_LIST = ["NOT STARTED", "IN PROCESS", "COMPLETED", "DROPPED"];
// Legacy actions may have status literally saved as "PENDING CONFIRM" from
// before the pendingConfirmation flag existed. It's not in STATUS_LIST, so it
// must never be trusted as a real status — normalize it back to IN PROCESS.

// Legacy actions may have status literally saved as "PENDING CONFIRM" from
// before the pendingConfirmation flag existed. It's not in STATUS_LIST, so it
// must never be trusted as a real status — normalize it back to IN PROCESS.
export const normalizeStatus = s => (s === "PENDING CONFIRM" ? "IN PROCESS" : s);

export const displayStatus = a => (a.pendingConfirmation && a.status !== "COMPLETED" && a.status !== "DROPPED")
  ? "PENDING CONFIRM"
  : normalizeStatus(a.status);

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

export const PRIORITY_LIST = ["CRITICAL", "WARNING", "NORMAL"];

export const SECTIONS = ["Production", "Maintenance", "Quality", "Safety", "Electrical", "Mechanical", "Instrumentation", "Stores & Logistics", "Management", "General"];

export const ATTENDEE_MAP = {
  "Furnace Daily Review": ["Anil Kumar", "Meena Joshi", "Amit Tiwari", "Sanjay Mishra"],
  "Daily Problem-Solving": ["Suresh Patel", "Ravi Gupta", "Kavita Rawat", "Neha Yadav"],
  "Safety Review": ["Amit Tiwari", "Meena Joshi", "Priya Singh", "Vijay Pandey"],
  "Daily Plant Head Review": ["Anil Kumar", "Meena Joshi", "Amit Tiwari", "Sanjay Mishra", "Vijay Pandey"],
  "Weekly Plant Head": ["Rajiv Sharma", "Anil Kumar", "Suresh Patel", "Deepak Verma", "Meena Joshi", "Ravi Gupta", "Priya Singh"],
};

export const MTG_INSTRUCTIONS = {
  "Furnace Daily Review": ["Review heat-wise production vs target (MPM, Power, Mn)", "Identify deviations from the last 24 hours", "Assign owners and due dates for each gap", "Confirm previous action statuses before closing"],
  "Daily Problem-Solving": ["Present the top 3 problems from yesterday", "Use 5-Why to identify root causes", "Assign corrective actions with clear owners", "Track open actions from prior sessions"],
  "Daily Plant Head Review": ["Plant head to chair — no phones policy", "Review safety first, then production KPIs", "Each HOD presents department status in 3 minutes", "Escalate blockers that need cross-functional resolution"],
  "Weekly Plant Head": ["MD-level review of all three plants", "Compare plant performance using dashboard data", "Close completed strategic actions, escalate long-running ones", "Confirm priorities for the coming week"],
  "Safety Review": ["Start with near-miss and incident recap", "PPE compliance check results", "Assign corrective actions for each unsafe condition observed", "Set next review date before closing"],
};

export const SEED_PROJECTS = [];

export const SEED_MEETINGS = [];

export const SEED_ACTIONS = [];

export const SAMPLE_TRANSCRIPT_LINES = [
  "Good morning everyone. Let's start with yesterday's production numbers.",
  "Heat 42 showed MPM deviation of 0.8 tonnes below target. Root cause under review.",
  "Action: Amit Tiwari to calibrate pressure sensors on Line 3 by next Tuesday.",
  "Power consumption was 8% above benchmark in Bay 2. Neha to inspect switchboard.",
  "Safety: PPE audit pending for furnace operators. Meena to schedule by end of week.",
  "Previous action ACT-007 — flow meter FM-28 has been closed as design limitation.",
  "Crane availability in bay 3 improved to 94%. Ravi's team acknowledged.",
  "Any other business? Next meeting same time tomorrow.",
];

/* ===================== SHELL ===================== */
export const NAV = [{ id: 0, icon: "🏠", label: "Home" }, { id: 1, icon: "📋", label: "Work" }, { id: 2, icon: "✅", label: "Actions" }, { id: 3, icon: "📊", label: "Dashboard" }, { id: 4, icon: "🚨", label: "Escalations" }];

/* ============ NOTIFICATION SYSTEM ============ */
// Generates in-app notifications from audit, actions and user context

/* Persists last view per user in memory */
export const userViewPref = {};

export const userSortPref = {};  // persist sort across page changes
// Persist filters across page changes AND browser refreshes via localStorage

// Persist filters across page changes AND browser refreshes via localStorage
export const FILTER_STORE_KEY = "mcs_action_filters";

export const userFilterPref = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_STORE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_e) { return {}; }
})();

export const saveFilterPref = () => {
  try { localStorage.setItem(FILTER_STORE_KEY, JSON.stringify(userFilterPref)); } catch (_e) { /* ignore */ }
};
