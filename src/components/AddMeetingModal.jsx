/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { Lbl } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { MEETING_TYPES } from "../utils/constants.js";
import { scopedPlants, scopedUsers } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ADD MEETING MODAL */
export function AddMeetingModal({ plants, users, projects, onSave, onClose, currentUser }) {
  useEscClose(onClose);
  const [f, setF] = useState({ name: "", type: "Custom", plant: "", time: "09:00", dur: 60, facilitator: "", recurring: false, recurrence: "daily", project: null, scheduledDays: [] });
  const [usePreset, setUsePreset] = useState(false);
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const FREQ_OPTS = [
    { v: "anyday", l: "Any Day", sub: "One-time meeting", icon: "📅" },
    { v: "everyday", l: "Every Day", sub: "Repeats daily", icon: "🔁" },
    { v: "selective", l: "Selective Days", sub: "Pick specific days", icon: "📆" },
  ];
  const DAY_OPTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const freqMode = f.recurring ? (f.scheduledDays.length > 0 ? "selective" : "everyday") : "anyday";
  const setFreq = (mode) => {
    if (mode === "anyday") up("recurring", false);
    else if (mode === "everyday") { up("recurring", true); up("scheduledDays", []); }
    else { up("recurring", true); up("scheduledDays", f.scheduledDays.length ? f.scheduledDays : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]); }
  };
  const canSave = f.name.trim() && f.plant && f.facilitator && f.time && f.project;
  const submit = () => { if (canSave) onSave({ ...f, type: f.name }); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 500, padding: 28 }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); submit(); } }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>Schedule New Meeting</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Lbl t="Meeting Name" req />
            <input value={f.name} onChange={e => up("name", e.target.value)} placeholder="e.g. Furnace Daily Review, Safety Briefing…" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={usePreset} onChange={e => setUsePreset(e.target.checked)} id="usePreset" style={{ width: 14, cursor: "pointer" }} />
            <label htmlFor="usePreset" style={{ fontSize: 12, cursor: "pointer", color: T.text2 }}>Or choose from standard meeting types:</label>
            {usePreset && <select value={f.type} onChange={e => { up("type", e.target.value); up("name", e.target.value); }} style={{ flex: 1, fontSize: 12 }}>
              {MEETING_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Plant" req /><select value={f.plant} onChange={e => up("plant", e.target.value)}><option value="">Select</option><option>All</option>{scopedPlants(currentUser, plants).map(p => <option key={p.id}>{p.name}</option>)}</select></div>
            <div><Lbl t="Time" req /><input type="time" value={f.time} onChange={e => up("time", e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Duration (min)" /><input type="number" value={f.dur} onChange={e => up("dur", +e.target.value)} min={15} max={360} /></div>
            <div><Lbl t="Facilitator" req /><select value={f.facilitator} onChange={e => up("facilitator", e.target.value)}><option value="">Select</option>{scopedUsers(currentUser, users).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
          </div>
          <div>
            <Lbl t="Link to Project" req />
            <select value={f.project || ""} onChange={e => up("project", e.target.value || null)} style={{ borderColor: !f.project ? T.red : T.border }}>
              <option value="">Select project (required)…</option>
              {projects.map(p => <option key={p.id}>{p.name}</option>)}
            </select>
            {!f.project && <div style={{ fontSize: 11, color: T.red, marginTop: 3 }}>Project is required to schedule a meeting.</div>}
          </div>
          <div style={{ background: T.bg, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.navy, marginBottom: 8 }}>Meeting Frequency</div>
            <div className="grid-3col" style={{ gap: 6 }}>
              {FREQ_OPTS.map(o => {
                const active = freqMode === o.v;
                return (
                  <button key={o.v} onClick={() => setFreq(o.v)} style={{ padding: "10px 8px", borderRadius: 8, border: `2px solid ${active ? T.navy : T.border}`, background: active ? T.navy : "#fff", color: active ? "#fff" : T.text, cursor: "pointer", textAlign: "center", transition: "all .15s" }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{o.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{o.l}</div>
                    <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>{o.sub}</div>
                  </button>
                );
              })}
            </div>
            {freqMode === "selective" && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#fff", borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, marginBottom: 6 }}>Select days (Mon – Sat)</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "nowrap", overflowX: "auto" }}>
                  {DAY_OPTS.map(d => {
                    const active = f.scheduledDays.includes(d);
                    return (
                      <button key={d} onClick={() => up("scheduledDays", active ? f.scheduledDays.filter(x => x !== d) : [...f.scheduledDays, d])} style={{ padding: "5px 10px", borderRadius: 6, border: `1.5px solid ${active ? T.navy : T.border}`, background: active ? T.navy : "transparent", color: active ? "#fff" : T.text, fontSize: 11, fontWeight: 600, cursor: "pointer", minWidth: 36 }}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" disabled={!canSave} style={{ opacity: canSave ? 1 : .5, cursor: canSave ? "pointer" : "not-allowed" }} onClick={submit}>Schedule</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== MEETING ROOM ===================== */
