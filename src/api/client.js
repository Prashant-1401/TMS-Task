/* eslint-disable react-refresh/only-export-components */


const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\+$/, "");

let AUTH_TOKEN = null;
let CURRENT_ROLES = [];
let _onAuthExpired = null;

export function setAuthToken(token) { AUTH_TOKEN = token; }
export function getAuthToken() { return AUTH_TOKEN; }
export function setCurrentRoles(roles) { CURRENT_ROLES = roles || []; }
export function getCurrentRoles() { return CURRENT_ROLES; }
export function setOnAuthExpired(fn) { _onAuthExpired = fn; }

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = AUTH_TOKEN || localStorage.getItem("mcs_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    const p = new URL(url).pathname;
    if (p !== "/api/ping" && !p.startsWith("/api/sessions/")) {
      _onAuthExpired?.();
    }
  }
  if (!res.ok) {
    let detail;
    try { const err = await res.json(); detail = err.detail || res.statusText; } catch { detail = res.statusText; }
    throw new Error(detail || `API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function apiGet(path, params) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(path + qs);
}
export function apiPost(path, body) { return apiFetch(path, { method: "POST", body: JSON.stringify(body) }); }
export function apiPatch(path, body) { return apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }); }
export function apiDelete(path) { return apiFetch(path, { method: "DELETE" }); }

/** Multipart file upload. The auth token must live in the header, never in the URL. */
export async function apiUpload(path, file) {
  const url = `${API_BASE_URL}${path}`;
  const token = AUTH_TOKEN || localStorage.getItem("mcs_token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) _onAuthExpired?.();
  if (!res.ok) {
    let detail;
    try { const err = await res.json(); detail = err.detail || res.statusText; } catch { detail = res.statusText; }
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return res.json();
}
