#!/usr/bin/env python3
"""Assemble src/store/AppContext.jsx and the new router-based src/App.jsx."""
import re
from pathlib import Path

store_logic = Path("/tmp/store_logic.txt").read_text()
tail_jsx = Path("/tmp/tail_jsx.txt").read_text()

# ── store fixes ──
store_logic = store_logic.replace(
    "if (pendingOps.size === 0) { _autosaveState = { ..._autosaveState, status: \"saved\", lastSaved: Date.now() }; emitAutosave(); }",
    "if (pendingOps.size === 0) setAutosaveStatus(\"saved\");")
store_logic = store_logic.replace(
    ".then(() => { _autosaveState = { ..._autosaveState, status: \"saved\", lastSaved: Date.now() }; emitAutosave(); })",
    ".then(() => setAutosaveStatus(\"saved\"))")
store_logic = store_logic.replace(
    "useAPIBridge(actions, setActions, projects, plants, depts, machines);",
    "useAPIBridge(actions, setActions, projects, plants, depts, machines, meetings);")

VALUE_KEYS = """user, setUser, page, setPage, audit, setAudit,
    dbReady, dbError, setDbError, fetchData,
    users, setUsers, plants, setPlants, depts, setDepts,
    actions, setActions, meetings, setMeetings, projects, setProjects,
    escMatrix, setEscMatrix, mtgPresets, setMtgPresets,
    machines, setMachines, reasons, setReasons, roles, setRoles,
    globalActiveMtg, setGlobalActiveMtg, mtgRunning, setMtgRunning, mtgElapsed,
    mtgTxLines, setMtgTxLines, mtgFastActions, setMtgFastActions,
    mtgInsights, setMtgInsights, clearMeetingState,
    commitFinal, committing, updateAction, committingRef,
    pendingForMe, notifs, unreadNotifs, markAllRead, markRead,
    onlineCount, lastSync, syncing,
    showQuickAdd, setShowQuickAdd, quickSaving, setQuickSaving,
    showSupport, setShowSupport, showProfile, setShowProfile,
    showSessions, setShowSessions, showAdminNotifs, setShowAdminNotifs,"""

STORE = '''import React, { createContext, useContext } from "react";
import { apiCreate, apiGet, apiPost, apiUpdate, setOnAuthExpired } from "../api/client";
import { flushPendingSaves, pendingOps, setAutosaveStatus, snapshotLocal } from "../api/autosave";
import { useAPIBridge } from "../hooks/useAPIBridge";
import { useNotifications } from "../hooks/useNotifications";
import { usePostgresDB } from "../hooks/usePostgresDB";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import {
  ATTENDEE_MAP, DEFAULT_DEPTS, DEFAULT_PLANTS, DEFAULT_USERS, MTG_INSTRUCTIONS,
  SEED_ACTIONS, SEED_MEETINGS, SEED_PROJECTS,
} from "../utils/constants";
import { ensureArray, resolveRecordIds, normalizeActionPatch } from "../utils/data";
import { isUserAdmin } from "../utils/permissions";
import { todayStr } from "../utils/helpers";
import { DEFAULT_ESC_MATRIX, runEscalation } from "../utils/escalation";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

/**
 * Single source of truth for app state (extracted from the old monolithic App).
 * All page components consume this via useApp(); App.jsx renders the provider
 * and the router shell.
 */
export function AppProvider({ children }) {
''' + store_logic + '''
  const value = {
    ''' + VALUE_KEYS + '''
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
'''
Path("src/store/AppContext.jsx").write_text(STORE, encoding="utf-8")
print("store written:", len(STORE.splitlines()), "lines")

# ── App.jsx from tail ──
tail = tail_jsx
# 1. quick-add upload fetch → apiUpload
old_upload = '''                if (files && files.length > 0) {
                  const failed = [];
                  for (const pf of files) {
                    try {
                      const formData = new FormData();
                      formData.append("file", pf.file);
                      const resp = await fetch(`${API_BASE_URL}/api/actions/${saved.id}/attachments`, {
                        method: "POST",
                        headers: { "x-api-key": API_KEY, "Authorization": `Bearer ${AUTH_TOKEN || localStorage.getItem("mcs_token")}` },
                        body: formData,
                      });
                      if (!resp.ok) failed.push(pf.file.name);
                    } catch (err) { failed.push(pf.file.name); }
                  }'''
new_upload = '''                if (files && files.length > 0) {
                  const failed = [];
                  for (const pf of files) {
                    try {
                      await apiUpload(`/api/actions/${saved.id}/attachments`, pf.file);
                    } catch (err) { failed.push(pf.file.name); }
                  }'''
assert old_upload in tail, "quick-add upload block not found"
tail = tail.replace(old_upload, new_upload)

# 2. extract route elements from {page === N && <X/>} lines
def to_route(match):
    cond, elem = match.group(1), match.group(2)
    m = re.match(r"page === (\d+)", cond)
    pid = m.group(1)
    path = {"0": "/", "1": "/work", "2": "/actions", "3": "/dashboard", "4": "/escalations", "99": "/master"}[pid]
    guard = "canAccessMasterSetup(user) && " if "canAccessMasterSetup" in cond else ""
    return f"        <Route path=\"{path}\" element={{{guard}({elem})}} />"

tail = re.sub(r"^\s*\{(page === \d+(?: && canAccessMasterSetup\(user\))?) && (.*)\}\s*$", to_route, tail, flags=re.M)
assert "<Route path=\"/work\"" in tail

# 3. wrap Routes around the Route elements
tail = tail.replace("        <Route path=\"/\"", '        <Routes>\n        <Route path="/"')
tail = tail.replace('element={(<MasterPage ', 'element={(<MasterPage ')  # no-op safety
tail = tail.replace(" />}} />", " />}} />")
tail = re.sub(r'(</Shell>)', r"\1", tail)
# insert </Routes> before </Shell>: find last Route line then add closing
tail = tail.replace("      </Shell>", "        </Routes>\n      </Shell>")

APP = '''import React, { useEffect, useLayoutEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { apiPost, apiUpdate, apiUpload } from "./api/client";
import { apiCreate } from "./api/client";
import { AddActionPanel } from "./components/AddActionPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoginPage } from "./components/LoginPage";
import { AdminNotifManager, SessionsManagerModal, SupportModal, UserProfilePanel } from "./components/Modals";
import { Shell } from "./components/Shell";
import { ActionsPage } from "./pages/ActionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EscalationsPage } from "./pages/EscalationsPage";
import { HomePage } from "./pages/HomePage";
import { MasterPage } from "./pages/MasterPage";
import { WorkPage } from "./pages/WorkPage";
import { AppProvider, useApp } from "./store/AppContext";
import { canAccessMasterSetup, isUserAdmin } from "./utils/permissions";
import { CSS, T } from "./utils/theme";
import { ensureArray, resolveRecordIds } from "./utils/data";
import { todayStr } from "./utils/helpers";

const PAGE_PATHS = { 0: "/", 1: "/work", 2: "/actions", 3: "/dashboard", 4: "/escalations", 99: "/master" };
const PATH_TO_PAGE = Object.fromEntries(Object.entries(PAGE_PATHS).map(([k, v]) => [v, Number(k)]));

/**
 * Root: renders the store provider + the routed application shell.
 * The numeric `page` in the store remains the source of truth (persisted),
 * and is kept bidirectionally in sync with the browser URL for deep links.
 */
export default function App() {
  return (
    <AppProvider>
      <AppRoot />
    </AppProvider>
  );
}

function AppRoot() {
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user, setUser, page, setPage, audit, dbReady, dbError, setDbError, fetchData,
    users, plants, depts, actions, setActions, meetings, setMeetings, projects, setProjects,
    escMatrix, machines, reasons, roles, mtgPresets,
    globalActiveMtg, setGlobalActiveMtg, mtgRunning, setMtgRunning, mtgElapsed,
    mtgTxLines, setMtgTxLines, mtgFastActions, setMtgFastActions, mtgInsights, setMtgInsights,
    clearMeetingState, commitFinal, committing, committingRef,
    pendingForMe, notifs, unreadNotifs, markAllRead, markRead, onlineCount, lastSync, syncing,
    showQuickAdd, setShowQuickAdd, quickSaving, setQuickSaving,
    showSupport, setShowSupport, showProfile, setShowProfile,
    showSessions, setShowSessions, showAdminNotifs, setShowAdminNotifs,
  } = app;

  // ── keep numeric page and URL in sync (deep links + back button) ──
  const path = PAGE_PATHS[page] ?? "/";
  useLayoutEffect(() => {
    if (location.pathname !== path) navigate(path, { replace: true });
  }, [path, location.pathname, navigate]);
  useLayoutEffect(() => {
    const p = PATH_TO_PAGE[location.pathname];
    if (p !== undefined && p !== page) setPage(p);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

''' + tail

Path("src/App.jsx").write_text(APP, encoding="utf-8")
print("App.jsx written:", len(APP.splitlines()), "lines")
