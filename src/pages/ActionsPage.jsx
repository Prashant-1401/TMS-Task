/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { apiRemove, apiUpdate } from "../api/autosave.js";
import { apiPost } from "../api/client.js";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { Lbl, PageHeader } from "../components/ui.jsx";
import { ExcelIO } from "../components/ExcelIO.jsx";
import { BoardView, KanbanView, TableView, TimelineView } from "../components/views.jsx";
import { PRIORITY_LIST, STATUS_LIST, displayStatus, saveFilterPref, userFilterPref, userSortPref, userViewPref } from "../utils/constants.js";
import { normalizeActionPatch, resolveRecordIds, responsibleMatchesUsers } from "../utils/data.js";
import { todayStr } from "../utils/helpers.js";
import { getPerms, isUserAdmin, scopedDepts, scopedPlants, scopedUsers } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

export function ActionsPage({ actions, setActions, plants, depts, users, user, projects, machines, meetings, fetchData }) {
  const userKey = user?.id || "guest";
  const [view, setView] = useState(userViewPref[userKey] || "table");
  // Multi-select filters: persistent across page changes
  const isAdmin = isUserAdmin(user);
  const [filters, setFilters] = useState(userFilterPref[userKey] || { 
    plant: user?.plant && user.plant !== "All" ? [user.plant] : [], 
    section: [], 
    responsible: [], 
    status: [], priority: [], project: [], meeting: [] 
  });
  const [myActionsOnly, setMyActionsOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  const [dropPos, setDropPos] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ responsible: "", email: "", status: "" });
  const [emailSending, setEmailSending] = useState(false);
  const canEdit = isUserAdmin(user) || getPerms(user).canEditActions;
  const allProjects = (projects || []).map(p => p.name).filter(Boolean);

  const changeView = v => { setView(v); userViewPref[userKey] = v; };

  // Scope: current user + all subordinates (recursive)
  const getSubTree = (name, allUsers, visited = new Set()) => {
    if (visited.has(name)) return [];
    visited.add(name);
    const directs = allUsers.filter(u => u.superior === name);
    const all = [name, ...directs.map(d => d.name)];
    directs.forEach(d => { all.push(...getSubTree(d.name, allUsers, visited).filter(n => !all.includes(n))); });
    return all;
  };
  const scopedNames = user ? getSubTree(user.name, users) : [];
  const userNameLower = (user?.name || "").trim().toLowerCase();
  const userPlant = user?.plant;
  let scoped = isAdmin
    ? actions
    : actions.filter(a => !userPlant || userPlant === "All" || !a.plant || a.plant === "All" || a.plant === userPlant);
  // Non-admin users: also scope by responsible person (self + subordinates)
  if (!isAdmin && scopedNames.length > 0) {
    scoped = scoped.filter(a => responsibleMatchesUsers(a.responsible, scopedNames.map(n => n.toLowerCase())));
  }

  const toggleFilter = (key, val) => {
    setFiltersPersist(f => {
      const cur = f[key];
      return { ...f, [key]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
    });
  };
  const clearFilter = (key) => setFiltersPersist(f => ({ ...f, [key]: [] }));
  const clearAll = () => { const empty = { plant: [], section: [], responsible: [], status: [], priority: [], project: [], meeting: [] }; setFilters(empty); userFilterPref[userKey] = empty; saveFilterPref(); setOpenFilter(null); setDropPos(null); };
  // Save filters to persistent store on each change
  const setFiltersPersist = (updater) => {
    setFilters(prev => { const next = typeof updater === "function" ? updater(prev) : updater; userFilterPref[userKey] = next; saveFilterPref(); return next; });
  };

  // My Actions / All Actions scoping.
  // "My Actions" = actions where THIS user is the responsible person only.
  // Actions allocated BY the user for someone else must NOT appear here.
  const displayScope = myActionsOnly
    ? scoped.filter(a => responsibleMatchesUsers(a.responsible, [userNameLower].filter(Boolean)))
    : scoped;

  const fa = displayScope.filter(a => {
    if (filters.plant.length && !filters.plant.includes("All") && !filters.plant.includes(a.plant)) return false;
    if (filters.section.length && !filters.section.includes(a.section)) return false;
    if (filters.responsible.length && !filters.responsible.includes(a.responsible)) return false;
    const aStatus = displayStatus(a);
    if (filters.status.length && !filters.status.includes(aStatus)) return false;
    if (filters.priority.length && !filters.priority.includes(a.priority)) return false;
    const aProj = a.projectName || a.project || "None";
    if (filters.project.length && !filters.project.includes(aProj)) return false;
    const aMtg = (a.srcId && (meetings || []).find(m => m.id === a.srcId)) ? (meetings.find(m => m.id === a.srcId).type) : (a.src || "None");
    if ((filters.meeting || []).length && !filters.meeting.includes(aMtg)) return false;
    if (q && ![a.text, a.responsible, a.sn, a.src, a.section].join(" ").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const upAction = (id, patch) => {
    const np = normalizeActionPatch(patch);
    setActions(p => p.map(a => {
      if (String(a.id) !== String(id)) return a;
      if (np.due && np.due !== a.due) {
        const rev = { date: todayStr(), from: a.due, to: np.due, by: user?.name || "Unknown" };
        return { ...a, ...np, revisions: (a.revisions || 0) + 1, revisionHistory: [...(a.revisionHistory || []), rev] };
      }
      return { ...a, ...np };
    }));
    apiUpdate("actions", id, resolveRecordIds(np, plants, depts, machines, projects, meetings)).then(saved => {
      if (saved && saved.id) setActions(p => p.map(a => String(a.id) === String(id) ? { ...a, ...saved } : a));
    }).catch(err => {
      console.error("Action update failed:", err);
      if (fetchData) fetchData();
    });
  };
  const upStatus = (id, status) => {
    if (status === "COMPLETED" || status === "PENDING CONFIRM") {
      // Expand filter so the action stays visible after status change
      setFiltersPersist(f => {
        if (f.status.length > 0 && !f.status.includes(status)) {
          return { ...f, status: [...f.status, status] };
        }
        return f;
      });
    }
    upAction(id, { status });
  };
  const deleteAction = (a) => {
    if (!window.confirm(`Delete action "${a.sn}" — ${a.text?.slice(0, 50)}…? This cannot be undone.`)) return;
    setActions(p => p.filter(x => x.id !== a.id));
    apiRemove("actions", a.id);
  };
  const allSections = scopedDepts(user, depts).map(d => d.name).filter(Boolean);
  const allResponsible = scopedUsers(user, users).map(u => u.name).filter(Boolean);
  const _pendingConf = scoped.filter(a => a.pendingConfirmation && a.status !== "COMPLETED" && a.status !== "DROPPED");

  // Feature 7: Export functions
  const exportCSV = () => {
    const headers = ["SN", "Source", "Meeting", "Department", "Plant", "Date", "Action", "Responsible", "Due Date", "Status", "Priority", "Revisions"];
    const rows = fa.map(a => { const m = a.srcId && (meetings || []).find(x => x.id === a.srcId) ? (meetings.find(x => x.id === a.srcId).type + (meetings.find(x => x.id === a.srcId).plant ? " · " + meetings.find(x => x.id === a.srcId).plant : "")) : (a.src || ""); return [a.sn, a.src, m, a.section, a.plant, a.dateOfAction, `"${a.text.replace(/"/g, '""')}"`, a.responsible, a.due, a.status, a.priority, a.revisions || 0]; });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a"); a2.href = url; a2.download = `actions-${todayStr()}.csv`; a2.click(); URL.revokeObjectURL(url);
  };
  const exportPDF = () => {
    const content = `
      <html><head><style>
        body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
        h2{color:#272262;margin-bottom:4px;}
        p{color:#636E72;font-size:10px;margin-bottom:16px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#272262;color:#fff;padding:8px 10px;text-align:left;font-size:10px;}
        td{padding:7px 10px;border-bottom:1px solid #E8E8F0;font-size:10px;}
        tr:nth-child(even) td{background:#F5F5FB;}
        .status-badge{padding:2px 8px;border-radius:10px;font-weight:600;}
      </style></head><body>
      <h2>Task Management System — Tasks Register</h2>
      <p>Exported on ${new Date().toLocaleDateString("en-IN")} · ${fa.length} actions</p>
      <table>
        <tr><th>SN</th><th>Action</th><th>Responsible</th><th>Due Date</th><th>Status</th><th>Priority</th><th>Plant</th><th>Meeting</th></tr>
        ${fa.map(a => { const m = a.srcId && (meetings || []).find(x => x.id === a.srcId) ? (meetings.find(x => x.id === a.srcId).type + (meetings.find(x => x.id === a.srcId).plant ? " · " + meetings.find(x => x.id === a.srcId).plant : "")) : (a.src || "—"); return `<tr><td>${a.sn}</td><td>${a.text}</td><td>${a.responsible}</td><td>${a.due || "—"}</td><td>${a.status}</td><td>${a.priority}</td><td>${a.plant}</td><td>${m}</td></tr>`; }).join("")}
      </table>
      </body></html>`;
    const w = window.open("", "_blank"); w.document.write(content); w.document.close(); w.print();
  };
  const printPage = () => window.print();

  return (
    <div className="fade-in">
      <PageHeader title="Actions Register" sub={`${isAdmin ? (myActionsOnly ? "My actions" : "Plant-wide") : "My actions"} · ${displayScope.length} actions · ${fa.length} shown`}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* My / All toggle */}
          {isAdmin && <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1.5px solid ${T.border}` }}>
            <button onClick={() => setMyActionsOnly(false)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: !myActionsOnly ? T.navy : "transparent", color: !myActionsOnly ? "#fff" : T.text2, transition: "all .18s" }}>All Actions</button>
            <button onClick={() => setMyActionsOnly(true)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: myActionsOnly ? T.navy : "transparent", color: myActionsOnly ? "#fff" : T.text2, transition: "all .18s" }}>My Actions</button>
          </div>}
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Download CSV">📥 CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={exportPDF} title="Download PDF">📄 PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={printPage} title="Print">🖨 Print</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEmailModal(true)} title="Email Actions" style={{ color: T.navy }}>✉ Email</button>
          <ExcelIO kind="actions" onImported={fetchData} />
        </div>
      </PageHeader>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[{ v: "table", icon: "☰", l: "Table" }, { v: "board", icon: "⊞", l: "Board", mobile: true }, { v: "kanban", icon: "▦", l: "Kanban", mobile: true }, { v: "timeline", icon: "━", l: "Timeline", mobile: true }].map(x => (
          <button key={x.v} onClick={() => changeView(x.v)} className={x.mobile ? "hide-mobile" : ""} style={{ padding: "5px 14px", borderRadius: 7, border: `1.5px solid ${view === x.v ? T.navy : T.border}`, background: view === x.v ? T.navy : "transparent", color: view === x.v ? "#fff" : T.text2, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            {x.icon} {x.l}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
        <div className="filter-bar" style={{ alignItems: "flex-end", marginBottom: 10 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search actions…" style={{ width: 200 }} />
          {[
            { label: "Plant", key: "plant", opts: scopedPlants(user, plants).map(p => p.name).filter(n => n !== "All") },
            { label: "Department", key: "section", opts: allSections },
            { label: "Responsible", key: "responsible", opts: allResponsible },
            { label: "Status", key: "status", opts: [...STATUS_LIST, "PENDING CONFIRM"] },
            { label: "Priority", key: "priority", opts: PRIORITY_LIST },
            { label: "Project", key: "project", opts: ["None", ...allProjects] },
            { label: "Meeting", key: "meeting", opts: ["None", ...(meetings || []).map(m => m.type)] },
          ].map(({ label, key, opts }) => {
            const sel2 = filters[key];
            const isOpen = openFilter === key;
            return (
              <div key={key} style={{ position: "relative" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, letterSpacing: .4, textTransform: "uppercase", display: "block", marginBottom: 2 }}>{label}</span>
                <button onClick={e => { if (isOpen) { setOpenFilter(null); setDropPos(null); } else { const r = e.currentTarget.getBoundingClientRect(); setDropPos({ top: r.bottom + 4, left: r.left, width: r.width }); setOpenFilter(key); } }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1.5px solid ${sel2.length ? T.navy : T.border}`, borderRadius: 7, background: sel2.length ? "#EEF0FF" : "#fff", color: sel2.length ? T.navy : T.text, cursor: "pointer", fontSize: 12, fontWeight: 500, minWidth: 110, whiteSpace: "nowrap" }}>
                  <span style={{ flex: 1, textAlign: "left" }}>{sel2.length === 0 ? "All" : sel2.length === 1 ? sel2[0] : `${sel2.length} selected`}</span>
                  {sel2.length > 0 && <span onClick={e => { e.stopPropagation(); clearFilter(key); setDropPos(null); }} style={{ color: T.text2, fontWeight: 700, fontSize: 14, lineHeight: 1 }}>×</span>}
                  <span style={{ fontSize: 9, color: T.text2 }}>{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && dropPos && (
                  <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: dropPos.top, left: dropPos.left, zIndex: 600, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,.13)", minWidth: 190, maxHeight: 260, overflowY: "auto", padding: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: sel2.length === 0 ? 700 : 400, color: sel2.length === 0 ? T.navy : T.text, marginBottom: 2, borderBottom: `1px solid ${T.border}` }} onClick={() => clearFilter(key)}>
                      <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${T.border}`, background: "transparent", display: "inline-block" }} />
                      All (clear)
                    </label>
                    {opts.map(o => (
                      <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12, background: sel2.includes(o) ? "#EEF0FF" : "transparent", fontWeight: sel2.includes(o) ? 600 : 400 }}>
                        <input type="checkbox" checked={sel2.includes(o)} onChange={() => toggleFilter(key, o)} style={{ width: 14, height: 14, cursor: "pointer", accentColor: T.navy }} />
                        {o}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginLeft: "auto" }}>
            {Object.values(filters).some(v => v.length > 0) && <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear All</button>}
            <span style={{ fontSize: 12, color: T.text2, fontWeight: 500, paddingBottom: 3 }}>{fa.length}/{scoped.length}</span>
          </div>
        </div>
        {/* Active filter chips */}
        {Object.entries(filters).some(([, v]) => v.length > 0) && (
          <div style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 6, marginBottom: 10 }}>
            {Object.entries(filters).flatMap(([key, vals]) => vals.map(v => (
              <span key={key + v} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.navy + "15", color: T.navy, border: `1px solid ${T.navy}30`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                <span style={{ opacity: .6, fontSize: 10 }}>{key}:</span> {v}
                <button onClick={() => toggleFilter(key, v)} style={{ background: "transparent", border: "none", color: T.navy, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, marginLeft: 2, opacity: .6 }}>×</button>
              </span>
            )))}
          </div>
        )}

      </div>
      {openFilter && <div style={{ position: "fixed", inset: 0, zIndex: 599 }} onClick={() => { setOpenFilter(null); setDropPos(null); }} />}
      {view === "table" && <TableView fa={fa} upStatus={upStatus} setSel={a => { setSel(a); }} canEdit={canEdit} upAction={upAction} sortState={userSortPref[userKey]} onSortChange={s => { userSortPref[userKey] = s; }} users={users} meetings={meetings} deleteAction={deleteAction} />}
      {view === "board" && <BoardView fa={fa} setSel={setSel} users={users} />}
      {view === "kanban" && <KanbanView
  fa={fa}
  upStatus={upStatus}
  canEdit={canEdit}
  users={users}
  setSel={setSel}
  user={user}
/>}
      {view === "timeline" && <TimelineView fa={fa} />}
      {sel && <ActionDetailPanel action={sel} onClose={() => setSel(null)} onUpdate={(id, patch) => { upAction(id, patch); setSel(p => p ? { ...p, ...normalizeActionPatch(patch) } : p); }} user={user} users={users} allUsers={users} plants={plants} machines={machines} />}
      {emailModal && (
        <div className="overlay" onClick={() => setEmailModal(null)}>
          <div className="modal" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: T.navy, margin: 0 }}>✉ Email Actions</h3>
              <button onClick={() => setEmailModal(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: T.text2 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <Lbl t="Responsible Person" />
                <select value={emailForm.responsible} onChange={e => setEmailForm(f => ({ ...f, responsible: e.target.value }))} style={{ width: "100%" }}>
                  <option value="">Select…</option>
                  {allResponsible.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Lbl t="Email Address" />
                <input type="email" value={emailForm.email} onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" style={{ width: "100%" }} />
              </div>
              <div>
                <Lbl t="Status Filter (optional)" />
                <select value={emailForm.status} onChange={e => setEmailForm(f => ({ ...f, status: e.target.value }))} style={{ width: "100%" }}>
                  <option value="">All statuses</option>
                  {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button
                disabled={!emailForm.responsible || !emailForm.email || emailSending}
                onClick={async () => {
                  setEmailSending(true);
                  try {
                    const body = { responsible: emailForm.responsible, email: emailForm.email };
                    if (emailForm.status) body.status = emailForm.status;
                    await apiPost("/api/actions/send-to-email", body);
                    setEmailModal(null);
                    setEmailForm({ responsible: "", email: "", status: "" });
                  } catch (e) {
                    alert("Failed to send email: " + e.message);
                  } finally {
                    setEmailSending(false);
                  }
                }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: (!emailForm.responsible || !emailForm.email || emailSending) ? T.border : T.navy, color: (!emailForm.responsible || !emailForm.email || emailSending) ? T.text2 : "#fff", fontWeight: 700, fontSize: 13, cursor: (!emailForm.responsible || !emailForm.email || emailSending) ? "not-allowed" : "pointer" }}
              >
                {emailSending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
