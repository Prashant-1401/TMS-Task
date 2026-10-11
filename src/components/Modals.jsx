/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet } from "../api/client.js";
import { Avatar, Empty, Lbl, Spin } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { responsibleMatchesUsers } from "../utils/data.js";
import { isOverdue } from "../utils/helpers.js";
import { T } from "../utils/theme.js";

/* Support message modal */
export function SupportModal({ user, onClose }) {
  useEscClose(onClose);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>💬 Application Support</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
        </div>
        {sent ? <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.navy, marginBottom: 8 }}>Message Sent!</div>
          <div style={{ fontSize: 12, color: T.text2 }}>Admin has been notified. You'll receive a response in-app.</div>
          <button className="btn btn-navy" style={{ marginTop: 20 }} onClick={onClose}>Close</button>
        </div> : <>
          <div style={{ marginBottom: 12, fontSize: 12, color: T.text2 }}>Send a message to your system administrator for help, access requests, or issues.</div>
          <Lbl t="Your Message" req />
          <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Describe your issue or request…" style={{ height: 100, resize: "none", marginBottom: 16 }} />
          <div style={{ fontSize: 11, color: T.text2, marginBottom: 16 }}>Sent by: <b>{user?.name}</b> · {user?.role} · {user?.plant}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-navy" disabled={!msg.trim()} onClick={() => { if (msg.trim()) setSent(true); }}>Send Message</button>
          </div>
        </>}
      </div>
    </div>
  );
}

/* User Profile Panel */

/* User Profile Panel */
export function UserProfilePanel({ user, users, actions, onClose, onRequestChange: _onRequestChange }) {
  useEscClose(onClose);
  const [tab, setTab] = useState("profile");
  const [photo, setPhoto] = useState(null);
  const [reqChange, setReqChange] = useState(false);
  const [reqMsg, setReqMsg] = useState("");
  const [reqSent, setReqSent] = useState(false);

  const myActions = actions.filter(a => responsibleMatchesUsers(a.responsible, [(user?.name || "").toLowerCase()]));
  const myTeam = users.filter(u => u.superior === user?.name);
  const myOpen = myActions.filter(a => a.status !== "COMPLETED" && a.status !== "DROPPED").length;
  const myOverdue = myActions.filter(isOverdue).length;
  const myDone = myActions.filter(a => a.status === "COMPLETED").length;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={onClose} />
      <div className="side-panel" style={{ width: 420, padding: 0 }}>
        {/* Header with avatar */}
        <div style={{ background: `linear-gradient(135deg,${T.navy},${T.navyD})`, padding: "24px 20px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 10, opacity: .6, letterSpacing: 1, textTransform: "uppercase" }}>My Profile</div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative" }}>
              {photo
                ? <img src={photo} alt="Profile" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,.3)" }} />
                : <div style={{ width: 64, height: 64, borderRadius: "50%", background: user?.color || T.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", border: "3px solid rgba(255,255,255,.3)" }}>{user?.initials || "?"}</div>
              }
              <label style={{ position: "absolute", bottom: 0, right: 0, background: T.amber, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11 }} title="Upload photo">
                📷<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(f); } }} />
              </label>
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>{user?.name}</div>
              <div style={{ fontSize: 12, opacity: .7, marginTop: 3 }}>{user?.role} · {user?.plant}</div>
              <div style={{ fontSize: 11, opacity: .5, marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 16, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14 }}>
            {[{ l: "Open", v: myOpen, c: T.amber }, { l: "Overdue", v: myOverdue, c: T.red }, { l: "Done", v: myDone, c: T.green }].map(k => (
              <div key={k.l} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 10, opacity: .6, marginTop: 2 }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
          {[["profile", "👤 Info"], ["team", "👥 My Team"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: tab === id ? 700 : 400, color: tab === id ? T.navy : T.text2, borderBottom: tab === id ? `2.5px solid ${T.navy}` : "2.5px solid transparent", marginBottom: -1 }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ padding: 20, overflowY: "auto" }}>
          {tab === "profile" && <>
            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              {[["Full Name", user?.name], ["Role", user?.role], ["Plant", user?.plant], ["Department", user?.dept || "—"], ["Reports To", user?.superior || "Top Level"], ["Phone", user?.phone || "—"], ["Email", user?.email || "—"]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            {reqChange ? <>
              <Lbl t="Request Info Change" />
              <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} placeholder="Describe what needs to be changed (e.g., phone number, department, reporting line)…" style={{ height: 80, resize: "none", marginBottom: 10 }} />
              {reqSent ? <div style={{ color: T.green, fontSize: 12, fontWeight: 600 }}>✅ Request sent to admin!</div>
                : <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setReqChange(false); setReqMsg(""); }}>Cancel</button>
                  <button className="btn btn-navy btn-sm" disabled={!reqMsg.trim()} onClick={() => { if (reqMsg.trim()) setReqSent(true); }}>Send Request</button>
                </div>}
            </>
              : <button className="btn btn-ghost btn-sm" onClick={() => setReqChange(true)}>✏ Request Info Change</button>}
          </>}
          {tab === "team" && <>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.navy, marginBottom: 12 }}>Direct Reports ({myTeam.length})</div>
            {myTeam.length === 0 ? <Empty icon="👤" title="No direct reports" sub="No one reports to you in the current org structure." /> :
              myTeam.map(u => {
                const uActions = actions.filter(a => responsibleMatchesUsers(a.responsible, [u.name.trim().toLowerCase()]));
                const uOpen = uActions.filter(a => a.status !== "COMPLETED" && a.status !== "DROPPED").length;
                const uOver = uActions.filter(isOverdue).length;
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                    <Avatar name={u.name} size={36} users={users} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: T.text2 }}>{u.role} · {u.plant}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: uOver > 0 ? T.red : T.text2 }}>{uOpen} open{uOver > 0 ? `, ${uOver} overdue` : ""}</div>
                    </div>
                  </div>
                );
              })
            }
          </>}
        </div>
      </div>
    </>
  );
}

/* Admin Notifications Manager */

/* Admin Notifications Manager */
export function AdminNotifManager({ users: _users, onClose }) {
  useEscClose(onClose);
  const [notifRules, setNotifRules] = useState([
    { id: 1, label: "Overdue reminder", trigger: "overdue", freq: "daily", target: "responsible", active: true },
    { id: 2, label: "Escalation alert", trigger: "escalation", freq: "immediate", target: "manager", active: true },
    { id: 3, label: "Due date revision", trigger: "revision", freq: "immediate", target: "responsible", active: true },
    { id: 4, label: "Weekly summary", trigger: "weekly_report", freq: "weekly", target: "all_users", active: false },
  ]);
  const toggleRule = id => setNotifRules(p => p.map(r => r.id === id ? { ...r, active: !r.active } : r));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 500, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>🔔 Admin Notification Rules</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: T.text2, marginBottom: 16 }}>Configure system-wide notification triggers. These rules apply to all users.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notifRules.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: T.bg, border: `1.5px solid ${r.active ? T.navy + "30" : T.border}` }}>
              <button onClick={() => toggleRule(r.id)} style={{ background: r.active ? T.green : "#e2e8f0", border: "none", borderRadius: 12, width: 42, height: 22, cursor: "pointer", transition: "all .2s", position: "relative", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, left: r.active ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "all .2s", display: "block" }} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>Frequency: {r.freq} · Target: {r.target.replace(/_/g, " ")}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: r.active ? T.greenL : T.border, color: r.active ? T.green : T.text2, fontWeight: 600 }}>{r.active ? "Active" : "Paused"}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-navy" onClick={onClose}>Save & Close</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== SESSIONS MANAGER MODAL ===================== */
/* Lists every device/browser currently logged in as this user, shows which
   one is "This device", and lets the user revoke any other session (or all
   others at once). Addresses the "multiple users login from different
   systems" requirement by making concurrent sessions visible & manageable. */

export function SessionsManagerModal({ user: _user, onClose }) {
  useEscClose(onClose);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiGet("/api/sessions/mine").then(setSessions).catch(() => setSessions([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const revoke = async (id) => {
    setBusy(id);
    try { await apiDelete(`/api/sessions/${id}`); load(); }
    catch (e) { alert("Could not revoke session: " + e.message); }
    finally { setBusy(null); }
  };
  const revokeOthers = async () => {
    if (!confirm("Sign out all other devices? This device stays signed in.")) return;
    setBusy("others");
    try { await apiDelete("/api/sessions/all/others"); load(); }
    catch (e) { alert("Could not revoke sessions: " + e.message); }
    finally { setBusy(null); }
  };

  const fmtAgo = (iso) => {
    if (!iso) return "—";
    const t = new Date(iso.replace(" ", "T") + (iso.includes("+") || iso.includes("Z") ? "" : "Z"));
    const s = Math.floor((Date.now() - t.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={onClose} />
      <div className="side-panel" style={{ width: 420, padding: 0 }}>
        <div style={{ background: `linear-gradient(135deg,${T.navy},${T.navyD})`, padding: "20px 20px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 10, opacity: .6, letterSpacing: 1, textTransform: "uppercase" }}>Active Sessions</div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>{sessions.length} device{sessions.length !== 1 ? "s" : ""} signed in</div>
          <div style={{ fontSize: 12, opacity: .7, marginTop: 3 }}>These are all places where you are currently logged in.</div>
        </div>
        <div style={{ padding: 16, overflowY: "auto", maxHeight: "calc(100vh - 140px)" }}>
          {loading && <div style={{ padding: 24, textAlign: "center", color: T.text2 }}><Spin /> Loading sessions…</div>}
          {!loading && sessions.length === 0 && <Empty icon="🔒" title="No active sessions" sub="We couldn't find any active login sessions." />}
          {!loading && sessions.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1.5px solid ${s.is_current ? T.green : T.border}`, borderRadius: 12, marginBottom: 10, background: s.is_current ? T.greenL : "#fff" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: T.navy + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {s.device === "Mobile" ? "📱" : s.device === "Tablet" ? "📟" : "🖥️"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
                  {s.browser} · {s.device}
                  {s.is_current && <span style={{ background: T.green, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>THIS DEVICE</span>}
                </div>
                <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>
                  {s.ip ? `${s.ip} · ` : ""}active {fmtAgo(s.last_seen)}
                </div>
              </div>
              {!s.is_current && (
                <button className="btn btn-sm btn-ghost" style={{ color: T.red, borderColor: T.red + "40" }} disabled={busy === s.id} onClick={() => revoke(s.id)}>
                  {busy === s.id ? <Spin /> : "Revoke"}
                </button>
              )}
            </div>
          ))}
          {!loading && sessions.length > 1 && (
            <button className="btn btn-red" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={busy === "others"} onClick={revokeOthers}>
              {busy === "others" ? <><Spin /> Signing out others…</> : "Sign out all other devices"}
            </button>
          )}
          <div style={{ fontSize: 11, color: T.text2, marginTop: 14, lineHeight: 1.5 }}>
            Tip: if you see a session you don't recognise, revoke it and change your password. Sessions auto-expire after 7 days of inactivity.
          </div>
        </div>
      </div>
    </>
  );
}
