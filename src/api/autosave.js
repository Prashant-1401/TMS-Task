/* eslint-disable react-refresh/only-export-components */
import { apiDelete, apiPatch, apiPost } from "../api/client.js";
import { normKeys } from "../utils/keys.js";

export function subscribeAutosave(fn) {
  autosaveListeners.add(fn);
  fn(_autosaveState);
  return () => autosaveListeners.delete(fn);
}

export function emitAutosave() {
  _autosaveState = { ..._autosaveState, pending: pendingOps.size };
  autosaveListeners.forEach(fn => { try { fn(_autosaveState); } catch {} });
}

export function setAutosaveStatus(status) {
  _autosaveState = { ..._autosaveState, status };
  emitAutosave();
}

// Pending operations queue: key → { resource, id, data, op }

// Pending operations queue: key → { resource, id, data, op }
export const pendingOps = new Map();

export function opKey(resource, id) { return `${resource}:${id ?? "new"}`; }

export function queueOp(resource, id, data, op) {
  pendingOps.set(opKey(resource, id), { resource, id, data, op });
  emitAutosave();
}

export function clearOp(resource, id) {
  pendingOps.delete(opKey(resource, id));
  emitAutosave();
}

export async function flushPendingSaves() {
  if (_flushing || pendingOps.size === 0) return;
  _flushing = true;
  setAutosaveStatus("saving");
  const entries = [...pendingOps.values()];
  for (const op of entries) {
    try {
      if (op.op === "create") {
        const saved = await apiPost(`/api/${op.resource}/`, normKeys(op.data));
        if (saved && saved.id) clearOp(op.resource, op.id || "new");
      } else {
        const id = op.id || (op.data && op.data.id);
        if (!id) { clearOp(op.resource, op.id || "new"); continue; }
        await apiPatch(`/api/${op.resource}/${id}`, normKeys(op.data));
        clearOp(op.resource, id);
      }
    } catch (e) {
      // keep in queue for next retry
      console.warn(`[autosave] retry pending ${op.resource}:${op.id || "new"} —`, e.message);
    }
  }
  _flushing = false;
  if (pendingOps.size === 0) {
    _autosaveState = { ..._autosaveState, status: "saved", lastSaved: Date.now() };
  } else {
    _autosaveState = { ..._autosaveState, status: "pending", lastSaved: Date.now() };
  }
  emitAutosave();
}

/* ─── Reconcile pending ops with live server data ──────────────
   After a real-time poll refetches server data, any optimistic
   create that has already been persisted shows up in the server
   response. Clear those pending ops so the "Saving… / Pending N"
   indicator hides once the change is live, and the local temp-id
   echo is replaced by the authoritative server record. ──────── */

export function reconcilePendingWithServer(resource, serverItems) {
  if (pendingOps.size === 0) return;
  const serverKeys = new Set(
    (serverItems || []).map(it => {
      const t = (it.text || it.name || "").trim().toLowerCase();
      const r = (it.responsible || it.facilitator || "").trim().toLowerCase();
      const c = (it.created || it.date || "").toString().slice(0, 10);
      return `${t}|${r}|${c}`;
    })
  );
  let changed = false;
  for (const op of [...pendingOps.values()]) {
    if (op.resource !== resource || op.op !== "create") continue;
    const d = op.data || {};
    const key = `${(d.text || d.name || "").trim().toLowerCase()}|${(d.responsible || d.facilitator || "").trim().toLowerCase()}|${(d.created || "").toString().slice(0, 10)}`;
    if (serverKeys.has(key)) {
      clearOp(resource, op.id);
      changed = true;
    }
  }
  if (changed && pendingOps.size === 0) {
    _autosaveState = { ..._autosaveState, status: "saved", lastSaved: Date.now() };
    emitAutosave();
  }
}


/* ─── API Persistence Sync (fire-and-forget with error log) ── */

/* ─── API Persistence Sync (fire-and-forget with error log) ── */
export async function apiCreate(resource, data, { track = true } = {}) {
  const id = data && (data.id || "new");
  if (track) queueOp(resource, id, data, "create");
  try {
    const result = await apiPost(`/api/${resource}/`, normKeys(data));
    if (track) clearOp(resource, id);
    return result;
  } catch (e) {
    console.error(`POST /api/${resource}/ failed:`, e.message);
    throw e; // leave in queue for background retry
  }
}

export async function apiUpdate(resource, id, data, { track = true } = {}) {
  if (track) queueOp(resource, id, data, "update");
  try {
    const result = await apiPatch(`/api/${resource}/${id}`, normKeys(data));
    if (track) clearOp(resource, id);
    return result;
  } catch (e) {
    console.error(`PATCH /api/${resource}/${id} failed:`, e.message);
    throw e; // leave in queue for background retry
  }
}

export async function apiRemove(resource, id) {
  try {
    const result = await apiDelete(`/api/${resource}/${id}`);
    return result;
  } catch (e) {
    console.error(`DELETE /api/${resource}/${id} failed:`, e.message);
    throw e;
  }
}

// LocalStorage snapshot backup of core editable collections.

// LocalStorage snapshot backup of core editable collections.
export const SNAPSHOT_KEY = "mcs_autosave_snapshot";

export function snapshotLocal(state) {
  try {
    const payload = {
      ts: Date.now(),
      actions: state.actions || [],
      meetings: state.meetings || [],
      projects: state.projects || [],
      machines: state.machines || [],
    };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[autosave] snapshot skipped:", e.message);
  }
}

export function loadSnapshot() {
  try {
    const s = localStorage.getItem(SNAPSHOT_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

/* ─── Key transforms (snake_case ↔ camelCase) ─────────────── */

export let _autosaveState = { status: "idle", pending: 0, lastSaved: null };

let _flushing = false;

export const autosaveListeners = new Set();
