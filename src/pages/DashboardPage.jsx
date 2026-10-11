/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useState } from "react";
import { apiUpdate } from "../api/autosave.js";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { Avatar, Empty, KPICard, PBadge, PageHeader, SBadge, Sparkbar } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { displayStatus, normalizeStatus } from "../utils/constants.js";
import { canAccessMeeting, normalizeActionPatch, responsibleMatchesUsers } from "../utils/data.js";
import { getEscBadgeStyle } from "../utils/escalation.js";
import { daysOver, fmt, isOverdue } from "../utils/helpers.js";
import { isUserAdmin, scopedDepts, scopedPlants } from "../utils/permissions.js";
import { SC, T } from "../utils/theme.js";

/* ===================== DASHBOARD ===================== */
export function DashboardPage({ actions, plants, depts, users, audit, user, meetings, onViewEscalations, refreshData, setActions: setActionsUp }) {
  const [drill, setDrill] = useState(null);
  const [deptDrill, setDeptDrill] = useState(null);
  const [mtgDrill, setMtgDrill] = useState(false);
  const [actionDetail, setActionDetail] = useState(null);
  const [plantF, setPlantF] = useState("All");
  const [deptF, setDeptF] = useState("All");
  useEscClose(useCallback(() => { setDrill(null); setDeptDrill(null); setMtgDrill(false); }, []));

  const _allPlants = plants ? plants.map(p => p.name) : [...new Set(actions.map(a => a.plant))];
  // Only Admin / MD see everyone's actions on the dashboard. Everyone else
  // (including Plant Head) only sees actions where they are responsible —
  // matches the same scoping already used on the Actions Register page.
  const isDashAdmin = isUserAdmin(user);
  const userNameLower = (user?.name || "").trim().toLowerCase();
  let fa = isDashAdmin
    ? actions
    : actions.filter(a => responsibleMatchesUsers(a.responsible, [userNameLower].filter(Boolean)) || (a.allocatedBy || "").trim().toLowerCase() === userNameLower);
  if (plantF !== "All") fa = fa.filter(a => a.plant === plantF);
  if (deptF !== "All") fa = fa.filter(a => String(a.section ?? "").toLowerCase().trim() === String(deptF ?? "").toLowerCase().trim() || String(a.dept ?? "").toLowerCase().trim() === String(deptF ?? "").toLowerCase().trim());

  const total = fa.length, comp = fa.filter(a => a.status === "COMPLETED").length, ip = fa.filter(a => normalizeStatus(a.status) === "IN PROCESS").length;
  const ns = fa.filter(a => a.status === "NOT STARTED").length, drop = fa.filter(a => a.status === "DROPPED").length;
  const over = fa.filter(isOverdue).length, crit = fa.filter(a => a.priority === "CRITICAL" && a.status !== "COMPLETED" && a.status !== "DROPPED").length;
  const pendingConf = fa.filter(a => a.pendingConfirmation).length;
  const revs = fa.reduce((s, a) => s + (Number(a.revisions) || 0), 0);
  // On-time rate: for each completed action, 100 if closedOn<=due, else 0; then average
  const onT = comp > 0 ? Math.round(fa.filter(a => a.status === "COMPLETED").reduce((sum, a) => {
    if (!a.due || !a.closedOn) return sum + 0;
    return sum + (new Date(a.closedOn) <= new Date(a.due) ? 100 : 0);
  }, 0) / comp) : 0;
  // Non-admins only ever see their own department on the heat map, regardless
  // of the department filter dropdown.
  const deptScopedDepts = isDashAdmin ? depts : depts.filter(d => String(d.name ?? "").toLowerCase().trim() === String(user?.dept ?? "").toLowerCase().trim());
  const visibleDepts = deptF !== "All" ? deptScopedDepts.filter(d => String(d.name ?? "").toLowerCase().trim() === String(deptF ?? "").toLowerCase().trim()) : (plantF !== "All" ? deptScopedDepts.filter(d => (users || []).some(u => u.plant === plantF && u.dept === d.name) || fa.some(a => String(a.section ?? "").toLowerCase().trim() === String(d.name ?? "").toLowerCase().trim())) : deptScopedDepts);

  // Build heat map rows: merge dept master + unique section values from actual actions
  // This ensures actions always appear even if section doesn't match any dept name
  const heatmapRows = visibleDepts.map(d => ({ id: d.id, name: d.name, head: d.head, icon: d.icon || "🏭", fromDept: true }));

  const scopedMeetings = isDashAdmin ? (meetings || []) : (meetings || []).filter(m => canAccessMeeting(user, m, null));
  const allSessions = scopedMeetings.flatMap(m => (Array.isArray(m.completedSessions) ? m.completedSessions : []).map(s => ({ ...s, type: m.type, plant: m.plant })));
  const totalMtgMins = allSessions.reduce((s, x) => s + (x.duration || 0), 0);
  // Deduplicate audit for badge (keep highest level per action SN) — scoped to
  // the same action set (fa) the user is allowed to see, not the global audit log.
  const faSnSet = new Set(fa.map(a => a.sn));
  const scopedAudit = isDashAdmin ? (audit || []) : (audit || []).filter(e => faSnSet.has(e.sn));
  const dedupedAuditBadge = Object.values(
    scopedAudit.reduce((acc, e) => {
      if (!acc[e.sn] || e.level > acc[e.sn].level) acc[e.sn] = e;
      return acc;
    }, {})
  );

  return (
    <div className="fade-in">
      <PageHeader title="Dashboard" sub="Live accountability snapshot">
        <div className="filter-bar" style={{ gap: 10, alignItems: "flex-end" }}>
          {refreshData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4 }}>&nbsp;</span>
              <button className="btn btn-ghost" onClick={refreshData} style={{ border: `1px solid ${T.border}`, background: "#fff", fontSize: 13, padding: "6px 14px" }}>🔄 Refresh</button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4 }}>Plant</span>
            <select value={plantF} onChange={e => setPlantF(e.target.value)} style={{ padding: "6px 10px" }}>
              <option value="All">All Plants</option>{scopedPlants(user, plants).map(p => <option key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4 }}>Department</span>
            <select value={deptF} onChange={e => setDeptF(e.target.value)} style={{ padding: "6px 10px" }}>
              <option value="All">All Departments</option>{scopedDepts(user, depts).map(d => <option key={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </PageHeader>

      <div className="grid-kpi-4" style={{ marginBottom: 12 }}>
        <KPICard icon="✅" value={total} label="Total Actions" sub="All records" color={T.navy} onClick={() => setDrill("aging")} />
        <KPICard icon="⚠" value={over} label="Overdue" sub="Need attention" color={T.red} alert={over > 0} onClick={() => setDrill("overdue")} />
        <KPICard icon="🔴" value={crit} label="Critical Open" sub="Unresolved" color={T.red} alert={crit > 0} onClick={() => setDrill("critical")} />
        <KPICard icon="🎯" value={`${onT}%`} label="On-Time Rate" sub="Completed on schedule" color={onT >= 80 ? T.green : T.amber} onClick={() => setDrill("ontime")} />
      </div>
      <div className="grid-kpi-4" style={{ marginBottom: 20 }}>
        <KPICard icon="📅" value={revs} label="Date Revisions" sub="Scope creep tracker" color={revs > 5 ? T.amber : T.slate} onClick={() => setDrill("revisions")} />
        <KPICard icon="🚨" value={dedupedAuditBadge.length} label="Escalated Actions" sub="View all →" color={T.red} alert={dedupedAuditBadge.length > 0} onClick={() => setDrill("escalated")} />
        <KPICard icon="⏳" value={pendingConf} label="Pending Confirm" sub="Awaiting approval" color={T.amber} alert={pendingConf > 0} onClick={() => setDrill("pending")} />
        <div className="card card-hover" onClick={() => setMtgDrill(true)} style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.navy + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎙</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: T.navy, lineHeight: 1 }}>{totalMtgMins}<span style={{ fontSize: 12, fontWeight: 400, color: T.text2, marginLeft: 2 }}>min</span></div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Meetings Ran</div>
          <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{allSessions.length} sessions · click to see</div>
        </div>
      </div>

      <div className="card status-bar" style={{ padding: "14px 24px", marginBottom: 20, gap: 0, alignItems: "center" }}>
        {[{ s: "NOT STARTED", n: ns }, { s: "IN PROCESS", n: ip }, { s: "COMPLETED", n: comp }, { s: "DROPPED", n: drop }].map((k, i, arr) => (
          <div key={k.s} onClick={() => setDrill(k.s.toLowerCase().replace(/ /g, "_"))} style={{ flex: 1, padding: "0 18px", borderRight: i < arr.length - 1 ? `1.5px solid ${T.border}` : "none", cursor: "pointer" }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 700, color: SC[k.s]?.dot || T.slate }}>{k.n}</div>
            <div style={{ marginTop: 5 }}><SBadge s={k.s} /></div>
          </div>
        ))}
        <div style={{ flex: 1.8, padding: "0 18px", borderLeft: `1.5px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, marginBottom: 6, letterSpacing: .5, textTransform: "uppercase" }}>Completion</div>
          <div style={{ background: T.border, borderRadius: 6, height: 10, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 6, background: `linear-gradient(90deg,${T.green},${T.amber})`, width: `${total ? Math.round(comp / total * 100) : 0}%`, transition: "width .6s" }} /></div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>{total ? Math.round(comp / total * 100) : 0}% complete</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1.5px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: T.navy }}>Department Accountability Heat Map</div><div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>Health = Red if any critical open, Amber if any overdue, else Green. Completion % = closed / total actions.</div></div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: T.text2 }}>
            {[{ c: T.red, l: "Critical" }, { c: T.amber, l: "Overdue" }, { c: T.green, l: "On track" }].map(x => (
              <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: x.c, display: "inline-block" }} />{x.l}</span>
            ))}
          </div>
        </div>
        <table>
          <thead><tr><th>Department</th><th style={{ textAlign: "center" }}>Total</th><th style={{ textAlign: "center" }}>Open</th><th style={{ textAlign: "center" }}>Critical</th><th style={{ textAlign: "center" }}>Overdue</th><th>Completion</th><th style={{ textAlign: "center" }}>Health</th></tr></thead>
          <tbody>{heatmapRows.map(d => {
            const dname = String(d.name ?? "").toLowerCase().trim();
            const da = fa.filter(a => {
              const sec = String(a.section ?? "").toLowerCase().trim();
              const dept = String(a.dept ?? "").toLowerCase().trim();
              return sec === dname || dept === dname;
            });
            const open = da.filter(a => a.status !== "COMPLETED" && a.status !== "DROPPED").length;
            const c = da.filter(a => a.priority === "CRITICAL" && a.status !== "COMPLETED" && a.status !== "DROPPED").length;
            const o = da.filter(isOverdue).length;
            const dn = da.filter(a => a.status === "COMPLETED").length;
            const r = da.length ? Math.round(dn / da.length * 100) : 0;
            const health = da.length === 0 ? "nodata" : c > 0 ? "red" : o > 0 ? "amber" : "green";
            const hc = health === "red" ? T.red : health === "amber" ? T.amber : health === "nodata" ? T.slate : T.green;
            const hb = health === "red" ? T.redL : health === "amber" ? T.amberL : health === "nodata" ? "#F0F0F8" : T.greenL;
            return (
              <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => setDeptDrill(d)}>
                <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: hc, flexShrink: 0 }} /><span style={{ fontSize: 18 }}>{d.icon}</span><div><div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div><div style={{ fontSize: 11, color: T.text2 }}>{d.head && d.head !== "—" ? `HOD: ${d.head}` : d.fromDept ? "" : "Section"}</div></div></div></td>
                <td style={{ textAlign: "center" }}><span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: T.navy }}>{da.length}</span></td>
                <td style={{ textAlign: "center", fontWeight: 600, color: open > 0 ? T.amber : T.green }}>{open}</td>
                <td style={{ textAlign: "center", fontWeight: 700, color: c > 0 ? T.red : T.text2 }}>{c}</td>
                <td style={{ textAlign: "center", fontWeight: 700, color: o > 0 ? T.red : T.text2 }}>{o}</td>
                <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkbar pct={r} color={r >= 80 ? T.green : r >= 50 ? T.amber : T.red} /><span style={{ fontSize: 12, fontWeight: 700, color: r >= 80 ? T.green : r >= 50 ? T.amber : T.red, minWidth: 30 }}>{r}%</span></div></td>
                <td style={{ textAlign: "center" }}><span style={{ padding: "3px 10px", borderRadius: 20, background: hb, color: hc, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{health}</span></td>
              </tr>
            );
          })}
          {heatmapRows.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: "28px 0", color: T.text2, fontSize: 13 }}>No departments or actions found for this filter.</td></tr>
          )}
          </tbody>
        </table>
      </div>

      <div className="grid-2col">
        {/* Feature 8: Clickable Critical & Overdue with slide-in panel */}
        <div className="card card-hover" style={{ padding: 20, cursor: "pointer" }} onClick={() => setDrill("criticalOverdue")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>Critical and Overdue</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ background: T.redL, color: T.red, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{fa.filter(a => (a.priority === "CRITICAL" || isOverdue(a)) && a.status !== "COMPLETED" && a.status !== "DROPPED").length}</span>
              <span style={{ fontSize: 11, color: T.navy, fontWeight: 700 }}>View All →</span>
            </div>
          </div>
          {fa.filter(a => (a.priority === "CRITICAL" || isOverdue(a)) && a.status !== "COMPLETED" && a.status !== "DROPPED").length === 0
            ? <Empty icon="✅" title="All clear" sub="No critical or overdue issues." />
            : fa.filter(a => (a.priority === "CRITICAL" || isOverdue(a)) && a.status !== "COMPLETED" && a.status !== "DROPPED").slice(0, 4).map(a => (
              <div key={a.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}`, alignItems: "flex-start" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: a.priority === "CRITICAL" ? T.red : T.amber, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{a.text.slice(0, 55)}{a.text.length > 55 ? "…" : ""}</div><div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{a.section} · {isOverdue(a) ? <span style={{ color: T.red, fontWeight: 600 }}>{daysOver(a)}d late</span> : fmt(a.due)}</div></div>
                <Avatar name={a.responsible} size={24} users={users} />
              </div>
            ))
          }
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>Escalation Alerts</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ background: T.redL, color: T.red, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{dedupedAuditBadge.length} logged</span>
              <button onClick={() => onViewEscalations && onViewEscalations()} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: T.navy, fontWeight: 700, padding: 0 }}>View All →</button>
            </div>
          </div>
          {audit.length === 0
            ? <Empty icon="🔇" title="No escalations" sub="All within thresholds." />
            : audit.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border}`, alignItems: "flex-start" }}>
                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0, background: getEscBadgeStyle(e.level).bg, color: getEscBadgeStyle(e.level).color }}>L{e.level}</span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500 }}>{e.text.slice(0, 55)}{e.text.length > 55 ? "…" : ""}</div><div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{e.target} · {e.reason}</div></div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Feature 8: Critical/Overdue slide-in side panel */}
      {drill === "criticalOverdue" && (() => {
        const critOverdue = fa.filter(a => (a.priority === "CRITICAL" || isOverdue(a)) && a.status !== "COMPLETED" && a.status !== "DROPPED").sort((a, b) => daysOver(b) - daysOver(a));
        return (
          <>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={() => setDrill(null)} />
            <div className="side-panel" style={{ width: 480, padding: 0, zIndex: 355 }}>
              <div style={{ background: `linear-gradient(135deg,${T.red},#E74C3C)`, padding: "20px 24px", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, opacity: .7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Dashboard Alert</div>
                    <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Critical & Overdue</h2>
                    <div style={{ fontSize: 12, opacity: .8 }}>{critOverdue.length} items requiring immediate attention</div>
                  </div>
                  <button onClick={() => setDrill(null)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
                {critOverdue.length === 0 ? <Empty icon="✅" title="All clear!" sub="No critical or overdue actions." /> :
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {critOverdue.map(a => (
                      <div key={a.id} style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", border: `1.5px solid ${a.priority === "CRITICAL" ? T.red : T.amber}30`, cursor: "pointer", transition: "transform .15s" }} onClick={() => { setDrill(null); setActionDetail(a); }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text2 }}>{a.sn}</span>
                          <div style={{ display: "flex", gap: 6 }}><SBadge s={a.status} /><PBadge p={a.priority} /></div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{a.text}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Avatar name={a.responsible} size={22} users={users} />
                            <span style={{ fontSize: 12, color: T.text2 }}>{a.responsible}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isOverdue(a) ? T.red : T.amber }}>{isOverdue(a) ? `${daysOver(a)}d overdue` : fmt(a.due)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          </>
        );
      })()}

      {drill && drill !== "criticalOverdue" && (() => {
        const drillData = {
          overdue: { title: "Overdue Actions", icon: "⚠", color: T.red, rows: fa.filter(isOverdue).sort((a, b) => daysOver(b) - daysOver(a)) },
          critical: { title: "Critical Open Actions", icon: "🔴", color: T.red, rows: fa.filter(a => a.priority === "CRITICAL" && a.status !== "COMPLETED" && a.status !== "DROPPED") },
          ontime: { title: "On-Time Closure", icon: "🎯", color: T.green, rows: fa.filter(a => a.status === "COMPLETED") },
          revisions: { title: "Date Revision Actions", icon: "📅", color: T.amber, rows: fa.filter(a => a.revisions > 0).sort((a, b) => b.revisions - a.revisions) },
          pending: { title: "Pending Confirmation", icon: "⏳", color: T.amber, rows: fa.filter(a => a.pendingConfirmation) },
          aging: { title: "All Actions — Aging View", icon: "📊", color: T.navy, rows: fa },
          not_started: { title: "Not Started Actions", icon: "⭕", color: T.slate, rows: fa.filter(a => a.status === "NOT STARTED") },
          in_process: { title: "In Process Actions", icon: "🔄", color: T.amber, rows: fa.filter(a => normalizeStatus(a.status) === "IN PROCESS") },
          dropped: { title: "Dropped Actions", icon: "🚫", color: T.text2, rows: fa.filter(a => a.status === "DROPPED") },
          escalated: { title: "Escalated Actions", icon: "🚨", color: T.red, rows: fa.filter(a => audit.find(e => e.sn === a.sn)) },
        };
        const d = drillData[drill];
        if (!d) return null;
        return (
          <>
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={() => setDrill(null)} />
            <div className="side-panel" style={{ width: 520, padding: 0, zIndex: 355 }}>
              <div style={{ background: `linear-gradient(135deg,${d.color},${d.color}CC)`, padding: "20px 24px", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, opacity: .7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Dashboard Drill-Down</div>
                    <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{d.icon} {d.title}</h2>
                    <div style={{ fontSize: 12, opacity: .8 }}>{d.rows.length} action{d.rows.length !== 1 ? "s" : ""}</div>
                  </div>
                  <button onClick={() => setDrill(null)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
                {d.rows.length === 0 ? <Empty icon="📭" title="No records" sub="Nothing to show for this filter." /> :
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {d.rows.slice(0, 30).map(a => (
                      <div key={a.id} style={{ background: T.bg, borderRadius: 10, padding: "12px 14px", border: `1.5px solid ${isOverdue(a) ? T.red + "40" : T.border}`, cursor: "pointer", transition: "transform .15s" }} onClick={() => { setDrill(null); setActionDetail(a); }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text2 }}>{a.sn}</span>
                          <div style={{ display: "flex", gap: 5 }}><SBadge s={displayStatus(a)} /><PBadge p={a.priority} /></div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{a.text}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Avatar name={a.responsible} size={22} users={users} />
                            <span style={{ fontSize: 12, color: T.text2 }}>{a.responsible || "Unassigned"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, fontSize: 11, color: T.text2 }}>
                            {drill === "revisions" && <span style={{ fontWeight: 700, color: T.amber }}>{a.revisions} revision{a.revisions !== 1 ? "s" : ""}</span>}
                            {drill === "escalated" && <span style={{ fontWeight: 700, color: T.red }}>L{Math.max(...(audit.filter(e => e.sn === a.sn).map(e => e.level || 1)))} escalated</span>}
                            <span style={{ color: isOverdue(a) ? T.red : T.text2, fontWeight: isOverdue(a) ? 700 : 400 }}>{isOverdue(a) ? `${daysOver(a)}d overdue` : fmt(a.due)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          </>
        );
      })()}

      {mtgDrill && (
        <div className="overlay" onClick={() => setMtgDrill(false)}>
          <div className="modal" style={{ width: 620, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: T.navy }}>Meeting Duration Summary</h2>
              <button onClick={() => setMtgDrill(false)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>x</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
              {[{ l: "Total Sessions", v: allSessions.length, c: T.navy }, { l: "Total Minutes", v: totalMtgMins, c: T.amber }, { l: "Avg Duration", v: allSessions.length ? Math.round(totalMtgMins / allSessions.length) + "min" : "—", c: T.green }].map(k => (
                <div key={k.l} style={{ textAlign: "center", background: T.bg, borderRadius: 10, padding: "16px 8px" }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 28, fontWeight: 800, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>{k.l}</div>
                </div>
              ))}
            </div>
            {scopedMeetings.map(m => {
              const sessions = m.completedSessions || [];
              const totalMin = sessions.reduce((s, x) => s + (x.duration || 0), 0);
              return (
                <div key={m.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div><div style={{ fontWeight: 600, fontSize: 13 }}>{m.name || m.type}</div><div style={{ fontSize: 11, color: T.text2 }}>{m.plant} · {m.project && <span style={{ color: T.amber }}>📎 {m.project}</span>}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 700, color: T.navy }}>{totalMin}min</div><div style={{ fontSize: 10, color: T.text2 }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</div></div>
                  </div>
                  {sessions.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>{sessions.map((s, i) => <div key={i} style={{ background: T.bg, borderRadius: 6, padding: "4px 10px", fontSize: 11 }}>{fmt(s.date)} — <b>{s.duration}min</b></div>)}</div>}
                  {sessions.length === 0 && <div style={{ fontSize: 11, color: T.text2, fontStyle: "italic" }}>No sessions recorded yet</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deptDrill && (() => {
        const da = fa.filter(a => String(a.section ?? "").toLowerCase().trim() === String(deptDrill.name ?? "").toLowerCase().trim() || String(a.dept ?? "").toLowerCase().trim() === String(deptDrill.name ?? "").toLowerCase().trim());
        const dopen = da.filter(a => a.status !== "COMPLETED" && a.status !== "DROPPED").length;
        const dover = da.filter(isOverdue).length, ddone = da.filter(a => a.status === "COMPLETED").length;
        return (
          <div className="overlay" onClick={() => setDeptDrill(null)}>
            <div className="modal" style={{ width: 660, padding: 28 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 28 }}>{deptDrill.icon}</span><div><h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: T.navy }}>{deptDrill.name}</h2><div style={{ fontSize: 12, color: T.text2 }}>HOD: {deptDrill.head}</div></div></div>
                <button onClick={() => setDeptDrill(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>x</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, margin: "14px 0" }}>
                {[{ l: "Total", v: da.length, c: T.navy }, { l: "Open", v: dopen, c: T.amber }, { l: "Overdue", v: dover, c: T.red }, { l: "Done", v: ddone, c: T.green }].map(k => (
                  <div key={k.l} style={{ textAlign: "center", background: T.bg, borderRadius: 8, padding: "12px 8px" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: k.c }}>{k.v}</div>
                    <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{k.l}</div>
                  </div>
                ))}
              </div>
              <table><thead><tr><th>SN</th><th>Action</th><th>Reason</th><th>Responsible</th><th>Status</th><th>Due</th></tr></thead>
                <tbody>{da.map(a => (
                  <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => { setActionDetail(a); setDeptDrill(null); }} onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = "#FAFAFE"); }} onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = ""); }}><td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2 }}>{a.sn}</td><td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{a.text}</td><td style={{ maxWidth: 140, fontSize: 11, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.reasonOfAction || "—"}</td><td><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={a.responsible} size={22} users={users} /><span style={{ fontSize: 12 }}>{a.responsible?.split(" ")[0]}</span></div></td><td><SBadge s={a.status} /></td><td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text }}>{fmt(a.due)}</td></tr>
                ))}</tbody></table>
              {da.length > 0 && <div style={{ fontSize: 11, color: T.text2, marginTop: 8, fontStyle: "italic" }}>💡 Click any row to open and edit the action</div>}
            </div>
          </div>
        );
      })()}
      {actionDetail && <ActionDetailPanel action={actionDetail} onClose={() => setActionDetail(null)} onUpdate={(id, patch) => { const np = normalizeActionPatch(patch); if (setActionsUp) setActionsUp(p => p.map(a => a.id !== id ? a : { ...a, ...np })); setActionDetail(p => p ? { ...p, ...np } : p); apiUpdate("actions", id, np).catch(() => refreshData && refreshData()); }} user={user} users={users} allUsers={users} plants={plants} meetings={meetings} />}
    </div>
  );
}



/* ===================== MASTER SETUP ===================== */
/* ===================== ESCALATION MATRIX TAB ===================== */
