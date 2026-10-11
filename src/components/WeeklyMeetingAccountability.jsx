/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { Avatar } from "../components/ui.jsx";
import { canAccessMeeting, ensureArray, normalizeActionPatch } from "../utils/data.js";
import { T } from "../utils/theme.js";

/* ===================== WEEKLY MEETING ACCOUNTABILITY ===================== */
export function WeeklyMeetingAccountability({ meetings, actions, users, user, plants, machines, selectedDay, onActionUpdate }) {
  const accessibleMeetings = (meetings || []).filter(m => canAccessMeeting(user, m, null));

  const sessions = accessibleMeetings
    .flatMap(m => (Array.isArray(m.completedSessions) ? m.completedSessions : [])
      .filter(s => selectedDay ? s.date === selectedDay : true)
      .map(s => ({ ...s, meeting: m }))
    );

  const getActionsFor = (session, meeting) => (actions || []).filter(a => {
    const matchMtg = meeting.id ? a.srcId === meeting.id : (!a.srcId && a.src === meeting.type);
    const matchDate = a.dateOfAction === session.date || a.created === session.date;
    return matchMtg && matchDate;
  });

  const [sessionPopup, setSessionPopup] = useState(null);
  const [actionDetail, setActionDetail] = useState(null);

  const thStyle = { padding: "10px 14px", fontWeight: 700, color: T.text2, fontSize: 10, textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap", textAlign: "left" };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: T.navy, display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        📊 Weekly Meeting Accountability
        {selectedDay && <span style={{ background: T.navy + "15", color: T.navy, borderRadius: 10, padding: "3px 12px", fontSize: 11, fontWeight: 700 }}>{selectedDay}</span>}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                <th style={thStyle}>Meeting ID</th>
                <th style={thStyle}>Meeting Name</th>
                <th style={thStyle}>Meeting Attendees</th>
                <th style={thStyle}>Actions Generated</th>
                <th style={thStyle}>Facilitator Name</th>
                <th style={thStyle}>Meeting Type</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "32px 20px", textAlign: "center", color: T.text2, fontSize: 12 }}>
                  {selectedDay ? `No meeting sessions found on ${selectedDay}.` : "Select a day from the Weekly Schedule above."}
                </td></tr>
              ) : sessions.map((s, i) => {
                const m = s.meeting;
                const mtgActions = getActionsFor(s, m);
                const attendees = ensureArray(s.attendees || []);
                return (
                  <tr key={m.id + s.date || `wma-${i}`}
                    onClick={() => setSessionPopup({ session: s, meeting: m, actions: mtgActions })}
                    style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? "#fff" : T.bg + "60", cursor: "pointer", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.navy + "08"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : T.bg + "60"}
                  >
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: T.text2 }}>{m.id || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: T.navy }}>{m.name || m.type}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 3, flexWrap: "nowrap", overflowX: "auto" }}>
                        {attendees.slice(0, 5).map((name, j) => <Avatar key={j} name={name} size={22} users={users} />)}
                        {attendees.length > 5 && <span style={{ fontSize: 10, color: T.text2, alignSelf: "center" }}>+{attendees.length - 5}</span>}
                        {attendees.length === 0 && <span style={{ fontSize: 11, color: T.text2 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: T.green + "18", color: T.green, borderRadius: 8, padding: "2px 10px", fontWeight: 700, fontSize: 11 }}>{mtgActions.length}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 12 }}>{s.facilitator || m.facilitator || "—"}</td>
                    <td style={{ padding: "10px 14px", color: T.text2, fontSize: 11 }}>{m.type}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Session Actions Popup ── */}
      {sessionPopup && (
        <div className="overlay" onClick={() => setSessionPopup(null)}>
          <div className="card" style={{ width: 560, maxHeight: "80vh", overflowY: "auto", padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>{sessionPopup.meeting.name || sessionPopup.meeting.type}</div>
                <div style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>{sessionPopup.meeting.id} · {sessionPopup.session.date} · {sessionPopup.actions.length} action{sessionPopup.actions.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setSessionPopup(null)} style={{ background: T.navy, border: "none", cursor: "pointer", color: "#fff", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>
            {sessionPopup.actions.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: T.text2, fontSize: 13 }}>
                No actions were generated in this meeting session.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessionPopup.actions.map((a, idx) => (
                  <div key={a.id || idx}
                    onClick={() => { setActionDetail(a); setSessionPopup(null); }}
                    style={{ background: T.bg, borderRadius: 10, padding: "12px 16px", cursor: "pointer", border: `1px solid ${T.border}`, transition: "border-color .15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = T.navy}
                    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text2 }}>{a.sn || a.id}</span>
                          <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 4, background: a.status === "COMPLETED" ? T.green + "18" : a.status === "IN PROCESS" ? T.amber + "18" : a.status === "DROPPED" ? T.red + "18" : T.bg, color: a.status === "COMPLETED" ? T.green : a.status === "IN PROCESS" ? T.amber : a.status === "DROPPED" ? T.red : T.text2, fontWeight: 600 }}>{a.status}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: T.navy, marginBottom: 4 }}>{a.text}</div>
                        <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.text2 }}>
                          <span>👤 {a.responsible || "—"}</span>
                          <span>📅 {a.due || "—"}</span>
                          {a.priority && <span style={{ color: a.priority === "CRITICAL" ? T.red : a.priority === "HIGH" ? T.amber : T.text2 }}>⚡ {a.priority}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 16, color: T.text2, flexShrink: 0 }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Action Detail Panel ── */}
      {actionDetail && (
        <ActionDetailPanel
          action={actionDetail}
          onClose={() => setActionDetail(null)}
          onUpdate={(id, patch) => {
            const np = normalizeActionPatch(patch);
            setActionDetail(p => p ? { ...p, ...np } : p);
            if (onActionUpdate) onActionUpdate(id, np);
          }}
          user={user}
          users={users}
          allUsers={users}
          plants={plants}
          machines={machines || []}
          meetings={meetings}
        />
      )}
    </div>
  );
}

/* ADD MEETING MODAL */
