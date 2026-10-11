/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";
import { reconcilePendingWithServer } from "../api/autosave.js";
import { apiGet, setCurrentRoles } from "../api/client.js";
import { resolveForeignKeys } from "../utils/data.js";
import { denormKeys } from "../utils/keys.js";

/* ─── usePostgresDB hook ───────────────────────────────────────────────── */
export function usePostgresDB({ defaultUsers, defaultPlants, defaultDepts,
  defaultActions, defaultMeetings, defaultProjects, defaultEscMatrix, defaultPresets, defaultMachines, defaultRoles }) {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [users, setUsersRaw] = useState(defaultUsers);
  const [plants, setPlantsRaw] = useState(defaultPlants);
  const [depts, setDeptsRaw] = useState(defaultDepts);
  const [actions, setActionsRaw] = useState(defaultActions);
  const [meetings, setMeetingsRaw] = useState(defaultMeetings);
  const [projects, setProjectsRaw] = useState(defaultProjects);
  const [escMatrix, setEscRaw] = useState(defaultEscMatrix);
  const [mtgPresets, setPresetsRaw] = useState(defaultPresets);
  const [machines, setMachinesRaw] = useState(defaultMachines || []);
  const [reasons, setReasonsRaw] = useState([]);
  const [persistedAudit, setPersistedAuditRaw] = useState([]);
  const [roles, setRolesRaw] = useState(defaultRoles || []);

  const fetchData = useCallback(async () => {
    try {
      const [rawP, rawD, rawU, rawA, rawM, rawPr, rawEm, rawPs, rawMc, rawRs, rawAu, rawRo] = await Promise.all([
        apiGet("/api/plants/").catch(() => []),
        apiGet("/api/departments/").catch(() => []),
        apiGet("/api/users/").catch(() => []),
        apiGet("/api/actions/").catch(() => []),
        apiGet("/api/meetings/").catch(() => []),
        apiGet("/api/projects/").catch(() => []),
        apiGet("/api/escalation/matrix").catch(() => []),
        apiGet("/api/meetings/presets").catch(() => []),
        apiGet("/api/machines/").catch(() => []),
        apiGet("/api/reasons/").catch(() => []),
        apiGet("/api/audit/").catch(() => []),
        apiGet("/api/roles/").catch(() => []),
      ]);

      const pDenorm = denormKeys(rawP);
      const dDenorm = denormKeys(rawD);
      const uDenorm = denormKeys(rawU);
      const aDenorm = denormKeys(rawA).map(a => ({ ...a, attendees: Array.isArray(a.attendees) ? a.attendees : [] }));
      const mDenorm = denormKeys(rawM).map(mt => ({ ...mt, attendees: Array.isArray(mt.attendees) ? mt.attendees : [] }));
      const prDenorm = denormKeys(rawPr);
      const emDenorm = denormKeys(rawEm);
      const mcDenorm = denormKeys(rawMc);
      const rsDenorm = denormKeys(rawRs);
      const auDenorm = denormKeys(rawAu);
      const roDenorm = denormKeys(rawRo);

      const resolvedU = resolveForeignKeys(uDenorm, pDenorm, dDenorm);
      const resolvedA = resolveForeignKeys(aDenorm, pDenorm, dDenorm);
      const resolvedM = resolveForeignKeys(mDenorm, pDenorm, dDenorm, prDenorm);
      const resolvedPr = resolveForeignKeys(prDenorm, pDenorm, dDenorm);
      const resolvedMc = resolveForeignKeys(mcDenorm, pDenorm, dDenorm);

      const psDenorm = { attendeeMap: {}, instructions: {} };
      (rawPs || []).forEach(row => {
        if (row.type) {
          psDenorm.attendeeMap[row.type] = Array.isArray(row.attendees) ? row.attendees : [];
          psDenorm.instructions[row.type] = Array.isArray(row.instructions) ? row.instructions : [];
        }
      });

      if (pDenorm.length) setPlantsRaw(pDenorm);
      if (dDenorm.length) setDeptsRaw(dDenorm);
      if (resolvedU.length) setUsersRaw(resolvedU);
      if (resolvedA.length) { setActionsRaw(resolvedA); reconcilePendingWithServer("actions", resolvedA); }
      if (resolvedM.length) { setMeetingsRaw(resolvedM); reconcilePendingWithServer("meetings", resolvedM); }
      if (resolvedPr.length) setProjectsRaw(resolvedPr);
      if (emDenorm.length) setEscRaw(emDenorm);
      if (rsDenorm.length) setReasonsRaw(rsDenorm);
      if (auDenorm.length) setPersistedAuditRaw(auDenorm);
      if (mcDenorm.length) setMachinesRaw(resolvedMc);
      if (roDenorm.length) { setRolesRaw(roDenorm); setCurrentRoles(roDenorm); }
      setPresetsRaw(psDenorm);
      setDbReady(true);
    } catch (e) {
      console.warn("API load failed, using defaults:", e.message);
      setDbError(e.message);
      setDbReady(true);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setUsers = useCallback((fnOrVal) => { setUsersRaw(fnOrVal); }, []);
  const setPlants = useCallback((fnOrVal) => { setPlantsRaw(fnOrVal); }, []);
  const setDepts = useCallback((fnOrVal) => { setDeptsRaw(fnOrVal); }, []);
  const setActions = useCallback((fnOrVal) => { setActionsRaw(fnOrVal); }, []);
  const setMeetings = useCallback((fnOrVal) => { setMeetingsRaw(fnOrVal); }, []);
  const setProjects = useCallback((fnOrVal) => { setProjectsRaw(fnOrVal); }, []);
  const setEscMatrix = useCallback((fnOrVal) => { setEscRaw(fnOrVal); }, []);
  const setMtgPresets = useCallback((fnOrVal) => { setPresetsRaw(fnOrVal); }, []);
  const setMachines = useCallback((fnOrVal) => { setMachinesRaw(fnOrVal); }, []);
  const setReasons = useCallback((fnOrVal) => { setReasonsRaw(fnOrVal); }, []);
  const setPersistedAudit = useCallback((fnOrVal) => { setPersistedAuditRaw(fnOrVal); }, []);
  const setRoles = useCallback((fnOrVal) => { setRolesRaw(fnOrVal); }, []);

  // Sync roles to module-level for getPerms()
  useEffect(() => { setCurrentRoles(roles); }, [roles]);

  return {
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
  };
}

/* ─── Real-time polling sync ──────────────────────────────────────
   Problem: the app only loaded data once on mount, so when another user
   (e.g. N) added/edited an action, the current user (M) never saw it
   until they manually refreshed the page.

   Fix: poll the backend on a fixed interval AND immediately whenever the
   tab regains focus / becomes visible. This keeps every logged-in browser
   in sync without WebSockets. A session heartbeat is also sent so the
   backend knows the user is actively online (session management). ───── */
