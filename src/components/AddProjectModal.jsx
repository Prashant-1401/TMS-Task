/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { Lbl } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { PRIORITY_LIST } from "../utils/constants.js";
import { scopedPlants, scopedUsers } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* Feature 3: Add Project Modal */
export function AddProjectModal({ plants, users, onSave, onClose, currentUser }) {
  useEscClose(onClose);
  const [f, setF] = useState({ name: "", plantId: "", owner: "", startDate: "", endDate: "", priority: "NORMAL", status: "NOT STARTED", objective: "", scope: "", budget: "", sponsor: "" });
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const valid = f.name && f.plantId && f.owner && f.startDate && f.endDate;
  const submit = () => { if (valid) onSave(f); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 540, padding: 28 }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); submit(); } }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: T.navy }}>Create New Project</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: T.text2 }}>×</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div><Lbl t="Project Name" req /><input value={f.name} onChange={e => up("name", e.target.value)} placeholder="e.g. Safety Drive Q3" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Plant" req /><select value={f.plantId} onChange={e => up("plantId", e.target.value)}><option value="">Select</option><option value="All">All</option>{scopedPlants(currentUser, plants).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><Lbl t="Priority" /><select value={f.priority} onChange={e => up("priority", e.target.value)}>{PRIORITY_LIST.map(p => <option key={p}>{p}</option>)}</select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Owner" req /><select value={f.owner} onChange={e => up("owner", e.target.value)}><option value="">Select</option>{scopedUsers(currentUser, users).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
            <div><Lbl t="Sponsor" /><select value={f.sponsor} onChange={e => up("sponsor", e.target.value)}><option value="">Select</option>{scopedUsers(currentUser, users).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><Lbl t="Start Date" req /><input type="date" value={f.startDate} onChange={e => up("startDate", e.target.value)} /></div>
            <div><Lbl t="End Date" req /><input type="date" value={f.endDate} onChange={e => up("endDate", e.target.value)} /></div>
          </div>
          <div><Lbl t="Budget" /><input value={f.budget} onChange={e => up("budget", e.target.value)} placeholder="INR 0,00,000" /></div>
          <div><Lbl t="Objective" /><textarea value={f.objective} onChange={e => up("objective", e.target.value)} style={{ height: 64, resize: "none" }} /></div>
          <div><Lbl t="Scope" /><textarea value={f.scope} onChange={e => up("scope", e.target.value)} style={{ height: 64, resize: "none" }} /></div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" onClick={submit} disabled={!valid}>Create Project</button>
        </div>
      </div>
    </div>
  );
}

/* Feature 4: Meeting Plan Side Panel */
