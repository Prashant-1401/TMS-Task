/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { API_BASE_URL, getAuthToken } from "../api/client.js";
import { Chip, Empty, Lbl, MultiUserSelect, Spin } from "../components/ui.jsx";
import { PRIORITY_LIST, SECTIONS } from "../utils/constants.js";
import { todayStr } from "../utils/helpers.js";
import { isUserAdmin, scopedDepts, scopedPlants } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* STAGING AREA */
export function StagingArea({ staged, mtg, plants, depts, users, txLines, onCommit, _onCloseMeeting, onBack, elapsedSecs, currentUser }) {
  const [draft, setDraft] = useState(() => staged.map((r, i) => ({ ...r, stageSN: "STG-" + String(i + 1).padStart(3, "0"), status: "IN PROCESS", priority: r.priority || "NORMAL", section: r.section || "General", plant: r.plant || mtg.plant })));
  const [analyzingSmart, setAnalyzingSmart] = useState(false);
  const [smartResult, setSmartResult] = useState(null);
  const [committing, setCommitting] = useState(false);

  const up = (id, k, v) => setDraft(d => d.map(r => r.id === id ? { ...r, [k]: v } : r));
  const del = id => setDraft(d => d.filter(r => r.id !== id));
  // "valid" = has text + responsible + due — shown as ready
  const valid = draft.filter(r => r.text?.trim() && r.responsible && r.due);
  // All actions with text get committed; missing responsible/due become UNASSIGNED
  const commitAll = () => {
    if (committing) return;
    setCommitting(true);
    const all = draft.filter(r => r.text?.trim()).map((r, i) => {
      const isComplete = !!(r.responsible && r.due);
      return {
        ...r, id: String(Date.now() + i), dateOfAction: todayStr(), revisions: 0, revisionHistory: [], created: todayStr(), closedOn: null, pendingConfirmation: false,
        responsible: r.responsible || null,
        due: r.due || null,
        status: isComplete ? "IN PROCESS" : "NOT STARTED",
        allocatedBy: r.allocatedBy || null
      };
    });
    onCommit(all);
  };
  const exportTranscript = () => {
    if (!txLines || txLines.length === 0) return;
    const text = txLines.map((l, i) => `${i + 1}. ${l}`).join("\n\n");
    const blob = new Blob([`Meeting: ${mtg.type}\nLocation: ${mtg.plant}\nDate: ${new Date().toLocaleDateString()}\n\n--- TRANSCRIPT ---\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transcript_${mtg.type.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const hms = s => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const runSmartSync = async () => {
    if (!txLines || txLines.length === 0) return;
    if (!API_BASE_URL) return;
    setAnalyzingSmart(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/meetings/extract-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token") || ""}` },
        body: JSON.stringify({
          transcript: txLines.join("\n"),
          meeting_type: mtg.type,
          plant: mtg.plant,
          previous_actions: []
        })
      });
      const data = await res.json();
      if (data.actions) {
        setSmartResult(data);
      }
    } catch (e) { console.error("Smart Sync failed", e); }
    setAnalyzingSmart(false);
  };

  const applySmartActions = () => {
    if (!smartResult) return;
    const next = smartResult.actions.map((a, i) => ({
      ...a,
      id: Date.now() + i,
      stageSN: "SMART-" + String(i + 1).padStart(3, "0"),
      status: "IN PROCESS",
      fromTranscript: true,
      fromSmart: true
    }));
    setDraft(next);
  };
  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "nowrap", overflowX: "auto" }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back to Meeting</button>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.navy }}>Review & Commit Actions</h1>
          <div style={{ fontSize: 12, color: T.text2 }}>{mtg.type} · Duration: {hms(elapsedSecs || 0)} · <b style={{ color: T.green }}>{valid.length} ready</b> · {draft.length - valid.length} incomplete (will be saved as Unassigned)</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-navy" onClick={runSmartSync} disabled={analyzingSmart || !txLines?.length}>
            {analyzingSmart ? <Spin /> : "🧠 Smart Sync (Deduplicate)"}
          </button>
          <button className="btn btn-ghost" onClick={exportTranscript} disabled={!txLines || txLines.length === 0} style={{ border: `1px solid ${T.border}` }}>
            📥 Export Transcript
          </button>
          <button className="btn btn-green" onClick={commitAll} disabled={committing || draft.filter(r => r.text?.trim()).length === 0}>
            {committing ? <><Spin /> Committing…</> : <>✓ Commit {draft.filter(r => r.text?.trim()).length} Action{draft.filter(r => r.text?.trim()).length !== 1 ? "s" : ""}</>}
          </button>
        </div>
      </div>
      {/* Info banner about unassigned */}
      {draft.length > valid.length && draft.filter(r => r.text?.trim()).length > 0 && (
        <div style={{ background: "#FFF8E1", border: `1px solid ${T.amber}30`, borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "#7A5A00" }}>
          ⚠ <b>{draft.filter(r => r.text?.trim() && (!r.responsible || !r.due)).length}</b> action(s) missing responsible / due date will be committed with status <b>UNASSIGNED</b> in the action tracker.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 20, height: "fit-content" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: T.navy, marginBottom: 10 }}>📝 Discussed Points</div>

          {smartResult && (
            <div style={{ marginBottom: 16, padding: 12, background: T.bg, borderRadius: 10, border: `1px solid ${T.navy}30` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.navy, textTransform: "uppercase", marginBottom: 8 }}>📌 Key Topics (AI)</div>
              {smartResult.topics?.map((t, idx) => (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{t.topic}</div>
                  <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.4 }}>{t.summary}</div>
                </div>
              ))}
              <button className="btn btn-navy btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={applySmartActions}>
                Apply AI Deduplication
              </button>
            </div>
          )}

          <div style={{ fontSize: 12, lineHeight: 1.9, color: "#555" }}>
            {txLines.map((l, i) => <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8 }}><span style={{ color: T.text2, fontSize: 10, flexShrink: 0, marginTop: 2 }}>{i + 1}.</span><span style={{ color: l.toLowerCase().includes("action") ? T.navy : T.text }}>{l}</span></div>)}
            {txLines.length === 0 && <span style={{ color: "#B2BEC3" }}>No transcript available.</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {draft.length === 0 && <div className="card" style={{ padding: 24 }}><Empty icon="📭" title="No actions to stage" sub="Go back and log actions during the meeting." /></div>}
          {draft.map(r => {
            const incomplete = !r.responsible || !r.due;
            return (
              <div key={r.id} className="card" style={{ padding: 18, borderLeft: `4px solid ${r.fromTranscript ? T.amber : incomplete ? T.slate : T.navy}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.text2 }}>{r.stageSN}</span>
                    {r.fromTranscript && <Chip label="From Transcript" color={T.amber} />}
                    {incomplete && <Chip label="Will be Unassigned" color={T.slate} />}
                  </div>
                  <button onClick={() => del(r.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.text2, fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ marginBottom: 10 }}><Lbl t="Action Point" req /><textarea value={r.text || ""} onChange={e => up(r.id, "text", e.target.value)} style={{ resize: "none", height: 52, fontSize: 12 }} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div><Lbl t="Responsible" /><MultiUserSelect value={r.responsible || ""} users={users.filter(u => { if (r.plant && r.plant !== "All") return !u.plant || u.plant === "All" || u.plant === r.plant; if (!isUserAdmin(currentUser) && currentUser?.plant && currentUser.plant !== "All") return !u.plant || u.plant === "All" || u.plant === currentUser.plant; return true; })} onChange={v => { up(r.id, "responsible", v); const firstName = (v || "").split(",").map(s => s.trim()).filter(Boolean)[0]; if (firstName) { const u = users.find(x => x.name === firstName); if (u) { setDraft(d => d.map(a => a.id === r.id ? { ...a, plant: u.plant || a.plant, section: u.dept || a.section } : a)); } } }} placeholder="Leave Unassigned" /></div>
                  <div><Lbl t="Due Date" /><input type="date" value={r.due || ""} onChange={e => up(r.id, "due", e.target.value)} style={{ borderColor: !r.due ? T.amber : T.border }} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                   <div><Lbl t="Department" /><select value={r.section || "General"} onChange={e => up(r.id, "section", e.target.value)}><option value="General">General</option>{scopedDepts(currentUser, depts).filter(d => !r.plant || r.plant === "All" || !d.plant || d.plant === "All Plants" || d.plant === r.plant).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}{SECTIONS.filter(s => s !== "General" && !scopedDepts(currentUser, depts).filter(d => !r.plant || r.plant === "All" || !d.plant || d.plant === "All Plants" || d.plant === r.plant).find(d => d.name === s)).map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><Lbl t="Priority" /><select value={r.priority} onChange={e => up(r.id, "priority", e.target.value)}>{PRIORITY_LIST.map(p => <option key={p}>{p}</option>)}</select></div>
                   <div><Lbl t="Plant" /><select value={r.plant || ""} onChange={e => setDraft(d => d.map(a => a.id === r.id ? { ...a, plant: e.target.value, section: "General" } : a))}>{scopedPlants(currentUser, plants).map(p => <option key={p.id}>{p.name}</option>)}</select></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================== ACTION DETAIL SIDE PANEL ===================== */
/* Completion workflow: assignee marks done → goes to allocatedBy + their superior for confirmation */
