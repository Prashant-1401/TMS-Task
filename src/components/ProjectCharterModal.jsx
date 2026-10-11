/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { Avatar, SBadge } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { fmt, isOverdue, todayStr } from "../utils/helpers.js";
import { isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ===================== PROJECT CHARTER MODAL ===================== */
export function ProjectCharterModal({ pr, onClose, actions, meetings, user, onProjectUpdate, onActionSelect, users: allUsers }) {
  useEscClose(onClose);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ ...pr, milestones: [...(Array.isArray(pr.milestones) ? pr.milestones : []).map(m => ({ ...m }))], team: [...((Array.isArray(pr.team) ? pr.team : (typeof pr.team === "string" ? [pr.team] : [])) || [])], risks: pr.risks || "" });
  const canEdit = isUserAdmin(user) || (user?.name === pr.owner) || (user?.name === pr.sponsor);
  const pActions = actions.filter(a => (a.projectName || a.project) === pr.name);
  const projectMeetings = (meetings || []).filter(m => m.project === pr.name);
  const now = new Date();
  const _start = new Date(pr.startDate || pr.start), end = new Date(pr.endDate || pr.end);
  const safeMilestones = Array.isArray((editMode ? draft : pr).milestones) ? (editMode ? draft : pr).milestones : [];
  const done = safeMilestones.filter(m => m.done).length;
  const total = safeMilestones.length;
  const milestonePct = total > 0 ? Math.round(done / total * 100) : 0;
  const isOverdueProject = now > end && pr.status !== "COMPLETED";
  const barColor = pr.status === "COMPLETED" ? T.green : isOverdueProject ? T.red : milestonePct >= 66 ? T.green : milestonePct >= 33 ? T.amber : T.red;
  const current = { ...(editMode ? draft : pr), milestones: safeMilestones };

  const toggleMilestone = (i) => {
    if (!editMode && !canEdit) return;
    setDraft(d => ({ ...d, milestones: d.milestones.map((m, idx) => idx === i ? { ...m, done: !m.done } : m) }));
    if (!editMode) onProjectUpdate({ ...pr, milestones: (Array.isArray(pr.milestones) ? pr.milestones : []).map((m, idx) => idx === i ? { ...m, done: !m.done } : m) });
  };
  const save = () => { onProjectUpdate(draft); setEditMode(false); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 860, padding: 0, maxHeight: "93vh" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg,${T.navy},#3D378C)`, borderRadius: "18px 18px 0 0", padding: "24px 28px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, opacity: .6, marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>Project Charter</div>
              {editMode
                ? <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.4)", borderRadius: 8, padding: "4px 10px", width: "100%", marginBottom: 6 }} />
                : <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{pr.name}</h2>}
              <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
                <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.15)", fontSize: 11, fontWeight: 600 }}>{pr.plant}</span>
                <span style={{ padding: "3px 10px", borderRadius: 20, background: pr.priority === "CRITICAL" ? T.red + "80" : pr.priority === "WARNING" ? T.amber + "80" : "rgba(255,255,255,.15)", fontSize: 11, fontWeight: 600 }}>{pr.priority}</span>
                <span style={{ padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.15)", fontSize: 11, fontWeight: 600 }}>{pr.status}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {canEdit && !editMode && <button onClick={() => setEditMode(true)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏ Edit</button>}
              {editMode && <><button onClick={save} style={{ background: T.green, border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Save</button><button onClick={() => setEditMode(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Cancel</button></>}
              <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: .85, marginBottom: 6 }}>
              <span>{fmt(pr.startDate || pr.start)}</span>
              <span style={{ fontWeight: 700, color: isOverdueProject ? "#ffaaaa" : barColor === T.green ? "#aaffcc" : "#ffd580" }}>
                {pr.status === "COMPLETED" ? "✓ Completed" : isOverdueProject ? "⚠ Overdue" : milestonePct === 100 ? "All milestones done" : `${done}/${total} milestones`}
              </span>
              <span>{fmt(pr.endDate || pr.end)}</span>
            </div>
            <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 6, height: 8 }}>
              <div style={{ height: "100%", borderRadius: 6, background: barColor, width: `${milestonePct}%`, transition: "width .6s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: .9 }}>{milestonePct}% complete</span>
            </div>
          </div>
        </div>
        <div style={{ padding: "24px 28px", overflowY: "auto", maxHeight: "calc(93vh - 180px)" }}>
          <div className="grid-3col" style={{ gap: 14, marginBottom: 20 }}>
            {[{ l: "Sponsor", k: "sponsor" }, { l: "Project Owner", k: "owner" }, { l: "Budget", k: "budget" }].map(({ l, k }) => (
              <div key={k} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{l}</div>
                {editMode ? <input value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} style={{ fontSize: 12, padding: "5px 8px" }} /> : <div style={{ fontWeight: 600, fontSize: 13 }}>{pr[k]}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[{ l: "🎯 Objective", k: "objective" }, { l: "🗺 Scope", k: "scope" }].map(({ l, k }) => (
              <div key={k} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.navy, marginBottom: 8 }}>{l}</div>
                {editMode ? <textarea value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} style={{ fontSize: 12, height: 80, resize: "none" }} /> : <div style={{ fontSize: 13, lineHeight: 1.6, color: T.text }}>{pr[k]}</div>}
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.navy }}>👥 Project Team</div>
              {editMode && <select defaultValue="" onChange={e => { const v = e.target.value; if (v && !draft.team.includes(v)) setDraft(d => ({ ...d, team: [...d.team, v] })) }}>
                <option value="" disabled>+ Add member</option>
                {(allUsers || []).filter(u => !draft.team.includes(u.name)).map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
              </select>}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "nowrap", overflowX: "auto" }}>
              {(() => {
                const rawTeam = (editMode ? draft : pr).team;
                const safeTeam = Array.isArray(rawTeam) ? rawTeam : (typeof rawTeam === "string" && rawTeam ? [rawTeam] : []);
                return <>
                  {safeTeam.map(name => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, borderRadius: 8, padding: "6px 12px", position: "relative" }}>
                      <Avatar name={name} size={28} users={allUsers || []} />
                      <div><div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div><div style={{ fontSize: 10, color: T.text2 }}>{(allUsers || []).find(u => u.name === name)?.role || "Member"}</div></div>
                      {editMode && <button onClick={() => setDraft(d => ({ ...d, team: d.team.filter(n => n !== name) }))} style={{ marginLeft: 4, background: "transparent", border: "none", cursor: "pointer", color: T.red, fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Remove">×</button>}
                    </div>
                  ))}
                  {safeTeam.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic" }}>No team members added</div>}
                </>;
              })()}
            </div>
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.navy }}>📍 Milestones</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: T.text2 }}>{done}/{current.milestones.length} complete</span>
                {editMode && <button onClick={() => setDraft(d => ({ ...d, milestones: [...d.milestones, { name: "New Milestone", due: todayStr(), done: false }] }))} style={{ fontSize: 11, background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>+ Add</button>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {current.milestones.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: m.done ? T.greenL : T.bg, border: `1px solid ${m.done ? T.green + "30" : T.border}`, cursor: canEdit && !editMode ? "pointer" : "default", transition: "all .18s" }} onClick={() => canEdit && !editMode && toggleMilestone(i)}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: m.done ? T.green : T.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `2px solid ${m.done ? T.green : T.border}`, transition: "all .2s", cursor: editMode ? "pointer" : "inherit" }} onClick={editMode ? ev => { ev.stopPropagation(); toggleMilestone(i) } : undefined}>
                    {m.done && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                  </div>
                  {editMode
                    ? <input value={m.name} onChange={e => setDraft(d => ({ ...d, milestones: d.milestones.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x) }))} style={{ flex: 1, fontSize: 12, padding: "3px 8px" }} onClick={ev => ev.stopPropagation()} />
                    : <div style={{ flex: 1, fontSize: 13, fontWeight: m.done ? 400 : 500, color: m.done ? T.text2 : T.text, textDecoration: m.done ? "line-through" : "none" }}>{m.name}</div>
                  }
                  {editMode
                    ? <input type="date" value={m.due} onChange={e => setDraft(d => ({ ...d, milestones: d.milestones.map((x, idx) => idx === i ? { ...x, due: e.target.value } : x) }))} style={{ fontSize: 11, padding: "3px 6px", width: 130 }} onClick={ev => ev.stopPropagation()} />
                    : <div style={{ fontSize: 11, color: T.text2, flexShrink: 0 }}>{fmt(m.due)}</div>
                  }
                  {editMode && <button onClick={ev => { ev.stopPropagation(); setDraft(d => ({ ...d, milestones: d.milestones.filter((_, idx) => idx !== i) })) }} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.red, fontSize: 16, lineHeight: 1, padding: "0 4px" }} title="Remove">×</button>}
                  {canEdit && !editMode && <span style={{ fontSize: 10, color: T.text2, opacity: .5 }}>{m.done ? "click to uncheck" : "click to check"}</span>}
                </div>
              ))}
              {current.milestones.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic", padding: "8px 0" }}>No milestones yet — click + Add to create one</div>}
            </div>
          </div>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.navy, marginBottom: 8 }}>⚠ Risks & Constraints</div>
            {editMode ? <textarea value={draft.risks} onChange={e => setDraft(d => ({ ...d, risks: e.target.value }))} style={{ fontSize: 12, height: 64, resize: "none" }} /> : <div style={{ fontSize: 13, lineHeight: 1.6, color: T.text }}>{pr.risks}</div>}
          </div>
          {projectMeetings.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 700, color: T.navy }}>🎙 Related Meetings ({projectMeetings.length})</div>
              <table>
                <thead><tr><th>Type</th><th>Plant</th><th>Time</th><th>Facilitator</th><th>Sessions</th></tr></thead>
                <tbody>{projectMeetings.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{m.type}</td>
                    <td style={{ fontSize: 12 }}>{m.plant}</td>
                    <td style={{ fontSize: 12 }}>{m.time} · {m.dur}min</td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={m.facilitator} size={22} users={allUsers || []} /><span style={{ fontSize: 12 }}>{m.facilitator}</span></div></td>
                    <td style={{ fontSize: 12, color: T.text2 }}>{(m.completedSessions || []).length} done</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {pActions.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 700, color: T.navy }}>Linked Actions ({pActions.length}) — click to open</div>
              <table>
                <thead><tr><th>#</th><th>Action</th><th>Responsible</th><th>Status</th><th>Due</th></tr></thead>
                <tbody>{pActions.map(a => (
                  <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => onActionSelect && onActionSelect(a)}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2 }}>{a.sn}</td>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</td>
                    <td style={{ fontSize: 12 }}>{a.responsible}</td>
                    <td><SBadge s={a.status} /></td>
                    <td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text }}>{fmt(a.due)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== WORK PAGE ===================== */
