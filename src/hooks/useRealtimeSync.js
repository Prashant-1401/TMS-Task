/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiPost, getAuthToken } from "../api/client.js";

export function useRealtimeSync({ fetchData, user, enabled = true, intervalMs = 15000 }) {
  const fetchRef = useRef(fetchData);
  useEffect(() => { fetchRef.current = fetchData; }, [fetchData]);

  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  const isEditing = () => {
    const el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
  };

  const sync = useCallback(async () => {
    if (inFlight.current || !enabled || isEditing()) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      await fetchRef.current();
      setLastSync(Date.now());
    } catch (_e) { /* keep previous data; will retry next tick */ }
    finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !user) return;
    const kick = setTimeout(sync, 3000);
    const poll = setInterval(sync, intervalMs);
    const beat = setInterval(() => {
      if (API_BASE_URL && (getAuthToken() || localStorage.getItem("mcs_token"))) {
        apiPost("/api/sessions/heartbeat", {}).catch(() => {});
      }
    }, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    const onFocus = () => sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(kick);
      clearInterval(poll);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, user, intervalMs, sync]);

  return { lastSync, syncing, sync };
}

/* ===================== DATA LAYER ===================== */
