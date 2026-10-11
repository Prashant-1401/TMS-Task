/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { apiUpdate } from "../api/autosave.js";
import { Avatar, Empty, KPICard } from "../components/ui.jsx";
import { resolveEscalationState } from "../utils/escalation.js";
import { todayStr } from "../utils/helpers.js";
import { scopedPlants } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

export function TeamPage({ users, actions, escMatrix, plants, _depts, user, isAdmin, setActions }) {
  const [search, setSearch] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [expanded, setExpanded] = useState(null);

  const escByUser = {};
  (actions || []).forEach(a => {
    const state = resolveEscalationState(a, escMatrix, users);
    if (!state) return;
    const names = (a.responsible || "").split(",").map(n => n.trim()).filter(Boolean);
    if (!names.length) {
      const key = "—Unassigned";
      if (!escByUser[key]) escByUser[key] = [];
      escByUser[key].push({ action: a, ...state });
      return;
    }
    names.forEach(name => {
      if (!escByUser[name]) escByUser[name] = [];
      escByUser[name].push({ action: a, ...state, fromUser: name });
    });
  });

  const canCloseEscalation = (member, escState) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (member?.superior && member.superior === user.name) return true;
    if (escState?.tier?.targetUser && escState.tier.targetUser === user.name) return true;
    return false;
  };

  const closeEscalatedAction = (actionId, status) => {
    setActions(p => p.map(a => a.id === actionId ? { ...a, status, closedOn: status === "COMPLETED" ? todayStr() : null, closedBy: user?.name || "", pendingConfirmation: false } : a));
    apiUpdate("actions", actionId, { status, closedOn: status === "COMPLETED" ? todayStr() : null, closedBy: user?.name || "", pendingConfirmation: false });
  };

  const filteredUsers = (users || [])
    .filter(u => !plantFilter || u.plant === plantFilter || u.plant === "All")
    .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || (u.role || "").toLowerCase().includes(search.toLowerCase()) || (u.dept || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (escByUser[b.name]?.length || 0) - (escByUser[a.name]?.length || 0) || a.name.localeCompare(b.name));

  const totalEscalated = Object.values(escByUser).reduce((sum, arr) => sum + arr.length, 0);
  const membersWithEsc = Object.keys(escByUser).filter(k => k !== "—Unassigned" && escByUser[k].length > 0).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        <KPICard icon="👥" value={(users || []).length} label="Team Members" sub="Registered across all plants" color={T.navy} />
        <KPICard icon="🚨" value={totalEscalated} label="Escalated Actions" sub="Currently overdue past a tier threshold" color={T.red} alert={totalEscalated > 0} />
        <KPICard icon="⚠️" value={membersWithEsc} label="Members With Escalations" sub="Team mates who need attention" color={T.amber} />
      </div>

      <div className="card filter-bar" style={{ padding: 12, marginBottom: 16, alignItems: "center" }}>
        <input type="text" placeholder="Search by name, role, dept…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, padding: "8px 12px" }} />
        <select value={plantFilter} onChange={e => setPlantFilter(e.target.value)} style={{ width: 170 }}>
          <option value="">All Plants</option>
          {scopedPlants(user, plants).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredUsers.map(m => {
          const mine = escByUser[m.name] || [];
          const isOpen = expanded === m.id;
          return (
            <div key={m.id} className="card" style={{ padding: 0, overflow: "hidden", border: mine.length > 0 ? `1.5px solid ${T.red}40` : "" }}>
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: mine.length > 0 ? "pointer" : "default" }} onClick={() => mine.length > 0 && setExpanded(isOpen ? null : m.id)}>
                <Avatar name={m.name} size={36} users={users} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>
                    {m.role} · {m.plant}{m.dept ? " · " + m.dept : ""}{m.superior ? " · Reports to " + m.superior : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: mine.length > 0 ? T.redL : T.bg, color: mine.length > 0 ? T.red : T.text2 }}>
                  {mine.length} escalated
                </span>
                {mine.length > 0 && <span style={{ fontSize: 12, color: T.text2 }}>{isOpen ? "▲" : "▼"}</span>}
              </div>
              {isOpen && mine.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}>
                  {mine.sort((a, b) => b.tier.level - a.tier.level).map(item => {
                    const a = item.action, canClose = canCloseEscalation(m, item);
                    return (
                      <div key={a.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", flexWrap: "nowrap", overflowX: "auto", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{a.sn}</span>
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: item.tier.color + "20", color: item.tier.color }}>Level {item.tier.level} → {item.tier.targetUser || "—"}</span>
                            <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>⚠️ {item.daysOverdue}d overdue</span>
                          </div>
                          <div style={{ fontSize: 12, color: T.text }}>{a.text}</div>
                        </div>
                        {canClose ? (
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button className="btn btn-green btn-sm" onClick={() => closeEscalatedAction(a.id, "COMPLETED")}>✓ Resolve</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: T.red }} onClick={() => closeEscalatedAction(a.id, "DROPPED")}>Drop</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: T.text2, fontStyle: "italic", flexShrink: 0 }}>Only {item.tier.targetUser || "the target user"}, {m.superior || "their superior"}, or Admin can close this</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredUsers.length === 0 && <Empty icon="👥" title="No team members" sub="Add users under the Users tab to see them here." />}
      </div>
    </div>
  );
}

/* ===================== ESCALATIONS PAGE ===================== */
