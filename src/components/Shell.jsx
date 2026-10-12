/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState } from "react";
import { _autosaveState, subscribeAutosave } from "../api/autosave.js";
import { NAV } from "../utils/constants.js";
import { canAccessMasterSetup, getPerms, isGuestRole, isUserAdmin } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

export function Shell({ children, page, setPage, user, onLogout, onQuickAdd, _pendingCount,_auditCountt, activeMtg, onResumeActiveMtg, mtgRunning, mtgElapsed, notifications, onMarkAllRead, unreadCount, _users,_actionss, onShowSupport, onShowProfile, onShowAdminNotifs, onShowSessions, onlineCount, _lastSync,_syncingg }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setAutoStatus] = useState(_autosaveState);
  useEffect(() => subscribeAutosave(setAutoStatus), []);
  const isAdmin = isUserAdmin(user);
  const userPerms = getPerms(user);
  const canAccessPage = (id) => {
    if (id === 99) return isAdmin;
    return true;
  };
  const hms = s => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const navigatePage = (id) => { if (canAccessPage(id)) { setPage(id); setMobileMenuOpen(false); } };

  // Auto-close mobile menu on orientation change (handles landscape ↔ portrait rotation)
  useEffect(() => {
    const onOrientationChange = () => { setMobileMenuOpen(false); };
    const onResize = () => {
      // On desktop (width > 768px and landscape height > 500px), close mobile menu
      if (window.innerWidth > 768 && window.innerHeight > 500) setMobileMenuOpen(false);
    };
    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      {mobileMenuOpen && <div className="mbl-overlay show" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`app-sidebar${mobileMenuOpen ? " open" : ""}`} style={{ width: 228, background: T.navy, color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "8px 10px", display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <img src="/logo.svg" alt="Adroit × Signet" style={{ display: "block", width: "100%", maxWidth: 150, height: "auto" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 11, lineHeight: 1.1 }}>Task Management System</div>
            <div style={{ fontSize: 9, color: T.amber, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2, fontWeight: 700 }}>Tasks</div>
          </div>
        </div>
        <nav style={{ padding: "14px 10px", flex: 1 }}>
          {NAV.map(n => {
            const active = page === n.id;
            const allowed = canAccessPage(n.id);
            return (
              <button key={n.id} onClick={() => navigatePage(n.id)} title={!allowed ? "Access not granted" : ""} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", cursor: allowed ? "pointer" : "not-allowed", marginBottom: 3, textAlign: "left", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: active ? 600 : 400, background: active ? "rgba(255,255,255,.15)" : "transparent", color: active ? "#fff" : allowed ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.3)", transition: "all .2s", position: "relative" }}>
                <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0, opacity: allowed ? 1 : 0.4 }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {!allowed && <span style={{ fontSize: 10, opacity: 0.5 }}>🔒</span>}
                {active && <span style={{ width: 3, height: 20, borderRadius: 2, background: T.amber, position: "absolute", right: 8 }} />}
              </button>
            );
          })}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
          {/* Notification Bell — fixed in sidebar, no overlap with content area */}
          <div style={{ padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,.08)", position: "relative" }}>
            <button onClick={() => { setShowNotifPanel(p => !p); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: showNotifPanel ? "rgba(255,255,255,.12)" : "transparent", cursor: "pointer", borderRadius: 8, padding: "6px 8px", color: "rgba(255,255,255,.75)", fontSize: 12, fontFamily: "'Inter',sans-serif", position: "relative" }}>
              <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>🔔</span>
              <span style={{ flex: 1, textAlign: "left", fontWeight: 500 }}>Notifications</span>
              {unreadCount > 0 && <span style={{ background: T.red, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{unreadCount}</span>}
            </button>
            {showNotifPanel && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 180 }} onClick={() => setShowNotifPanel(false)} />
                <div style={{ position: "absolute", bottom: "100%", left: 10, right: 10, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.2)", padding: 0, zIndex: 190, maxHeight: 380, overflowY: "auto", animation: "slideUp .2s ease" }}>
                  <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderRadius: "12px 12px 0 0" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>🔔 Notifications</div>
                    {(notifications || []).length > 0 && <button onClick={e => { e.stopPropagation(); onMarkAllRead && onMarkAllRead(); }} style={{ fontSize: 10, color: T.text2, border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}>Mark all read</button>}
                  </div>
                  {(notifications || []).length === 0
                    ? <div style={{ padding: "24px 14px", textAlign: "center", color: T.text2, fontSize: 12 }}>No notifications</div>
                    : (notifications || []).slice(0, 20).map(n => (
                      <div key={n.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: n.read ? "transparent" : "#F0F0FF", display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{n.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 12, color: T.text, marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.4, wordBreak: "break-word" }}>{n.body}</div>
                        </div>
                        {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.navy, flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    ))
                  }
                </div>
              </>
            )}
          </div>
          {canAccessMasterSetup(user) && (
            <button onClick={() => navigatePage(99)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 18px", border: "none", cursor: "pointer", background: page === 99 ? "rgba(255,255,255,.1)" : "transparent", color: "rgba(255,255,255,.45)", fontSize: 12, fontFamily: "'Inter',sans-serif", transition: "all .2s" }}>
              <span style={{ fontSize: 14 }}>⚙</span><span>Master Setup</span>
            </button>
          )}

          <div style={{ padding: "12px 18px", position: "relative" }}>
            <button onClick={() => setShowUserMenu(p => !p)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: user?.color || T.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, color: "#fff" }}>{user?.initials || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
                <div style={{ fontSize: 10, opacity: .5, color: "#fff" }}>{user?.role} · {user?.plant === "All" ? "All Plants" : user?.plant}</div>
              </div>
              <span style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>▲</span>
            </button>
            {showUserMenu && (
              <div style={{ position: "absolute", bottom: "100%", left: 10, right: 10, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.15)", padding: 8, zIndex: 200 }}>
                <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: T.text2 }}>{user?.role} — {user?.plant}</div>
                </div>
                {!isGuestRole(user?.role) && <button onClick={() => { setShowUserMenu(false); onShowProfile && onShowProfile(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: T.text, fontSize: 13, fontWeight: 600, borderRadius: 8 }}>👤 My Profile</button>}
                {!isGuestRole(user?.role) && <button onClick={() => { setShowUserMenu(false); onShowSessions && onShowSessions(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: T.text, fontSize: 13, fontWeight: 600, borderRadius: 8 }}>🖥️ My Sessions{onlineCount ? <span style={{ marginLeft: "auto", background: T.green, color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 8px" }}>{onlineCount}</span> : null}</button>}
                {!isGuestRole(user?.role) && user?.role !== "Admin" && Number(page) !== 3 && Number(page) !== 4 && <button onClick={() => { setShowUserMenu(false); onShowSupport && onShowSupport(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: T.navy, fontSize: 13, fontWeight: 600, borderRadius: 8 }}>💬 Get Support</button>}
                {isAdmin && Number(page) !== 3 && Number(page) !== 4 && <button onClick={() => { setShowUserMenu(false); onShowAdminNotifs && onShowAdminNotifs(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: T.amber, fontSize: 13, fontWeight: 600, borderRadius: 8 }}>🔔 Notification Rules</button>}
                <button onClick={() => { setShowUserMenu(false); onLogout(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", color: T.red, fontSize: 13, fontWeight: 600, borderRadius: 8 }}>🚪 Sign Out</button>
              </div>
            )}
          </div>

        </div>
      </aside>
      <main style={{ flex: 1, overflow: "hidden", minWidth: 0, position: "relative", display: "flex", flexDirection: "column", height: "100vh" }} className="app-main">

        {/* Mobile top bar */}
        <div style={{ display: "none", padding: "10px 16px", background: T.navy, color: "#fff", alignItems: "center", gap: 12 }} className="mbl-topbar">
          <button className="mbl-menu-btn" onClick={() => setMobileMenuOpen(p => !p)} style={{ display: "flex" }}>☰</button>
          <div style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: "#fff" }}>TMS Tasks</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {userPerms.canEditActions && <button className="fab" style={{ position: "static", width: 36, height: 36, fontSize: 20 }} onClick={onQuickAdd} title="Quick add action">+</button>}
          </div>
        </div>
        <style>{`.mbl-topbar{display:none!important;}@media(max-width:768px){.mbl-topbar{display:flex!important;}.fab:not(.mbl-topbar .fab){display:none!important;}}@media(max-height:500px) and (orientation:landscape){.mbl-topbar{display:flex!important;}.fab:not(.mbl-topbar .fab){display:none!important;}}`}</style>

        {/* Floating "Meeting Running" pill when away from Work page */}
        {activeMtg && page !== 1 && (
          <div onClick={onResumeActiveMtg} style={{ position: "sticky", top: 0, zIndex: 400, background: `linear-gradient(90deg,${T.red},#C0392B)`, color: "#fff", padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,.2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", animation: mtgRunning ? "blink 1s infinite" : "none", flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Meeting in progress: {activeMtg.type}</span>
            {mtgRunning && <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, background: "rgba(0,0,0,.2)", padding: "2px 8px", borderRadius: 5 }}>{hms(mtgElapsed || 0)}</span>}
            <span style={{ marginLeft: "auto", background: "rgba(255,255,255,.2)", borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>↩ Return to Meeting</span>
          </div>
        )}

        <div className="app-content" style={{ padding: 28, paddingTop: 20, flex: 1, overflowY: "auto", minHeight: 0 }}>{children}</div>
      </main>
      {userPerms.canEditActions && <button className="fab" onClick={onQuickAdd} title="Quick add action">+</button>}
    </div>
  );
}

/* ===================== HOME PAGE ===================== */
/* ActionSidePanel — slide-in detail panel used across HomePage */
