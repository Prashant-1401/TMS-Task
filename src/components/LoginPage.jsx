/* eslint-disable react-refresh/only-export-components */
import React, { useRef, useState } from "react";
import { apiGet, apiPost, setAuthToken } from "../api/client.js";
import { Lbl, Spin } from "../components/ui.jsx";
import { T } from "../utils/theme.js";

/* ===================== LOGIN PAGE ===================== */
export function LoginPage({ onLogin }) {
  const [u, setU] = useState(""), pw = useRef(null);
  const [errMsg, setErrMsg] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const tryLogin = async () => {
    setLoading(true); setErrMsg("");
    try {
      const res = await apiPost("/api/auth/login", { username: u.trim(), password: pw.current.value });
      const { token, user } = res;
      localStorage.setItem("mcs_token", token);
      setAuthToken(token);
      // Resolve plant/dept IDs to display names
      try {
        const plants = await apiGet("/api/plants/");
        const depts = await apiGet("/api/departments/");
        const pMap = {}; plants.forEach(p => { pMap[p.id] = p.name; });
        const dMap = {}; depts.forEach(d => { dMap[d.id] = d.name; });
        if (user.plant && pMap[user.plant]) user.plant = pMap[user.plant];
        if (user.dept && dMap[user.dept]) user.dept = dMap[user.dept];
      } catch (_e) { /* keep IDs as-is */ }
      onLogin(user);
    } catch (err) {
      // Try master login as fallback
      try {
        const res = await apiPost("/api/auth/master-login", { username: u.trim(), password: pw.current.value });
        const { token, user } = res;
        localStorage.setItem("mcs_token", token);
        setAuthToken(token);
        // Master login also returns plant as an ID — resolve to name for consistency
        try {
          const plants = await apiGet("/api/plants/");
          const pMap = {}; plants.forEach(p => { pMap[p.id] = p.name; });
          if (user.plant && pMap[user.plant]) user.plant = pMap[user.plant];
        } catch (_e) { /* keep as-is */ }
        onLogin(user);
      } catch (_masterErr) {
        setErrMsg(err.message || "Login failed");
      }
    }
    setLoading(false);
  };
  const loginAsGuest = async () => {
    setLoading(true); setErrMsg("");
    onLogin({ id: "GUEST", name: "Guest User", username: "guest", role: "Guest User", plant: "All", dept: "Management", initials: "GU", color: "#7F8C8D" });
    setLoading(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg,${T.navy} 0%,#3D378C 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="login-card" style={{ width: 420, background: "#fff", borderRadius: 20, padding: 36, boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 22, color: T.navy, letterSpacing: 1 }}>ADROIT</div>
              <div style={{ fontSize: 9, color: T.text2, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>Industries</div>
            </div>
            <div style={{ width: 1.5, height: 36, background: T.border, borderRadius: 2 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 22, color: T.amber, letterSpacing: 1 }}>SIGNET</div>
              <div style={{ fontSize: 9, color: T.text2, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>Industries</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 18, color: T.navy, lineHeight: 1.2 }}>Task Management System</div>
          <div style={{ fontSize: 11, color: T.text2, marginTop: 6 }}>Decentralized Work Management Platform</div>
        </div>
        <div style={{ marginBottom: 14 }}><Lbl t="Username" req /><input value={u} onChange={e => setU(e.target.value)} placeholder="Enter your username" onKeyDown={e => e.key === "Enter" && tryLogin()} /></div>
        <div style={{ marginBottom: 20 }}>
          <Lbl t="Password" req />
          <div style={{ position: "relative" }}>
            <input ref={pw} type={showPw ? "text" : "password"} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && tryLogin()} style={{ paddingRight: 44 }} />
            <button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: T.text2, lineHeight: 1, padding: 0, display: "flex", alignItems: "center" }}>{showPw ? "🙈" : "👁"}</button>
          </div>
        </div>
        {errMsg && <div style={{ background: T.redL, color: T.red, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14, fontWeight: 500 }}>{errMsg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-navy" style={{ width: "100%", justifyContent: "center", fontSize: 14, padding: "12px 0" }} onClick={tryLogin} disabled={loading}>
            {loading ? <><Spin /> Signing in…</> : "Sign In"}
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 14, padding: "12px 0", border: `1.5px solid ${T.border}`, color: T.navy }} onClick={loginAsGuest} disabled={loading}>
            🚪 Access as Guest User
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: T.text2 }}>Powered by Adroit × Signet</div>
      </div>
    </div>
  );
}

/* ===================== SHELL ===================== */
