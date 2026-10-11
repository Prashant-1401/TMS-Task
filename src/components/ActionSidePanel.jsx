/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { MultiUserSelect, PBadge, SBadge } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { daysOver, fmt, isOverdue } from "../utils/helpers.js";
import { isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ActionSidePanel — slide-in detail panel used across HomePage */
export function ActionSidePanel({ action, onClose, onUpdate, users, _plants,_deptss, currentUser }) {
  useEscClose(onClose);
  const [editField, setEditField] = useState(null);
  const [fieldVal, setFieldVal] = useState("");
  const [msg, setMsg] = useState("");
  const startEdit = (k, v) => { setEditField(k); setFieldVal(v || ""); };
  const commit = () => { if (onUpdate && editField) onUpdate(action.id, { [editField]: fieldVal }); setEditField(null); };
  const sendMsg = () => { if (!msg.trim()) return; const m = { id: Date.now(), author: currentUser?.name || "Unknown", text: msg.trim(), ts: new Date().toLocaleTimeString() }; onUpdate && onUpdate(action.id, { messages: [...(action.messages || []), m] }); setMsg(""); };
  const InlineField = ({ label, k, value, type = "text", opts }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>{label}</div>
      {editField === k
        ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {opts ? <select value={fieldVal} onChange={e => setFieldVal(e.target.value)} style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}>{opts.map(o => <option key={o}>{o}</option>)}{value && !opts.includes(value) && <option value={value}>{value}</option>}</select>
            : <input type={type} value={fieldVal} onChange={e => setFieldVal(e.target.value)} autoFocus style={{ flex: 1, fontSize: 12, padding: "4px 8px" }} />}
          <button onClick={commit} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✓</button>
          <button onClick={() => setEditField(null)} style={{ background: T.border, color: T.text, border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
        : <div style={{ fontSize: 13, color: T.text, padding: "4px 8px", borderRadius: 6, background: T.bg, cursor: "pointer", border: `1px solid transparent`, transition: "all .15s" }} onClick={() => startEdit(k, value)}
          onMouseEnter={e => e.currentTarget.style.border = `1px solid ${T.border}`}
          onMouseLeave={e => e.currentTarget.style.border = "1px solid transparent"}>
          {value || <span style={{ color: T.text2, fontStyle: "italic" }}>—</span>}
          <span style={{ fontSize: 9, color: T.text2, marginLeft: 6 }}>✏</span>
        </div>
      }
    </div>
  );
  if (!action) return null;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={onClose} />
      <div className="side-panel" style={{ width: 480, padding: 0, zIndex: 341 }}>
        <div style={{ background: `linear-gradient(135deg,${T.navy},#3D378C)`, padding: "18px 22px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, opacity: .6, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{action.sn} · {action.src}</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, lineHeight: 1.4 }}>{action.text}</div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 10 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "nowrap", overflowX: "auto" }}>
            <SBadge s={action.status} /><PBadge p={action.priority} />
            {isOverdue(action) && <span style={{ background: T.red, color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{daysOver(action)}d overdue</span>}
          </div>
        </div>
        <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>Responsible</div>
            <MultiUserSelect value={action.responsible} users={(users || []).filter(u => { if (action.plant && action.plant !== "All") return !u.plant || u.plant === "All" || u.plant === action.plant; if (!isUserAdmin(currentUser) && currentUser?.plant && currentUser.plant !== "All") return !u.plant || u.plant === "All" || u.plant === currentUser.plant; return true; })} onChange={v => { const patch = { responsible: v }; const firstName = (v || "").split(",").map(s => s.trim()).filter(Boolean)[0]; if (firstName) { const u = (users || []).find(x => x.name === firstName); if (u) { if (u.plant) patch.plant = u.plant; if (u.dept) patch.section = u.dept; } } onUpdate && onUpdate(action.id, patch); }} />
          </div>
          <InlineField label="Due Date" k="due" value={action.due} type="date" />
          <InlineField label="Status" k="status" value={action.status} opts={["NOT STARTED", "IN PROCESS", "COMPLETED", "DROPPED"]} />
          <InlineField label="Priority" k="priority" value={action.priority} opts={["NORMAL", "WARNING", "CRITICAL"]} />
          <InlineField label="Remarks" k="remarks" value={action.remarks} />
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>Details</div>
          <div className="grid-2col" style={{ gap: 8, marginBottom: 14 }}>
            {[["Plant", action.plant], ["Department", action.section], ["Allocated By", action.allocatedBy], ["Date of Action", fmt(action.dateOfAction)]].map(([l, v]) => (
              <div key={l} style={{ background: T.bg, borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.text2, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8 }}>Thread</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {(action.messages || []).map((m, i) => <div key={i} style={{ background: T.bg, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}><span style={{ fontWeight: 600, color: T.navy }}>{m.author}:</span> {m.text}</div>)}
            {(action.messages || []).length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic" }}>No messages yet</div>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMsg(); }} placeholder="Add a message…" style={{ flex: 1, fontSize: 12, padding: "6px 10px" }} />
            <button onClick={sendMsg} style={{ background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Send</button>
          </div>
        </div>
      </div>
    </>
  );
}
