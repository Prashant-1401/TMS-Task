import React, { useLayoutEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { apiPost, apiUpload } from "./api/client";
import { apiCreate, apiUpdate } from "./api/autosave";
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
import { resolveRecordIds } from "./utils/data";
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
    users, setUsers, plants, setPlants, depts, setDepts, actions, setActions, meetings, setMeetings, projects, setProjects,
    escMatrix, setEscMatrix, machines, setMachines, reasons, roles, setRoles, mtgPresets, setMtgPresets,
    globalActiveMtg, setGlobalActiveMtg, mtgRunning, setMtgRunning, mtgElapsed,
    mtgTxLines, setMtgTxLines, mtgFastActions, setMtgFastActions, mtgInsights, setMtgInsights,
    clearMeetingState, commitFinal, committing: _committing, committingRef,
    pendingForMe, notifs, unreadNotifs, markAllRead, markRead: _markRead, onlineCount, lastSync, syncing,
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

  // Loading screen while data loads
  if (!dbReady) return (
    <ErrorBoundary>
      <style>{CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${T.navy} 0%,#3D378C 100%)`, gap: 16 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>Task Management System</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,.7)", fontSize: 13 }}>
          <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,.5)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
          Loading data from server…
        </div>
        {dbError && <div style={{ fontSize: 11, color: "#FEF3CD", marginTop: 4 }}>⚠ {dbError}</div>}
      </div>
    </ErrorBoundary>
  );

  if (!user) return (<ErrorBoundary><style>{CSS}</style><LoginPage onLogin={acc => { setUser(acc); setPage(0); }} /></ErrorBoundary>);

  return (
    <ErrorBoundary>
      <style>{CSS}</style>
      <Shell page={page} setPage={setPage} user={user} onLogout={() => { try { apiPost("/api/auth/logout", {}).catch(() => {}); } finally { setUser(null); setPage(0); clearMeetingState(); } }} onQuickAdd={() => setShowQuickAdd(true)} pendingCount={pendingForMe} auditCount={audit.length} activeMtg={globalActiveMtg} onResumeActiveMtg={() => setPage(1)} mtgRunning={mtgRunning} mtgElapsed={mtgElapsed} notifications={notifs} unreadCount={unreadNotifs} onMarkAllRead={markAllRead} users={users} actions={actions} onShowSupport={() => setShowSupport(true)} onShowProfile={() => setShowProfile(true)} onShowAdminNotifs={() => setShowAdminNotifs(true)} onShowSessions={() => setShowSessions(true)} onlineCount={onlineCount} lastSync={lastSync} syncing={syncing}>
        <Routes>
        <Route path="/" element={(<HomePage actions={actions} setActions={setActions} user={user} setPage={setPage} users={users} meetings={meetings} plants={plants} depts={depts} setGlobalActiveMtg={m => { setGlobalActiveMtg(m); setMtgRunning(true); }} machines={machines} projects={projects} fetchData={fetchData} />)} />
        <Route path="/work" element={(<WorkPage plants={plants} depts={depts} users={users} onCommitFinal={rows => { commitFinal(rows); clearMeetingState(); }} actions={actions} setActions={setActions} user={user} onProjectUpdate={updated => { setProjects(p => p.map(x => x.id === updated.id ? updated : x)); apiUpdate("projects", updated.id, updated); }} allProjects={projects} setProjects={setProjects} allMeetings={meetings} setMeetings={setMeetings} setPage={setPage} globalActiveMtg={globalActiveMtg} setGlobalActiveMtg={m => { setGlobalActiveMtg(m); if (m) setMtgRunning(true); }} mtgRunning={mtgRunning} setMtgRunning={setMtgRunning} mtgElapsed={mtgElapsed} mtgTxLines={mtgTxLines} setMtgTxLines={setMtgTxLines} mtgFastActions={mtgFastActions} setMtgFastActions={setMtgFastActions} mtgInsights={mtgInsights} setMtgInsights={setMtgInsights} clearMeetingState={clearMeetingState} mtgPresets={mtgPresets} machines={machines} reasons={reasons} fetchData={fetchData} />)} />
        <Route path="/actions" element={(<ActionsPage actions={actions} setActions={setActions} plants={plants} depts={depts} users={users} user={user} projects={projects} machines={machines} meetings={meetings} fetchData={fetchData} />)} />
        <Route path="/dashboard" element={(<DashboardPage actions={actions} plants={plants} depts={depts} users={users} audit={audit} user={user} meetings={meetings} onViewEscalations={() => setPage(4)} refreshData={fetchData} setActions={setActions} />)} />
        <Route path="/escalations" element={(<EscalationsPage actions={actions} setActions={setActions} audit={audit} users={users} escMatrix={escMatrix} plants={plants} depts={depts} user={user} fetchData={fetchData} machines={machines} projects={projects} meetings={meetings} />)} />
        <Route path="/master" element={canAccessMasterSetup(user) && (<MasterPage user={user} plants={plants} setPlants={setPlants} depts={depts} setDepts={setDepts} users={users} setUsers={setUsers} escMatrix={escMatrix} setEscMatrix={setEscMatrix} mtgPresets={mtgPresets} setMtgPresets={setMtgPresets} machines={machines} setMachines={setMachines} refreshMaster={fetchData} roles={roles} setRoles={setRoles} actions={actions} setActions={setActions} />)} />
        </Routes>
      </Shell>
      {dbError && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "#FEF3CD", border: "1px solid #F5C842", borderRadius: 10, padding: "10px 20px", fontSize: 12, color: "#7D4E00", boxShadow: "0 4px 20px rgba(0,0,0,.15)", maxWidth: "90vw", textAlign: "center" }}>
          ⚠ {dbError}
        </div>
      )}
      {showSupport && <SupportModal user={user} onClose={() => setShowSupport(false)} />}
      {showProfile && <UserProfilePanel user={user} users={users} actions={actions} onClose={() => setShowProfile(false)} />}
      {showSessions && <SessionsManagerModal user={user} onClose={() => setShowSessions(false)} />}
      {showAdminNotifs && isUserAdmin(user) && <AdminNotifManager users={users} onClose={() => setShowAdminNotifs(false)} />}
      {showQuickAdd && (
        <AddActionPanel
          users={users} plants={plants} depts={depts}
          defaultPlant={user?.plant === "All" ? "" : user?.plant}
          defaultSrc="Quick Add"
          projects={projects}
          meetings={meetings}
          machines={machines}
          reasons={reasons}
          currentUser={user}
          saving={quickSaving}
          onSave={async (a, files) => {
            if (committingRef.current) return;
            committingRef.current = true;
            setQuickSaving(true);
            const localId = String(Date.now());
            const newAction = { ...a, id: localId, dateOfAction: todayStr(), revisions: 0, revisionHistory: [], created: todayStr(), closedOn: null, status: "IN PROCESS", messages: [], pendingConfirmation: false, allocatedBy: user?.name || "" };
            const resolved = resolveRecordIds(newAction, plants, depts, machines, projects, meetings);
            setActions(p => [...p, resolved]);
            try {
              const saved = await apiCreate("actions", resolved);
              if (saved && saved.id) {
                setActions(p => p.map(x => x.id === localId ? { ...x, id: saved.id, sn: saved.sn || x.sn } : x));
                // Upload pending files to the saved action
                if (files && files.length > 0) {
                  const failed = [];
                  for (const pf of files) {
                    try {
                      await apiUpload(`/api/actions/${saved.id}/attachments`, pf.file);
                    } catch (_err) { failed.push(pf.file.name); }
                  }
                  if (failed.length > 0) {
                    setDbError(`Upload failed for: ${failed.join(", ")}. Action was saved without attachments.`);
                    setTimeout(() => setDbError(null), 6000);
                  }
                }
              }
              fetchData();
            } catch (e) {
              setActions(p => p.filter(x => x.id !== localId));
              setDbError("Failed to save action: " + e.message);
              setTimeout(() => setDbError(null), 5000);
            } finally {
              committingRef.current = false;
              setQuickSaving(false);
            }
            setShowQuickAdd(false);
          }}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </ErrorBoundary>
  );
}
