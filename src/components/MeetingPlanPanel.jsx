/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { Avatar } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { MEETING_TYPES } from "../utils/constants.js";
import { ensureArray } from "../utils/data.js";
import { fmt } from "../utils/helpers.js";
import { scopedUsers } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* Feature 4: Meeting Plan Side Panel */
export function MeetingPlanPanel({ mtg, canEdit, projects, users, _plants, onSave, onClose, mtgPresets, currentUser }) {
  useEscClose(onClose);
  const [editMode, setEditMode] = useState(false);
  const defaultInstructions = ensureArray(mtgPresets?.instructions?.[mtg.type] || ["Follow meeting agenda", "Capture all action points", "Assign clear owners and due dates", "Confirm previous actions before closing"]);
  const defaultAttendees = ensureArray(mtgPresets?.attendeeMap?.[mtg.type]);
  const [draft, setDraft] = useState({
    ...mtg,
    name: mtg.name || mtg.type || "",
    guidelines: ensureArray(mtg.guidelines || defaultInstructions),
    attendees: ensureArray(mtg.attendees || defaultAttendees),
  });
  const up = (k, v) => setDraft(x => ({ ...x, [k]: v }));
  const guidelines = draft.guidelines;
  const attendees = draft.attendees;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={onClose} />
      <div className="side-panel" style={{ width: 520, padding: 0 }}>
        <div style={{ background: `linear-gradient(135deg,${T.navy},#3D378C)`, padding: "20px 24px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, opacity: .6, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Meeting Plan</div>
              {editMode
                ? <input value={draft.name || draft.type || ""} onChange={e => up("name", e.target.value)} placeholder="Meeting name" style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.4)", borderRadius: 8, padding: "4px 10px", width: "100%", marginBottom: 4 }} />
                : <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{mtg.name || mtg.type}</h2>}
              <div style={{ fontSize: 12, opacity: .8 }}>{mtg.plant} · {mtg.time} · {mtg.dur}min</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {canEdit && !editMode && <button onClick={() => setEditMode(true)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏ Edit</button>}
              {editMode && <><button onClick={() => { onSave(draft); setEditMode(false); }} style={{ background: T.green, border: "none", color: "#fff", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Save</button><button onClick={() => { setDraft({ ...mtg, guidelines: mtg.guidelines || [...defaultInstructions], attendees: mtg.attendees || [...defaultAttendees] }); setEditMode(false); }} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Cancel</button></>}
              <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          </div>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[{ l: "Type", k: "type", opts: MEETING_TYPES, type: "select" }, { l: "Facilitator", k: "facilitator", type: "userselect" }, { l: "Time", k: "time", type: "time" }, { l: "Duration (min)", k: "dur", type: "number" }].map(({ l, k, opts, type }) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{l}</div>
                {editMode
                  ? type === "select" ? <select value={draft[k]} onChange={e => up(k, e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select>
                    : type === "userselect" ? <select value={draft[k]} onChange={e => up(k, e.target.value)}>{scopedUsers(currentUser, users).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select>
                      : <input type={type || "text"} value={draft[k]} onChange={e => up(k, e.target.value)} />
                  : <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{mtg[k]}</div>
                }
              </div>
            ))}
          </div>
          {editMode && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Linked Project</div>
              <select value={draft.project || ""} onChange={e => up("project", e.target.value || null)}><option value="">None</option>{projects.map(p => <option key={p.id}>{p.name}</option>)}</select>
            </div>
          )}
          {(mtg.scheduledDays && mtg.scheduledDays.length > 0) || editMode ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Scheduled Days</div>
              {editMode
                ? <div style={{ display: "flex", gap: 5, flexWrap: "nowrap", overflowX: "auto" }}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => {
                    const days = ensureArray(draft.scheduledDays || []);
                    const active = days.includes(d);
                    return <button key={d} onClick={() => up("scheduledDays", active ? days.filter(x => x !== d) : [...days, d])} style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${active ? T.navy : T.border}`, background: active ? T.navy : "transparent", color: active ? "#fff" : T.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{d}</button>;
                  })}
                </div>
                : <div style={{ display: "flex", gap: 5, flexWrap: "nowrap", overflowX: "auto" }}>{ensureArray(mtg.scheduledDays || []).map(d => <span key={d} style={{ padding: "3px 10px", borderRadius: 6, background: T.navy + "15", color: T.navy, fontSize: 11, fontWeight: 600 }}>{d}</span>)}</div>
              }
            </div>
          ) : null}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.navy }}>📌 Meeting Guidelines</div>
              {editMode && <button onClick={() => up("guidelines", [...guidelines, ""])} style={{ fontSize: 11, background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer" }}>+ Add</button>}
            </div>
            {editMode
              ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {guidelines.map((g, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: T.text2, fontSize: 12, minWidth: 18 }}>{i + 1}.</span>
                    <input value={g} onChange={e => up("guidelines", guidelines.map((x, idx) => idx === i ? e.target.value : x))} style={{ flex: 1, fontSize: 12, padding: "5px 8px" }} />
                    <button onClick={() => up("guidelines", guidelines.filter((_, idx) => idx !== i))} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.red, fontSize: 16, lineHeight: 1, padding: "0 4px" }}>×</button>
                  </div>
                ))}
                {guidelines.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic" }}>No guidelines — click + Add</div>}
              </div>
              : <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {guidelines.map((s, i) => <li key={i} style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{s}</li>)}
                {guidelines.length === 0 && <li style={{ fontSize: 12, color: T.text2, fontStyle: "italic", listStyle: "none" }}>No guidelines added yet</li>}
              </ol>
            }
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.navy }}>👥 Expected Attendees</div>
              {editMode && <select defaultValue="" onChange={e => { const v = e.target.value; if (v && !attendees.includes(v)) up("attendees", [...attendees, v]) }}>
                <option value="" disabled>+ Add person</option>
                {scopedUsers(currentUser, users).filter(u => !attendees.includes(u.name)).map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
              </select>}
            </div>
            <div style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 8 }}>
              {attendees.map((name, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: T.bg, borderRadius: 8, padding: "5px 10px" }}>
                  <Avatar name={name} size={22} users={users || []} /><span style={{ fontSize: 12 }}>{name}</span>
                  {editMode && <button onClick={() => up("attendees", attendees.filter((_, idx) => idx !== i))} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.red, fontSize: 14, lineHeight: 1, padding: "0 2px", marginLeft: 2 }}>×</button>}
                </div>
              ))}
              {attendees.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic" }}>No attendees added</div>}
            </div>
          </div>
          {(mtg.completedSessions || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.navy, marginBottom: 8 }}>📊 Past Sessions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(mtg.completedSessions || []).map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", background: T.bg, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <span>{fmt(s.date)}</span><span style={{ fontWeight: 600, color: T.navy }}>{s.duration} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── COMPLETED MEETING DASHBOARD ── */
