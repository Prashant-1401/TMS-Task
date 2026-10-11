/* eslint-disable react-refresh/only-export-components */
/* TODO(refactor): this component early-returns on a null mtg prop before all
   hooks are declared (pre-existing behavior from the monolith, preserved
   verbatim). Mount it only with a non-null mtg; restructuring the hook order
   is deferred to avoid behavioral changes in this pass. */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiUpdate } from "../api/autosave.js";
import { API_BASE_URL, getAuthToken } from "../api/client.js";
import { ActionDetailPanel } from "../components/ActionDetailPanel.jsx";
import { StagingArea } from "../components/StagingArea.jsx";
import { Avatar, PBadge, Spin } from "../components/ui.jsx";
import { BoardView, KanbanView, TableView, TimelineView } from "../components/views.jsx";
import { PRIORITY_LIST, STATUS_LIST } from "../utils/constants.js";
import { ensureArray, normalizeActionPatch, responsibleMatchesUsers } from "../utils/data.js";
import { isOverdue, todayStr } from "../utils/helpers.js";
import { scopedDepts } from "../utils/permissions.js";
import { T } from "../utils/theme.js";

/* ===================== MEETING ROOM ===================== */
export function MeetingRoom({ mtg, plants, depts, users, onCommit, onCloseMeeting, onBack, _prevActions, relatedActions, running, setRunning, elapsed, txLines, setTxLines, insights, setInsights, currentUser, mtgPresets, setActions, machines, reasons, fetchData }) {
  // ── Defensive: default all array props to [] to prevent "Cannot read properties of undefined (reading 'filter')" ──
  const _rel = Array.isArray(relatedActions) ? relatedActions : [];
  const _tx = Array.isArray(txLines) ? txLines : [];
  const _ins = Array.isArray(insights) ? insights : [];
  const _usr = Array.isArray(users) ? users : [];
  const _plt = Array.isArray(plants) ? plants : [];
  const _dep = Array.isArray(depts) ? depts : [];
  const _rsn = Array.isArray(reasons) ? reasons : [];
  const _mch = Array.isArray(machines) ? machines : [];
  // Use safe aliases throughout; if the prop was undefined, log once for debugging
  relatedActions = _rel; txLines = _tx; insights = _ins;
  users = _usr; plants = _plt; depts = _dep; reasons = _rsn; machines = _mch;
  if (!mtg) { console.error("[MeetingRoom] mtg prop is null/undefined — aborting render"); return null; }

  const [phase, setPhase] = useState("live");
  const [selAction, setSelAction] = useState(null);
  const [mtgShowMine, setMtgShowMine] = useState(() => { try { return localStorage.getItem("mcs_mtg_showMine") === "true"; } catch { return false; } });
  const [mtgPendingSearch, setMtgPendingSearch] = useState(() => { try { return localStorage.getItem("mcs_mtg_pendingSearch") || ""; } catch { return ""; } });
  const [mtgFilters, setMtgFilters] = useState(() => { try { const s = localStorage.getItem("mcs_mtg_filters"); return s ? JSON.parse(s) : {}; } catch { return {}; } });
  const [mtgActionView, setMtgActionView] = useState(() => { try { return localStorage.getItem("mcs_mtg_actionView") || "table"; } catch { return "table"; } });
  const [exitConfirm, setExitConfirm] = useState(false);
  const [sttStatus, setSttStatus] = useState("idle"); // idle | listening | error | unsupported
  const [sttInterim, setSttInterim] = useState("");
  const [analyzingPara, setAnalyzingPara] = useState(false);
  const [sttLang, setSttLang] = useState("hi-IN"); // "en-IN" or "hi-IN" — hi-IN works better for Hinglish/Indian accents
  const [translating, setTranslating] = useState(false);
  const [apiLimitPopup, setApiLimitPopup] = useState(null); // null | "translate" | "insights"
  // Separate fail counters so translate failures don't block Gemini insights
  const translateFailRef = useRef(0);
  const analyzeFailRef = useRef(0);
  // Increased from 3 to 5 — Render cold-start can eat 2-3 timeouts before warming up
  const API_FAIL_LIMIT = 5;
  const _apiFailCountRef = analyzeFailRef; // alias kept for any other usages
  useEffect(() => { try { localStorage.setItem("mcs_mtg_showMine", String(mtgShowMine)); } catch {} }, [mtgShowMine]);
  useEffect(() => { try { if (mtgPendingSearch) localStorage.setItem("mcs_mtg_pendingSearch", mtgPendingSearch); else localStorage.removeItem("mcs_mtg_pendingSearch"); } catch {} }, [mtgPendingSearch]);
  useEffect(() => { try { localStorage.setItem("mcs_mtg_filters", JSON.stringify(mtgFilters)); } catch {} }, [mtgFilters]);
  useEffect(() => { try { localStorage.setItem("mcs_mtg_actionView", mtgActionView); } catch {} }, [mtgActionView]);

  const txRef = useRef(null);
  const insightsRef = useRef(null);
  const recognitionRef = useRef(null);
  const paraBufferRef = useRef(""); // accumulates words between silences
  // 2-minute batch analysis refs
  const batchTimerRef = useRef(null);
  const lastAnalyzedCharCountRef = useRef(0); // tracks total chars of txLines already analyzed
  const [batchCountdown, setBatchCountdown] = useState(120); // seconds until next analysis
  const batchCountdownRef = useRef(null);
  const instructions = ensureArray(mtg.guidelines || mtgPresets?.instructions?.[mtg.type] || ["Follow meeting agenda", "Capture all action points", "Assign clear owners and due dates", "Confirm previous actions before closing"]);
  const attendees = ensureArray(mtg.attendees || mtgPresets?.attendeeMap?.[mtg.type]);

  // Auto-scroll transcript
  useEffect(() => { if (txRef.current) txRef.current.scrollTop = txRef.current.scrollHeight; }, [txLines, sttInterim]);
  // Auto-scroll insights
  useEffect(() => { if (insightsRef.current) insightsRef.current.scrollTop = insightsRef.current.scrollHeight; }, [insights]);

  const latestInsightsRef = useRef(insights);
  useEffect(() => { latestInsightsRef.current = insights; }, [insights]);

  // ── Smart Translate: Only translate if Hindi (Devanagari) text is detected ──
  const translateText = useCallback(async (rawTxt) => {
    if (!rawTxt || rawTxt.trim().length < 2) return rawTxt;

    // Detect if text contains Devanagari (Hindi script) — if yes, translate; if no, keep as-is
    const hasDevanagari = /[\u0900-\u097F]/.test(rawTxt);
    if (!hasDevanagari) {
      // Already in Roman/Latin script (English or Hinglish in Roman), no translation needed
      return rawTxt.trim();
    }

    // Back off if backend repeatedly unavailable (translate-specific counter)
    if (translateFailRef.current >= API_FAIL_LIMIT) {
      if (translateFailRef.current === API_FAIL_LIMIT) setApiLimitPopup("translate");
      return rawTxt.trim();
    }

    if (!API_BASE_URL) return rawTxt.trim();

    try {
      setTranslating(true);
      const res = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token") || ""}` },
        body: JSON.stringify({ text: rawTxt.trim(), source: "hi", target: "en" })
      });
      const data = await res.json();
      setTranslating(false);
      translateFailRef.current = 0; // reset on success
      return data.translated || rawTxt;
    } catch (e) { console.warn("Translation failed (backend offline?):", e); setTranslating(false); translateFailRef.current++; if (translateFailRef.current >= API_FAIL_LIMIT) setApiLimitPopup("translate"); return rawTxt; }
  }, [/* no deps */]);

  // ── Analyze a paragraph via backend Gemini ───────────────────────────────
  const analyzeParagraph = useCallback(async (para) => {
    if (!para || para.trim().length < 20) return;
    if (!API_BASE_URL) { console.warn("Insights skipped: VITE_API_BASE_URL not set in .env"); return; }
    // Back off only if Gemini/analyze endpoint itself is repeatedly failing
    if (analyzeFailRef.current >= API_FAIL_LIMIT) {
      if (analyzeFailRef.current === API_FAIL_LIMIT) setApiLimitPopup("insights");
      console.warn("Insights paused: backend analyze endpoint failed 3 times. Is the server running?");
      return;
    }
    setAnalyzingPara(true);
    try {
      const hasDevanagari = /[\u0900-\u097F]/.test(para);
      const source_lang = hasDevanagari ? "hi" : "en";

      const res = await fetch(`${API_BASE_URL}/api/meetings/analyze-paragraph`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${getAuthToken() || localStorage.getItem("mcs_token") || ""}` },
        body: JSON.stringify({
          paragraph: para.trim(),
          meeting_type: mtg.type,
          source_lang: source_lang
        })
      });
      const parsed = await res.json();
      analyzeFailRef.current = 0; // reset on success

      // Show error toast if backend signals a problem (e.g. Gemini returned garbage)
      if (parsed.error) {
        console.warn("AI insight warning:", parsed.error);
      }

      const insight = {
        id: Date.now(),
        para: para.trim(),
        ts: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        actions: (parsed.actions || []).map((a, i) => ({ ...a, id: Date.now() + i, _staged: false })),
        decisions: parsed.decisions || [],
        risks: parsed.risks || [],
        keyPoints: parsed.keyPoints || []
      };
      setInsights(p => {
        const existingActionTexts = p.flatMap(ins => ensureArray(ins.actions).map(a => a.text.toLowerCase()));
        const newActions = insight.actions.filter(a => {
          const txt = a.text.toLowerCase();
          return !existingActionTexts.some(ext => txt.includes(ext) || ext.includes(txt));
        });
        insight.actions = newActions;
        if (insight.actions.length || insight.decisions.length || insight.risks.length || insight.keyPoints.length) {
          return [...p, insight];
        }
        return p;
      });
    } catch (e) {
      analyzeFailRef.current++;
      if (analyzeFailRef.current >= API_FAIL_LIMIT) setApiLimitPopup("insights");
      console.warn(`Insight analysis failed (attempt ${analyzeFailRef.current}/${API_FAIL_LIMIT}). Is the backend running at ${API_BASE_URL}?`, e);
    }
    setAnalyzingPara(false);
  }, [mtg.type, setInsights]);

  // ── Start Chrome STT ──────────────────────────────────────────────────────
  // hi-IN works better for Indian-accented speech and Hinglish (Hindi+English mix)
  const startSTT = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttStatus("unsupported"); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = sttLang;
    r.maxAlternatives = 1;

    r.onstart = () => setSttStatus("listening");
    r.onerror = (e) => {
      if (e.error === "no-speech") return; // benign
      setSttStatus("error");
      console.warn("STT error:", e.error);
    };
    r.onend = () => {
      // Auto-restart if meeting still running
      if (recognitionRef.current && running) {
        try { recognitionRef.current.start(); } catch (_ex) { }
      }
    };

    r.onresult = (e) => {
      let interimTxt = "", finalTxt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt += t + " ";
        else interimTxt += t;
      }
      setSttInterim(interimTxt);

      if (finalTxt.trim()) {
        paraBufferRef.current += finalTxt;
        // Always run translateText — it internally detects script (Devanagari → translate, Roman → return as-is)
        const processTxt = async (rawTxt) => {
          const displayTxt = await translateText(rawTxt);
          return displayTxt;
        };

        // Process text through smart translation — display only, no per-paragraph analysis
        const rawPara = finalTxt.trim();
        processTxt(rawPara).then(processed => {
          setTxLines(p => {
            const last = p[p.length - 1] || "";
            const combined = last + (last ? " " : "") + processed;
            if (combined.length > 150 || /[.!?।]\s*$/.test(processed)) {
              return [...p.slice(0, -1), combined.trim(), ""];
            }
            return p.length === 0 ? [processed] : [...p.slice(0, -1), combined.trim()];
          });
        });
      }
    };

    recognitionRef.current = r;
    try { r.start(); } catch (_ex) { setSttStatus("error"); }
  }, [running, analyzeParagraph, setTxLines, sttLang, translateText]);

  // ── Stop STT ──────────────────────────────────────────────────────────────
  const stopSTT = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      try { recognitionRef.current.stop(); } catch (_ex) { }
      recognitionRef.current = null;
    }
    setSttStatus("idle");
    setSttInterim("");
    // Analyze any remaining buffer on stop
    if (paraBufferRef.current.trim().length > 10) {
      paraBufferRef.current = "";
    }
  }, []);



  // Latest txLines ref for interval access
  const txLinesRef = useRef(txLines);
  useEffect(() => { txLinesRef.current = txLines; }, [txLines]);

  useEffect(() => {
    if (!running) {
      // Stop batch timer when meeting paused
      clearInterval(batchTimerRef.current);
      clearInterval(batchCountdownRef.current);
      return;
    }
    // ── Reset all failure counters on every meeting start ──────────────────
    // Critical: analyzeFailRef persists for the lifetime of MeetingRoom.
    // If the backend failed 3× during a previous pause (e.g. Render cold-start),
    // insights would be permanently blocked without this reset.
    analyzeFailRef.current = 0;
    translateFailRef.current = 0;
    setApiLimitPopup(null); // clear any lingering "limit reached" popup

    // ── Wake the Render backend before the first 2-min interval fires ──────
    // Render free tier sleeps after inactivity. A fire-and-forget ping here
    // gives it ~30s to warm up before the first real analyze call.
    if (API_BASE_URL) {
      fetch(`${API_BASE_URL}/api/ping`, { method: "GET" }).catch(() => {});
    }

    // Reset countdown and analyzed char count
    setBatchCountdown(120);
    lastAnalyzedCharCountRef.current = 0;

    // Countdown every second
    batchCountdownRef.current = setInterval(() => {
      setBatchCountdown(c => {
        if (c <= 1) return 120; // reset after triggering
        return c - 1;
      });
    }, 1000);

    // Main 2-minute analysis interval
    batchTimerRef.current = setInterval(() => {
      const lines = txLinesRef.current || [];
      const fullText = lines.filter(l => l.trim()).join(" ").trim();
      const alreadyAnalyzed = lastAnalyzedCharCountRef.current;
      const newText = fullText.slice(alreadyAnalyzed).trim();
      if (newText.length >= 20) {
        analyzeParagraph(newText);
        lastAnalyzedCharCountRef.current = fullText.length;
      }
      setBatchCountdown(120); // reset countdown
    }, 120000); // 2 minutes

    return () => {
      clearInterval(batchTimerRef.current);
      clearInterval(batchCountdownRef.current);
    };
  }, [running, analyzeParagraph]);

  // When meeting stops, do one final analysis of remaining unanalyzed transcript
  useEffect(() => {
    if (!running && txLines.length > 0) {
      const fullText = txLines.filter(l => l.trim()).join(" ").trim();
      const alreadyAnalyzed = lastAnalyzedCharCountRef.current;
      const newText = fullText.slice(alreadyAnalyzed).trim();
      if (newText.length >= 20) {
        analyzeParagraph(newText);
        lastAnalyzedCharCountRef.current = fullText.length;
      }
    }
  }, [running]);// eslint-disable-line

  // Start/stop STT with meeting running state
  useEffect(() => {
    if (running) startSTT();
    else stopSTT();
    return () => stopSTT();
  }, [running]);// eslint-disable-line

  const hms = s => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const triggerManualAnalysis = () => {
    if (analyzingPara) return;
    const lines = txLinesRef.current || [];
    const fullText = lines.filter(l => l.trim()).join(" ").trim();
    const alreadyAnalyzed = lastAnalyzedCharCountRef.current;
    const newText = fullText.slice(alreadyAnalyzed).trim();
    if (newText.length >= 20) {
      analyzeParagraph(newText);
      lastAnalyzedCharCountRef.current = fullText.length;
      setBatchCountdown(120);
    }
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

  const stopAndStage = () => {
    stopSTT();
    setRunning(false);
    // Gather all AI-suggested actions from insights
    const aiActions = (Array.isArray(insights) ? insights : []).flatMap(ins =>
      ensureArray(ins.actions).map((a, _i) => ({
        id: Date.now() + Math.random(),
        text: a.text,
        responsible: a.responsible || null,
        priority: a.priority || "NORMAL",
        section: a.section || "General",
        src: mtg.type,
        srcId: mtg.id || null,
        plant: mtg.plant,
        status: "IN PROCESS",
        revisions: 0, revisionHistory: [],
        created: todayStr(), closedOn: null,
        dateOfAction: todayStr(),
        fromTranscript: true,
        fromInsights: true,
        project: mtg.project || null,
        messages: [], pendingConfirmation: false,
        due: ""
      }))
     );
    setPhase({ fromFast: [], txActions: aiActions });
  };

  // ── Stage action from insight card ───────────────────────────────────────
  const stageInsightAction = (insId, actId) => {
    setInsights(p => p.map(ins => ins.id === insId ? {
      ...ins,
      actions: ins.actions.map(a => a.id === actId ? { ...a, _staged: true } : a)
    } : ins));
  };

  if (phase !== "live") {
    const { fromFast, txActions } = phase;
    return <StagingArea staged={[...(fromFast || []), ...(txActions || [])]} mtg={mtg} plants={plants} depts={depts} users={users} txLines={txLines} onCommit={rows => { onCommit(rows); onCloseMeeting(); }} onCloseMeeting={onCloseMeeting} onBack={() => setPhase("live")} elapsedSecs={elapsed} currentUser={currentUser} />;
  }

  /* ── Paused Meeting Prompt ─────────────────────────────────────── */
  /* When meeting was stopped (running=false) but session data exists, 
     show Resume/Exit choice instead of jumping into live view */
  const hasSessionData = (elapsed || 0) > 0 || (Array.isArray(txLines) && txLines.filter(l => l.trim()).length > 0) || (Array.isArray(insights) && insights.length > 0);
  if (!running && hasSessionData && !exitConfirm) {
    const wordCount = txLines.join(" ").split(" ").filter(Boolean).length;
    const actionCount = (Array.isArray(insights) ? insights : []).reduce((n, ins) => n + ensureArray(ins.actions).length, 0);
    return (
      <div className="fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
        <div style={{ width: 520, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.amber + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px", border: `3px solid ${T.amber}40` }}>⏸</div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: T.navy, marginBottom: 8 }}>Meeting Paused</h1>
          <div style={{ fontSize: 14, color: T.text2, marginBottom: 24 }}>{mtg.type} · {mtg.plant}</div>

          {/* Session summary */}
          <div className="card" style={{ padding: 20, marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Session Summary</div>
            <div className="grid-3col" style={{ gap: 14 }}>
              {[
                { icon: "⏱", label: "Duration", value: hms(elapsed || 0), color: T.navy },
                { icon: "📝", label: "Words Captured", value: wordCount, color: T.amber },
                { icon: "⚡", label: "Actions Found", value: actionCount, color: T.green },
              ].map(k => (
                <div key={k.label} style={{ textAlign: "center", padding: "10px 0", borderRadius: 10, background: k.color + "08", border: `1px solid ${k.color}20` }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: T.text2, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
            <button className="btn btn-navy" style={{ padding: "14px 32px", fontSize: 15, borderRadius: 12 }} onClick={() => setRunning(true)}>
              ▶ Resume Meeting
            </button>
            <button className="btn btn-amber" style={{ padding: "14px 32px", fontSize: 15, borderRadius: 12 }} onClick={stopAndStage}>
              ⏹ Stop & Review Actions
            </button>
          </div>

          {/* Exit option */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginTop: 8 }}>
            <button onClick={() => { try { stopSTT(); } catch (_e) { } onCloseMeeting && onCloseMeeting(); }} style={{ border: "none", background: "transparent", color: T.red, cursor: "pointer", fontSize: 12, fontWeight: 600, opacity: .7 }}>
              🚪 Exit without saving
            </button>
          </div>
        </div>
      </div>
    );
  }
  // Reset exitConfirm if we get back to running
  if (running && exitConfirm) setExitConfirm(false);

  const pendingRelated = (Array.isArray(relatedActions) ? relatedActions : [])
    .filter(a => a && a.status !== "DROPPED")
    .sort((a, b) => {
      const over_a = isOverdue(a) ? -1 : 0, over_b = isOverdue(b) ? -1 : 0;
      if (over_a !== over_b) return over_a - over_b;
      if (!a.due) return 1; if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  const myPending = pendingRelated.filter(a => responsibleMatchesUsers(a.responsible, [(currentUser?.name || "").toLowerCase()]) || a.allocatedBy === currentUser?.name);
  const displayPending = mtgShowMine ? myPending : pendingRelated;

  const insightCount = insights.reduce((n, ins) => n + ensureArray(ins.actions).length + ensureArray(ins.decisions).length + ensureArray(ins.risks).length + ensureArray(ins.keyPoints).length, 0);

  return (
    <div className="fade-in">
      {/* API Limit Popup */}
      {apiLimitPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,.25)", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{apiLimitPopup === "translate" ? "🔇" : "🤖"}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: T.red, marginBottom: 8 }}>
              {apiLimitPopup === "translate" ? "Translation Limit Reached" : "AI Insights Limit Reached"}
            </div>
            <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.6, marginBottom: 20 }}>
              {apiLimitPopup === "translate"
                ? "The translation service failed 3 times and has been paused. Transcription will continue in the original language. Please check your backend server at"
                : "The AI insights service failed 3 times and has been paused. Transcription will continue without live insights. Please check your backend server at"}
              <br /><b style={{ color: T.navy }}>{API_BASE_URL || "localhost:8000"}</b>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-ghost" onClick={() => {
                if (apiLimitPopup === "translate") translateFailRef.current = 0;
                else analyzeFailRef.current = 0;
                setApiLimitPopup(null);
              }} style={{ fontSize: 13 }}>🔄 Retry</button>
              <button className="btn btn-navy" onClick={() => setApiLimitPopup(null)} style={{ fontSize: 13 }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "nowrap", overflowX: "auto", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.navy }}>{mtg.type}</h1>
            <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{mtg.plant} · {mtg.time} · Facilitator: <b>{mtg.facilitator}</b>{mtg.project && <> · <b style={{ color: T.amber }}>{mtg.project}</b></>}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* STT Status pill + language indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: sttStatus === "listening" ? "#D5F5E3" : sttStatus === "error" ? "#FADBD8" : sttStatus === "unsupported" ? "#FEF3CD" : "#F0F0F8", fontSize: 11, fontWeight: 600, color: sttStatus === "listening" ? T.green : sttStatus === "error" ? T.red : sttStatus === "unsupported" ? T.amber : T.slate }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sttStatus === "listening" ? "#27AE60" : sttStatus === "error" ? "#C0392B" : sttStatus === "unsupported" ? "#E69903" : "#95A5A6", animation: sttStatus === "listening" ? "blink 1s infinite" : "none", flexShrink: 0 }} />
            {sttStatus === "listening" && "🎙 Listening"}
            {sttStatus === "idle" && "⏸ Mic off"}
            {sttStatus === "error" && "⚠ Mic error"}
            {sttStatus === "unsupported" && "⚠ STT not supported"}
          </div>
          {/* Language badge */}
          <div style={{ fontSize: 10, fontWeight: 700, background: sttLang === "hi-IN" ? T.amber : "#E8E8F0", color: sttLang === "hi-IN" ? T.navy : T.text2, padding: "3px 9px", borderRadius: 12, border: `1px solid ${sttLang === "hi-IN" ? T.amber + "60" : T.border}` }}>
            {sttLang === "hi-IN" ? "🇮🇳 Hinglish Mode" : "EN Mode"}
          </div>
          {/* Language toggle — hi-IN recommended for Hinglish/Indian-accented speech */}
          <div style={{ display: "flex", background: T.border, borderRadius: 8, padding: 2, gap: 0 }}>
            <button onClick={() => { if (!running) setSttLang("en-IN"); }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: running ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, background: sttLang === "en-IN" ? T.navy : "transparent", color: sttLang === "en-IN" ? "#fff" : T.text2, transition: "all .15s", opacity: running ? .6 : 1 }} title={running ? "Stop meeting to switch language" : "English only (pure English)"}>EN</button>
            <button onClick={() => { if (!running) setSttLang("hi-IN"); }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: running ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, background: sttLang === "hi-IN" ? T.navy : "transparent", color: sttLang === "hi-IN" ? "#fff" : T.text2, transition: "all .15s", opacity: running ? .6 : 1 }} title={running ? "Stop meeting to switch language" : "Hinglish: Hindi+English mix, Indian accent"}>🇮🇳 HI/EN</button>
          </div>
          {translating && <span style={{ fontSize: 10, color: T.amber, fontWeight: 600, animation: "blink 1s infinite" }}>🔄 Translating…</span>}
          <div style={{ background: running ? T.red : "#636E72", color: "#fff", borderRadius: 10, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", flexShrink: 0, animation: running ? "blink 1s infinite" : "none" }} />
            <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>{hms(elapsed || 0)}</span>
            {running && <span style={{ fontSize: 9, opacity: .8, fontWeight: 700, letterSpacing: 1 }}>LIVE</span>}
          </div>
          <button className="btn btn-red" style={{ fontWeight: 700 }} onClick={stopAndStage}>⏹ Stop & Review</button>
          <button onClick={() => { try { stopSTT(); } catch (_e) { } onCloseMeeting && onCloseMeeting(); }} style={{ border: `1.5px solid ${T.red}`, background: "transparent", color: T.red, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }} title="Exit meeting immediately">🚪 Exit</button>
        </div>
      </div>

      {/* Pending Actions table — clean Actions Register style ribbon */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        {/* Header bar */}
        <div style={{ padding: "12px 16px", borderBottom: `1.5px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", flexWrap: "nowrap", overflowX: "auto", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>📋 {mtg.type} — Action Points</span>
            {insights.flatMap(i => ensureArray(i.actions)).length > 0 && (
              <span style={{ background: T.amber + "20", color: T.amber, border: `1px solid ${T.amber}40`, borderRadius: 10, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>
                +{insights.flatMap(i => ensureArray(i.actions)).length} from this meeting
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
            <span style={{ fontSize: 11, color: T.text2 }}>{mtgShowMine ? myPending.length : pendingRelated.length} existing</span>
            {/* All / Mine toggle */}
            <div style={{ display: "flex", background: T.bg, borderRadius: 8, padding: 3, border: `1.5px solid ${T.border}` }}>
              <button onClick={() => setMtgShowMine(false)} style={{ padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: !mtgShowMine ? T.navy : "transparent", color: !mtgShowMine ? "#fff" : T.text2, transition: "all .18s" }}>All</button>
              <button onClick={() => setMtgShowMine(true)} style={{ padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: mtgShowMine ? T.navy : "transparent", color: mtgShowMine ? "#fff" : T.text2, transition: "all .18s" }}>Mine</button>
            </div>
            {/* View toggle — matches Actions Register */}
            <div style={{ display: "flex", gap: 3, borderLeft: `1px solid ${T.border}`, paddingLeft: 8 }}>
              {[
                { v: "table", icon: "☰", l: "Table" },
                { v: "board", icon: "⊞", l: "Board" },
                { v: "kanban", icon: "▦", l: "Kanban" },
                { v: "timeline", icon: "━", l: "Timeline" },
              ].map(x => (
                <button key={x.v} onClick={() => setMtgActionView(x.v)}
                  style={{ padding: "4px 11px", borderRadius: 7, border: `1.5px solid ${mtgActionView === x.v ? T.navy : T.border}`, background: mtgActionView === x.v ? T.navy : "transparent", color: mtgActionView === x.v ? "#fff" : T.text2, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all .15s" }}>
                  {x.icon} {x.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter ribbon — matches Actions Register style */}
        <div className="filter-bar" style={{ padding: "10px 16px", background: "#fff", borderBottom: `1px solid ${T.border}`, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <input
              value={mtgPendingSearch || ""}
              onChange={e => setMtgPendingSearch && setMtgPendingSearch(e.target.value)}
              placeholder="🔍 Search actions…"
              style={{ width: 180, fontSize: 12, padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: 6, outline: "none", fontFamily: "inherit" }}
            />
          </div>
          {[
            { label: "STATUS", key: "mtgStatus", opts: STATUS_LIST },
            { label: "PRIORITY", key: "mtgPriority", opts: PRIORITY_LIST },
            { label: "DEPT", key: "mtgSection", opts: scopedDepts(currentUser, depts).map(d => d.name) },
          ].map(({ label, key, opts }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .4 }}>{label}</span>
              <select
                value={(mtgFilters || {})[key] || ""}
                onChange={e => setMtgFilters && setMtgFilters(f => ({ ...f, [key]: e.target.value }))}
                style={{ fontSize: 12, padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.text, minWidth: 110, fontFamily: "inherit" }}
              >
                <option value="">{label === "STATUS" ? "All" : label === "PRIORITY" ? "All" : "All"}</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {(Object.values(mtgFilters || {}).some(v => v) || mtgPendingSearch) && (
            <button
              onClick={() => { setMtgFilters && setMtgFilters({}); setMtgPendingSearch && setMtgPendingSearch(""); }}
              style={{ alignSelf: "flex-end", fontSize: 12, padding: "5px 14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text2, cursor: "pointer", fontFamily: "inherit" }}
            >✕ Clear</button>
          )}
          <div style={{ marginLeft: "auto", alignSelf: "flex-end", fontSize: 12, color: T.text2, fontWeight: 500 }}>
            {pendingRelated.length}/{pendingRelated.length} shown
          </div>
        </div>
        {/* AI-identified actions from current meeting */}
        {insights.flatMap(ins => ensureArray(ins.actions)).length > 0 && (
          <div style={{ padding: "10px 18px", background: T.amber + "10", borderBottom: `1.5px solid ${T.amber}30` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>⚡ Discussed in This Meeting (AI-Identified)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {insights.flatMap(ins => ensureArray(ins.actions)).filter((a, idx, arr) => arr.findIndex(x => x.text === a.text) === idx).map((a, i) => (
                <div key={a.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: a._staged ? T.greenL : "#fff", borderRadius: 7, padding: "6px 10px", border: `1px solid ${a._staged ? T.green + "50" : T.amber + "40"}` }}>
                  <span style={{ fontSize: 11, color: T.amber, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{a.text}</div>
                    {a.responsible && <div style={{ fontSize: 10, color: T.text2, marginTop: 1 }}>→ {a.responsible}</div>}
                  </div>
                  <PBadge p={a.priority || "NORMAL"} />
                  {a._staged && <span style={{ fontSize: 10, color: T.green, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Staged</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {(() => {
          const filteredPending = displayPending.filter(a => {
            if (mtgPendingSearch && ![a.text, a.responsible, a.sn].join(" ").toLowerCase().includes((mtgPendingSearch || "").toLowerCase())) return false;
            if ((mtgFilters || {}).mtgStatus && a.status !== mtgFilters.mtgStatus) return false;
            if ((mtgFilters || {}).mtgPriority && a.priority !== mtgFilters.mtgPriority) return false;
            if ((mtgFilters || {}).mtgSection && a.section !== mtgFilters.mtgSection) return false;
            return true;
          });
          const mtgUpStatus = (id, status) => {
            if (!setActions) return;
            const patch = normalizeActionPatch({ status });
            setActions(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...patch } : a));
            apiUpdate("actions", id, patch).then(saved => {
              if (saved && saved.id) setActions(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...saved } : a));
            }).catch(err => {
              console.error("Action update failed:", err);
              if (fetchData) fetchData();
            });
          };
          const mtgUpAction = (id, patch) => {
            if (!setActions) return;
            const np = normalizeActionPatch(patch);
            setActions(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...np } : a));
            apiUpdate("actions", id, np).then(saved => {
              if (saved && saved.id) setActions(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...saved } : a));
            }).catch(err => {
              console.error("Action update failed:", err);
              if (fetchData) fetchData();
            });
          };
          const canDrag = !!setActions;
          if (filteredPending.length === 0) return (
            <div style={{ padding: "14px 18px", fontSize: 12, color: T.text2 }}>No pending actions linked to this meeting type or project.</div>
          );
          if (mtgActionView === "table") return (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              <TableView fa={filteredPending} upStatus={mtgUpStatus} setSel={a => setSelAction(a)} canEdit={canDrag} upAction={mtgUpAction} users={users} />
            </div>
          );
          if (mtgActionView === "board") return (
            <div style={{ maxHeight: 340, overflowY: "auto", padding: 12 }}>
              <BoardView fa={filteredPending} setSel={a => setSelAction(a)} users={users} />
            </div>
          );
          if (mtgActionView === "kanban") return (
            <div style={{ padding: 12, overflowX: "auto" }}>
              <KanbanView fa={filteredPending} upStatus={mtgUpStatus} canEdit={canDrag} users={users} setSel={a => setSelAction(a)} />
            </div>
          );
          if (mtgActionView === "timeline") return (
            <div style={{ maxHeight: 340, overflowY: "auto", padding: 12 }}>
              <TimelineView fa={filteredPending} />
            </div>
          );
          return null;
        })()}
      </div>

      {/* 3-col: Transcript | Insights | Guidelines */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 320px", gap: 14 }}>

        {/* Live Transcript */}
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>🎙 Live Transcript</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button className="btn btn-ghost"
                onClick={exportTranscript}
                disabled={!txLines || txLines.length === 0}
                style={{ padding: "2px 8px", fontSize: 10, height: 22, borderColor: T.border }}>
                📥 Export
              </button>
              {analyzingPara && <span style={{ fontSize: 10, color: T.amber, fontWeight: 600, animation: "blink 1s infinite" }}>⚡ Analyzing…</span>}
              {running && sttStatus === "listening" && <span style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>● REC</span>}
            </div>
          </div>
          <div ref={txRef} style={{ background: T.bg, borderRadius: 8, padding: 12, flex: 1, minHeight: 240, maxHeight: 360, overflowY: "auto", fontSize: 12, lineHeight: 2, color: "#444" }}>
            {txLines.length === 0 && !sttInterim
              ? <span style={{ color: "#B2BEC3" }}>{sttStatus === "unsupported" ? "Chrome STT not supported. Actions will be captured via AI insights." : "Microphone ready. Start speaking — transcript appears here in real time."}</span>
              : <>
                {txLines.filter(l => l.trim()).map((l, i) => (
                  <div key={i} style={{ padding: "3px 0", borderBottom: i < txLines.length - 1 ? `1px solid ${T.border}` : "", display: "flex", gap: 8 }}>
                    <span style={{ color: T.text2, fontSize: 10, flexShrink: 0, marginTop: 3 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: l.toLowerCase().includes("action") || l.toLowerCase().includes(" to ") ? T.navy : T.text }}>{l}</span>
                  </div>
                ))}
                {sttInterim && (
                  <div style={{ padding: "3px 0", opacity: .5, fontStyle: "italic", display: "flex", gap: 8 }}>
                    <span style={{ color: T.text2, fontSize: 10, flexShrink: 0, marginTop: 3 }}>…</span>
                    <span>{sttInterim}</span>
                  </div>
                )}
              </>
            }
          </div>
          <div style={{ fontSize: 10, color: T.text2, textAlign: "center" }}>
            {txLines.filter(l => l.trim()).length} paragraphs · {txLines.join(" ").split(" ").filter(Boolean).length} words
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>⚡ AI Insights</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button className="btn btn-navy btn-sm"
                onClick={triggerManualAnalysis}
                disabled={analyzingPara || !running || (txLines.filter(l => l.trim()).join(" ").trim().slice(lastAnalyzedCharCountRef.current).trim().length < 20)}
                style={{ padding: "2px 8px", fontSize: 10, height: 22 }}>
                {analyzingPara ? <Spin /> : "🧠 Get Insights"}
              </button>
              {insightCount > 0 && <span style={{ background: T.navy, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{insightCount}</span>}
              {analyzingPara && <span style={{ width: 12, height: 12, border: "2px solid #E69903", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />}
            </div>
          </div>
          {/* 2-min countdown bar */}
          {running && (
            <div style={{ background: T.bg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: .5 }}>Next AI Analysis</span>
                  <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "monospace", color: batchCountdown <= 10 ? T.red : batchCountdown <= 30 ? T.amber : T.navy }}>
                    {Math.floor(batchCountdown / 60)}:{String(batchCountdown % 60).padStart(2, "0")}
                  </span>
                </div>
                <div style={{ background: T.border, borderRadius: 4, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, background: batchCountdown <= 10 ? T.red : batchCountdown <= 30 ? T.amber : `linear-gradient(90deg,${T.navy},${T.amber})`, width: `${((120 - batchCountdown) / 120) * 100}%`, transition: "width 1s linear" }} />
                </div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: batchCountdown <= 10 ? T.red + "15" : T.navy + "10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, animation: batchCountdown <= 10 ? "blink 1s infinite" : "none" }}>
                🧠
              </div>
            </div>
          )}
          <div ref={insightsRef} style={{ flex: 1, minHeight: 240, maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.length === 0
              ? <div style={{ textAlign: "center", padding: "32px 12px", color: T.text2 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🧠</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>AI insights appear here</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Transcript is analyzed every <b>2 minutes</b> for action items, decisions, and risks.</div>
              </div>
              : insights.map(ins => (
                <div key={ins.id} style={{ background: T.bg, borderRadius: 10, padding: 12, border: `1px solid ${T.border}`, animation: "fadeIn .4s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: T.text2, fontWeight: 600 }}>🕐 {ins.ts}</div>
                    <span style={{ fontSize: 9, background: T.navy + "15", color: T.navy, padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>2-min batch</span>
                  </div>
                   <div style={{ fontSize: 11, color: "#555", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5, borderLeft: `2px solid ${T.amber}`, paddingLeft: 8 }}>"{(ins.para || "").slice(0, 200)}{(ins.para || "").length > 200 ? "…" : ""}"</div>
                  {ensureArray(ins.actions).length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.navy, marginBottom: 4, textTransform: "uppercase", letterSpacing: .5 }}>Actions</div>
                      {ensureArray(ins.actions).map(a => (
                        <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4, background: a._staged ? "#D5F5E3" : "#fff", borderRadius: 6, padding: "5px 8px", border: `1px solid ${a._staged ? T.green + "40" : T.border}` }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: T.text }}>{a.text}</div>
                            {a.responsible && <div style={{ fontSize: 10, color: T.text2, marginTop: 1 }}>→ {a.responsible}</div>}
                          </div>
                          <PBadge p={a.priority || "NORMAL"} />
                          {a._staged
                            ? <span style={{ fontSize: 10, color: T.green, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Staged</span>
                            : <button onClick={() => stageInsightAction(ins.id, a.id)} style={{ border: `1px solid ${T.navy}`, borderRadius: 5, background: T.navy, color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 700, padding: "2px 7px", whiteSpace: "nowrap" }}>+ Add</button>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                  {ensureArray(ins.decisions).length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.green, marginBottom: 3, textTransform: "uppercase", letterSpacing: .5 }}>✅ Decisions</div>
                      {ensureArray(ins.decisions).map((d, i) => <div key={i} style={{ fontSize: 11, color: T.text, padding: "2px 0", paddingLeft: 8, borderLeft: `2px solid ${T.green}` }}>{d}</div>)}
                    </div>
                  )}
                  {ensureArray(ins.risks).length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.red, marginBottom: 3, textTransform: "uppercase", letterSpacing: .5 }}>⚠ Risks</div>
                      {ensureArray(ins.risks).map((r, i) => <div key={i} style={{ fontSize: 11, color: T.text, padding: "2px 0", paddingLeft: 8, borderLeft: `2px solid ${T.red}` }}>{r}</div>)}
                    </div>
                  )}
                  {ensureArray(ins.keyPoints).length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.slate, marginBottom: 3, textTransform: "uppercase", letterSpacing: .5 }}>💡 Key Points</div>
                      {ensureArray(ins.keyPoints).map((k, i) => <div key={i} style={{ fontSize: 11, color: T.text, padding: "2px 0", paddingLeft: 8, borderLeft: `2px solid ${T.slate}` }}>{k}</div>)}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
          <div style={{ fontSize: 10, color: T.text2, textAlign: "center" }}>
            {insights.length} batch{insights.length !== 1 ? "es" : ""} analyzed · {insights.reduce((n, i) => n + ensureArray(i.actions).length, 0)} actions found
          </div>
        </div>

        {/* Guidelines */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: T.navy, marginBottom: 8 }}>📌 Meeting Guidelines</div>
          <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, margin: 0, marginBottom: 12 }}>
            {instructions.map((s, i) => <li key={i} style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{s}</li>)}
          </ol>
          {attendees.length > 0 && <>
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: T.navy, marginBottom: 5 }}>Expected Attendees</div>
              <div style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 5 }}>
                {attendees.map((name, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: T.bg, borderRadius: 6, padding: "2px 7px" }}>
                    <Avatar name={name} size={16} users={users} /><span style={{ fontSize: 11 }}>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>}
          {/* ── Exit Meeting Section ── */}
          <div style={{ borderTop: `1.5px solid ${T.red}30`, marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: T.red, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>🚪 Exit Meeting</div>
            <div style={{ fontSize: 11, color: T.text2, marginBottom: 10, lineHeight: 1.5 }}>Leave this meeting without saving any actions. Use <b>Stop & Review</b> above to save your work first.</div>
            <button onClick={() => { try { stopSTT(); } catch (_e) { } onCloseMeeting && onCloseMeeting(); }} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", color: T.red, borderColor: T.red + "50" }}>Exit Meeting</button>
          </div>
        </div>
      </div>

      {selAction && <ActionDetailPanel action={selAction} onClose={() => setSelAction(null)} onUpdate={() => { }} user={currentUser} users={users} allUsers={users} plants={plants} machines={machines} />}
    </div>
  );
}

/* ADD ACTION SIDE PANEL */
