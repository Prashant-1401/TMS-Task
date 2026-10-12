/* eslint-disable react-refresh/only-export-components */
import React, { useRef, useState } from "react";
import { API_BASE_URL, getAuthToken } from "../api/client.js";
import { T } from "../utils/theme.js";

const btnStyle = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
  borderRadius: 8, border: `1px solid ${T.line || "#D9DDE6"}`, background: "transparent",
  color: T.text || "#1F2430", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};

/** Export an xlsx from `path` (adds auth header — never put tokens in URLs). */
async function downloadExcel(path, filename) {
  const token = getAuthToken() || localStorage.getItem("mcs_token");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* binary/error body */ }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import/Export buttons for Actions and Users (Admin Panel).
 *  kind: "actions" | "users"
 */
export function ExcelIO({ kind, onImported }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const isActions = kind === "actions";

  const doImport = async file => {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const token = getAuthToken() || localStorage.getItem("mcs_token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}${isActions ? "/api/actions/excel/import" : "/api/users/excel/import"}`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Import failed (${res.status})`);
      const summary = isActions
        ? `Imported ${data.created} action(s)`
        : `Imported ${data.created} user(s)`;
      const errs = (data.errors || []).length ? ` — ${data.errors.length} warning(s): ${data.errors.slice(0, 3).join("; ")}` : "";
      setMsg({ ok: true, text: summary + errs });
      onImported?.();
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Import failed" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button type="button" style={btnStyle} disabled={busy}
        onClick={() => downloadExcel(
          isActions ? "/api/actions/excel/export" : "/api/users/excel/export",
          isActions ? "actions.xlsx" : "users.xlsx",
        ).catch(e => setMsg({ ok: false, text: e.message }))}>
        ⬇ Export Excel
      </button>
      <button type="button" style={btnStyle} disabled={busy} onClick={() => fileRef.current?.click()}>
        ⬆ Import Excel
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm" hidden
        onChange={e => doImport(e.target.files?.[0])} />
      {busy && <span style={{ fontSize: 11.5, color: T.text2 }}>Working…</span>}
      {msg && (
        <span style={{ fontSize: 11.5, color: msg.ok ? "#0B7A3E" : "#B3261E", maxWidth: 420 }}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
