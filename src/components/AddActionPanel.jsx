/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { Lbl, MultiUserSelect, Spin } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { PRIORITY_LIST, SECTIONS } from "../utils/constants.js";
import { canAccessMeeting } from "../utils/data.js";
import { todayStr } from "../utils/helpers.js";
import { isUserAdmin, scopedDepts, scopedPlants } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ADD ACTION SIDE PANEL */
export function AddActionPanel({ users, plants, depts, defaultPlant, defaultSrc, defaultMeeting, defaultProject, projects, meetings, onSave, onClose, currentUser, machines, reasons: reasonsProp, saving }) {
  useEscClose(onClose);
  const panelRef = React.useRef(null);
  const todayDate = todayStr();
  const [f, setF] = useState({ text: "", responsible: "", due: todayDate, section: currentUser?.dept || "General", plant: defaultPlant || (currentUser?.plant && currentUser.plant !== "All" ? currentUser.plant : ""), src: defaultSrc || "", priority: "NORMAL", remarks: "", project: defaultProject || "", meeting: defaultMeeting || "", reasonOfAction: "", machineName: "", actionPointType: "" });
  const [pendingFiles, setPendingFiles] = useState([]);
  // Meetings that the current user can see (admin sees all, others only visible plants)
  const meetingOpts = (meetings || []).filter(m => canAccessMeeting(currentUser, m, null)).map(m => ({ id: m.id, label: `${m.type}${m.plant ? " · " + m.plant : ""}${m.project ? " · " + m.project : ""}` }));
  // Derive reason suggestions from the reasons state passed in (loaded at app boot)
  const _reasonSuggestions = (reasonsProp || []).map(r => r.reason || r.Reason || r.text || r.Text || Object.values(r)[0]).filter(Boolean);
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const machineOpts = (machines || []).filter(m => !f.plant || !m.plant || m.plant === f.plant).map(m => m.name).filter(Boolean);
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 340 }} onClick={onClose} />
      <div className="side-panel" ref={panelRef} style={{ width: 420, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>Log Action Point</h2>
          <button onClick={onClose} style={{ background: T.navy, border: "none", cursor: "pointer", fontSize: 16, color: "#fff", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><Lbl t="Action Point Type" req /><select value={f.actionPointType} onChange={e => up("actionPointType", e.target.value)}><option value="">Select type…</option>{["Corrective Action","Preventive Action","Improvement","Safety","Maintenance","Quality","Compliance","Other","Others"].map(t => <option key={t} value={t}>{t}</option>)}{f.actionPointType && !["Corrective Action","Preventive Action","Improvement","Safety","Maintenance","Quality","Compliance","Other","Others"].includes(f.actionPointType) && <option value={f.actionPointType}>{f.actionPointType}</option>}</select></div>
          <div><Lbl t="Action Point" req /><textarea value={f.text} onChange={e => up("text", e.target.value)} style={{ height: 72, resize: "none" }} placeholder="Describe the action…" /></div>
          {/* Attachments — uploaded on save */}
          <div>
            <Lbl t="Attachments" />
            {pendingFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, borderRadius: 8, padding: "7px 12px", border: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 14 }}>{pf.file.type?.includes("pdf") ? "📄" : pf.file.type?.includes("image") ? "🖼" : pf.file.type?.includes("sheet") || pf.file.type?.includes("excel") ? "📊" : pf.file.type?.includes("word") || pf.file.type?.includes("document") ? "📝" : "📁"}</span>
                    <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pf.file.name}</span>
                    <button onClick={() => setPendingFiles(p => p.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: T.text2, fontSize: 14, padding: 2 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1.5px dashed ${T.border}`, cursor: "pointer", fontSize: 12, color: T.text2, background: "#fff", transition: "border-color .15s, background .15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.navy; e.currentTarget.style.background = T.bg; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = "#fff"; }}
            >
              <span style={{ fontSize: 14 }}>+</span> Attach File
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx" style={{ display: "none" }} onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert("File size exceeds 5 MB limit."); return; }
                setPendingFiles(p => [...p, { file }]);
                e.target.value = "";
              }} />
            </label>
          </div>
          <div><Lbl t="Responsible Person(s)" req /><MultiUserSelect value={f.responsible} users={users.filter(u => { if (f.plant && f.plant !== "All") return !u.plant || u.plant === "All" || u.plant === f.plant; if (!isUserAdmin(currentUser) && currentUser?.plant && currentUser.plant !== "All") return !u.plant || u.plant === "All" || u.plant === currentUser.plant; return true; })} onChange={v => { up("responsible", v); const firstName = (v || "").split(",").map(s => s.trim()).filter(Boolean)[0]; if (firstName) { const u = users.find(x => x.name === firstName); if (u) { if (u.plant) up("plant", u.plant); if (u.dept) up("section", u.dept); } } }} /></div>
          <div><Lbl t="Due Date" req /><input type="date" value={f.due} onChange={e => up("due", e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Department" /><select value={f.section} onChange={e => up("section", e.target.value)}><option value="General">General</option>{scopedDepts(currentUser, depts).filter(d => !f.plant || f.plant === "All" || !d.plant || d.plant === "All Plants" || d.plant === f.plant).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}{SECTIONS.filter(s => s !== "General" && !scopedDepts(currentUser, depts).filter(d => !f.plant || f.plant === "All" || !d.plant || d.plant === "All Plants" || d.plant === f.plant).find(d => d.name === s)).map(s => <option key={s}>{s}</option>)}</select></div>
            <div><Lbl t="Plant" /><select value={f.plant} onChange={e => { up("plant", e.target.value); up("section", "General"); up("machineName", ""); }}>{scopedPlants(currentUser, plants).map(p => <option key={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Priority" /><select value={f.priority} onChange={e => up("priority", e.target.value)}>{PRIORITY_LIST.map(p => <option key={p}>{p}</option>)}</select></div>
            {projects && <div><Lbl t="Link to Project" /><select value={f.project} onChange={e => up("project", e.target.value)}><option value="">None</option>{projects.map(p => <option key={p.id}>{p.name}</option>)}</select></div>}
          </div>
          {(projects || meetings) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {meetings && <div><Lbl t="Link to Meeting" /><select value={f.meeting} onChange={e => {
                const mid = e.target.value;
                up("meeting", mid);
                const selMtg = (meetings || []).find(m => m.id === mid);
                if (selMtg && selMtg.project) {
                  const projMatch = (projects || []).find(p => p.name === selMtg.project);
                  up("project", projMatch ? projMatch.name : selMtg.project);
                }
              }}><option value="">None</option>{meetingOpts.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Machine Name" /><select value={f.machineName} onChange={e => up("machineName", e.target.value)}><option value="">Select machine…</option>{machineOpts.map(m => <option key={m} value={m}>{m}</option>)}{f.machineName && !machineOpts.includes(f.machineName) && <option value={f.machineName}>{f.machineName}</option>}</select></div>
            <div><Lbl t="Remarks" /><input value={f.remarks} onChange={e => up("remarks", e.target.value)} placeholder="Optional notes…" /></div>
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" style={{ flex: 2, justifyContent: "center" }} onClick={() => {
            if (!(f.text.trim() && f.responsible && f.due)) return;
            const linkedMtg = (meetings || []).find(m => m.id === f.meeting);
            const enriched = { ...f };
            if (linkedMtg) { enriched.srcId = linkedMtg.id; enriched.src = linkedMtg.type; }
            onSave(enriched, pendingFiles);
          }} disabled={saving}>
            {saving ? <><Spin /> Saving…</> : "Save Action"}
          </button>
        </div>
      </div>
    </>
  );
}

/* STAGING AREA */
