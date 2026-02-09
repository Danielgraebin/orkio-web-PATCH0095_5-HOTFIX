// Orkio Web - API client helpers (Railway-safe)
// Keeps base URL clean and adds org + auth headers consistently.

import { getTenant, getToken } from "../lib/auth.js";

export function apiBase() {
  const raw = (window.__ORKIO_ENV__?.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "").trim();
  const base = raw.replace(/\/$/, "");
  // Accept both:
  // - https://host (recommended)
  // - https://host/api (legacy)
  return base.endsWith("/api") ? base.slice(0, -4) : base;
}

export function joinApi(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase()}${p}`;
}

export function headers({ token, org, json = true } = {}) {
  const h = {};
  const t = (token ?? getToken() ?? "").trim();
  const o = (org ?? getTenant() ?? "").trim();
  if (json) h["Content-Type"] = "application/json";
  if (t) h["Authorization"] = `Bearer ${t}`;
  // FastAPI Header param: x_org_slug -> header "X-Org-Slug" (aka "x-org-slug")
  if (o) h["X-Org-Slug"] = o;
  return h;
}

// Generic JSON fetch helper
export async function apiFetch(path, { method = "GET", body, token, org, json = true, signal } = {}) {
  const url = joinApi(path);
  const res = await fetch(url, {
    method,
    headers: headers({ token, org, json }),
    body: body == null ? undefined : (json ? JSON.stringify(body) : body),
    signal,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
  if (!res.ok) {
    const msg = (isJson ? (payload?.detail || payload?.message) : payload) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { data: payload, status: res.status };
}

// Upload file to /api/files (multipart)
export async function uploadFile(file, { token, org, agentId, agentIds, threadId, intent, institutionalRequest, linkAllAgents } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  if (agentId) fd.append("agent_id", agentId);
  if (Array.isArray(agentIds) && agentIds.length) fd.append("agent_ids", agentIds.join(","));
  if (threadId) fd.append("thread_id", threadId);
  if (intent) fd.append("intent", intent);
  if (institutionalRequest) fd.append("institutional_request", "true");
  if (linkAllAgents) fd.append("link_all_agents", "true");
  // link_agent default true, but backend will honor intent
  fd.append("link_agent", "true");
  const res = await fetch(joinApi("/api/files/upload"), {
    method: "POST",
    headers: headers({ token, org, json: false }),
    body: fd,
  });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
  if (!res.ok) {
    const msg = (isJson ? (payload?.detail || payload?.message) : payload) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { data: payload, status: res.status };
}

// Chat helper: POST /api/chat { tenant, thread_id, agent_id, message, top_k }
export async function chat({ thread_id = null, agent_id = null, message, top_k = 6, token, org } = {}) {
  const tenant = (org ?? getTenant() ?? "public").trim() || "public";
  return apiFetch("/api/chat", {
    method: "POST",
    token,
    org: tenant,
    body: { tenant, thread_id, agent_id, message, top_k },
  });
}
