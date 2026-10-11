/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { apiUpdate } from "../api/autosave.js";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { Avatar, Empty, KPICard, PageHeader } from "../components/ui.jsx";
import { normalizeActionPatch, resolveRecordIds, responsibleMatchesUsers } from "../utils/data.js";
import { getEscBadgeStyle, resolveEscalationState } from "../utils/escalation.js";
import { fmt } from "../utils/helpers.js";
import { isUserAdmin, scopedDepts, scopedPlants } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ===================== ESCALATIONS PAGE ===================== */
export function EscalationsPage({ actions, setActions, audit, users, escMatrix, plants, depts, user, fetchData, machines = [], projects = [], meetings = [] }) {
  const [activeTab, setActiveTab] = useState("active");
  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  // Only Admin / MD get to see the whole org's escalations (and the Total/Mine
  // toggle). Everyone else is locked to their own — matches Dashboard scoping.
  const isEscAdmin = isUserAdmin(user);
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  const userNameLower = (user?.name || "").toLowerCase();

  const getActionEscalationState = (action, matrix) => resolveEscalationState(action, matrix, users);

  const scopedActions = isEscAdmin ? actions : actions.filter(a => responsibleMatchesUsers(a.responsible, [userNameLower]) || (a.allocatedBy || "").trim().toLowerCase() === userNameLower);
  const scopedAudit = isEscAdmin ? audit : audit.filter(log => {
    const action = actions.find(a => a.sn === log.sn);
    return action && (responsibleMatchesUsers(action.responsible, [userNameLower]) || (action.allocatedBy || "").trim().toLowerCase() === userNameLower);
  });

  const activeEscalations = scopedActions.map(a => {
    const escState = getActionEscalationState(a, escMatrix);
    return escState ? { action: a, ...escState } : null;
  }).filter(Boolean);

  const effectiveShowOnlyMine = isEscAdmin ? showOnlyMine : true;

  const filteredActive = activeEscalations.filter(item => {
    const a = item.action;
    const matchesSearch = (a.sn || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.text || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.responsible || "").toLowerCase().includes(search.toLowerCase());
    const matchesPlant = !plantFilter || a.plant === plantFilter;
    const matchesDept = !deptFilter || a.dept === deptFilter;
    const matchesTier = !tierFilter || String(item.tier.level) === tierFilter;
    const matchesMine = !effectiveShowOnlyMine || responsibleMatchesUsers(a.responsible, [userNameLower]);
    return matchesSearch && matchesPlant && matchesDept && matchesTier && matchesMine;
  });

  const filteredHistory = scopedAudit.filter(log => {
    const matchesSearch = (log.sn || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.text || "").toLowerCase().includes(search.toLowerCase()) ||
      (log.reason || "").toLowerCase().includes(search.toLowerCase());
    const matchesTier = !tierFilter || String(log.level) === tierFilter;
    const action = actions.find(a => a.sn === log.sn);
    const matchesMine = !effectiveShowOnlyMine || (action && responsibleMatchesUsers(action.responsible, [userNameLower]));
    return matchesSearch && matchesTier && matchesMine;
  });

  const highestLevel = activeEscalations.length > 0
    ? Math.max(...activeEscalations.map(e => e.tier.level))
    : 0;

  return (
    <div className="fade-in" style={{ padding: "0 24px 24px", overflowY: "auto", flex: 1, height: "100%" }}>
      <PageHeader title="Escalation Control Center" sub="Monitor overdue actions, review escalation alerts, and resolve blockers." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 24 }}>
        <KPICard icon="🚨" value={activeEscalations.length} label="Active Escalations" sub="Actions currently unresolved beyond due dates" color={T.red} alert={activeEscalations.length > 0} />
        <KPICard icon="⚠️" value={highestLevel > 0 ? `Level ${highestLevel}` : "None"} label="Highest Active Level" sub={highestLevel > 0 ? "Requires management attention" : "No active escalations"} color={highestLevel > 0 ? T.amber : T.green} />
        <KPICard icon="📋" value={scopedAudit.length} label="Total Escalation Triggers" sub="Logged history of escalation events" color={T.slate} />
      </div>

      <div className="card filter-bar" style={{ padding: 16, marginBottom: 20, background: "#fff" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input type="text" placeholder="Search by SN, text, owner, reason..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "8px 12px" }} />
        </div>
        <div style={{ width: 150 }}>
          <select value={plantFilter} onChange={e => setPlantFilter(e.target.value)}>
            <option value="">All Plants</option>
            {scopedPlants(user, plants).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ width: 160 }}>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {scopedDepts(user, depts).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div style={{ width: 140 }}>
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="">All Levels</option>
            {[1, 2, 3, 4].map(l => <option key={l} value={String(l)}>Level {l}</option>)}
          </select>
        </div>
        {(search || plantFilter || deptFilter || tierFilter || (isEscAdmin && !showOnlyMine)) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setPlantFilter(""); setDeptFilter(""); setTierFilter(""); setShowOnlyMine(true); }} style={{ padding: "8px 12px" }}>Reset</button>
        )}
        {isEscAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "nowrap", overflowX: "auto" }}>
            <button onClick={() => setShowOnlyMine(false)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: !showOnlyMine ? T.navy : T.bg,
                color: !showOnlyMine ? "#fff" : T.text2,
                transition: "all .2s"
              }}>
              Total ({activeEscalations.length})
            </button>
            <button onClick={() => setShowOnlyMine(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: showOnlyMine ? T.navy : T.bg,
                color: showOnlyMine ? "#fff" : T.text2,
                transition: "all .2s"
              }}>
              My Escalations ({activeEscalations.filter(e => responsibleMatchesUsers(e.action.responsible, [userNameLower])).length})
            </button>
          </div>
        )}
      </div>

      <div style={{ borderBottom: `2px solid ${T.border}`, marginBottom: 20, display: "flex", gap: 0 }}>
        <button onClick={() => setActiveTab("active")} style={{ padding: "10px 18px", border: "none", cursor: "pointer", background: "transparent", fontSize: 13, fontWeight: activeTab === "active" ? 700 : 400, color: activeTab === "active" ? T.navy : T.text2, borderBottom: activeTab === "active" ? `3px solid ${T.navy}` : "3px solid transparent", transition: "all .2s" }}>
          🚨 Active Escalations ({filteredActive.length})
        </button>
        <button onClick={() => setActiveTab("history")} style={{ padding: "10px 18px", border: "none", cursor: "pointer", background: "transparent", fontSize: 13, fontWeight: activeTab === "history" ? 700 : 400, color: activeTab === "history" ? T.navy : T.text2, borderBottom: activeTab === "history" ? `3px solid ${T.navy}` : "3px solid transparent", transition: "all .2s" }}>
          📜 Alert Log History ({filteredHistory.length})
        </button>
      </div>

      {activeTab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredActive.map(item => {
            const a = item.action;
            const tColor = item.tier.color || T.red;
            return (
              <div key={a.id} className="card card-hover" onClick={() => setSelectedAction(a)} style={{ padding: "16px 20px", display: "flex", flexWrap: "nowrap", overflowX: "auto", justifyContent: "space-between", alignItems: "center", gap: 16, borderLeft: `5px solid ${tColor}` }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, background: T.bg, padding: "2px 6px", borderRadius: 4, color: T.text }}>{a.sn}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: tColor + "20", color: tColor }}>Level {item.tier.level} — {item.tier.label}</span>
                    <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>⚠️ {item.daysOverdue}d Overdue</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 8 }}>{a.text}</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "nowrap", overflowX: "auto", fontSize: 11, color: T.text2 }}>
                    <span>🏭 <b>Plant:</b> {a.plant}</span>
                    <span>🗂 <b>Dept:</b> {a.dept || "—"}</span>
                    {a.machine && <span>⚙ <b>Machine:</b> {a.machine}</span>}
                    <span>📅 <b>Due Date:</b> {fmt(a.due)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: T.text2, marginBottom: 2 }}>Responsible</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar name={a.responsible} size={24} users={users} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{a.responsible}</span>
                    </div>
                  </div>
                  <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 11, color: T.text2 }}>Escalation Path</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.navy }}>👤 {item.tier.targetUser || "—"}</div>
                    <div style={{ fontSize: 10, background: T.bg, padding: "2px 6px", borderRadius: 4, color: T.text2 }}>📢 {item.tier.notifyMethod}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredActive.length === 0 && (
            <Empty icon="☀️" title="All Clear" sub="No active escalations. All tasks are within their due thresholds." />
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="card" style={{ padding: "20px 24px", background: "#fff" }}>
          {filteredHistory.map((log, i) => (
            <div key={log.id} style={{ display: "flex", gap: 16, position: "relative", paddingBottom: i < filteredHistory.length - 1 ? 24 : 0 }}>
              {i < filteredHistory.length - 1 && (
                <div style={{ position: "absolute", left: 15, top: 32, bottom: 0, width: 2, background: T.border }} />
              )}
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: getEscBadgeStyle(log.level).bg, color: getEscBadgeStyle(log.level).color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, zIndex: 2, flexShrink: 0 }}>
                L{log.level}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "nowrap", overflowX: "auto", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>Escalation Alert for <span style={{ fontFamily: "monospace", color: T.navy }}>{log.sn}</span></span>
                  <span style={{ fontSize: 11, color: T.text2 }}>{new Date(log.ts).toLocaleString("en-IN")}</span>
                </div>
                <div style={{ fontSize: 13, color: T.text, marginBottom: 6, lineHeight: 1.4 }}>{log.text}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "nowrap", overflowX: "auto", fontSize: 11, color: T.text2 }}>
                  <span>📢 <b>Target Notified:</b> {log.target}</span>
                  <span>🔍 <b>Reason:</b> {log.reason}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredHistory.length === 0 && (
            <Empty icon="📋" title="Log Empty" sub="No escalation history logged yet." />
          )}
        </div>
      )}

      {selectedAction && (
        <ActionDetailPanel
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onUpdate={(id, patch) => {
            const np = normalizeActionPatch(patch);
            setActions(p => p.map(a => a.id === id ? { ...a, ...np } : a));
            setSelectedAction(p => p ? { ...p, ...np } : p);
            apiUpdate("actions", id, resolveRecordIds(np, plants, depts, machines, projects, meetings)).catch(err => {
              console.error("Action update failed:", err);
              if (fetchData) fetchData();
            });
          }}
          user={user}
          users={users}
          allUsers={users}
          plants={plants}
          machines={machines}
          meetings={meetings}
        />
      )}
    </div>
  );
}
