#!/usr/bin/env python3
"""Full App.jsx splitter: emits the modular frontend structure with security fixes."""
import re
from pathlib import Path

SRC = Path("src/App.jsx")
DECL_RE = re.compile(r'^(export default |export )?(async )?(function\s*\*?|class|const|let)\s+([A-Za-z_$][\w$]*)')


def parse_blocks(lines):
    starts = []
    for i, line in enumerate(lines):
        if i < 3:
            continue
        if line.startswith("/*") or line.startswith("//"):
            if not (starts and lines[starts[-1]].startswith(("/*", "//"))):
                starts.append(i)
            continue
        if DECL_RE.match(line):
            starts.append(i)
    decls = [s for s in starts if DECL_RE.match(lines[s])]
    blocks = {}
    for idx, s in enumerate(decls):
        e = decls[idx + 1] if idx + 1 < len(decls) else len(lines)
        m = DECL_RE.match(lines[s])
        # include leading comments/blank section directly above
        bs = s
        while bs > 0 and (lines[bs - 1].strip().startswith(("/*", "//")) or lines[bs - 1].strip() == ""):
            bs -= 1
            if lines[bs].strip().startswith("/*"):
                while bs > 0 and not lines[bs].strip().endswith("*/"):
                    bs -= 1
                break
        blocks[m.group(4)] = "".join(lines[bs:e]).strip("\n") + "\n"
    return blocks


# ── name → module map ──
M = {
    "api/client.js": ["API_BASE_URL", "setAuthToken", "getAuthToken", "setCurrentRoles", "getCurrentRoles", "setOnAuthExpired"],
    "api/autosave.js": ["subscribeAutosave", "emitAutosave", "setAutosaveStatus", "pendingOps", "opKey", "queueOp", "clearOp", "flushPendingSaves", "reconcilePendingWithServer", "apiCreate", "apiUpdate", "apiRemove", "SNAPSHOT_KEY", "snapshotLocal", "loadSnapshot", "_autosaveState", "_flushing", "autosaveListeners"],
    "utils/keys.js": ["SNAKE_TO_CAMEL", "CAMEL_TO_SNAKE", "denormKeys", "normKeys"],
    "utils/data.js": ["resolveRecordIds", "responsibleMatchesUsers", "resolveForeignKeys", "plantVisible", "meetingAccessNames", "canAccessMeeting", "ensureArray", "startOfWeekMonday", "buildWeekBelt", "normalizeActionPatch"],
    "utils/constants.js": ["WEEKDAY_NAMES", "DEFAULT_PLANTS", "DEFAULT_DEPTS", "DEFAULT_USERS", "MEETING_TYPES", "STATUS_LIST", "normalizeStatus", "displayStatus", "PRIORITY_LIST", "SECTIONS", "ATTENDEE_MAP", "MTG_INSTRUCTIONS", "SEED_PROJECTS", "SEED_MEETINGS", "SEED_ACTIONS", "SAMPLE_TRANSCRIPT_LINES", "NAV", "userViewPref", "userSortPref", "FILTER_STORE_KEY", "userFilterPref", "saveFilterPref"],
    "utils/permissions.js": ["isGuestRole", "getPerms", "isUserAdmin", "canAccessMasterSetup", "scopedPlants", "scopedDepts", "scopedUsers"],
    "utils/helpers.js": ["todayStr", "fmt", "todayLocal", "isOverdue", "daysOver", "getU", "nextSN", "getSuperiors"],
    "utils/escalation.js": ["DEFAULT_ESC_MATRIX", "getEscBadgeStyle", "resolveEscalationState", "runEscalation"],
    "utils/theme.js": ["T", "SC", "PC", "CSS"],
    "hooks/usePostgresDB.js": ["usePostgresDB"],
    "hooks/useRealtimeSync.js": ["useRealtimeSync"],
    "hooks/useEscClose.js": ["useEscClose"],
    "hooks/useNotifications.js": ["useNotifications"],
    "hooks/useAPIBridge.js": ["useAPIBridge"],
    "components/ui.jsx": ["SBadge", "PBadge", "Avatar", "Lbl", "HR", "Spin", "Empty", "MultiUserSelect", "Chip", "KPICard", "PageHeader", "Sparkbar", "SectionSaveButton"],
    "components/LoginPage.jsx": ["LoginPage"],
    "components/Modals.jsx": ["SupportModal", "UserProfilePanel", "AdminNotifManager", "SessionsManagerModal"],
    "components/Shell.jsx": ["Shell"],
    "components/ActionSidePanel.jsx": ["ActionSidePanel"],
    "components/ProjectCharterModal.jsx": ["ProjectCharterModal"],
    "components/AddProjectModal.jsx": ["AddProjectModal"],
    "components/MeetingPlanPanel.jsx": ["MeetingPlanPanel"],
    "components/CompletedMeetingDashboard.jsx": ["CompletedMeetingDashboard"],
    "components/WeeklyMeetingAccountability.jsx": ["WeeklyMeetingAccountability"],
    "components/AddMeetingModal.jsx": ["AddMeetingModal"],
    "components/MeetingRoom.jsx": ["MeetingRoom"],
    "components/AddActionPanel.jsx": ["AddActionPanel"],
    "components/StagingArea.jsx": ["StagingArea"],
    "components/ActionDetailPanel.jsx": ["ActionDetailPanel"],
    "components/views.jsx": ["TableView", "BoardView", "KanbanView", "TimelineView"],
    "components/EscMatrixTab.jsx": ["EscMatrixTab"],
    "components/ErrorBoundary.jsx": ["ErrorBoundary"],
    "pages/HomePage.jsx": ["HomePage"],
    "pages/WorkPage.jsx": ["WorkPage"],
    "pages/ActionsPage.jsx": ["ActionsPage"],
    "pages/DashboardPage.jsx": ["DashboardPage"],
    "pages/TeamPage.jsx": ["TeamPage"],
    "pages/EscalationsPage.jsx": ["EscalationsPage"],
    "pages/MasterPage.jsx": ["MasterPage"],
}
name_to_module = {}
for mod, names in M.items():
    for n in names:
        if n in name_to_module:
            raise SystemExit(f"duplicate export name: {n}")
        name_to_module[n] = mod
# blocks present in source but NOT mapped (client internals handled by hand):
UNMAPPED_OK = {"RAW_API_BASE_URL", "API_KEY", "AUTH_TOKEN", "CURRENT_ROLES", "_onAuthExpired", "App", "apiFetch", "apiGet", "apiPost", "apiPatch", "apiDelete"}


def fix_text(name, text):
    """Security + correctness fixes applied to extracted blocks."""
    # 1. strip API key header everywhere
    text = text.replace('"x-api-key": API_KEY, ', "")
    text = text.replace('${AUTH_TOKEN ||', '${getAuthToken() ||')
    # 2. runEscalation inline fetch → apiPost
    if name == "runEscalation":
        text = text.replace(
            '''    fetch(`${API_BASE_URL}/api/escalation/email/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token") || ""}` },
      body: JSON.stringify({})
    }).catch(e => console.warn("Escalation email failed", e));''',
            '    apiPost("/api/escalation/email/escalate", {}).catch(e => console.warn("Escalation email failed", e));')
    # 3. useAPIBridge missing `meetings` parameter (pre-existing latent bug)
    if name == "useAPIBridge":
        text = text.replace(
            "function useAPIBridge(actions, setActions, projects, plants, depts, machines) {",
            "function useAPIBridge(actions, setActions, projects, plants, depts, machines, meetings) {")
        text = text.replace("}, [setActions, projects, plants, depts, machines]);",
                            "}, [setActions, projects, plants, depts, machines, meetings]);")
    # 4. attachment download: handle presigned-URL JSON response (S3 mode)
    if name == "ActionDetailPanel":
        old = '''                        try {
                        const resp = await fetch(`${API_BASE_URL}/api/actions/${action.id}/attachments/${att.id}`, {
                          headers: { "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token")}` },
                          });
                          if (!resp.ok) { alert("Download failed"); setDownloadingAtt(null); return; }
                          const blob = await resp.blob();
                          const url = URL.createObjectURL(blob);'''
        new = '''                        try {
                        const resp = await fetch(`${API_BASE_URL}/api/actions/${action.id}/attachments/${att.id}`, {
                          headers: { "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token")}` },
                          });
                          if (!resp.ok) { alert("Download failed"); setDownloadingAtt(null); return; }
                          const ctype = (resp.headers.get("content-type") || "");
                          if (ctype.includes("application/json")) {
                            const j = await resp.json();
                            if (j.url) window.open(j.url, "_blank");
                            else alert("Download link unavailable");
                            setDownloadingAtt(null);
                            return;
                          }
                          const blob = await resp.blob();
                          const url = URL.createObjectURL(blob);'''
        if old not in text:
            raise SystemExit("ActionDetailPanel download block not matched")
        text = text.replace(old, new)
    return text


def main():
    src_lines = SRC.read_text().splitlines(keepends=True)
    blocks = parse_blocks(src_lines)

    unmapped = [n for n in blocks if n not in name_to_module and n not in UNMAPPED_OK]
    if unmapped:
        raise SystemExit(f"UNMAPPED blocks: {unmapped}")

    # ── emit module files ──
    for mod, names in M.items():
        body = "\n".join(fix_text(n, blocks[n]) for n in names if n in blocks)
        # drop names generated fresh (client.js is hand-written)
        if mod == "api/client.js":
            continue
        # export each top-level decl
        for n in names:
            body = re.sub(rf"^(async )?function {re.escape(n)}\b", rf"\1export function {n}", body, flags=re.M)
            body = re.sub(rf"^const {re.escape(n)}\b", rf"export const {n}", body, flags=re.M)
            body = re.sub(rf"^class {re.escape(n)}\b", rf"export class {n}", body, flags=re.M)
        Path(mod).parent.mkdir(parents=True, exist_ok=True)
        Path(mod).write_text("/* eslint-disable react-refresh/only-export-components */\n" + body, encoding="utf-8")
        print("wrote", mod)

    # ── hand-written api/client.js ──
    Path("api/client.js").write_text(CLIENT_SRC, encoding="utf-8")
    print("wrote api/client.js")

    # ── export App tail pieces for the App.jsx / store assembly step ──
    app_block = blocks["App"]
    marker = "  // Loading screen while data loads"
    idx = app_block.index(marker)
    store_logic = app_block[:idx]
    tail_jsx = app_block[idx:]
    Path("/tmp/store_logic.txt").write_text(store_logic, encoding="utf-8")
    Path("/tmp/tail_jsx.txt").write_text(tail_jsx, encoding="utf-8")
    print("staged store logic:", len(store_logic.splitlines()), "lines; tail jsx:", len(tail_jsx.splitlines()), "lines")


CLIENT_SRC = '''const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\\+$/, "");

let AUTH_TOKEN = null;
let CURRENT_ROLES = [];
let _onAuthExpired = null;

export function setAuthToken(token) { AUTH_TOKEN = token; }
export function getAuthToken() { return AUTH_TOKEN; }
export function setCurrentRoles(roles) { CURRENT_ROLES = roles || []; }
export function getCurrentRoles() { return CURRENT_ROLES; }
export function setOnAuthExpired(fn) { _onAuthExpired = fn; }

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = AUTH_TOKEN || localStorage.getItem("mcs_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    const p = new URL(url).pathname;
    if (p !== "/api/ping" && !p.startsWith("/api/sessions/")) {
      _onAuthExpired?.();
    }
  }
  if (!res.ok) {
    let detail;
    try { const err = await res.json(); detail = err.detail || res.statusText; } catch { detail = res.statusText; }
    throw new Error(detail || `API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function apiGet(path, params) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(path + qs);
}
export function apiPost(path, body) { return apiFetch(path, { method: "POST", body: JSON.stringify(body) }); }
export function apiPatch(path, body) { return apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }); }
export function apiDelete(path) { return apiFetch(path, { method: "DELETE" }); }

/** Multipart file upload. The auth token must live in the header, never in the URL. */
export async function apiUpload(path, file) {
  const url = `${API_BASE_URL}${path}`;
  const token = AUTH_TOKEN || localStorage.getItem("mcs_token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) _onAuthExpired?.();
  if (!res.ok) {
    let detail;
    try { const err = await res.json(); detail = err.detail || res.statusText; } catch { detail = res.statusText; }
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return res.json();
}
'''


if __name__ == "__main__":
    main()
