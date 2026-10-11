/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { displayStatus, normalizeStatus } from "../utils/constants.js";
import { getU } from "../utils/helpers.js";
import { PC, SC, T } from "../utils/theme.js";

/* ===================== MICRO COMPONENTS ===================== */
export function SBadge({ s }) {
  const statusStr = typeof s === "object" && s !== null
    ? displayStatus(s)
    : (s === "PENDING CONFIRM" ? "PENDING CONFIRM" : (s || "NOT STARTED"));
  const c = SC[statusStr] || SC[normalizeStatus(statusStr)] || { bg: "#eee", text: "#333", dot: "#aaa" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {statusStr}
    </span>
  );
}

export function PBadge({ p }) { const c = PC[p] || { bg: "#eee", text: "#333" }; return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, background: c.bg, color: c.text, fontSize: 11, fontWeight: 600 }}>{p}</span>; }

export function Avatar({ name, size = 30, users = [] }) { const u = getU(name, users); return <span title={name} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: u.color + "20", color: u.color, fontSize: size * .34, fontWeight: 700, flexShrink: 0, border: `1.5px solid ${u.color}30` }}>{u.initials}</span>; }

export function Lbl({ t, req }) { return <label style={{ fontSize: 11, color: T.text2, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: .3 }}>{t}{req && <span style={{ color: T.red, marginLeft: 2 }}>*</span>}</label>; }

export function HR() { return <div style={{ height: 1, background: T.border, margin: "16px 0" }} />; }

export function Spin() { return <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />; }

export function Empty({ icon, title, sub }) { return <div style={{ textAlign: "center", padding: "48px 24px", color: T.text2 }}><div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div><div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 4 }}>{title}</div><div style={{ fontSize: 12 }}>{sub}</div></div>; }

export function MultiUserSelect({ value, users, onChange, placeholder = "Select persons…" }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const ref = React.useRef(null);
  const selected = (value || "").split(",").map(s => s.trim()).filter(Boolean);
  React.useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const toggle = (name) => { const next = selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]; onChange(next.join(", ")); };
  const remove = (name) => onChange(selected.filter(n => n !== name).join(", "));
  const filtered = (users || []).filter(u => !search || (u.name || "").toLowerCase().includes(search.toLowerCase()) || (u.role || "").toLowerCase().includes(search.toLowerCase()));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 4, padding: "5px 8px", minHeight: 34, borderRadius: 8, border: `1.5px solid ${open ? T.navy : T.border}`, background: "#fff", cursor: "pointer", alignItems: "center" }}>
        {selected.length === 0 && <span style={{ fontSize: 12, color: T.text2 }}>{placeholder}</span>}
        {selected.map(name => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 14, background: T.navy + "12", color: T.navy, fontSize: 11, fontWeight: 600 }}>
            <Avatar name={name} size={16} users={users} />
            {name}
            <span onClick={(e) => { e.stopPropagation(); remove(name); }} style={{ cursor: "pointer", marginLeft: 2, fontSize: 13, lineHeight: 1, opacity: .6 }}>&times;</span>
          </span>
        ))}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 50, maxHeight: 220, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}` }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or role…" style={{ width: "100%", fontSize: 12, padding: "5px 8px", border: `1px solid ${T.border}`, borderRadius: 6, outline: "none" }} autoFocus />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.map(u => {
              const sel = selected.includes(u.name);
              return (
                <div key={u.id || u.name} onClick={() => toggle(u.name)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", background: sel ? T.navy + "08" : "transparent", fontWeight: sel ? 600 : 400 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${sel ? T.navy : T.border}`, background: sel ? T.navy : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", flexShrink: 0 }}>{sel && "✓"}</span>
                  <Avatar name={u.name} size={20} users={users} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: T.text2 }}>{u.role || ""}</div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: T.text2, textAlign: "center" }}>No users found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function Chip({ label, color = "#272262" }) { return <span style={{ padding: "2px 9px", borderRadius: 20, background: color + "15", color, fontSize: 11, fontWeight: 600 }}>{label}</span>; }

export function KPICard({ icon, value, label, sub, color, onClick, alert: al }) {
  return <div className="card card-hover" onClick={onClick} style={{ padding: "14px 16px", position: "relative" }}>
    {al && <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: T.red, animation: "blink 1.2s ease-in-out infinite" }} />}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{sub}</div>}
    {onClick && <div style={{ fontSize: 10, color: T.navy, marginTop: 6, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase" }}>View →</div>}
  </div>;
}

export function PageHeader({ title, sub, children }) {
  return <div className="page-header-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
    <div><h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.navy, lineHeight: 1.2 }}>{title}</h1>{sub && <p style={{ fontSize: 13, color: T.text2, marginTop: 4 }}>{sub}</p>}</div>
    {children && <div className="page-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>}
  </div>;
}

export function Sparkbar({ pct, color }) {
  return <div style={{ background: T.border, borderRadius: 4, height: 6, overflow: "hidden", flex: 1 }}>
    <div style={{ height: "100%", borderRadius: 4, background: color, width: `${pct}%`, transition: "width .6s" }} />
  </div>;
}
/* ESC-close hook */

/* ── Reusable Save-to-Server button ──────────────────────────────────── */
export function SectionSaveButton({ label = "💾 Save to Server", onSave }) {
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState(null);
  const handleSave = async () => {
    setStatus("saving");
    setErrMsg(null);
    try { await onSave(); setStatus("saved"); }
    catch (e) { setStatus("error"); setErrMsg(e.message); console.error("Save failed:", e); }
    setTimeout(() => setStatus("idle"), 2500);
  };
  const col = status === "saved" ? T.green : status === "error" ? T.red : T.navy;
  const lbl = status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved!" : status === "error" ? "⚠ Failed" : label;
  return <>
    <button onClick={handleSave} disabled={status === "saving"}
      style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: status === "saving" ? "not-allowed" : "pointer", background: col, color: "#fff", fontWeight: 700, fontSize: 13, opacity: status === "saving" ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
      {status === "saving" && <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.5)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />}
      {lbl}
    </button>
    {errMsg && <span style={{ fontSize: 11, color: T.red, maxWidth: 260 }}>{errMsg}</span>}
  </>;
}

/* ── Team Page (Master Setup) ──────────────────────────────────────────────
   Shows every team member with their plant/dept/role/superior and how many
   of their actions are currently escalated. Admin, the team member's direct
   superior, or the target user named in the escalation tier can close it
   right here. */
