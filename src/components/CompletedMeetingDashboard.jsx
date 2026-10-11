/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { Avatar, Chip } from "../components/ui.jsx";
import { canAccessMeeting, ensureArray } from "../utils/data.js";
import { fmt } from "../utils/helpers.js";
import { isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ── COMPLETED MEETING DASHBOARD ── */
export function CompletedMeetingDashboard({ meetings, actions, users, user, plants: _plants }) {
  const _isAdmin = isUserAdmin(user);
  const [dashFilter, setDashFilter] = useState("all");
  const [dashSearch, setDashSearch] = useState("");

  // Flatten all completed sessions with their parent meeting data
  const allSessions = (meetings || []).flatMap(m =>
    (Array.isArray(m.completedSessions) ? m.completedSessions : []).map(s => ({
      ...m,
      sessionDate: s.date,
      sessionDur: s.duration || 0,
      sessionActionCount: s.actionCount || 0,
    }))
  ).filter(s => canAccessMeeting(user, s, null));

  // Enrich sessions with actual action counts from the actions table
  const enrichedSessions = allSessions.map(s => {
    const matchedActions = (actions || []).filter(a => {
      const matchType = s.id ? (a.srcId === s.id || (!a.srcId && a.src === s.type)) : a.src === s.type;
      const matchDate = s.sessionDate ? (a.dateOfAction === s.sessionDate || a.created === s.sessionDate) : true;
      return matchType && matchDate;
    });
    return { ...s, liveActionCount: matchedActions.length, matchedActions };
  });

  // Filter & search
  const filtered = enrichedSessions
    .filter(s => {
      if (dashSearch) {
        const q = dashSearch.toLowerCase();
        return (s.type || "").toLowerCase().includes(q) || (s.plant || "").toLowerCase().includes(q) || (s.facilitator || "").toLowerCase().includes(q);
      }
      if (dashFilter === "week") {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return s.sessionDate && new Date(s.sessionDate) >= weekAgo;
      }
      if (dashFilter === "month") {
        const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
        return s.sessionDate && new Date(s.sessionDate) >= monthAgo;
      }
      return true;
    })
    .sort((a, b) => (b.sessionDate || "").localeCompare(a.sessionDate || ""));

  // Summary stats
  const totalSessions = filtered.length;
  const totalMinutes = filtered.reduce((sum, s) => sum + (s.sessionDur || 0), 0);
  const totalActions = filtered.reduce((sum, s) => sum + (s.liveActionCount || s.sessionActionCount || 0), 0);
  const avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
  const uniquePlants = [...new Set(filtered.map(s => s.plant).filter(Boolean))];
  const uniqueFacilitators = [...new Set(filtered.map(s => s.facilitator).filter(Boolean))];

  // Per-meeting-type breakdown
  const typeBreakdown = {};
  filtered.forEach(s => {
    if (!typeBreakdown[s.type]) typeBreakdown[s.type] = { count: 0, totalMin: 0, totalActions: 0 };
    typeBreakdown[s.type].count++;
    typeBreakdown[s.type].totalMin += s.sessionDur || 0;
    typeBreakdown[s.type].totalActions += s.liveActionCount || s.sessionActionCount || 0;
  });

  if (allSessions.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16, color: T.navy, display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        ✅ Completed Meeting Dashboard
        <span style={{ background: T.green + "18", color: T.green, borderRadius: 10, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>{totalSessions} sessions</span>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Sessions", value: totalSessions, icon: "📊", color: T.navy },
          { label: "Total Duration", value: totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`, icon: "⏱", color: T.amber },
          { label: "Actions Generated", value: totalActions, icon: "⚡", color: T.green },
          { label: "Avg Duration", value: `${avgDuration}m`, icon: "📈", color: T.slate },
        ].map(k => (
          <div key={k.label} style={{ background: k.color + "08", border: `1.5px solid ${k.color}25`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22 }}>{k.icon}</div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10, color: T.text2, textTransform: "uppercase", letterSpacing: .4, marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "nowrap", overflowX: "auto" }}>
        <input value={dashSearch} onChange={e => setDashSearch(e.target.value)} placeholder="🔍 Search meetings…" style={{ width: 220, fontSize: 12, padding: "6px 12px", border: `1px solid ${T.border}`, borderRadius: 8, outline: "none" }} />
        {[
          { v: "all", l: "All Time" },
          { v: "week", l: "Last 7 Days" },
          { v: "month", l: "Last 30 Days" },
        ].map(o => (
          <button key={o.v} onClick={() => setDashFilter(o.v)} style={{ padding: "5px 14px", borderRadius: 8, border: `1.5px solid ${dashFilter === o.v ? T.navy : T.border}`, background: dashFilter === o.v ? T.navy : "transparent", color: dashFilter === o.v ? "#fff" : T.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{o.l}</button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 11, color: T.text2 }}>
          {uniquePlants.length} plant{uniquePlants.length !== 1 ? "s" : ""} · {uniqueFacilitators.length} facilitator{uniqueFacilitators.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Type Breakdown Cards */}
      {Object.keys(typeBreakdown).length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "nowrap", overflowX: "auto", marginBottom: 20 }}>
          {Object.entries(typeBreakdown).sort((a, b) => b[1].count - a[1].count).map(([type, data]) => (
            <div key={type} className="card" style={{ padding: "10px 16px", minWidth: 160, borderLeft: `4px solid ${T.navy}` }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: T.navy, marginBottom: 4 }}>{type}</div>
              <div style={{ fontSize: 11, color: T.text2 }}>{data.count} sessions · {data.totalMin}m · {data.totalActions} actions</div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Meeting</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Plant</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Facilitator</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Date</th>
                <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Duration</th>
                <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Actions</th>
                <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Attendees</th>
                <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 }}>Project</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const attendees = ensureArray(s.attendees || []);
                return (
                  <tr key={`${s.id}_${i}`} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? "#fff" : T.bg + "60" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: T.navy }}>{s.type}</td>
                    <td style={{ padding: "10px 14px" }}><Chip label={s.plant} color={T.navy} /></td>
                    <td style={{ padding: "10px 14px", color: T.text }}>{s.facilitator}</td>
                    <td style={{ padding: "10px 14px", color: T.text2 }}>{fmt(s.sessionDate)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{s.sessionDur}m</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ background: T.green + "18", color: T.green, borderRadius: 8, padding: "2px 10px", fontWeight: 700, fontSize: 11 }}>{s.liveActionCount || s.sessionActionCount || 0}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflowX: "auto" }}>
                        {attendees.slice(0, 3).map((name, j) => <Avatar key={j} name={name} size={18} users={users} />)}
                        {attendees.length > 3 && <span style={{ fontSize: 10, color: T.text2 }}>+{attendees.length - 3}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: T.amber, fontWeight: 600 }}>{s.project || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 30, textAlign: "center", color: T.text2, fontSize: 13 }}>No completed meetings match your filters.</div>
        )}
      </div>
    </div>
  );
}

/* ===================== WEEKLY MEETING ACCOUNTABILITY ===================== */
