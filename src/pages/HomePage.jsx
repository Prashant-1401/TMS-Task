/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { apiUpdate } from "../api/autosave.js";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { Avatar, Empty, PBadge, SBadge } from "../components/ui.jsx";
import { normalizeStatus } from "../utils/constants.js";
import { canAccessMeeting, ensureArray, normalizeActionPatch, resolveRecordIds, responsibleMatchesUsers } from "../utils/data.js";
import { daysOver, fmt, isOverdue, todayStr } from "../utils/helpers.js";
import { isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

export function HomePage({ actions, setActions, user, setPage, users, meetings, plants, depts, setGlobalActiveMtg, machines, projects, fetchData }) {
  const now = new Date();
  const isAdmin = isUserAdmin(user);

  // Fix 3: Dashboard scope — actions assigned to me, or assigned to my subordinates, or in my department
  const getSubordinates = (name, allUsers, visited = new Set()) => {
    if (visited.has(name)) return [];
    visited.add(name);
    const directs = allUsers.filter(u => u.superior === name);
    const all = [...directs];
    directs.forEach(d => { all.push(...getSubordinates(d.name, allUsers, visited)); });
    return all;
  };
  const subs = user ? getSubordinates(user.name, users) : [];
  const subNames = subs.map(u => u.name);
  const _myDept = user?.dept || "";
  // Normalize name comparisons — data may have trailing spaces/casing differences
  const userName = (user?.name || "").trim().toLowerCase();
  const _subNamesLower = subNames.map(n => n.trim().toLowerCase());
  const _scopedActions = isAdmin || !user?.plant || user?.plant === "All"
    ? actions
    : actions.filter(a => !a.plant || a.plant === "All" || a.plant === user?.plant);

  // My personal actions: where I am the responsible person or the allocator
  const myActions = actions.filter(a => {
    if (!userName) return false;
    return responsibleMatchesUsers(a.responsible, [userName]) || (a.allocatedBy || "").trim().toLowerCase() === userName;
  });

  const total = myActions.length;
  const comp = myActions.filter(a => a.status === "COMPLETED").length;
  const inProc = myActions.filter(a => a.status === "IN PROCESS").length;
  const _notStarted = myActions.filter(a => a.status === "NOT STARTED").length;
  const _over = myActions.filter(isOverdue).length;
  const crit = myActions.filter(a => a.priority === "CRITICAL" && a.status !== "COMPLETED" && a.status !== "DROPPED").length;

  // Fix 2 & 4: My open actions as Responsible or Allocator — clickable, opens side panel
  const myOwn = actions.filter(a => (responsibleMatchesUsers(a.responsible, [userName].filter(Boolean)) || (a.allocatedBy || "").trim().toLowerCase() === userName) && userName && a.status !== "COMPLETED" && a.status !== "DROPPED")
    .sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  // Fix 2 extra: Unassigned actions from my allocations
  const unassigned = myActions.filter(a => (!a.responsible || a.responsible.trim() === "") && a.status !== "COMPLETED" && a.status !== "DROPPED");
  const todayStr2 = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // ── Compute truly upcoming meetings ────────────────────────────────────────
  const getNextOccurrence = (mtg) => {
    const mtgTimeStr = mtg.time; // "HH:MM"
    if (!mtgTimeStr || !String(mtgTimeStr).includes(":")) return null;
    const [mtgH, mtgM] = String(mtgTimeStr).split(":").map(Number);
    if (isNaN(mtgH) || isNaN(mtgM)) return null;
    const today = new Date();
    const todayDateStr = today.toISOString().split("T")[0];

    // Build a Set of dates this meeting was already completed
    const completedDates = new Set((mtg.completedSessions || []).map(s => s.date));

    // Non-recurring: show only if not completed AND datetime is in future
    if (!mtg.recurring) {
      // If already completed today, don't show
      if (mtg.completedSessions && mtg.completedSessions.some(s => s.date === todayDateStr)) return null;
      const mtgDateTime = new Date(today);
      mtgDateTime.setHours(mtgH, mtgM, 0, 0);
      // If meeting time already passed today, it's not upcoming
      if (mtgDateTime < now) return null;
      return mtgDateTime;
    }

    // Recurring: find next occurrence after today ( skipping completed dates )
    let checkDate = new Date(today);
    // Start from today; if meeting time already passed today, start from tomorrow
    const nowMins = today.getHours() * 60 + today.getMinutes();
    const mtgMins = mtgH * 60 + mtgM;
    if (nowMins >= mtgMins) checkDate.setDate(checkDate.getDate() + 1);

    // Find next date not in completedDates
    const maxDaysAhead = 365; // safety cap
    for (let i = 0; i < maxDaysAhead; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (!completedDates.has(dateStr)) {
        // Found a date where meeting hasn't been marked complete
        const next = new Date(checkDate);
        next.setHours(mtgH, mtgM, 0, 0);
        return next;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    return null; // no upcoming occurrence found within lookahead
  };

  const upcomingMeetings = (meetings || []).filter(m => canAccessMeeting(user, m, null))
    .map(m => {
      const next = getNextOccurrence(m);
      return next ? { ...m, _nextDt: next } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a._nextDt - b._nextDt)
    .slice(0, 3);

  // Fix 3: unified action update + single panel state
  const upAction = (id, patch) => {
    const np = normalizeActionPatch(patch);
    setActions && setActions(p => p.map(a => {
      if (a.id !== id) return a;
      if (np.due && np.due !== a.due) { const rev = { date: todayStr(), from: a.due, to: np.due, by: user?.name || "Unknown" }; return { ...a, ...np, revisions: (a.revisions || 0) + 1, revisionHistory: [...(a.revisionHistory || []), rev] }; }
      return { ...a, ...np };
    }));
    apiUpdate("actions", id, resolveRecordIds(np, plants, depts, machines, projects, meetings)).then(saved => {
      if (saved && saved.id) setActions && setActions(p => p.map(a => a.id === id ? { ...a, ...saved } : a));
    }).catch(err => {
      console.error("Action update failed:", err);
      if (fetchData) fetchData();
    });
  };

  // State — single unified action detail panel
  const [actionPanel, setActionPanel] = useState(null);

  // State
  const [subModal, setSubModal] = useState(null);
  const [kpiDrill, setKpiDrill] = useState(null);
  const [mtgModal, setMtgModal] = useState(null); // Fix 4: meeting popup
  const [unassignedDrill, setUnassignedDrill] = useState(false);

  // Fix 6: per-bucket counts for subordinates
  const subData = subs.map(u => {
    const mine = actions.filter(a => responsibleMatchesUsers(a.responsible, [u.name.trim().toLowerCase()]) && a.status !== "COMPLETED" && a.status !== "DROPPED");
    const delayed = mine.filter(isOverdue);
    const today = mine.filter(a => !isOverdue(a) && a.due && Math.floor((new Date(a.due) - now) / 86400000) === 0);
    const soon = mine.filter(a => !isOverdue(a) && a.due && Math.floor((new Date(a.due) - now) / 86400000) > 0 && Math.floor((new Date(a.due) - now) / 86400000) <= 3);
    const later = mine.filter(a => !isOverdue(a) && a.due && Math.floor((new Date(a.due) - now) / 86400000) > 3);
    return { ...u, pending: mine.length, delayed, today, soon, later, actions: mine };
  }).filter(u => u.pending > 0);

  const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening";

  const kpiDrillData = {
    total: { title: "My Actions", rows: myActions },
    running: { title: "My In Process Actions", rows: myActions.filter(a => a.status === "IN PROCESS") },
    critical: { title: "My Critical Open Actions", rows: myActions.filter(a => a.priority === "CRITICAL" && a.status !== "COMPLETED" && a.status !== "DROPPED") },
    completed: { title: "My Completed Actions", rows: myActions.filter(a => a.status === "COMPLETED") },
    overdue: { title: "My Overdue Actions", rows: myActions.filter(isOverdue) },
  };

  // Fix 4: Meeting popup modal
  const MeetingPopup = ({ mtg, onClose, onStart, canAttend }) => (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480, padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg,${T.navy},#3D378C)`, borderRadius: "18px 18px 0 0", padding: "20px 24px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, opacity: .6, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Meeting Plan</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800 }}>{mtg.type}</div>
              <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>{mtg.plant} · {mtg.time} · {mtg.dur}min</div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
        <div style={{ padding: "18px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[["Facilitator", mtg.facilitator], ["Plant", mtg.plant], ["Time", mtg.time], ["Duration", `${mtg.dur} min`]].map(([l, v]) => (
              <div key={l} style={{ background: T.bg, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v || "—"}</div>
              </div>
            ))}
          </div>
          {(mtg.guidelines || []).length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, color: T.navy, marginBottom: 6 }}>📌 Meeting Guidelines</div><ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>{(mtg.guidelines || []).map((g, i) => <li key={i} style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{g}</li>)}</ol></div>}
          {(mtg.completedSessions || []).length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, color: T.navy, marginBottom: 6 }}>📊 Past Sessions</div>{(mtg.completedSessions || []).map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", background: T.bg, borderRadius: 6, padding: "6px 10px", fontSize: 12, marginBottom: 4 }}><span>{fmt(s.date)}</span><span style={{ fontWeight: 600 }}>{s.duration} min</span></div>)}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onClose} className="btn btn-ghost">Close</button>
            {canAttend ? (
              <button onClick={() => { onStart && onStart(mtg); onClose(); }} className="btn btn-navy">▶ Start Meeting</button>
            ) : (
              <button className="btn btn-ghost" disabled title="Only listed attendees can start this meeting" style={{ opacity: .6, cursor: "not-allowed" }}>🔒 Locked</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: T.text2, marginBottom: 4 }}>Home › Task Management System</div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.navy }}>Good {greeting}, {user && user.name ? user.name.split(" ")[0] : ""} 👋</h1>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 3 }}>{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid-kpi-5" style={{ marginBottom: 24 }}>
        {[
          { n: total, label: "Task Assigned", icon: "📋", color: T.navy, key: "total" },
          { n: unassigned.length, label: "Unassigned", icon: "❓", color: T.slate, key: "unassigned" },
          { n: inProc, label: "In Process", icon: "🏃", color: T.amber, key: "running" },
          { n: crit, label: "Critical Open", icon: "⚠", color: T.red, key: "critical" },
          { n: comp, label: "Completed", icon: "✅", color: T.green, key: "completed" },
        ].map((k, i) => (
          <div key={i} className="card card-hover" style={{ padding: 18, cursor: "pointer" }} onClick={() => k.key === "unassigned" ? setUnassignedDrill(true) : setKpiDrill(k.key)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 32, fontWeight: 800, color: k.color }}>{k.n}</div><div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginTop: 2 }}>{k.label}</div></div>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: k.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Open Tasks (full width) */}
      <div style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1.5px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: T.navy }}>Open Tasks — I am Responsible</div>
            <button onClick={() => setPage(2)} style={{ fontSize: 12, color: T.navy, border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}>View All →</button>
          </div>
          <table>
            <thead><tr><th>SN</th><th>Action</th><th>Status</th><th>Due On</th><th>Priority</th><th>Revisions</th></tr></thead>
            <tbody>
              {myOwn.slice(0, 8).map((a, idx) => {
                const status = normalizeStatus(a.status);
                const hasRemarks = Array.isArray(a.messages) && a.messages.length > 0;
                let rowBg = "";
                if (status === "COMPLETED") rowBg = "#D5F5E3";
                else if (status === "DROPPED") rowBg = "#F2F3F4";
                else if (isOverdue(a)) rowBg = "#FADBD8";
                else if (hasRemarks) rowBg = "#FEF3CD";
                else if (a.pendingConfirmation) rowBg = "#FEF9E7";
                return (
                <tr key={a.id || `home-own-${idx}`} style={{ cursor: "pointer", background: rowBg }} onClick={() => setActionPanel(a)}>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2, whiteSpace: "nowrap" }}>{a.sn}</td>
                  <td style={{ fontSize: 12, fontWeight: 500, whiteSpace: "normal", wordBreak: "break-word", maxWidth: 320, lineHeight: 1.4 }}>{a.text}</td>
                  <td><SBadge s={a.status} /></td>
                  <td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text, fontWeight: isOverdue(a) ? 600 : 400, whiteSpace: "nowrap" }}>{isOverdue(a) ? `${daysOver(a)}d overdue` : fmt(a.due)}</td>
                  <td><PBadge p={a.priority} /></td>
                <td style={{ textAlign: "center" }}>{(a.revisions || 0) > 0 ? <span style={{ fontWeight: 700, color: T.amber, fontSize: 12 }}>{a.revisions}</span> : <span style={{ color: T.text2, fontSize: 12 }}>—</span>}</td>
                </tr>
                );
              })}
              {myOwn.length === 0 && <tr><td colSpan={6}><Empty icon="🎉" title="All clear!" sub="No open actions assigned to you." /></td></tr>}
            </tbody>
          </table>
          {/* Upcoming meetings — Fix 4: clickable */}
          {upcomingMeetings.length > 0 && (
            <div style={{ padding: "12px 20px", borderTop: `1.5px solid ${T.border}`, background: T.bg }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.navy, marginBottom: 8, textTransform: "uppercase", letterSpacing: .4 }}>📅 Upcoming — click to open</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {upcomingMeetings.map((m, idx) => {
                  const isToday = m._nextDt.toISOString().split("T")[0] === todayStr2;
                  return (
                    <div key={m.id || `mtg-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "6px 9px", borderRadius: 7, transition: "background .15s" }}
                      onClick={() => setMtgModal(m)}
                      onMouseEnter={e => e.currentTarget.style.background = T.border}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                      {/* Time badge */}
                      <span style={{ background: T.navy + "15", color: T.navy, borderRadius: 6, padding: "2px 8px", fontWeight: 600, minWidth: 48, textAlign: "center" }}>
                        {m.time}
                      </span>

                      {/* Meeting title */}
                      <span style={{ fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name || m.type}
                      </span>

                      {/* Plant */}
                      <span style={{ fontSize: 11, color: T.text2 }}>
                        {m.plant}
                      </span>

                      {/* Date indicator (if not today) */}
                      {!isToday && <span style={{ fontSize: 10, color: T.text2, fontWeight: 600 }}>
                        {m._nextDt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>}

                      {/* Recurring indicator */}
                      {m.recurring && <span style={{ fontSize: 10, color: T.amber, fontWeight: 700, background: T.amberL, padding: "1px 6px", borderRadius: 4 }}>🔁</span>}

                      {/* Arrow */}
                      <span style={{ fontSize: 10, color: T.navy, fontWeight: 700 }}>Open →</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Team Pending (Fix 6) + Escalated Actions (Fix 7) */}
      <div className="grid-2col" style={{ marginBottom: 20 }}>
        {/* Fix 6: Team Pending with 4 color buckets per person */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: T.navy, marginBottom: 4 }}>Team Pending Actions</div>
          <div style={{ fontSize: 11, color: T.text2, marginBottom: 12 }}>Click any count box to see those actions</div>
          {subData.length === 0
            ? <Empty icon="✅" title="All clear!" sub={subs.length === 0 ? "No subordinates in org chart" : "All team members up to date"} />
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {subData.slice(0, 6).map((u, idx) => (
                <div key={u.id || `sub-${idx}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Avatar name={u.name} size={24} users={users} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: T.text2 }}>{u.role}</span>
                  </div>
                  <div className="grid-team-buckets">
                    {[
                      { label: "Delayed", count: u.delayed.length, bg: T.redL, border: T.red, color: T.red, actions: u.delayed, tip: "Overdue" },
                      { label: "Today", count: u.today.length, bg: "#FFF3E0", border: "#E65100", color: "#E65100", actions: u.today, tip: "Due today" },
                      { label: "Next 3d", count: u.soon.length, bg: T.amberL, border: T.amber, color: T.amber, actions: u.soon, tip: "Due in 1-3 days" },
                      { label: ">3 Days", count: u.later.length, bg: "#fff", border: T.border, color: T.text2, actions: u.later, tip: "Due after 3 days" },
                    ].map(b => (
                      <div key={b.label} style={{ background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 8, padding: "6px 8px", textAlign: "center", cursor: b.count > 0 ? "pointer" : "default", opacity: b.count === 0 ? .4 : 1, transition: "all .15s" }}
                        onClick={() => b.count > 0 && setSubModal({ user: u, bucket: b.label, actions: b.actions })}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: b.color }}>{b.count}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: b.color, marginTop: 1 }}>{b.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          }
        </div>

        {/* Fix 7: Escalated Actions Summary */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: T.navy }}>🚨 Escalated Actions</div>
            <button onClick={() => setPage(4)} style={{ fontSize: 11, color: T.red, border: `1px solid ${T.red}`, background: "transparent", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 700 }}>View All →</button>
          </div>
          {myActions.filter(isOverdue).length === 0
            ? <Empty icon="✅" title="No escalations!" sub="All your actions are within threshold." />
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {myActions.filter(isOverdue).sort((a, b) => daysOver(b) - daysOver(a)).slice(0, 5).map((a, idx) => {
                const d = daysOver(a);
                const lvl = d >= 7 ? "L4" : d >= 3 ? "L3" : d >= 1 ? "L2" : "L1";
                const lvlColor = d >= 7 ? T.red : d >= 3 ? "#C0392B" : d >= 1 ? "#E67E22" : T.amber;
                return (
                  <div key={a.id || `esc-${idx}`} style={{ background: T.redL, border: `1.5px solid ${T.red}20`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }} onClick={() => setActionPanel(a)}>
                    <div style={{ background: lvlColor, color: "#fff", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{lvl}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 3, color: T.text, wordBreak: "break-word" }}>{a.text}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: T.text2 }}>{a.responsible}</span>
                        <span style={{ fontSize: 11, color: T.red, fontWeight: 700 }}>{d}d overdue</span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          }
        </div>
      </div>

      {/* Unified action detail panel — same as Actions page */}
      {actionPanel && <ActionDetailPanel action={actionPanel} onClose={() => setActionPanel(null)} onUpdate={(id, patch) => { upAction(id, patch); setActionPanel(p => p ? { ...p, ...normalizeActionPatch(patch) } : p); }} user={user} users={users} allUsers={users} plants={plants} meetings={meetings} />}

      {/* Fix 6: Team sub modal */}
      {subModal && (
        <div className="overlay" onClick={() => setSubModal(null)}>
          <div className="modal" style={{ width: 620, padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 22px", borderBottom: `1.5px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={subModal.user.name} size={34} users={users} />
                <div>
                  <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: T.navy }}>{subModal.user.name}</h3>
                  <div style={{ fontSize: 11, color: T.text2 }}>{subModal.bucket} Actions · {subModal.actions.length} items</div>
                </div>
              </div>
              <button onClick={() => setSubModal(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
            </div>
            <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {subModal.actions.length === 0
                ? <Empty icon="✅" title="No actions in this bucket" sub="" />
                : <table>
                  <thead><tr><th>SN</th><th>Action</th><th>Due</th><th>Status</th><th>Priority</th></tr></thead>
                  <tbody>{subModal.actions.map((a, idx) => (
                    <tr key={a.id || `sub-act-${idx}`} style={{ cursor: "pointer" }} onClick={() => setActionPanel(a)}>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2, whiteSpace: "nowrap" }}>{a.sn}</td>
                      <td style={{ fontSize: 12, fontWeight: 500, whiteSpace: "normal", wordBreak: "break-word", maxWidth: 240, lineHeight: 1.4 }}>{a.text}</td>
                      <td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text, fontWeight: isOverdue(a) ? 600 : 400, whiteSpace: "nowrap" }}>{isOverdue(a) ? `${daysOver(a)}d late` : fmt(a.due)}</td>
                      <td><SBadge s={a.status} /></td>
                      <td><PBadge p={a.priority} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              }
            </div>
          </div>
        </div>
      )}


      {/* KPI drill modal */}
      {kpiDrill && kpiDrillData[kpiDrill] && (
        <div className="overlay" onClick={() => setKpiDrill(null)}>
          <div className="modal" style={{ width: 700, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>{kpiDrillData[kpiDrill].title} <span style={{ fontSize: 12, color: T.text2, fontWeight: 400 }}>({kpiDrillData[kpiDrill].rows.length})</span></h2>
              <button onClick={() => setKpiDrill(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
            </div>
            <table><thead><tr><th>SN</th><th>Action</th><th>Responsible</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>{kpiDrillData[kpiDrill].rows.slice(0, 20).map((a, idx) => (
                <tr key={a.id || `drill-${idx}`} style={{ cursor: "pointer" }} onClick={() => setActionPanel(a)}>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2, whiteSpace: "nowrap" }}>{a.sn}</td>
                  <td style={{ fontSize: 12, whiteSpace: "normal", wordBreak: "break-word", maxWidth: 260, lineHeight: 1.4 }}>{a.text}</td>
                  <td style={{ fontSize: 12 }}>{a.responsible}</td>
                  <td><SBadge s={a.status} /></td>
                  <td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text, whiteSpace: "nowrap" }}>{fmt(a.due)}</td>
                </tr>
              ))}</tbody></table>
            {kpiDrillData[kpiDrill].rows.length === 0 && <Empty icon="📭" title="No records" sub="Nothing to show." />}
            <div style={{ marginTop: 14, textAlign: "right" }}><button className="btn btn-navy btn-sm" onClick={() => { setKpiDrill(null); setPage(2); }}>Open Actions Register</button></div>
          </div>
        </div>
      )}


      {/* Unassigned drill modal */}
      {unassignedDrill && (
        <div className="overlay" onClick={() => setUnassignedDrill(false)}>
          <div className="modal" style={{ width: 680, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>Unassigned Actions <span style={{ fontSize: 12, color: T.text2, fontWeight: 400 }}>({unassigned.length})</span></h2>
              <button onClick={() => setUnassignedDrill(false)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
            </div>
            {unassigned.length === 0 ? <Empty icon="✅" title="All actions have an owner" sub="" /> : <table>
              <thead><tr><th>SN</th><th>Action</th><th>Source</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>{unassigned.map((a, idx) => (<tr key={a.id || `unassigned-${idx}`}><td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2 }}>{a.sn}</td><td style={{ fontSize: 12, whiteSpace: "normal", wordBreak: "break-word", maxWidth: 260, lineHeight: 1.4 }}>{a.text}</td><td style={{ fontSize: 12 }}>{a.src}</td><td><SBadge s={a.status} /></td><td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text }}>{fmt(a.due)}</td></tr>))}</tbody>
            </table>}
          </div>
        </div>
      )}

      {/* Fix 4: Meeting popup */}
      {mtgModal && (() => {
        const _att = ensureArray(mtgModal.attendees);
        const _my = (user?.name || "").trim().toLowerCase();
        const _canAttend = isUserAdmin(user) || _att.some(a => (a || "").toString().trim().toLowerCase() === _my) || (mtgModal.facilitator || "").toString().trim().toLowerCase() === _my;
        return <MeetingPopup mtg={mtgModal} canAttend={_canAttend} onClose={() => setMtgModal(null)} onStart={(m) => { setGlobalActiveMtg && setGlobalActiveMtg(m); setPage(1); }} />;
      })()}
    </div>
  );
}

/* ===================== PROJECT CHARTER MODAL ===================== */
