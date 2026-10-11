/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef } from "react";

/* ESC-close hook */
export function useEscClose(fn) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => {
    const h = e => { if (e.key === "Escape") fnRef.current(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
}

/* ===================== LOGIN PAGE ===================== */
