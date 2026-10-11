/* eslint-disable react-refresh/only-export-components */
import React, { useRef, useState } from "react";
import { API_BASE_URL, getAuthToken } from "../api/client.js";
import { Avatar, Chip, MultiUserSelect, PBadge, SBadge, Spin } from "../components/ui.jsx";
import { useEscClose } from "../hooks/useEscClose.js";
import { DEFAULT_PLANTS, SECTIONS, STATUS_LIST, displayStatus } from "../utils/constants.js";
import { normalizeActionPatch, responsibleMatchesUsers } from "../utils/data.js";
import { fmt, todayStr } from "../utils/helpers.js";
import { getPerms, isGuestRole, isUserAdmin, scopedPlants, scopedUsers } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* Completion workflow: assignee marks done → goes to allocatedBy + their superior for confirmation */
export function ActionDetailPanel({ action, onClose, onUpdate, user, _users, allUsers, plants: panelPlants, machines: panelMachines, meetings: panelMeetings }) {
  useEscClose(onClose);
  const [msgText, setMsgText] = useState("");
  const messagesEndRef = useRef(null);
  const msgs = action.messages || [];
  const revHistory = action.revisionHistory || [];
  const isPendingConfirm = action.pendingConfirmation === true;
  // Feature 6: inline edit state (track per-field editing)
  const [editingField, setEditingField] = useState(null);
  const [fieldVal, setFieldVal] = useState("");
  const [markCompleteStatus, setMarkCompleteStatus] = useState("COMPLETED");
  const [downloadingAtt, setDownloadingAtt] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const textareaRef = useRef(null);

  // Determine who can interact/confirm
  const assignee = action.responsible;
  const allocator = action.allocatedBy;
  const allocatorUser = allUsers.find(u => u.name === allocator);
  const allocatorSuperior = allocatorUser?.superior ? allUsers.find(u => u.name === allocatorUser.superior) : null;
  const isAssignee = responsibleMatchesUsers(assignee, [(user?.name || "").toLowerCase()]);
  const isAllocator = user?.name === allocator;
  const isAllocatorSuperior = user?.name === allocatorSuperior?.name;
  const isAdmin = isUserAdmin(user);
  const _hasEditPerm = isAdmin || isAllocator || (getPerms(user).canEditActions && isAssignee);
  const canConfirm = isAllocator || isAllocatorSuperior || isAdmin;
  const canMsg = _hasEditPerm || isAssignee || isAllocator;
  const canEdit = _hasEditPerm && !isPendingConfirm && action.status !== "COMPLETED" && action.status !== "DROPPED";

  const sendMsg = () => {
    if (!msgText.trim() || !canMsg) return;
    const newMsg = { id: Date.now(), author: user?.name || "Unknown", authorInitials: user?.initials || "?", authorColor: user?.color || T.slate, text: msgText.trim(), ts: new Date().toISOString() };
    onUpdate(action.id, { messages: [...msgs, newMsg] });
    setMsgText("");
  };
  const requestCompletion = () => {
    const sysMsg = { id: Date.now(), author: "System", authorInitials: "SYS", authorColor: T.navy, text: `${user?.name} has marked this action as complete and sent it for confirmation by ${allocator}${allocatorSuperior ? ` and ${allocatorSuperior.name}` : "."}`, ts: new Date().toISOString() };
    onUpdate(action.id, { status: "PENDING CONFIRM", pendingConfirmation: true, messages: [...msgs, sysMsg] });
  };
  const confirmComplete = () => {
    const sysMsg = { id: Date.now(), author: "System", authorInitials: "SYS", authorColor: T.green, text: `${user?.name} has confirmed completion. Action is now COMPLETED.`, ts: new Date().toISOString() };
    onUpdate(action.id, { status: "COMPLETED", pendingConfirmation: false, closedOn: todayStr(), messages: [...msgs, sysMsg] });
  };
  const rejectComplete = () => {
    const sysMsg = { id: Date.now(), author: "System", authorInitials: "SYS", authorColor: T.red, text: `${user?.name} has rejected the completion and reopened this action.`, ts: new Date().toISOString() };
    onUpdate(action.id, { status: "IN PROCESS", pendingConfirmation: false, messages: [...msgs, sysMsg] });
  };
  const startEdit = (field, val) => { setEditingField(field); setFieldVal(val || ""); setTimeout(() => { if (textareaRef.current) { textareaRef.current.value = val || ""; textareaRef.current.focus(); textareaRef.current.setSelectionRange((val||"").length, (val||"").length); } }, 0); };
  const commitEdit = (field) => {
    if (field === editingField) {
      // For textarea fields, read from the ref (uncontrolled) to avoid cursor-jump bug
      const actualVal = (textareaRef.current && editingField === field) ? textareaRef.current.value : fieldVal;
      const patch = field === "status"
        ? normalizeActionPatch({ status: actualVal })
        : { [field]: actualVal };
      onUpdate(action.id, patch);
      setEditingField(null);
    }
  };
  const fmtTime = ts => { const d = new Date(ts); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); };

  // Inline editable field renderer
  const InlineField = ({ label, field, value, type, opts, readonly }) => {
    const isEditing = editingField === field;
    const editable = canEdit && !readonly;
    return (
      <div>
        <div style={{ fontSize: 10, color: T.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>{label}</div>
        {isEditing
          ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {type === "select" ? <select value={fieldVal} onChange={e => setFieldVal(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", flex: 1, border: `1.5px solid ${T.navy}`, borderRadius: 8 }} autoFocus>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
              : type === "textarea" ? <textarea ref={textareaRef} defaultValue={fieldVal} dir="ltr" style={{ flex: 1, fontSize: 12, height: 72, resize: "vertical", border: `1.5px solid ${T.navy}`, borderRadius: 8, padding: "6px 8px" }} />
                : <input type={type || "text"} value={fieldVal} onChange={e => setFieldVal(e.target.value)} style={{ flex: 1, fontSize: 12, padding: "4px 8px", border: `1.5px solid ${T.navy}`, borderRadius: 8 }} autoFocus />
            }
            <button onClick={() => commitEdit(field)} style={{ background: T.green, border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✓</button>
            <button onClick={() => setEditingField(null)} style={{ background: T.border, border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
          </div>
          : <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: editable ? "pointer" : "default", padding: "5px 8px", borderRadius: 6, border: editable ? `1.5px solid ${T.border}` : "1.5px solid transparent", transition: "border-color .15s, background .15s", background: "transparent" }}
            onMouseEnter={e => { if (editable) { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = T.navy; } }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; if (editable) e.currentTarget.style.borderColor = T.border; }}
            onClick={() => { if (editable) startEdit(field, value); }}>
            <span style={{ fontSize: 12, flex: 1 }}>{value || "—"}</span>
            {editable && <span style={{ fontSize: 10, color: T.text2, opacity: .5 }}>✏</span>}
          </div>
        }
      </div>
    );
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 405 }} onClick={onClose} />
      <div className="side-panel" style={{ width: 580, display: "flex", flexDirection: "column", zIndex: 410 }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1.5px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: T.text2 }}>{action.sn}</div>
            <button onClick={onClose} style={{ background: T.navy, border: "none", cursor: "pointer", fontSize: 16, color: "#fff", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
          </div>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: T.navy, lineHeight: 1.3, marginBottom: 10 }}>{action.text}</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto" }}>
            <SBadge s={displayStatus(action)} /><PBadge p={action.priority} />
            {(action.projectName || action.project) && <Chip label={"🔗 " + (action.projectName || action.project)} color={T.amber} />}
            {action.srcId && (() => { const m = (panelMeetings || []).find(x => x.id === action.srcId); if (!m) return null; return <Chip label={"📅 " + m.type + (m.plant ? " · " + m.plant : "")} color={T.navy} />; })()}
          </div>
          {isPendingConfirm && (
            <div className="confirm-banner" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7A5A00", marginBottom: 6 }}>⏳ Awaiting Completion Confirmation</div>
              <div style={{ fontSize: 11, color: "#7A5A00", marginBottom: canConfirm ? 10 : 0 }}>
                {assignee} has marked this complete. Waiting for {allocator}{allocatorSuperior ? ` or ${allocatorSuperior.name}` : ""} to confirm.
              </div>
              {canConfirm && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-green btn-sm" onClick={confirmComplete} style={{ flex: 1, justifyContent: "center" }}>✓ Confirm Complete</button>
                  <button className="btn btn-red btn-sm" onClick={rejectComplete} style={{ flex: 1, justifyContent: "center" }}>↩ Reopen</button>
                </div>
              )}
              {isAssignee && !canConfirm && <div style={{ fontSize: 11, color: T.text2, fontStyle: "italic" }}>You submitted this. Waiting for allocator's response.</div>}
            </div>
          )}
        </div>

        {/* Feature 6: Single scrollable page - Details + Thread + Revisions stacked */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* === DETAILS SECTION === */}
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.navy, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>📋 Details {canEdit && <span style={{ fontSize: 10, color: T.text2, fontWeight: 400 }}>(click any field to edit)</span>}</div>
            <div style={{ marginBottom: 12 }}>
              <InlineField label="Action Category" field="reasonOfAction" value={action.reasonOfAction} type="select" opts={["","Corrective Action","Preventive Action","Improvement","Safety","Maintenance","Quality","Compliance","Other"]} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <InlineField label="Action Point" field="text" value={action.text} type="textarea" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {/* Read-only fields */}
              <div><div style={{ fontSize: 10, color: T.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>Date of Action</div><div style={{ fontSize: 12, padding: "3px 6px" }}>{fmt(action.dateOfAction)}</div></div>
              <div><div style={{ fontSize: 10, color: T.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>Allocated By</div><div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px" }}><Avatar name={action.allocatedBy} size={20} users={allUsers} /><span style={{ fontSize: 12 }}>{action.allocatedBy || "—"}</span></div></div>
              {/* Editable fields */}
              <InlineField label="Source" field="src" value={action.src} type="text" />
              <InlineField label="Department" field="section" value={action.section} type="select" opts={[...(panelPlants ? [] : SECTIONS), ...((panelPlants ? scopedUsers(user, allUsers || []) : []).length > 0 ? [...new Set(["General", ...scopedUsers(user, allUsers || []).map(u => u.dept).filter(Boolean)])] : SECTIONS)]} />

              <InlineField label="Plant" field="plant" value={action.plant} type="select" opts={scopedPlants(user, panelPlants || DEFAULT_PLANTS).map(p => p.name)} />
              <div>
                <div style={{ fontSize: 10, color: T.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>Responsible</div>
                <MultiUserSelect value={action.responsible} users={(allUsers || []).filter(u => { if (action.plant && action.plant !== "All") return !u.plant || u.plant === "All" || u.plant === action.plant; if (!isUserAdmin(user) && user?.plant && user.plant !== "All") return !u.plant || u.plant === "All" || u.plant === user.plant; return true; })} onChange={v => { const patch = { responsible: v }; const firstName = (v || "").split(",").map(s => s.trim()).filter(Boolean)[0]; if (firstName) { const u = (allUsers || []).find(x => x.name === firstName); if (u) { if (u.plant) patch.plant = u.plant; if (u.dept) patch.section = u.dept; } } onUpdate(action.id, patch); }} />
              </div>
              <InlineField label="Due Date" field="due" value={action.due} type="date" />
              <div><div style={{ fontSize: 10, color: T.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3 }}>Closed On</div><div style={{ fontSize: 12, padding: "3px 6px" }}>{fmt(action.closedOn)}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <InlineField label="Machine Name" field="machineName" value={action.machineName} type="select" opts={(panelMachines || []).filter(m => !action.plant || !m.plant || m.plant === action.plant).map(m => m.name).filter(Boolean)} />
              <div />
            </div>
            <InlineField label="Remarks" field="remarks" value={action.remarks} type="textarea" />
            {/* Attachments Section */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: T.text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>📎 Attachments</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(action.attachments || []).map(att => (
                  <div key={att.id || att.filename} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, borderRadius: 8, padding: "7px 12px", border: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 16 }}>{att.mimetype?.includes("pdf") ? "📄" : att.mimetype?.includes("image") ? "🖼" : att.mimetype?.includes("sheet") || att.mimetype?.includes("excel") || att.mimetype?.includes("csv") ? "📊" : att.mimetype?.includes("word") || att.mimetype?.includes("document") ? "📝" : "📁"}</span>
                    <span
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDownloadingAtt(att.id);
                        try {
                        const resp = await fetch(`${API_BASE_URL}/api/actions/${action.id}/attachments/${att.id}`, {
                          headers: { "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token")}` },
                          });
                          if (!resp.ok) { alert("Download failed"); setDownloadingAtt(null); return; }
                          const ctype = (resp.headers.get("content-type") || "");
                          if (ctype.includes("application/json")) {
                            const j = await resp.json();
                            if (j.url) window.open(j.url, "_blank");
                            else alert("Download link unavailable");
                            setDownloadingAtt(null);
                            return;
                          }
                          const blob = await resp.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url; a.download = att.filename;
                          document.body.appendChild(a); a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (err) { alert("Download failed: " + err.message); }
                        setDownloadingAtt(null);
                      }}
                      style={{ fontSize: 12, fontWeight: 500, color: T.navy, textDecoration: "underline", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                    >{att.filename}{downloadingAtt === att.id && <span style={{ marginLeft: 6 }}><Spin /></span>}</span>
                    <span style={{ fontSize: 10, color: T.text2 }}>{att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}</span>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm("Remove this attachment?")) return;
                          const updated = (action.attachments || []).filter(a => a.id !== att.id);
                          onUpdate(action.id, { attachments: updated });
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 14, padding: 2 }}
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "6px 14px", borderRadius: 8, border: `1.5px dashed ${T.border}`, cursor: uploadingFile ? "not-allowed" : "pointer", fontSize: 12, color: uploadingFile ? T.text2 : T.navy, background: uploadingFile ? T.bg : "#fff", transition: "border-color .15s, background .15s", opacity: uploadingFile ? .6 : 1 }}
                  onMouseEnter={e => { if (!uploadingFile) { e.currentTarget.style.borderColor = T.navy; e.currentTarget.style.background = T.bg; } }}
                  onMouseLeave={e => { if (!uploadingFile) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = "#fff"; } }}
                >
                  {uploadingFile ? <><Spin /> Uploading…</> : <><span style={{ fontSize: 14 }}>+</span> Attach File</>}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx"
                    style={{ display: "none" }}
                    disabled={uploadingFile}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { alert("File size exceeds 5 MB limit."); return; }
                      setUploadingFile(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const resp = await fetch(`${API_BASE_URL}/api/actions/${action.id}/attachments`, {
                          method: "POST",
                          headers: { "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token")}` },
                          body: formData,
                        });
                        if (!resp.ok) { const err = await resp.json().catch(() => ({})); alert(err.detail || "Upload failed"); setUploadingFile(false); return; }
                        const result = await resp.json();
                        const updatedAttachments = [...(action.attachments || []), result.attachment];
                        onUpdate(action.id, { attachments: updatedAttachments });
                      } catch (err) {
                        alert("Upload failed: " + err.message);
                      }
                      setUploadingFile(false);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            {/* Actions */}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
              {!isGuestRole(user?.role) && !isPendingConfirm && action.status !== "COMPLETED" && action.status !== "DROPPED" && (
                <>
                  {isAssignee && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={markCompleteStatus}
                        onChange={e => setMarkCompleteStatus(e.target.value)}
                        style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text }}
                      >
                        <option value="COMPLETED">✅ Mark as Completed</option>
                        <option value="IN PROCESS">🔄 Mark as In Process</option>
                        <option value="NOT STARTED">⏸ Mark as Not Started</option>
                        <option value="DROPPED">🚫 Mark as Dropped</option>
                      </select>
                      <button
                        className={
                          markCompleteStatus === "DROPPED" ? "btn btn-red btn-sm" :
                          markCompleteStatus === "COMPLETED" ? "btn btn-green btn-sm" :
                          "btn btn-ghost btn-sm"
                        }
                        onClick={() => {
                          if (markCompleteStatus === "DROPPED") {
                            onUpdate(action.id, { status: "DROPPED", closedOn: todayStr(), pendingConfirmation: false });
                          } else if (markCompleteStatus === "COMPLETED") {
                            requestCompletion();
                          } else {
                            onUpdate(action.id, { status: markCompleteStatus, closedOn: null, pendingConfirmation: false });
                          }
                        }}>Confirm →</button>
                    </div>
                  )}
                  {!isAssignee && canMsg && (
                    <select value={action.status} onChange={e => onUpdate(action.id, normalizeActionPatch({ status: e.target.value }))} style={{ fontSize: 12, padding: "5px 8px" }}>
                      {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </>
              )}
              {(action.status === "COMPLETED" || action.status === "DROPPED") && canMsg && (
                <button className="btn btn-ghost btn-sm" onClick={() => onUpdate(action.id, normalizeActionPatch({ status: "IN PROCESS" }))}>↩ Reopen</button>
              )}
            </div>
          </div>

          {/* === THREAD SECTION === */}
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.navy, marginBottom: 12 }}>💬 Thread {msgs.length > 0 && <span style={{ color: T.text2, fontWeight: 400 }}>({msgs.length})</span>}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: canMsg ? 12 : 0 }}>
              {msgs.length === 0 && <div style={{ textAlign: "center", padding: "16px 0", color: T.text2, fontSize: 12 }}>No messages yet.{canMsg ? " Start the conversation below." : ""}</div>}
              {msgs.map(m => {
                const isMe = m.author === user?.name;
                const isSys = m.author === "System";
                if (isSys) return (
                  <div key={m.id} style={{ textAlign: "center", padding: "4px 12px" }}>
                    <span style={{ fontSize: 11, color: T.text2, background: T.bg, padding: "3px 10px", borderRadius: 20, display: "inline-block" }}>{m.text}</span>
                  </div>
                );
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.authorColor + "20", color: m.authorColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, border: `1.5px solid ${m.authorColor}30` }}>{m.authorInitials}</div>
                    <div style={{ maxWidth: "72%" }}>
                      <div style={{ fontSize: 10, color: T.text2, marginBottom: 3, textAlign: isMe ? "right" : "left" }}>{m.author}{isMe ? " (You)" : ""} · {fmtTime(m.ts)}</div>
                      <div style={{ background: isMe ? T.navy : T.bg, border: `1px solid ${isMe ? T.navy : T.border}`, borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5, color: isMe ? "#fff" : T.text }}>{m.text}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {canMsg && (
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }} placeholder="Type a message… (Enter to send)" style={{ flex: 1, resize: "none", height: 52, fontSize: 12 }} />
                <button className="btn btn-navy" onClick={sendMsg} disabled={!msgText.trim()} style={{ flexShrink: 0, alignSelf: "flex-end", padding: "8px 14px" }}>Send</button>
              </div>
            )}
          </div>

          {/* === REVISIONS SECTION === */}
          <div style={{ padding: "16px 24px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.navy, marginBottom: 12 }}>📅 Revisions {revHistory.length > 0 && <span style={{ color: T.text2, fontWeight: 400 }}>({revHistory.length} changes)</span>}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: T.navy }}>{action.revisions || 0}</div>
                <div style={{ fontSize: 11, color: T.text2 }}>Date Revisions</div>
              </div>
              <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: action.status === "COMPLETED" ? T.green : T.amber }}>{action.status}</div>
                <div style={{ fontSize: 11, color: T.text2 }}>Current Status</div>
              </div>
            </div>
            {action.closedOn && <div style={{ background: T.greenL, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12 }}><b style={{ color: T.green }}>Completed on:</b> {fmt(action.closedOn)}</div>}
            {revHistory.length === 0 ? <div style={{ fontSize: 12, color: T.text2, fontStyle: "italic", padding: "8px 0" }}>No date revisions yet.</div> :
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {revHistory.map((r, i) => (
                  <div key={i} style={{ background: T.amberL, borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${T.amber}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>Rev #{i + 1}</span>
                      <span style={{ fontSize: 11, color: T.text2 }}>{fmt(r.date)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.text }}>Due changed from <b>{fmt(r.from)}</b> to <b>{fmt(r.to)}</b></div>
                    {r.by && <div style={{ fontSize: 11, color: T.text2, marginTop: 3 }}>by {r.by}</div>}
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </>
  );
}

/* ===================== ACTIONS PAGE ===================== */
/* Persists last view per user in memory */
