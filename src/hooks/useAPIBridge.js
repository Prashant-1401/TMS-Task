/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef } from "react";
import { apiCreate, apiUpdate } from "../api/autosave.js";
import { normalizeActionPatch, resolveRecordIds } from "../utils/data.js";
import { todayStr } from "../utils/helpers.js";

export function useAPIBridge(actions, setActions, projects, plants, depts, machines, meetings) {
  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  useEffect(() => {
    // Expose global API (TMS primary, MCS legacy)
          window.TMS_API = window.MCS_API = {
            version: "1.0.0",
            getActions: () => actionsRef.current,
            getAction: (id) => actionsRef.current.find(a => a.id === id || a.sn === id),
            updateAction: (id, patch) => { const np = normalizeActionPatch(patch); setActions(p => p.map(a => a.id === id ? { ...a, ...np } : a)); apiUpdate("actions", id, np); },
            addAction: async (action) => {
              const localId = String(Date.now());
              const n = { ...action, id: localId, created: todayStr(), revisionHistory: [], messages: [], pendingConfirmation: false };
              const resolved = resolveRecordIds(n, plants, depts, machines, projects, meetings);
              setActions(p => [...p, resolved]);
              try {
                const saved = await apiCreate("actions", resolved);
                if (saved && saved.id) setActions(p => p.map(x => x.id === localId ? { ...x, id: saved.id, sn: saved.sn || x.sn } : x));
              } catch (_e) { setActions(p => p.filter(x => x.id !== localId)); }
            },
            getProjects: () => projects,
          };
    // postMessage bridge
    const handler = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      switch (e.data.type) {
        case "TMS_GET_ACTIONS":
        case "MCS_GET_ACTIONS":
          e.source?.postMessage({ type: "TMS_ACTIONS_RESULT", data: actionsRef.current, ok: true }, "*");
          e.source?.postMessage({ type: "MCS_ACTIONS_RESULT", data: actionsRef.current, ok: true }, "*");
          break;
        case "TMS_GET_ACTION":
        case "MCS_GET_ACTION":
          e.source?.postMessage({ type: "TMS_ACTION_RESULT", data: actionsRef.current.find(a => a.id === e.data.id), ok: true }, "*");
          e.source?.postMessage({ type: "MCS_ACTION_RESULT", data: actionsRef.current.find(a => a.id === e.data.id), ok: true }, "*");
          break;
        case "TMS_UPDATE_ACTION":
        case "MCS_UPDATE_ACTION":
          setActions(p => p.map(a => a.id === e.data.id ? { ...a, ...e.data.patch } : a));
          apiUpdate("actions", e.data.id, e.data.patch).catch(_err => {
            setActions(p => p.map(a => a.id === e.data.id ? { ...a } : a));
          });
          e.source?.postMessage({ type: "TMS_UPDATE_OK", id: e.data.id, ok: true }, "*");
          e.source?.postMessage({ type: "MCS_UPDATE_OK", id: e.data.id, ok: true }, "*");
          break;
        case "TMS_ADD_ACTION":
        case "MCS_ADD_ACTION": {
          const localId = String(Date.now());
          const newA = { ...e.data.action, id: localId, created: todayStr(), revisionHistory: [], messages: [], pendingConfirmation: false };
          const resolved = resolveRecordIds(newA, plants, depts, machines, projects, meetings);
          setActions(p => [...p, resolved]);
          apiCreate("actions", resolved).then(saved => {
            if (saved && saved.id) setActions(p => p.map(x => x.id === localId ? { ...x, id: saved.id, sn: saved.sn || x.sn } : x));
          }).catch(() => { setActions(p => p.filter(x => x.id !== localId)); });
          e.source?.postMessage({ type: "TMS_ADD_OK", action: resolved, ok: true }, "*");
          e.source?.postMessage({ type: "MCS_ADD_OK", action: resolved, ok: true }, "*");
          break;
        }
        case "TMS_GET_PROJECTS":
        case "MCS_GET_PROJECTS":
          e.source?.postMessage({ type: "TMS_PROJECTS_RESULT", data: projects, ok: true }, "*");
          e.source?.postMessage({ type: "MCS_PROJECTS_RESULT", data: projects, ok: true }, "*");
          break;
        default: break;
      }
    };
    window.addEventListener("message", handler);
    return () => { window.removeEventListener("message", handler); delete window.MCS_API; delete window.TMS_API; };
  }, [setActions, projects, plants, depts, machines, meetings]);
}

/* ===================== ERROR BOUNDARY ===================== */
