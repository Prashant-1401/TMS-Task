/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { apiCreate, apiRemove, apiUpdate } from "../api/autosave.js";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { AddMeetingModal } from "../components/AddMeetingModal.jsx";
import { AddProjectModal } from "../components/AddProjectModal.jsx";
import { CompletedMeetingDashboard } from "../components/CompletedMeetingDashboard.jsx";
import { MeetingPlanPanel } from "../components/MeetingPlanPanel.jsx";
import { MeetingRoom } from "../components/MeetingRoom.jsx";
import { ProjectCharterModal } from "../components/ProjectCharterModal.jsx";
import { WeeklyMeetingAccountability } from "../components/WeeklyMeetingAccountability.jsx";
import { Avatar, Chip, PBadge, PageHeader, SBadge } from "../components/ui.jsx";
import { buildWeekBelt, canAccessMeeting, ensureArray, normalizeActionPatch, plantVisible, resolveRecordIds } from "../utils/data.js";
import { fmt } from "../utils/helpers.js";
import { getPerms, isGuestRole, isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ===================== WORK PAGE ===================== */
export function WorkPage({ plants, depts, users, onCommitFinal, actions, setActions, user, onProjectUpdate, allProjects, setProjects: setProjectsUp, allMeetings, setMeetings: setMeetingsUp, setPage, globalActiveMtg, setGlobalActiveMtg, mtgRunning, setMtgRunning, mtgElapsed, mtgTxLines, setMtgTxLines, _mtgFastActions,_setMtgFastActionss, mtgInsights, setMtgInsights, clearMeetingState, mtgPresets, machines, reasons, fetchData }) {
  // activeMtg is now global — WorkPage just reads/writes it
  const activeMtg = globalActiveMtg;
  const setActiveMtg = (m) => { setGlobalActiveMtg(m); if (m) setMtgRunning(true); };
  // Use App-level meetings so they persist across page navigation
  const meetings = allMeetings;
  const setMeetings = setMeetingsUp;
  // Projects: single source of truth from App level
  const projects = allProjects;
  const setProjects = (updater) => {
    setProjectsUp && setProjectsUp(updater);
  };
  const [charter, setCharter] = useState(null);
  const [showAddMtg, setShowAddMtg] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [charterActionSel, setCharterActionSel] = useState(null);
  const [mtgPlan, setMtgPlan] = useState(null);  // Feature 4: meeting plan view
  const [selectedBeltDay, setSelectedBeltDay] = useState(() => new Date().toISOString().split("T")[0]);  // combined Weekly Schedule: which day is drilled into

  const isAdmin = isUserAdmin(user);
  const userPerms = getPerms(user);
  // Feature 3: can create projects if admin or has permission
  const canCreateProject = isAdmin || userPerms.canCreateProjects;
  // Feature 4: can edit meetings if admin or has permission
  const canEditMeetings = isAdmin || userPerms.canEditMeetings;

  const deleteMeeting = (m) => {
    if (!window.confirm(`Delete "${m.type}" (${m.plant}, ${m.time})? This cannot be undone.`)) return;
    setMeetings(p => (p || []).filter(x => x.id !== m.id));
    apiRemove("meetings", m.id);
  };
  const deleteProject = (pr) => {
    if (!window.confirm(`Delete project "${pr.name}"? This cannot be undone.`)) return;
    setProjects(p => (p || []).filter(x => x.id !== pr.id));
    apiRemove("projects", pr.id);
  };

  const _plantFilter = (item) => isUserAdmin(user) || plantVisible(user, item);
  const visibleMeetings = (meetings || []).filter(m => canAccessMeeting(user, m, mtgPresets));
  const visibleProjects = isAdmin ? (projects || []) : (projects || []).filter(p => isUserAdmin(user) || plantVisible(user, p));

  if (activeMtg) return <MeetingRoom mtg={activeMtg} plants={plants} depts={depts} users={users} onCommit={rows => { onCommitFinal(rows); }} onCloseMeeting={() => { clearMeetingState && clearMeetingState(); setPage(0); }} onBack={() => setPage(0)} prevActions={actions} relatedActions={actions.filter(a => {
          // Match by specific meeting instance (srcId) when available, else fall back to type match
          const matchesMeeting = activeMtg.id
            ? (a.srcId === activeMtg.id || (!a.srcId && a.src === activeMtg.type))
            : a.src === activeMtg.type;
          const matchesProject = activeMtg.project && (a.projectName || a.project) === activeMtg.project;
          return matchesMeeting || matchesProject;
        })} running={mtgRunning} setRunning={setMtgRunning} elapsed={mtgElapsed} txLines={mtgTxLines} setTxLines={setMtgTxLines} insights={mtgInsights} setInsights={setMtgInsights} currentUser={user} mtgPresets={mtgPresets} setActions={setActions} machines={machines} reasons={reasons} fetchData={fetchData} />;

  return (
    <div className="fade-in">
      <PageHeader title="Work" sub="Projects, meetings and active sessions" />
      <div className="grid-2col" style={{ gap: 24 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: T.navy, display: "flex", alignItems: "center", gap: 8 }}>
              🎙 Today's Meetings
              <span style={{ background: T.navy + "15", color: T.navy, borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{visibleMeetings.length}</span>
            </div>
            {!isGuestRole(user?.role) && <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMtg(true)}>+ Schedule</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleMeetings.map((m, idx) => {
              const attendees = ensureArray(m.attendees || mtgPresets?.attendeeMap?.[m.type]);
              const linkedProject = (projects || []).find(p => p.name === m.project);
              const myName = (user?.name || "").trim().toLowerCase();
              const amAttendee = attendees.some(a => (a || "").toString().trim().toLowerCase() === myName);
              const amFacilitator = (m.facilitator || "").toString().trim().toLowerCase() === myName;
              const canAttend = isUserAdmin(user) || canEditMeetings || amFacilitator || (amAttendee && !isGuestRole(user?.role));
              return (
                <div key={m.id || `mtg-list-${idx}`} className="card" style={{ padding: 18 }}>
                  {m.project && linkedProject && (
                    <div style={{ background: T.navy + "08", border: `1px solid ${T.navy}20`, borderRadius: 8, padding: "6px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setCharter(linkedProject)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>🗂</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.navy }}>{m.project}</span>
                      </div>
                      <span style={{ fontSize: 11, color: T.text2 }}>View Charter →</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ background: T.navy, color: "#fff", borderRadius: 10, padding: "8px 10px", textAlign: "center", minWidth: 56, flexShrink: 0, position: "relative" }}>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800 }}>{m.time}</div>
                      <div style={{ fontSize: 9, opacity: .7, marginTop: 1 }}>{m.dur}min</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Feature 4: meeting title clickable to open plan */}
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.navy, marginBottom: 3, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }} onClick={() => setMtgPlan(m)}>{m.name || m.type}</div>
                      <div style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 6, marginBottom: 6 }}>
                        <Chip label={m.plant} color={T.navy} />
                        {m.recurring && <Chip label="Recurring" color={T.slate} />}
                        {m.scheduledDays && m.scheduledDays.length > 0 && <Chip label={m.scheduledDays.join(", ")} color={T.amber} />}
                      </div>
                      <div style={{ fontSize: 11, color: T.text2, marginBottom: 6 }}>Facilitated by <b style={{ color: T.text }}>{m.facilitator}</b></div>
                      {attendees.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", overflowX: "auto" }}>
                          <span style={{ fontSize: 10, color: T.text2 }}>Attendees:</span>
                          {attendees.slice(0, 5).map((name, i) => <Avatar key={i} name={name} size={20} users={users} />)}
                          {attendees.length > 5 && <span style={{ fontSize: 10, color: T.text2 }}>+{attendees.length - 5}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      {/* Feature 4: View Plan button */}
                      <button className="btn btn-ghost btn-sm" onClick={() => setMtgPlan(m)}>📋 Plan</button>
                      {canAttend ? (
                        <button className="btn btn-green btn-sm" onClick={() => setActiveMtg(m)}>▶ Start</button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" disabled title="Only listed attendees can start this meeting" style={{ opacity: .6, cursor: "not-allowed" }}>🔒 Locked</button>
                      )}
                      {canEditMeetings && <button className="btn btn-ghost btn-sm" style={{ color: T.red }} onClick={() => deleteMeeting(m)}>🗑 Delete</button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleMeetings.length === 0 && <div style={{ fontSize: 13, color: T.text2, fontStyle: "italic", padding: "24px 0", textAlign: "center" }}>No meetings yet. Click <b>+ Schedule</b> to create one.</div>}
          </div>

        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: T.navy, display: "flex", alignItems: "center", gap: 8 }}>
              🗂 Active Projects
              <span style={{ background: T.amber + "20", color: T.amber, borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{visibleProjects.filter(p => p.status !== "COMPLETED").length}</span>
            </div>
            {/* Feature 3: Add New Project button - only for those with permission */}
            {canCreateProject && <button className="btn btn-amber btn-sm" onClick={() => setShowAddProject(true)}>+ Add Project</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleProjects.map((pr, idx) => {
              const _start = new Date(pr.startDate || pr.start), end = new Date(pr.endDate || pr.end), now2 = new Date();
              const ms = Array.isArray(pr.milestones) ? pr.milestones : [];
              const done = ms.filter(m => m.done).length;
              const total = ms.length;
              const milestonePct = total > 0 ? Math.round(done / total * 100) : 0;
              const isOverdueProject = now2 > end && pr.status !== "COMPLETED";
              const barColor = pr.status === "COMPLETED" ? T.green : isOverdueProject ? T.red : milestonePct >= 66 ? T.green : milestonePct >= 33 ? T.amber : T.red;
              const projMeetings = (allMeetings || []).filter(m => m.project === pr.name);
              return (
                <div key={pr.id || `proj-${idx}`} className="card card-hover" style={{ padding: 18, borderLeft: `4px solid ${pr.priority === "CRITICAL" ? T.red : pr.priority === "WARNING" ? T.amber : T.navy}`, cursor: "pointer" }} onClick={() => setCharter(pr)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{pr.name}</div>
                      <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{pr.plant} · <b style={{ color: T.text }}>{pr.owner}</b></div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <PBadge p={pr.priority} />
                      {(isAdmin || user?.name === pr.owner || user?.name === pr.sponsor) && (
                        <button className="btn btn-ghost btn-sm" style={{ color: T.red, padding: "3px 8px" }} onClick={ev => { ev.stopPropagation(); deleteProject(pr); }}>🗑</button>
                      )}
                    </div>
                  </div>
                  {/* Feature 5: Milestones directly clickable/editable */}
                  <div style={{ marginBottom: 10 }}>
                    {ms.slice(0, 3).map((m, i) => {
                      const isOwner = user?.name === pr.owner || user?.name === pr.sponsor || isAdmin;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }} onClick={ev => { ev.stopPropagation(); if (isOwner) { const updated = { ...pr, milestones: ms.map((x, idx) => idx === i ? { ...x, done: !x.done } : x) }; setProjects(p => p.map(x => x.id === updated.id ? updated : x)); onProjectUpdate(updated); } }}>
                          <span style={{ width: 16, height: 16, borderRadius: "50%", background: m.done ? T.green : T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", flexShrink: 0, cursor: isOwner ? "pointer" : "default", border: `1.5px solid ${m.done ? T.green : T.border}`, transition: "all .2s" }}>{m.done ? "✓" : ""}</span>
                          <span style={{ fontSize: 11, color: m.done ? T.text2 : T.text, textDecoration: m.done ? "line-through" : "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                          <span style={{ fontSize: 10, color: T.text2, flexShrink: 0 }}>{fmt(m.due)}</span>
                        </div>
                      );
                    })}
                    {ms.length > 3 && <div style={{ fontSize: 10, color: T.text2, paddingLeft: 24 }}>+{ms.length - 3} more milestones</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <div style={{ background: T.border, borderRadius: 6, height: 6, flex: 1, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 6, width: `${milestonePct}%`, background: barColor, transition: "width .6s" }} /></div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: barColor, minWidth: 36 }}>{milestonePct}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: T.text2 }}>
                    <span>{fmt(pr.startDate || pr.start)} → {fmt(pr.endDate || pr.end)}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span>{done}/{ms.length} milestones</span>
                      {projMeetings.length > 0 && <span>· {projMeetings.length} meeting{projMeetings.length !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Weekly Schedule: combined belt + scheduled days, with day drill-down showing meeting details & actions ── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: T.navy, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          📆 Weekly Schedule
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {buildWeekBelt(visibleMeetings, actions).map(day => {
              const beltColor = day.color === "green" ? T.green : day.color === "amber" ? T.amber : day.color === "red" ? T.red : null;
              const bg = beltColor ? beltColor + "18" : "#F5F5FB";
              const border = beltColor ? beltColor : T.border;
              const isSelected = day.dateStr === selectedBeltDay;
              return (
                <div key={day.dateStr} onClick={() => setSelectedBeltDay(day.dateStr)}
                  title={`${day.dayName} ${day.dayNum} — ${day.hasSession ? day.count + " action(s), " + day.done + " done" : "no meeting"}`}
                  style={{ flex: "1 0 0", minWidth: 64, borderRadius: 10, border: `1.5px solid ${isSelected ? T.navy : border}`, boxShadow: isSelected ? `0 0 0 2px ${T.navy}30` : "none", background: bg, padding: "10px 6px", textAlign: "center", position: "relative", cursor: "pointer", transition: "all .15s" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: day.isToday ? T.navy : T.text2, textTransform: "uppercase", letterSpacing: .3 }}>{day.dayName}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text, lineHeight: 1.1, margin: "2px 0 6px" }}>{day.dayNum}</div>
                  {day.hasSession || day.count > 0 ? (
                    <>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: beltColor || T.text2 }}>{day.count}</div>
                      <div style={{ fontSize: 9, color: T.text2, fontWeight: 600 }}>{day.done === day.count && day.count > 0 ? "All done" : day.done + " done"}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 9, color: T.text2, fontWeight: 600, marginTop: 6 }}>—</div>
                  )}
                  {beltColor && <div style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: "50%", background: beltColor }} />}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: T.text2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} /> All completed</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: T.amber }} /> Partial</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: T.red }} /> None done</span>
          </div>

          {/* ── Selected day drill-down: meetings scheduled that day + actions created on each meeting ── */}
          {(() => {
            const beltDays = buildWeekBelt(visibleMeetings, actions);
            const selDay = beltDays.find(d => d.dateStr === selectedBeltDay) || beltDays.find(d => d.isToday);
            if (!selDay) return null;
            const dayMeetings = visibleMeetings.filter(m => ensureArray(m.scheduledDays).includes(selDay.dayName));
            return (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.navy, marginBottom: 10 }}>
                  {selDay.dayName} {selDay.dayNum}{selDay.isToday ? " · Today" : ""} — Scheduled Meetings
                  <span style={{ marginLeft: 8, background: T.navy + "15", color: T.navy, borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{dayMeetings.length}</span>
                </div>
                {dayMeetings.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic" }}>No meetings scheduled on this day.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {dayMeetings.map((m, i) => {
                    const mtgActions = (actions || []).filter(a => a.srcId ? a.srcId === m.id : a.src === m.type);
                    const doneCount = mtgActions.filter(a => a.status === "COMPLETED" || a.status === "DROPPED").length;
                    return (
                      <div key={m.id || `dm-${i}`} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "nowrap", overflowX: "auto" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: T.navy, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }} onClick={() => setMtgPlan(m)}>{m.name || m.type}</div>
                            <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{m.time} · {m.plant} · Facilitated by <b style={{ color: T.text }}>{m.facilitator}</b></div>
                          </div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", overflowX: "auto" }}>
                            {ensureArray(m.scheduledDays).map(d => <span key={d} style={{ padding: "2px 8px", borderRadius: 6, background: d === selDay.dayName ? T.navy : T.navy + "15", color: d === selDay.dayName ? "#fff" : T.navy, fontSize: 10, fontWeight: 700 }}>{d}</span>)}
                          </div>
                        </div>
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${T.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .3, marginBottom: 6 }}>
                            Actions created ({mtgActions.length}{mtgActions.length > 0 ? ` · ${doneCount} done` : ""})
                          </div>
                          {mtgActions.length === 0 ? (
                            <div style={{ fontSize: 11, color: T.text2, fontStyle: "italic" }}>No actions created from this meeting yet.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {mtgActions.slice(0, 4).map((a, ai) => (
                                <div key={a.id || `ma-${ai}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontSize: 11, color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.sn ? `${a.sn} — ` : ""}{a.text}</span>
                                  <SBadge s={a.status} />
                                </div>
                              ))}
                              {mtgActions.length > 4 && <div style={{ fontSize: 10, color: T.text2 }}>+{mtgActions.length - 4} more</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Completed Meeting Dashboard ── */}
      <CompletedMeetingDashboard meetings={visibleMeetings} actions={actions} users={users} user={user} plants={plants} />

      {/* ── Weekly Meeting Accountability ── */}
      <WeeklyMeetingAccountability meetings={visibleMeetings} actions={actions} users={users} user={user} plants={plants} machines={machines} selectedDay={selectedBeltDay} onActionUpdate={(id, patch) => { const np = normalizeActionPatch(patch); setActions(p => p.map(a => a.id !== id ? a : { ...a, ...np })); apiUpdate("actions", id, resolveRecordIds(np, plants, depts, machines, projects)).catch(() => fetchData && fetchData()); }} />

      {charter && <ProjectCharterModal pr={charter} onClose={() => { setCharter(null); setCharterActionSel(null); }} actions={actions} meetings={meetings} user={user} users={users} onProjectUpdate={updated => { setProjects(p => p.map(x => x.id === updated.id ? updated : x)); if (charter && charter.id === updated.id) setCharter(updated); onProjectUpdate(updated); }} onActionSelect={a => setCharterActionSel(a)} />}
      {charterActionSel && <ActionDetailPanel action={charterActionSel} onClose={() => setCharterActionSel(null)} onUpdate={(id, patch) => { const np = normalizeActionPatch(patch); setActions(p => p.map(a => a.id !== id ? a : { ...a, ...np })); apiUpdate("actions", id, resolveRecordIds(np, plants, depts, machines, projects, meetings)).catch(() => fetchData && fetchData()); setCharterActionSel(p => p ? { ...p, ...np } : p); }} user={user} users={users} allUsers={users} plants={plants} machines={machines} meetings={meetings} />}
      {showAddMtg && <AddMeetingModal plants={plants} users={users} projects={projects} onSave={m => { const mtg = { ...m, id: "M" + Date.now(), completedSessions: [] }; setMeetings(p => [...p, mtg]); apiCreate("meetings", resolveRecordIds(mtg, plants, depts, machines, projects)); setShowAddMtg(false); }} onClose={() => setShowAddMtg(false)} currentUser={user} />}
      {/* Feature 3: Add Project Modal */}
      {showAddProject && <AddProjectModal plants={plants} users={users} onSave={p => { const pName = {}; plants.forEach(pl => pName[pl.id] = pl.name); const pr = { ...p, plant: pName[p.plantId] || p.plantId, id: "PR" + Date.now(), milestones: [], risks: [], team: [], budget: p.budget ? Number(p.budget) || 0 : 0 }; setProjects(prev => [...prev, pr]); apiCreate("projects", pr); showAddProject && setShowAddProject(false); }} onClose={() => setShowAddProject(false)} currentUser={user} />}
      {/* Feature 4: Meeting Plan Side Panel */}
      {mtgPlan && <MeetingPlanPanel key={mtgPlan.id} mtg={mtgPlan} canEdit={canEditMeetings} projects={projects} users={users} plants={plants} onSave={updated => { setMeetings(p => p.map(m => m.id === updated.id ? updated : m)); setMtgPlan(updated); apiUpdate("meetings", updated.id, resolveRecordIds(updated, plants, depts, machines, projects)); }} onClose={() => setMtgPlan(null)} mtgPresets={mtgPresets} currentUser={user} />}
    </div>
  );
}

/* Feature 3: Add Project Modal */
