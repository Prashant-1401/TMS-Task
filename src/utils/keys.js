/* eslint-disable react-refresh/only-export-components */


/* ─── Key transforms (snake_case ↔ camelCase) ─────────────── */
export const SNAKE_TO_CAMEL = {
  plant_id: "plantId", dept_id: "deptId", machine_id: "machineId",
  machine_name: "machineName", date_of_action: "dateOfAction",
  allocated_by: "allocatedBy", closed_on: "closedOn", closed_by: "closedBy",
  revision_history: "revisionHistory", responsible_user_id: "responsibleUserId",
  reason_id: "reasonId", action_point_type: "actionPointType",
  reason_of_action: "reasonOfAction", project_id: "projectId",
  project_name: "projectName",
  is_active: "isActive", action_count: "actionCount",
  start_date: "startDate", end_date: "endDate",
  completed_sessions: "completedSessions", pending_confirmation: "pendingConfirmation",
  asset_no: "assetNo", notify_method: "notifyMethod",
  overdue_days: "overdueDays", overdue_hrs: "overdueHrs",
  from_role: "fromRole", target_role: "targetRole",
  from_user: "fromUser", target_user: "targetUser",
  applicable_to: "applicableTo",
  action_sn: "sn",
  scheduled_days: "scheduledDays", guidelines: "guidelines",
  src_id: "srcId", src: "src", meetingid: "meetingId", meeting_name: "meetingName",
};

export const CAMEL_TO_SNAKE = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL).map(([s, c]) => [c, s])
);

export function denormKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(denormKeys);
  const out = {};
  Object.keys(obj).forEach(k => { out[SNAKE_TO_CAMEL[k] || k] = obj[k]; });
  return out;
}

export function normKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(normKeys);
  const out = {};
  Object.keys(obj).forEach(k => { out[CAMEL_TO_SNAKE[k] || k] = obj[k]; });
  // Backend schemas use "project" (not "project_name") — remap after normKeys
  if ("project_name" in out) { out.project = out.project_name; delete out.project_name; }
  return out;
}

/* ─── Resolve display names → FK IDs for actions & meetings ────── */
