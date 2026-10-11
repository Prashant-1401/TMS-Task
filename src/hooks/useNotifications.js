/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { responsibleMatchesUsers } from "../utils/data.js";
import { fmt, isOverdue } from "../utils/helpers.js";

/* ============ NOTIFICATION SYSTEM ============ */
// Generates in-app notifications from audit, actions and user context
export function useNotifications(actions, audit, user, users = []) {
  const [notifs, setNotifs] = useState([]);
  // Track dismissed IDs for this session — cleared notifications won't reappear
  const dismissedIds = useRef(new Set());
  // Track previously seen state per action so we only notify on NEW events
  const seenRef = useRef(new Map());
  const userRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    // Reset baseline when a different user logs in
    if (userRef.current !== user.name) { seenRef.current = new Map(); userRef.current = user.name; }

    const newNotifs = [];
    const now = Date.now();
    const myPlant = user.plant;
    const _myDept = user.dept;
    const _userNameLower = (user.name || "").trim().toLowerCase();

    // Scope: my plant actions (admins with "All" plant see everything)
    const inScope = (a) => {
      if (myPlant === "All") return true;
      if (a.plant && a.plant !== myPlant) return false;
      return true;
    };

    // My subordinates (for allotment targeting)
    const subsSet = new Set();
    const collect = (name) => {
      (users || []).filter(u => u.superior === name).forEach(d => {
        if (!subsSet.has(d.name)) { subsSet.add(d.name); collect(d.name); }
      });
    };
    collect(user.name);
    const myPeople = [user.name, ...subsSet].map(n => (n || "").trim().toLowerCase()).filter(Boolean);
    const isMine = (a) => responsibleMatchesUsers(a.responsible, myPeople);

    const msgKey = (m) => (m.id != null ? String(m.id) : (m.ts || "") + "|" + (m.author || ""));

    // 1. Actions where user is mentioned in messages
    actions.forEach(a => {
      (Array.isArray(a.messages) ? a.messages : []).forEach(m => {
        if (m.text && m.text.includes("@" + user.name) && m.author !== user.name) {
          newNotifs.push({
            id: "msg_" + a.id + "_" + msgKey(m), type: "mention", icon: "💬",
            title: "Mentioned in " + a.sn, body: `${m.author} mentioned you: "${m.text.slice(0, 40)}…"`,
            ts: m.ts || now, read: false, sn: a.sn
          });
        }
      });
    });

    // 2. Actions escalated to user (target matches user role) — only within my scope
    audit.forEach(e => {
      const action = actions.find(a => a.sn === e.sn);
      if (!action || !inScope(action)) return;
      if (e.target === user.role || e.target === "All") {
        newNotifs.push({
          id: "esc_" + e.id, type: "escalation", icon: "🚨",
          title: "Action Escalated to You", body: `${action.sn} — ${(action.text || "").slice(0, 50)} (L${e.level})`,
          ts: e.ts || now, read: false, sn: action.sn
        });
      }
    });

    // 3. My actions with revised due dates (revisions > 0, and I'm responsible)
    actions.filter(a => isMine(a) && a.revisions > 0).forEach(a => {
      const lastRev = a.revisionHistory?.[a.revisionHistory.length - 1];
      if (lastRev) {
        newNotifs.push({
          id: "rev_" + a.id, type: "revision", icon: "📅",
          title: "Due Date Revised", body: `${a.sn} due date changed from ${lastRev.from} to ${lastRev.to} by ${lastRev.by}`,
          ts: lastRev.date || now, read: false, sn: a.sn
        });
      }
    });

    // 4. My overdue actions
    actions.filter(a => isMine(a) && isOverdue(a)).forEach(a => {
      newNotifs.push({
        id: "over_" + a.id, type: "overdue", icon: "⚠",
        title: "Action Overdue", body: `${a.sn} — ${(a.text || "").slice(0, 50)} was due ${fmt(a.due)}`,
        ts: a.due, read: false, sn: a.sn
      });
    });

    // 5. NEW events for actions in my plant/dept scope (delta detection)
    actions.filter(inScope).forEach(a => {
      const prev = seenRef.current.get(a.id);
      const msgs = Array.isArray(a.messages) ? a.messages : [];
      const msgKeys = new Set(msgs.map(msgKey));
      const respKey = Array.isArray(a.responsible) ? a.responsible.join("|") : (a.responsible || "");

      if (!prev) {
        // First time we see this action — seed baseline, no notification
        seenRef.current.set(a.id, { status: a.status, msgs: msgKeys, resp: respKey });
        return;
      }

      // 5a. New remark / thread
      msgs.forEach(m => {
        const k = msgKey(m);
        if (!prev.msgs.has(k) && m.author !== user.name) {
          newNotifs.push({
            id: "rem_" + a.id + "_" + k, type: "remark", icon: "💬",
            title: "New remark on " + a.sn, body: `${m.author}: ${(m.text || "").slice(0, 50)}`,
            ts: m.ts || now, read: false, sn: a.sn
          });
        }
      });

      // 5b. Status changed
      if (prev.status && prev.status !== a.status) {
        newNotifs.push({
          id: "st_" + a.id + "_" + a.status + "_" + (a.revisionHistory?.length || 0), type: "status", icon: "🔄",
          title: "Status changed · " + a.sn, body: `${prev.status} → ${a.status}`,
          ts: now, read: false, sn: a.sn
        });
      }

      // 5c. Action allotted to me / my team
      const prevResp = (prev.resp || "").split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
      const newResp = respKey.split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
      const allottedToMe = newResp.some(r => myPeople.includes(r)) && !prevResp.some(r => myPeople.includes(r));
      if (allottedToMe) {
        newNotifs.push({
          id: "allot_" + a.id + "_" + respKey, type: "allot", icon: "📌",
          title: "Action allotted to you", body: `${a.sn} — ${(a.text || "").slice(0, 50)} assigned to ${(a.responsible || "")}`,
          ts: now, read: false, sn: a.sn
        });
      }

      seenRef.current.set(a.id, { status: a.status, msgs: msgKeys, resp: respKey });
    });

    // Deduplicate, exclude dismissed, and limit
    const deduped = Object.values(newNotifs.reduce((acc, n) => { acc[n.id] = n; return acc; }, {}))
      .filter(n => !dismissedIds.current.has(n.id))
      .sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 50);
    setNotifs(deduped);
  }, [actions, audit, user, users]);

  const unread = notifs.filter(n => !n.read).length;
  const markAllRead = () => {
    // Add all current IDs to dismissed set so they don't come back this session
    notifs.forEach(n => dismissedIds.current.add(n.id));
    setNotifs([]);
  };
  const markRead = (id) => {
    dismissedIds.current.add(id);
    setNotifs(p => p.filter(n => n.id !== id));
  };
  return { notifs, unread, markAllRead, markRead };
}

/* Support message modal */
