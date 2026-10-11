/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useRef, useState } from "react";
import { Avatar, Empty, PBadge, SBadge } from "../components/ui.jsx";
import { normalizeStatus } from "../utils/constants.js";
import { daysOver, fmt, isOverdue, todayStr } from "../utils/helpers.js";
import { SC, T } from "../utils/theme.js";

export function TableView({ fa, _upStatus, setSel,_canEditt, _upAction, sortState, onSortChange, users, meetings, deleteAction }) {
  const meetingMap = {}; (meetings || []).forEach(m => { meetingMap[m.id] = m; });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsView, setFsView] = useState("table");
  const tableAreaRef = useRef(null);
  const captureTable = async () => {
    const el = tableAreaRef.current;
    if (!el) return;
    if (!window.html2canvas) {
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const prevOverflow = el.style.overflow;
    const prevFlex = el.style.flex;
    const prevHeight = el.style.height;
    el.style.overflow = "visible";
    el.style.flex = "none";
    el.style.height = "auto";
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#fff", useCORS: true, scrollY: 0, windowWidth: el.scrollWidth, windowHeight: el.scrollHeight });
    el.style.overflow = prevOverflow;
    el.style.flex = prevFlex;
    el.style.height = prevHeight;
    const link = document.createElement("a");
    link.download = `actions-capture-${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  useEffect(() => { if (!isFullscreen) return; const h = e => { if (e.key === "Escape") setIsFullscreen(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [isFullscreen]);
  // Use externally-provided sort state if available (for persistence), else local
  const [localSortKey, setLocalSortKey] = useState(sortState?.key || "dateOfAction");
  const [localSortDir, setLocalSortDir] = useState(sortState?.dir || "desc");
  const sortKey = localSortKey, sortDir = localSortDir;
  const toggleSort = k => {
    const newKey = k, newDir = sortKey === k ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setLocalSortKey(newKey); setLocalSortDir(newDir);
    onSortChange && onSortChange({ key: newKey, dir: newDir });
  };
  const SortIcon = ({ k }) => {
    const active = sortKey === k;
    return (
      <span style={{ marginLeft: 4, opacity: active ? 1 : .3, fontSize: 10, userSelect: "none", display: "inline-flex", flexDirection: "column", lineHeight: 1, gap: 0 }}>
        <span style={{ color: active && sortDir === "asc" ? T.amber : "inherit", lineHeight: 1 }}>▲</span>
        <span style={{ color: active && sortDir === "desc" ? T.amber : "inherit", lineHeight: 1 }}>▼</span>
      </span>
    );
  };
  const TH = ({ k, label, minWidth, style = {} }) => (
    <th style={{ minWidth, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", ...style }} onClick={() => toggleSort(k)}>
      {label}<SortIcon k={k} />
    </th>
  );
  const sorted = [...fa].sort((a, b) => {
    let av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
    if (sortKey === "meeting") { av = (a.srcId && meetingMap[a.srcId]) ? meetingMap[a.srcId].type : (a.src || ""); bv = (b.srcId && meetingMap[b.srcId]) ? meetingMap[b.srcId].type : (b.src || ""); }
    if (sortKey === "due" || sortKey === "dateOfAction" || sortKey === "created") {
      av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0;
    } else if (sortKey === "revisions") { av = a.revisions || 0; bv = b.revisions || 0; }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    return sortDir === "asc" ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
  });
  return (
    <div className={isFullscreen ? "" : "card"} style={{ padding: 0, overflow: "hidden", ...(isFullscreen ? { position: "fixed", inset: 0, zIndex: 900, background: "#fff", borderRadius: 0, display: "flex", flexDirection: "column" } : {}) }}>
      {isFullscreen && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: `1.5px solid ${T.border}`, background: T.navy, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>Actions Register — Fullscreen ({fa.length} rows)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[{ v: "table", icon: "☰", l: "Table" }, { v: "board", icon: "⊞", l: "Board" }, { v: "kanban", icon: "▦", l: "Kanban" }, { v: "timeline", icon: "━", l: "Timeline" }].map(x => (
            <button key={x.v} onClick={() => setFsView(x.v)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${fsView === x.v ? "#fff" : "rgba(255,255,255,.3)"}`, background: fsView === x.v ? "#fff" : "transparent", color: fsView === x.v ? T.navy : "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {x.icon} {x.l}
            </button>
          ))}
          <button onClick={() => setIsFullscreen(false)} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, color: "#fff", padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: 8 }}>✕ Exit</button>
          <button onClick={captureTable} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, color: "#fff", padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📸 Capture</button>
        </div>
      </div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", borderTop: isFullscreen ? "none" : `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>{fa.length} action{fa.length !== 1 ? "s" : ""}</span>
        {!isFullscreen && <button onClick={() => setIsFullscreen(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.text2, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>⛶ Fullscreen</button>}
      </div>
      <div ref={tableAreaRef} style={{ overflowX: "auto", flex: isFullscreen ? 1 : "none", WebkitOverflowScrolling: "touch" }}>
        <table style={{ minWidth: 1200 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}><tr>
            <TH k="sn" label="SN" minWidth={70} />
            <TH k="src" label="Source" minWidth={150} />

            <TH k="section" label="Department" minWidth={100} />
            <TH k="plant" label="Plant" minWidth={90} />
            <TH k="dateOfAction" label="Date" minWidth={100} />
            <TH k="text" label="Action Point" minWidth={280} />
            <TH k="responsible" label="Responsible" minWidth={130} />
            <TH k="due" label="Due Date" minWidth={100} />
            <TH k="status" label="Status" minWidth={130} />
            <TH k="revisions" label="Revisions" minWidth={80} style={{ textAlign: "center" }} />
            {deleteAction && <th style={{ minWidth: 50 }}></th>}
          </tr></thead>
          <tbody>
            {sorted.map((a, idx) => {
              const status = normalizeStatus(a.status);
              const hasRemarks = Array.isArray(a.messages) && a.messages.length > 0;
              let rowBg = "";
              if (status === "COMPLETED") rowBg = "#D5F5E3";
              else if (status === "DROPPED") rowBg = "#F2F3F4";
              else if (isOverdue(a)) rowBg = "#FADBD8";
              else if (hasRemarks) rowBg = "#FEF3CD";
              else if (a.pendingConfirmation) rowBg = "#FEF9E7";
              return (
              <tr key={a.id || `act-${idx}`} style={{ cursor: "pointer", background: rowBg }} onClick={() => setSel(a)}>
                <td style={{ fontFamily: "monospace", fontSize: 11, color: T.text2 }}>{a.sn}</td>
                <td style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.src}</td>

                <td style={{ fontSize: 12 }}>{a.section}</td>
                <td style={{ fontSize: 11 }}>{a.plant}</td>
                <td style={{ fontSize: 11, color: T.text2, whiteSpace: "nowrap" }}>{fmt(a.dateOfAction)}</td>
                <td style={{ minWidth: 280, maxWidth: 360 }}>
                  <div style={{ fontWeight: 500, whiteSpace: "normal", wordBreak: "break-word", fontSize: 13, lineHeight: 1.4 }}>{a.text}</div>
                  {isOverdue(a) && <div style={{ fontSize: 10, color: T.red, fontWeight: 600 }}>⚠ {daysOver(a)}d overdue</div>}
                  {a.pendingConfirmation && <div style={{ fontSize: 10, color: T.amber, fontWeight: 600 }}>⏳ {a.status}</div>}
                </td>
                <td onClick={e => e.stopPropagation()}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={a.responsible} size={24} users={users} /><span style={{ fontSize: 12 }}>{a.responsible}</span></div></td>
                <td style={{ fontSize: 12, color: isOverdue(a) ? T.red : T.text, whiteSpace: "nowrap" }}>{fmt(a.due)}</td>
                <td onClick={e => e.stopPropagation()}><SBadge s={a.status} /></td>
                <td style={{ textAlign: "center" }}>{(a.revisions || 0) > 0 ? <span style={{ fontWeight: 700, color: T.amber, fontSize: 12 }}>{a.revisions}</span> : <span style={{ color: T.text2, fontSize: 12 }}>—</span>}</td>
                {deleteAction && <td style={{ textAlign: "center" }}>{status === "DROPPED" && <button onClick={e => { e.stopPropagation(); deleteAction(a); }} style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Delete</button>}</td>}
              </tr>
              );
            })}
            {sorted.length === 0 && <tr><td colSpan={10}><Empty icon="📭" title="No actions found" sub="Adjust filters or add actions via Work." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BoardView({ fa, setSel, users }) {
  const groups = [...new Set(fa.map(a => a.section))].filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map(g => {
        const ga = fa.filter(a => a.section === g), done = ga.filter(a => a.status === "COMPLETED").length;
        return (
          <div key={g} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", background: T.bg, borderBottom: `1.5px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>{g}</span>
              <span style={{ fontSize: 11, color: T.text2 }}>{done}/{ga.length} completed</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, padding: 14 }}>
              {ga.map((a, idx) => (
                <div key={a.id || `board-${idx}`} style={{ background: T.bg, borderRadius: 10, padding: 12, border: `1.5px solid ${a.pendingConfirmation ? T.amber : isOverdue(a) ? T.red : T.border}`, cursor: "pointer" }} onClick={() => setSel(a)}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 4 }}><SBadge s={normalizeStatus(a.status)} /><PBadge p={a.priority} /></div>
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{a.text.slice(0, 70)}{a.text.length > 70 ? "…" : ""}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Avatar name={a.responsible} size={22} users={users || []} />
                    <span style={{ fontSize: 10, color: isOverdue(a) ? T.red : T.text2 }}>{fmt(a.due)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KanbanView({ fa, upStatus, canEdit, users, setSel, user: _user }) {
  const dragIdRef = useRef(null);
  const [overCol, setOverCol] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [heldId, setHeldId] = useState(null);
  const holdTimerRef = useRef(null);

  const HOLD_GLOW = {
    "NOT STARTED":      { border: "#7C80B0", shadow: "0 0 0 3px rgba(124,128,176,.25), 0 8px 24px rgba(124,128,176,.18)", bg: "#F4F3FB" },
    "IN PROCESS":       { border: "#E69903", shadow: "0 0 0 3px rgba(230,153,3,.25), 0 8px 24px rgba(230,153,3,.18)",    bg: "#FFFBEF" },
    "PENDING CONFIRM":  { border: "#F39C12", shadow: "0 0 0 3px rgba(243,156,18,.25), 0 8px 24px rgba(243,156,18,.18)",  bg: "#FEF9E7" },
    "COMPLETED":        { border: "#27AE60", shadow: "0 0 0 3px rgba(39,174,96,.25),   0 8px 24px rgba(39,174,96,.18)",   bg: "#F0FBF5" },
    "DROPPED":          { border: "#BDC3C7", shadow: "0 0 0 3px rgba(189,195,199,.25), 0 8px 24px rgba(189,195,199,.18)", bg: "#F8F9FA" },
  };

  const handleDragStart = (e, a) => {
    clearTimeout(holdTimerRef.current);
    setHeldId(null);
    dragIdRef.current = a.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(a.id));
    const ghost = e.currentTarget.cloneNode(true);
    Object.assign(ghost.style, {
      position: "fixed", top: "-1000px", left: "-1000px",
      width: e.currentTarget.offsetWidth + "px",
      transform: "rotate(2deg) scale(1.06)",
      boxShadow: "0 20px 48px rgba(39,34,98,.30)",
      borderRadius: "10px", opacity: "1",
      border: "2px solid #272262",
      background: "#fff", pointerEvents: "none",
    });
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 28);
    setTimeout(() => ghost.remove(), 0);
  };

  const handleMouseDown = (a) => {
    if (!canEdit) return;
    holdTimerRef.current = setTimeout(() => setHeldId(a.id), 120);
  };
  const handleMouseUp = () => { clearTimeout(holdTimerRef.current); setHeldId(null); };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 14,
      alignItems: "start",
      width: "100%",
      paddingBottom: 100,
      overflowX: "auto"
    }}>
      {["NOT STARTED", "IN PROCESS", "PENDING CONFIRM", "COMPLETED", "DROPPED"].map(col => {
        const c = SC[col] || { bg: "#eee", text: "#333", dot: "#aaa" };
        const glow = HOLD_GLOW[col] || { border: T.navy, shadow: "0 0 0 3px rgba(39,34,98,.2), 0 8px 24px rgba(39,34,98,.15)", bg: "#F4F3FB" };
        const isDragOver = overCol === col;
        let colCards = [];
        if (col === "PENDING CONFIRM") {
          colCards = fa.filter(a => a.pendingConfirmation && a.status !== "COMPLETED" && a.status !== "DROPPED");
        } else {
          colCards = fa.filter(a => normalizeStatus(a.status) === col);
        }

        return (
          <div key={col}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== col) setOverCol(col); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
            onDrop={e => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("text/plain");
              let id = dragIdRef.current;
              if (id == null && raw !== "") {
                id = !isNaN(raw) ? Number(raw) : raw;
              }
              if (id != null && id !== "") upStatus(id, col);
              dragIdRef.current = null;
              setOverCol(null);
            }}
            style={{
              borderRadius: 12,
              border: isDragOver ? `2px dashed ${c.dot}` : `2px solid ${c.dot}22`,
              background: isDragOver ? c.dot + "14" : "#F7F7FC",
              transition: "background .18s, border-color .18s",
              minHeight: 220,
            }}>

            {/* Column header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px 8px",
              borderBottom: `2px solid ${c.dot}33`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%", background: c.dot,
                  display: "inline-block", flexShrink: 0,
                  boxShadow: isDragOver ? `0 0 0 3px ${c.dot}44` : "none",
                  transition: "box-shadow .18s",
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: c.text, letterSpacing: .3 }}>{col}</span>
              </div>
              <span style={{ background: "#fff", color: c.text, borderRadius: 20, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{colCards.length}</span>
            </div>

            {/* Drop indicator when dragging over an empty column */}
            {isDragOver && colCards.length === 0 && (
              <div style={{ margin: "10px 10px 0", padding: "18px 0", borderRadius: 8, border: `2px dashed ${c.dot}88`, textAlign: "center", fontSize: 12, color: c.dot, fontWeight: 600 }}>
                ⬇ Drop here
              </div>
            )}

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 10px 10px" }}>
              {colCards.map((a, idx) => {
                const isDragging = draggingId === a.id;
                const isHeld = heldId === a.id;
                const draggable = canEdit; // pendingConfirmation does not block dragging
                return (
                  <div key={a.id || `kanban-${idx}`}
                    draggable={draggable}
                    onMouseDown={() => handleMouseDown(a)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDragStart={e => handleDragStart(e, a)}
                    onDragEnd={_e => { dragIdRef.current = null; setOverCol(null); setDraggingId(null); setHeldId(null); }}
                    onClick={() => { if (!isDragging) setSel(a); }}
                    style={{
                      background: isHeld ? glow.bg : "#fff",
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: draggable ? (isHeld ? "grabbing" : "grab") : "default",
                      border: isHeld
                        ? `1.5px solid ${glow.border}`
                        : `1.5px solid ${a.pendingConfirmation ? T.amber : isOverdue(a) ? T.red : "transparent"}`,
                      userSelect: "none", WebkitUserSelect: "none",
                      position: "relative",
                      opacity: isDragging ? 0.3 : 1,
                      transform: isDragging ? "scale(0.95)" : isHeld ? "scale(1.025) translateY(-2px)" : "none",
                      boxShadow: isDragging ? "none" : isHeld ? glow.shadow : "0 1px 6px rgba(0,0,0,.07)",
                      transition: "opacity .15s, transform .18s, box-shadow .18s, border-color .15s, background .15s",
                      zIndex: isHeld ? 2 : 1,
                    }}>
                    {/* Hold accent stripe */}
                    {isHeld && (
                      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, borderRadius: "10px 10px 0 0", background: `linear-gradient(90deg,${glow.border},${glow.border}66)` }} />
                    )}
                    <div style={{ fontSize: 11, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: isHeld ? glow.border : T.text2, fontWeight: isHeld ? 700 : 500, transition: "color .15s" }}>{a.sn}</span>
                      <PBadge p={a.priority} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.45, marginBottom: 9, color: T.text, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.text}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Avatar name={a.responsible} size={20} users={users || []} />
                      <span style={{ fontSize: 10, color: isOverdue(a) ? T.red : T.text2 }}>{fmt(a.due)}</span>
                    </div>
                    {a.pendingConfirmation && <div style={{ fontSize: 10, color: T.amber, marginTop: 5, fontWeight: 600 }}>⏳ {a.status}</div>}
                    {(a.messages || []).length > 0 && <div style={{ fontSize: 10, color: T.text2, marginTop: 4 }}>💬 {a.messages.length}</div>}
                  </div>
                );
              })}
              {/* Empty column drop zone when not dragging over */}
              {colCards.length === 0 && !isDragOver && (
                <div style={{ textAlign: "center", padding: "24px 0", fontSize: 12, color: c.dot, opacity: .35, border: `2px dashed ${c.dot}44`, borderRadius: 8 }}>
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TimelineView({ fa }) {
  const sorted = [...fa].filter(a => a.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  if (sorted.length === 0) return <div className="card" style={{ padding: 24 }}><Empty icon="📅" title="No actions with due dates" sub="Add due dates to see timeline." /></div>;
  const minD = new Date(sorted[0].due), maxD = new Date(sorted[sorted.length - 1].due);
  const range = Math.max(1, (maxD - minD) / 86400000);
  const pct = d => Math.round((new Date(d) - minD) / 86400000 / range * 100);
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: T.navy, marginBottom: 20 }}>Timeline — Sorted by Due Date</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.text2, marginBottom: 6 }}><span>{fmt(sorted[0].due)}</span><span style={{ color: T.red, fontWeight: 600 }}>Today</span><span>{fmt(sorted[sorted.length - 1].due)}</span></div>
      <div style={{ position: "relative", background: T.border, height: 2, borderRadius: 2, marginBottom: 20 }}>
        <div style={{ position: "absolute", left: `${pct(todayStr())}%`, top: -4, width: 2, height: 10, background: T.red, borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(a => {
          const p = pct(a.due);
          const c = isOverdue(a) ? T.red : a.status === "COMPLETED" ? T.green : T.amber;
          return (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: T.text2, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.responsible?.split(" ")[0]}</div>
              <div style={{ position: "relative", height: 22 }}>
                <div style={{ position: "absolute", left: `${Math.min(p, 90)}%`, top: 0, background: c, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.sn}: {a.text.slice(0, 28)}{a.text.length > 28 ? "…" : ""}
                </div>
              </div>
              <div style={{ fontSize: 10, color: c, fontWeight: 600 }}>{fmt(a.due)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== DASHBOARD ===================== */
