import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiGet, setOnAuthExpired } from "../api/client";
import { apiCreate, apiUpdate, flushPendingSaves, pendingOps, setAutosaveStatus, snapshotLocal } from "../api/autosave";
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
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("mcs_session_user");
      return saved ? JSON.parse(saved) : null;
    } catch (_e) { return null; }
  });
  const [audit, setAudit] = useState([]);
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem("mcs_session_page");
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);

  // ── Postgres live database ──
  const {
    dbReady, dbError, setDbError, fetchData,
    users, setUsers,
    plants, setPlants,
    depts, setDepts,
    actions, setActions,
    meetings, setMeetings,
    projects, setProjects,
    escMatrix, setEscMatrix,
    mtgPresets, setMtgPresets,
    machines, setMachines,
    reasons, setReasons,
    persistedAudit, setPersistedAudit,
    roles, setRoles,
  } = usePostgresDB({
    defaultUsers: DEFAULT_USERS,
    defaultPlants: DEFAULT_PLANTS,
    defaultDepts: DEFAULT_DEPTS,
    defaultActions: SEED_ACTIONS,
    defaultMeetings: SEED_MEETINGS,
    defaultProjects: SEED_PROJECTS,
    defaultEscMatrix: DEFAULT_ESC_MATRIX,
    defaultPresets: { attendeeMap: ATTENDEE_MAP, instructions: MTG_INSTRUCTIONS },
    defaultMachines: [],
    defaultRoles: [
      { id: "R1", name: "Guest User", level: 1 },
      { id: "R3", name: "Supervisor", level: 3 },
      { id: "R4", name: "Shift Engineer", level: 4 },
      { id: "R5", name: "HOD", level: 5 },
      { id: "R6", name: "Plant Head", level: 6 },
      { id: "R7", name: "MD", level: 7 },
      { id: "R8", name: "Admin", level: 8 }
    ]
  });

  // Global active meeting — persists across page navigation + browser refresh
  const [globalActiveMtg, setGlobalActiveMtg] = useState(() => {
    try { const s = localStorage.getItem("mcs_mtg_active"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [mtgRunning, setMtgRunning] = useState(() => {
    try { return localStorage.getItem("mcs_mtg_running") === "true"; } catch { return false; }
  });
  const [mtgElapsed, setMtgElapsed] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem("mcs_mtg_elapsed") || "0", 10);
      const savedTs = parseInt(localStorage.getItem("mcs_mtg_timestamp") || "0", 10);
      // If meeting was running, add elapsed wall-clock time since last save
      const running = localStorage.getItem("mcs_mtg_running") === "true";
      if (running && savedTs > 0) {
        const diff = Math.floor((Date.now() - savedTs) / 1000);
        return saved + diff;
      }
      return saved;
    } catch { return 0; }
  });
  const [mtgTxLines, setMtgTxLines] = useState(() => {
    try { const s = localStorage.getItem("mcs_mtg_txlines"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [mtgFastActions, setMtgFastActions] = useState(() => {
    try { const s = localStorage.getItem("mcs_mtg_fastactions"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [mtgInsights, setMtgInsights] = useState(() => {
    try { const s = localStorage.getItem("mcs_mtg_insights"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const mtgTxLineNo = useRef(0);
  const mtgTimerRef = useRef(null);
  const _mtgTxRef = useRef(null);

  // Global 401 → force logout
  useEffect(() => {
    setOnAuthExpired(() => {
      localStorage.removeItem("mcs_token");
      setUser(null);
      setPage(0);
    });
    return () => setOnAuthExpired(null);
  }, []);

  // Persist session
  useEffect(() => {
    if (user) localStorage.setItem("mcs_session_user", JSON.stringify(user));
    else localStorage.removeItem("mcs_session_user");
  }, [user]);
  useEffect(() => {
    localStorage.setItem("mcs_session_page", page);
  }, [page]);

  // Persist meeting room state to localStorage so it survives browser refresh
  useEffect(() => {
    if (globalActiveMtg) localStorage.setItem("mcs_mtg_active", JSON.stringify(globalActiveMtg));
    else localStorage.removeItem("mcs_mtg_active");
  }, [globalActiveMtg]);
  useEffect(() => {
    localStorage.setItem("mcs_mtg_running", String(mtgRunning));
  }, [mtgRunning]);
  useEffect(() => {
    localStorage.setItem("mcs_mtg_elapsed", String(mtgElapsed));
    localStorage.setItem("mcs_mtg_timestamp", String(Date.now()));
  }, [mtgElapsed]);
  useEffect(() => {
    if (mtgTxLines.length > 0) localStorage.setItem("mcs_mtg_txlines", JSON.stringify(mtgTxLines));
    else localStorage.removeItem("mcs_mtg_txlines");
  }, [mtgTxLines]);
  useEffect(() => {
    if (mtgFastActions.length > 0) localStorage.setItem("mcs_mtg_fastactions", JSON.stringify(mtgFastActions));
    else localStorage.removeItem("mcs_mtg_fastactions");
  }, [mtgFastActions]);
  useEffect(() => {
    if (mtgInsights.length > 0) localStorage.setItem("mcs_mtg_insights", JSON.stringify(mtgInsights));
    else localStorage.removeItem("mcs_mtg_insights");
  }, [mtgInsights]);

  // Seed in-memory audit from persisted audit data on first load.
  // Dependency is intentionally dbReady only — running on persistedAudit would create a sync loop.
  useEffect(() => {
    if (dbReady && Array.isArray(persistedAudit) && persistedAudit.length > 0) {
      // Deduplicate on read — handles stale duplicate rows written before this fix
      const seen = new Set();
      const deduped = persistedAudit.filter(e => {
        const key = `${e.sn}_${e.level}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setAudit(deduped);
    }
  }, [dbReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global timer only — transcript now driven by real STT inside MeetingRoom
  useEffect(() => {
    if (mtgRunning && globalActiveMtg) {
      mtgTimerRef.current = setInterval(() => setMtgElapsed(e => e + 1), 1000);
    } else {
      clearInterval(mtgTimerRef.current);
    }
    return () => clearInterval(mtgTimerRef.current);
  }, [mtgRunning, globalActiveMtg]);

  // ── Background Autosave ──
  // 1) Periodically flush any pending (failed) saves to the backend.
  // 2) Periodically snapshot core collections to localStorage as a backup.
  useEffect(() => {
    const flushTimer = setInterval(() => { flushPendingSaves(); }, 15000);
    const snapTimer = setInterval(() => {
      snapshotLocal({ actions, meetings, projects, machines });
      if (pendingOps.size === 0) setAutosaveStatus("saved");
    }, 30000);
    // flush once shortly after load to recover anything queued
    const kick = setTimeout(() => flushPendingSaves(), 4000);
    return () => { clearInterval(flushTimer); clearInterval(snapTimer); clearTimeout(kick); };
  }, [actions, meetings, projects, machines]);

  // ── Live meeting draft autosave ──
  // While a meeting is actively running, push the live transcript / fast
  // actions / insights to the backend so an in-progress meeting is never lost
  // if the tab crashes or is closed before the final commit.
  useEffect(() => {
    if (!mtgRunning || !globalActiveMtg || !globalActiveMtg.id) return;
    const draftTimer = setInterval(() => {
      const draft = {
        txLines: mtgTxLines || [],
        fastActions: mtgFastActions || [],
        insights: mtgInsights || [],
        elapsed: mtgElapsed || 0,
        ts: Date.now(),
      };
      apiUpdate("meetings", globalActiveMtg.id, { live_draft: draft }, { track: false })
        .then(() => setAutosaveStatus("saved"))
        .catch(() => { /* will retry next tick */ });
    }, 15000);
    return () => clearInterval(draftTimer);
  }, [mtgRunning, globalActiveMtg, mtgTxLines, mtgFastActions, mtgInsights, mtgElapsed]);

  // Reset meeting state when meeting ends
  const clearMeetingState = () => {
    setGlobalActiveMtg(null); setMtgRunning(false); setMtgElapsed(0);
    setMtgTxLines([]); setMtgFastActions([]); setMtgInsights([]); mtgTxLineNo.current = 0;
    ["mcs_mtg_active","mcs_mtg_running","mcs_mtg_elapsed","mcs_mtg_timestamp","mcs_mtg_txlines","mcs_mtg_fastactions","mcs_mtg_insights"].forEach(k => localStorage.removeItem(k));
  };

  useAPIBridge(actions, setActions, projects, plants, depts, machines, meetings);

  // Real-time polling: keep this browser in sync with other users' changes
  const { lastSync, syncing } = useRealtimeSync({ fetchData, user, enabled: !!user });

  useEffect(() => {
    const t = setTimeout(() => runEscalation(actions, (updater) => {
      setAudit(updater);
      // Persist audit, deduplicating by SN+level to prevent
      // duplicate rows accumulating across sessions / re-runs.
      setPersistedAudit(prev => {
        const current = Array.isArray(prev) ? prev : [];
        const updated = typeof updater === "function" ? updater(current) : updater;
        const seen = new Set();
        return updated.filter(e => {
          const key = `${e.sn}_${e.level}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 100);
      });
    }, escMatrix, users), 1500);
    return () => clearTimeout(t);
  }, [actions]);

  const committingRef = useRef(false);
  const [committing, setCommitting] = useState(false);
  const commitFinal = rows => {
    if (committingRef.current) return;
    committingRef.current = true;
    setCommitting(true);
    const localIds = [];
    const resolvedRows = rows.map((r, i) => {
      const localId = String(Date.now() + i);
      localIds.push(localId);
      const base = { ...r, id: localId, messages: r.messages || [], revisionHistory: r.revisionHistory || [], pendingConfirmation: false, allocatedBy: r.allocatedBy || user?.name || "" };
      return resolveRecordIds(base, plants, depts, machines, projects, meetings);
    });
    setActions(p => [...p, ...resolvedRows]);
    Promise.all(
      resolvedRows.map(async (r, i) => {
        try {
          const saved = await apiCreate("actions", r);
          if (saved && saved.id) {
            setActions(p => p.map(x => x.id === localIds[i] ? { ...x, id: saved.id, sn: saved.sn || x.sn } : x));
          }
        } catch (e) {
          setActions(p => p.filter(x => x.id !== localIds[i]));
          setDbError("Failed to save action: " + e.message);
          setTimeout(() => setDbError(null), 5000);
        }
      })
    ).finally(() => {
      committingRef.current = false;
      setCommitting(false);
      fetchData();
    });
    if (globalActiveMtg && globalActiveMtg.id) {
      const sessionEntry = { date: todayStr(), duration: mtgElapsed || 0, actionCount: rows.length, attendees: ensureArray(globalActiveMtg.attendees || []), facilitator: globalActiveMtg.facilitator || "" };
      setMeetings(p => (p || []).map(m => m.id === globalActiveMtg.id ? { ...m, completedSessions: [...ensureArray(m.completedSessions), sessionEntry] } : m));
      // Persist the completed session AND clear the live draft in one update.
      apiUpdate("meetings", globalActiveMtg.id, { completedSessions: [...ensureArray(globalActiveMtg.completedSessions), sessionEntry], live_draft: {} }, { track: false });
    }
  };
  const updateAction = async (id, patch) => {
    const np = normalizeActionPatch(patch);
    setActions(p => p.map(a => {
      if (a.id !== id) return a;
      if (np.due && np.due !== a.due) {
        const rev = { date: todayStr(), from: a.due, to: np.due, by: user?.name || "Unknown" };
        return { ...a, ...np, revisions: (a.revisions || 0) + 1, revisionHistory: [...(a.revisionHistory || []), rev] };
      }
      return { ...a, ...np };
    }));
    try {
      const saved = await apiUpdate("actions", id, resolveRecordIds(np, plants, depts, machines, projects, meetings));
      if (saved && saved.id) {
        setActions(p => p.map(a => a.id === id ? { ...a, version: saved.version, revisions: saved.revisions } : a));
      }
    } catch (e) {
      setDbError("Failed to update action: " + e.message);
      setTimeout(() => setDbError(null), 5000);
      fetchData();
    }
  };

  // Sidebar Actions badge = open (non-completed, non-dropped) actions in user's plant scope
  const pendingForMe = actions.filter(a => {
    if (a.status === "COMPLETED" || a.status === "DROPPED") return false;
    if (isUserAdmin(user) || user?.plant === "All") return true;
    return !a.plant || a.plant === user?.plant;
  }).length;

  // Notification system
  const { notifs, unread: unreadNotifs, markAllRead, markRead } = useNotifications(actions, audit, user, users);

  // UI modals/panels
  const [showSupport, setShowSupport] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showAdminNotifs, setShowAdminNotifs] = useState(false);

  // Active-session count (for the "My Sessions" badge in the user menu)
  const [onlineCount, setOnlineCount] = useState(0);
  useEffect(() => {
    if (!user) { setOnlineCount(0); return; }
    const loadCount = () => {
      apiGet("/api/sessions/mine").then(s => setOnlineCount(Array.isArray(s) ? s.length : 0)).catch(() => {});
    };
    loadCount();
    const t = setInterval(loadCount, 60000);
    return () => clearInterval(t);
  }, [user]);


  const value = {
    user, setUser, page, setPage, audit, setAudit,
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
    showSessions, setShowSessions, showAdminNotifs, setShowAdminNotifs,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
