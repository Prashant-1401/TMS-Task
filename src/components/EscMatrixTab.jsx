/* eslint-disable react-refresh/only-export-components */
import React, { useState } from "react";
import { apiCreate, apiRemove, apiUpdate } from "../api/autosave.js";
import { apiPost } from "../api/client.js";
import { Lbl, SectionSaveButton } from "../components/ui.jsx";
import { DEFAULT_ESC_MATRIX } from "../utils/escalation.js";
import { T } from "../utils/theme.js";

/* ===================== ESCALATION MATRIX TAB ===================== */
export function EscMatrixTab({ escMatrix, setEscMatrix, onSave, isAdmin, canModify, users = [], _roles = [] }) {
  const PRIORITIES = ["CRITICAL", "WARNING", "NORMAL"];
  const USER_NAMES = (users || []).map(u => u.name).filter(Boolean);
  const METHODS = ["In-App", "In-App + Email", "Email Only", "SMS + Email"];
  const [editRow, setEditRow] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [userFilter, setUserFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [syncingMatrix, setSyncingMatrix] = useState(false);
  const [matrixSyncMsg, setMatrixSyncMsg] = useState("");
  const upDraft = (k, v) => setEditDraft(d => ({ ...d, [k]: v }));

  const checkCanModify = (rowId) => isAdmin || (canModify && canModify("escMatrix", rowId));

  const normPriorities = (p) => {
    if (Array.isArray(p)) return p;
    if (typeof p === "string" && p.trim()) return p.split(",").map(x => x.trim()).filter(Boolean);
    return ["CRITICAL", "WARNING", "NORMAL"];
  };
  const startEdit = (tier) => { setEditRow(tier.id); setEditDraft({ ...tier, priorities: normPriorities(tier.priorities) }); };
  const saveEdit = () => {
    const finalDraft = { ...editDraft };
    if (finalDraft.fromUser && finalDraft.targetUser && !finalDraft.label?.trim()) {
      finalDraft.label = `Level ${finalDraft.level} — ${finalDraft.fromUser} → ${finalDraft.targetUser}`;
    }
    setEscMatrix(m => m.map(t => t.id === editRow ? finalDraft : t));
    apiUpdate("escalation/matrix", editRow, finalDraft);
    setEditRow(null); setEditDraft(null);
  };
  const cancelEdit = () => { setEditRow(null); setEditDraft(null); };
  const addTier = () => {
    const matrix = escMatrix || DEFAULT_ESC_MATRIX;
    const maxLvl = Math.max(...matrix.map(t => t.level), 0);
    const newTier = {
      id: "E" + crypto.randomUUID().slice(0, 8),
      level: maxLvl + 1,
      fromUser: "",
      targetUser: "",
      label: "",
      overdueDays: maxLvl * 3 + 3,
      overdueHrs: (maxLvl * 3 + 3) * 24,
      notifyMethod: "In-App + Email",
      priorities: ["CRITICAL"],
      applicableTo: "All",
      color: T.slate,
      active: true,
      description: "",
    };
    setEscMatrix(m => [...m, newTier]);
    apiCreate("escalation/matrix", newTier);
    setEditRow(newTier.id); setEditDraft({ ...newTier, priorities: [...newTier.priorities] });
  };
  const deleteTier = (id) => { setEscMatrix(m => m.filter(t => t.id !== id)); apiRemove("escalation/matrix", id); };
  const toggleActive = (id) => setEscMatrix(m => {
    const t = m.find(x => x.id === id);
    const nextActive = !t?.active;
    apiUpdate("escalation/matrix", id, { active: nextActive });
    return m.map(x => x.id === id ? { ...x, active: nextActive } : x);
  });

  const allMatrix = (escMatrix || DEFAULT_ESC_MATRIX)
    .map(t => ({ ...t, priorities: normPriorities(t.priorities) }));

  const matrix = allMatrix
    .filter(t => !userFilter || (t.fromUser || "") === userFilter)
    .filter(t => !levelFilter || t.level === Number(levelFilter))
    .sort((a, b) => a.level - b.level || (a.fromUser || "").localeCompare(b.fromUser || ""));

  const usersInUse = [...new Set(allMatrix.filter(t => t.active).map(t => t.fromUser).filter(Boolean))].sort();
  const chainByUser = {};
  usersInUse.forEach(u => {
    chainByUser[u] = allMatrix
      .filter(t => t.active && t.fromUser === u)
      .sort((a, b) => a.level - b.level);
  });

  return (
    <div>
      <div className="card" style={{ padding: "18px 22px", marginBottom: 14, background: `linear-gradient(135deg,${T.navy},#3D378C)`, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🚨 User-Wise Escalation Matrix</div>
            <div style={{ fontSize: 12, opacity: .8 }}>When an action goes overdue, alerts are sent to the specific user configured in each tier.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
            {onSave && <SectionSaveButton onSave={onSave} />}
            <button
              onClick={async () => {
                setSyncingMatrix(true); setMatrixSyncMsg("");
                try { await apiPost("/api/escalation/sync-matrix-to-sheet", {}); setMatrixSyncMsg("Synced!"); }
                catch (_e) { setMatrixSyncMsg("Failed"); }
                setSyncingMatrix(false);
                setTimeout(() => setMatrixSyncMsg(""), 3000);
              }}
              disabled={syncingMatrix}
              style={{ background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, opacity: syncingMatrix ? 0.6 : 1 }}>
              {syncingMatrix ? "Syncing…" : matrixSyncMsg || "📊 Sync to Sheets"}
            </button>
            {(isAdmin || onSave) && <button onClick={addTier} style={{ background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add Tier</button>}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "16px 22px", marginBottom: 14, overflow: "hidden" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text2, marginBottom: 12, textTransform: "uppercase", letterSpacing: .5 }}>Escalation Chains by Responsible Person</div>
        {usersInUse.length === 0 && <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic" }}>No active tiers defined.</div>}
        {usersInUse.map(userName => {
          const chain = chainByUser[userName];
          return (
            <div key={userName} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
              <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: T.navy, background: T.bg, padding: "5px 10px", borderRadius: 6, minWidth: 110 }}>{userName}</div>
              <div style={{ fontSize: 14, color: T.text2, flexShrink: 0 }}>→</div>
              {chain.map((t, i, arr) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ textAlign: "center", minWidth: 90 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, margin: "0 auto 4px", boxShadow: `0 0 0 2px ${t.color}30` }}>L{t.level}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.text }}>{t.targetUser || "—"}</div>
                    <div style={{ fontSize: 9, color: T.text2, marginTop: 1 }}>+{t.overdueDays}d</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ fontSize: 12, color: T.text2, margin: "0 4px", flexShrink: 0 }}>→</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 14, display: "flex", gap: 10, flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4 }}>Filter:</span>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ width: 180, padding: "6px 10px" }}>
          <option value="">All Responsible Users</option>
          {USER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ width: 130, padding: "6px 10px" }}>
          <option value="">All Levels</option>
          <option value="1">Level 1</option>
          <option value="2">Level 2</option>
          <option value="3">Level 3</option>
          <option value="4">Level 4</option>
          <option value="5">Level 5+</option>
        </select>
        {(userFilter || levelFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setUserFilter(""); setLevelFilter(""); }} style={{ padding: "6px 10px" }}>Clear</button>
        )}
        <span style={{ fontSize: 11, color: T.text2, marginLeft: "auto" }}>Showing {matrix.length} of {allMatrix.length} tiers</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {matrix.map(tier => {
          const isEditing = editRow === tier.id;
          const editable = checkCanModify(tier.id);
          return (
            <div key={tier.id} className="card" style={{ padding: 0, overflow: "hidden", opacity: tier.active ? 1 : .55, border: `1.5px solid ${isEditing ? tier.color : T.border}`, transition: "all .2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: isEditing ? `1px solid ${T.border}` : "none", background: isEditing ? T.bg : "transparent" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: tier.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>L{tier.level}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{tier.label || `Level ${tier.level}`}</div>
                  <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{tier.description || "No description"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {editable && (
                    <button onClick={() => toggleActive(tier.id)} title={tier.active ? "Disable" : "Enable"} style={{ background: tier.active ? T.green : "#e2e8f0", border: "none", borderRadius: 12, width: 42, height: 22, cursor: "pointer", transition: "all .2s", position: "relative", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 2, left: tier.active ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "all .2s", display: "block" }} />
                    </button>
                  )}
                  {editable && <span style={{ fontSize: 10, color: tier.active ? T.green : T.text2, fontWeight: 600, minWidth: 36 }}>{tier.active ? "ON" : "OFF"}</span>}
                  {!isEditing && editable && <button onClick={() => startEdit(tier)} style={{ fontSize: 11, background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>Edit</button>}
                  {!isEditing && editable && <button onClick={() => deleteTier(tier.id)} style={{ fontSize: 11, background: "transparent", color: T.red, border: `1px solid ${T.red}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>Delete</button>}
                  {isEditing && <button onClick={saveEdit} style={{ fontSize: 11, background: T.green, color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>Save</button>}
                  {isEditing && <button onClick={cancelEdit} style={{ fontSize: 11, background: "transparent", color: T.text2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>}
                </div>
              </div>
              {!isEditing && (
                <div style={{ display: "flex", gap: 10, padding: "10px 18px", flexWrap: "nowrap", overflowX: "auto", alignItems: "center" }}>
                  <span style={{ fontSize: 11, background: T.bg, borderRadius: 6, padding: "4px 10px", color: T.text }}><b>Responsible:</b> {tier.fromUser || "—"}</span>
                  <span style={{ fontSize: 14, color: T.text2 }}>→</span>
                  <span style={{ fontSize: 11, background: T.bg, borderRadius: 6, padding: "4px 10px", color: T.text }}><b>Notify:</b> {tier.targetUser || "—"}</span>
                  <span style={{ fontSize: 11, background: T.bg, borderRadius: 6, padding: "4px 10px", color: T.text }}><b>Trigger:</b> {tier.overdueDays === 0 ? "On due date" : `${tier.overdueDays} day${tier.overdueDays !== 1 ? "s" : ""} overdue`}</span>
                  <span style={{ fontSize: 11, background: T.bg, borderRadius: 6, padding: "4px 10px", color: T.text }}><b>Notify via:</b> {tier.notifyMethod}</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", overflowX: "auto" }}>
                    {tier.priorities.map(p => <span key={p} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 700, background: p === "CRITICAL" ? T.redL : p === "WARNING" ? T.amberL : "#E8F4F8", color: p === "CRITICAL" ? T.red : p === "WARNING" ? T.amber : "#1A6B8A" }}>{p}</span>)}
                  </div>
                </div>
              )}
              {isEditing && editDraft && (
                <div className="grid-3col" style={{ padding: "16px 18px", gap: 12 }}>
                  <div style={{ gridColumn: "1/-1" }}><Lbl t="Tier Label (auto-built if left blank)" /><input value={editDraft.label || ""} onChange={e => upDraft("label", e.target.value)} placeholder={`Level ${editDraft.level} — ${editDraft.fromUser || "From"} → ${editDraft.targetUser || "To"}`} /></div>
                  <div style={{ gridColumn: "1/-1" }}><Lbl t="Description" /><input value={editDraft.description || ""} onChange={e => upDraft("description", e.target.value)} placeholder="Brief explanation of this escalation level" /></div>
                  <div>
                    <Lbl t="Responsible Person (from)" req />
                    <select value={editDraft.fromUser || ""} onChange={e => upDraft("fromUser", e.target.value)}>
                      <option value="">— select —</option>
                      {USER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl t="Escalate To (notify)" req />
                    <select value={editDraft.targetUser || ""} onChange={e => upDraft("targetUser", e.target.value)}>
                      <option value="">— select —</option>
                      {USER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl t="Level" req />
                    <input type="number" min={1} max={10} value={editDraft.level} onChange={e => upDraft("level", +e.target.value)} />
                  </div>
                  <div>
                    <Lbl t="Overdue Days (trigger)" req />
                    <input type="number" min={0} max={365} value={editDraft.overdueDays} onChange={e => { const d = +e.target.value; upDraft("overdueDays", d); upDraft("overdueHrs", d * 24); }} />
                    <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>0 = triggers on due date</div>
                  </div>
                  <div>
                    <Lbl t="Notification Method" />
                    <select value={editDraft.notifyMethod} onChange={e => upDraft("notifyMethod", e.target.value)}>
                      {METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl t="Badge Color" />
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "nowrap", overflowX: "auto" }}>
                      {["#E69903", "#E67E22", "#D35400", "#C0392B", "#7B241C", "#1E8449", "#272262", "#7F8C8D"].map(c => (
                        <button key={c} onClick={() => upDraft("color", c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: editDraft.color === c ? "3px solid #000" : "3px solid transparent", cursor: "pointer", padding: 0, outline: "none" }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Lbl t="Applies to Priorities" />
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      {PRIORITIES.map(p => (
                        <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                          <input type="checkbox" checked={editDraft.priorities.includes(p)} onChange={e => { const arr = e.target.checked ? [...editDraft.priorities, p] : editDraft.priorities.filter(x => x !== p); upDraft("priorities", arr); }} style={{ width: 14, cursor: "pointer" }} />
                          <span style={{ color: p === "CRITICAL" ? T.red : p === "WARNING" ? T.amber : T.text, fontWeight: 600 }}>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: T.amberL, borderRadius: 8 }}>
                    <span style={{ fontSize: 13 }}>⚠</span>
                    <span style={{ fontSize: 12, color: "#7A4500" }}>Changes take effect on the next escalation run. Active actions already escalated won't be re-triggered.</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {matrix.length === 0 && <div className="card" style={{ padding: 32, textAlign: "center", color: T.text2 }}>No escalation tiers match the current filter. Click <b>+ Add Tier</b> to create one.</div>}
      </div>
    </div>
  );
}


/* ── Reusable Save-to-Server button ──────────────────────────────────── */
