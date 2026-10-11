#!/usr/bin/env python3
"""Add auto-generated import headers to every split module.

Two-pass: build module→exports map, then for each file scan its body for
identifiers owned by other modules and emit import statements.
"""
import re
from pathlib import Path

SRC = Path("src")
MODULES = {
    "api/client.js": {"API_BASE_URL", "setAuthToken", "getAuthToken", "setCurrentRoles", "getCurrentRoles", "setOnAuthExpired", "apiFetch", "apiGet", "apiPost", "apiPatch", "apiDelete", "apiUpload"},
    "api/autosave.js": {"subscribeAutosave", "emitAutosave", "setAutosaveStatus", "pendingOps", "opKey", "queueOp", "clearOp", "flushPendingSaves", "reconcilePendingWithServer", "apiCreate", "apiUpdate", "apiRemove", "SNAPSHOT_KEY", "snapshotLocal", "loadSnapshot"},
    "utils/keys.js": {"denormKeys", "normKeys"},
    "utils/data.js": {"resolveRecordIds", "responsibleMatchesUsers", "resolveForeignKeys", "plantVisible", "meetingAccessNames", "canAccessMeeting", "ensureArray", "startOfWeekMonday", "buildWeekBelt", "normalizeActionPatch"},
    "utils/constants.js": {"WEEKDAY_NAMES", "DEFAULT_PLANTS", "DEFAULT_DEPTS", "DEFAULT_USERS", "MEETING_TYPES", "STATUS_LIST", "normalizeStatus", "displayStatus", "PRIORITY_LIST", "SECTIONS", "ATTENDEE_MAP", "MTG_INSTRUCTIONS", "SEED_PROJECTS", "SEED_MEETINGS", "SEED_ACTIONS", "SAMPLE_TRANSCRIPT_LINES", "NAV", "userViewPref", "userSortPref", "FILTER_STORE_KEY", "userFilterPref", "saveFilterPref"},
    "utils/permissions.js": {"isGuestRole", "getPerms", "isUserAdmin", "canAccessMasterSetup", "scopedPlants", "scopedDepts", "scopedUsers"},
    "utils/helpers.js": {"todayStr", "fmt", "todayLocal", "isOverdue", "daysOver", "getU", "nextSN", "getSuperiors"},
    "utils/escalation.js": {"DEFAULT_ESC_MATRIX", "getEscBadgeStyle", "resolveEscalationState", "runEscalation"},
    "utils/theme.js": {"T", "SC", "PC", "CSS"},
    "hooks/usePostgresDB.js": {"usePostgresDB"},
    "hooks/useRealtimeSync.js": {"useRealtimeSync"},
    "hooks/useEscClose.js": {"useEscClose"},
    "hooks/useNotifications.js": {"useNotifications"},
    "hooks/useAPIBridge.js": {"useAPIBridge"},
    "components/ui.jsx": {"SBadge", "PBadge", "Avatar", "Lbl", "HR", "Spin", "Empty", "MultiUserSelect", "Chip", "KPICard", "PageHeader", "Sparkbar", "SectionSaveButton"},
    "components/LoginPage.jsx": {"LoginPage"},
    "components/Modals.jsx": {"SupportModal", "UserProfilePanel", "AdminNotifManager", "SessionsManagerModal"},
    "components/Shell.jsx": {"Shell"},
    "components/ActionSidePanel.jsx": {"ActionSidePanel"},
    "components/ProjectCharterModal.jsx": {"ProjectCharterModal"},
    "components/AddProjectModal.jsx": {"AddProjectModal"},
    "components/MeetingPlanPanel.jsx": {"MeetingPlanPanel"},
    "components/CompletedMeetingDashboard.jsx": {"CompletedMeetingDashboard"},
    "components/WeeklyMeetingAccountability.jsx": {"WeeklyMeetingAccountability"},
    "components/AddMeetingModal.jsx": {"AddMeetingModal"},
    "components/MeetingRoom.jsx": {"MeetingRoom"},
    "components/AddActionPanel.jsx": {"AddActionPanel"},
    "components/StagingArea.jsx": {"StagingArea"},
    "components/ActionDetailPanel.jsx": {"ActionDetailPanel"},
    "components/views.jsx": {"TableView", "BoardView", "KanbanView", "TimelineView"},
    "components/EscMatrixTab.jsx": {"EscMatrixTab"},
    "components/ErrorBoundary.jsx": {"ErrorBoundary"},
    "pages/HomePage.jsx": {"HomePage"},
    "pages/WorkPage.jsx": {"WorkPage"},
    "pages/ActionsPage.jsx": {"ActionsPage"},
    "pages/DashboardPage.jsx": {"DashboardPage"},
    "pages/TeamPage.jsx": {"TeamPage"},
    "pages/EscalationsPage.jsx": {"EscalationsPage"},
    "pages/MasterPage.jsx": {"MasterPage"},
}
owner = {}
for mod, names in MODULES.items():
    for n in names:
        owner[n] = mod

REACT_HOOKS = {"useState", "useEffect", "useRef", "useCallback", "useMemo", "useContext", "useLayoutEffect"}


def relpath(from_mod, to_mod):
    depth = len(Path(from_mod).parent.parts)
    up = "../" * depth if depth else "./"
    return up + to_mod if depth else "./" + to_mod


def gen_header(file_mod, body):
    imports = []
    # react
    used_hooks = sorted(h for h in REACT_HOOKS if re.search(rf"\b{h}\b", body))
    needs_react = bool(used_hooks) or re.search(r"\bReact\.", body) or re.search(r"<[A-Z][\w.]*", body)
    if re.search(r"\bReact\.Component\b", body):
        imports.append('import React' + (f", {{ {', '.join(used_hooks)} }}" if used_hooks else "") + ' from "react";')
    elif needs_react:
        imports.append('import React' + (f", {{ {', '.join(used_hooks)} }}" if used_hooks else "") + ' from "react";')
    # module imports grouped by source module
    by_mod = {}
    for name, mod in owner.items():
        if mod == file_mod:
            continue
        if re.search(rf"\b{name}\b", body):
            by_mod.setdefault(mod, []).append(name)
    for mod in sorted(by_mod):
        names = sorted(by_mod[mod])
        imports.append(f'import {{ {", ".join(names)} }} from "{relpath(file_mod, mod)}";')
    return imports


def main():
    for mod in MODULES:
        p = SRC / mod
        text = p.read_text()
        lines = text.splitlines(keepends=True)
        # find end of existing header (eslint-disable line) then body
        body_start = 0
        if lines and "eslint-disable" in lines[0]:
            body_start = 1
        body = "".join(lines[body_start:])
        header = gen_header(mod, body)
        p.write_text("/* eslint-disable react-refresh/only-export-components */\n" + "\n".join(header) + "\n\n" + body)
        print(f"{mod}: {len(header)} imports")


if __name__ == "__main__":
    main()
