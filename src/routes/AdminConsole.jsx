import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, uploadFile, joinApi, headers } from "../ui/api.js";
import { getTenant, getToken, getUser, isAdmin } from "../lib/auth.js";

function Badge({ children }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
      {children}
    </span>
  );
}

function Pill({ children, tone = "muted" }) {
  const cls =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : tone === "bad"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
      : "border-white/10 bg-white/5 text-white/70";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{children}</span>;
}

function fmt(ts) {
  if (!ts) return "-";
  const d = new Date(ts * 1000);
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

// Modal component
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-900 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminConsole() {
  const nav = useNavigate();
  const tenant = getTenant() || "public";
  const token = getToken();
  const user = getUser();

  const adminUploadRef = useRef(null);
  const institutionalUploadRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleAdminUpload(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    ev.target.value = "";
    try {
      setUploading(true);
      await uploadFile(f, { token, org: tenant, agentId: selectedAgentForKnowledge?.id || null, intent: "agent" });
      try { await refreshAll(); } catch (e) { console.warn('refresh after upload failed', e); }
    } catch (e) {
      console.error(e);
      alert("Falha no upload. Veja o console para detalhes.");
    } finally {
      setUploading(false);
    }
  }

  async function handleInstitutionalUpload(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    ev.target.value = "";
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(joinApi("/api/admin/files/upload"), {
        method: "POST",
        headers: headers({ token, org: tenant, json: false }),
        body: fd,
      });
      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");
      const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
      if (!res.ok) {
        const msg = (isJson ? (payload?.detail || payload?.message) : payload) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      try { await refreshAll(); } catch (e) { console.warn('refresh after upload failed', e); }
    } catch (e) {
      console.error(e);
      alert("Falha no upload institucional. Veja o console para detalhes.");
    } finally {
      setUploading(false);
    }
  }


  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [audit, setAudit] = useState([]);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [fileRequests, setFileRequests] = useState([]);
  const [costs, setCosts] = useState(null);
  const [costDays, setCostDays] = useState(7);

  async function refreshAll() {
    // Refresh core admin data; safe to call after uploads/edits
    await Promise.allSettled([
      load("overview"),
      load("users"),
      load("files"),
      load("agents"),
      load("audit"),
      load("approvals"),
      load("fileRequests"),
      load("costs"),
    ]);
  }

  const [agents, setAgents] = useState([]);
  
  // Agent form state
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({
    name: "",
    description: "",
    system_prompt: "",
    model: "",
    embedding_model: "",
    temperature: "",
    rag_enabled: true,
    rag_top_k: 6,
    is_default: false
  });
  
  // Knowledge linking
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [selectedAgentForDelegate, setSelectedAgentForDelegate] = useState(null);
  const [delegateTargetAgentId, setDelegateTargetAgentId] = useState("");
  const [delegateInstruction, setDelegateInstruction] = useState("");
  const [selectedAgentForLinks, setSelectedAgentForLinks] = useState(null);
  const [agentLinks, setAgentLinks] = useState([]);
  const [linkMode, setLinkMode] = useState('consult');
  const [selectedAgentForKnowledge, setSelectedAgentForKnowledge] = useState(null);
  const [agentKnowledge, setAgentKnowledge] = useState([]);
  const [allFiles, setAllFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) nav("/auth");
    if (!isAdmin(user)) nav("/app");
  }, [token]);

  async function load(which) {
    setLoading(true);
    setErr("");
    try {
      if (which === "overview") {
        const res = await apiFetch("/api/admin/overview", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setOverview(data);
      } else if (which === "users") {
        const res = await apiFetch("/api/admin/users", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setUsers(Array.isArray(data) ? data : []);
      } else if (which === "files") {
        const res = await apiFetch("/api/admin/files", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setFiles(Array.isArray(data) ? data : []);
      } else if (which === "agents") {
        const res = await apiFetch("/api/admin/agents", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setAgents(Array.isArray(data) ? data : []);
      } else if (which === "audit") {
        const res = await apiFetch("/api/admin/audit", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setAudit(Array.isArray(data) ? data : []);
      } else if (which === "approvals") {
        const res = await apiFetch("/api/admin/users?status=pending", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setPendingUsers(Array.isArray(data) ? data : []);
      } else if (which === "fileRequests") {
        const res = await apiFetch("/api/admin/file-requests?status=pending", { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setFileRequests(Array.isArray(data) ? data : []);
      } else if (which === "costs") {
        const res = await apiFetch(`/api/admin/costs?days=${encodeURIComponent(costDays)}`, { org: tenant, token });
        const data = res && typeof res === "object" && "data" in res ? res.data : res;
        setCosts(data || null);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("overview");
  }, []);

  useEffect(() => {
    if (tab === "overview") load("overview");
    if (tab === "users") load("users");
    if (tab === "files") { load("files"); load("fileRequests"); }
    if (tab === "agents") load("agents");
    if (tab === "audit") load("audit");
    if (tab === "approvals") load("approvals");
    if (tab === "costs") load("costs");
  }, [tab, costDays]);

  const stats = overview || { tenants: "-", users: "-", threads: "-", messages: "-", files: "-" };

  // Agent CRUD functions
  function openCreateAgent() {
    setEditingAgent(null);
    setAgentForm({
      name: "",
      description: "",
      system_prompt: "Você é um assistente útil e objetivo.",
      model: "gpt-4o-mini",
      embedding_model: "",
      temperature: "0.7",
      rag_enabled: true,
      rag_top_k: 6,
      is_default: false
    });
    setAgentModalOpen(true);
  }

  function openEditAgent(agent) {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name || "",
      description: agent.description || "",
      system_prompt: agent.system_prompt || "",
      model: agent.model || "",
      embedding_model: agent.embedding_model || "",
      temperature: agent.temperature || "",
      rag_enabled: agent.rag_enabled !== false,
      rag_top_k: agent.rag_top_k || 6,
      is_default: agent.is_default || false
    });
    setAgentModalOpen(true);
  }

  async function saveAgent() {
    setLoading(true);
    setErr("");
    try {
      const payload = {
        name: agentForm.name,
        description: agentForm.description || null,
        system_prompt: agentForm.system_prompt,
        model: agentForm.model || null,
        embedding_model: agentForm.embedding_model || null,
        temperature: agentForm.temperature ? parseFloat(agentForm.temperature) : null,
        rag_enabled: agentForm.rag_enabled,
        rag_top_k: parseInt(agentForm.rag_top_k) || 6,
        is_default: agentForm.is_default
      };

      if (editingAgent) {
        await apiFetch(`/api/admin/agents/${editingAgent.id}`, {
          method: "PUT",
          org: tenant,
          token,
          body: payload
        });
      } else {
        await apiFetch("/api/admin/agents", {
          method: "POST",
          org: tenant,
          token,
          body: payload
        });
      }
      setAgentModalOpen(false);
      load("agents");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteAgent(agentId) {
    if (!confirm("Tem certeza que deseja excluir este agente?")) return;
    setLoading(true);
    try {
      await apiFetch(`/api/admin/agents/${agentId}`, {
        method: "DELETE",
        org: tenant,
        token
      });
      load("agents");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Knowledge management
  
  async function openLinksModal(agent) {
    setSelectedAgentForLinks(agent);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/agents/${agent.id}/links`, { org: tenant, token });
      const data = res && typeof res === "object" && "data" in res ? res.data : res;
      const items = Array.isArray(data) ? data : (data?.items || []);
      setAgentLinks(items.map(i => i.target_agent_id));
      setLinkMode(items?.[0]?.mode || "consult");
      setLinksModalOpen(true);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function saveLinks() {
    if (!selectedAgentForLinks?.id) return;
    setLoading(true);
    try {
      await apiFetch(`/api/admin/agents/${selectedAgentForLinks.id}/links`, {
        method: "PUT",
        org: tenant,
        token,
        body: { target_agent_ids: agentLinks, mode: linkMode }
      });
      setLinksModalOpen(false);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }


  function openDelegateModal(sourceAgent) {
    setSelectedAgentForDelegate(sourceAgent);
    setDelegateTargetAgentId("");
    setDelegateInstruction("");
    setDelegateModalOpen(true);
  }

  async function sendDelegate() {
    if (!selectedAgentForDelegate?.id) return;
    if (!delegateTargetAgentId) return alert("Selecione o agente destino.");
    if (!delegateInstruction.trim()) return alert("Escreva a instrução.");
    setLoading(true);
    setErr("");
    try {
      await apiFetch("/api/agents/delegate", {
        method: "POST",
        org: tenant,
        token,
        body: {
          source_agent_id: selectedAgentForDelegate.id,
          target_agent_id: delegateTargetAgentId,
          instruction: delegateInstruction,
          create_thread: true,
          thread_title: `Instrução de ${selectedAgentForDelegate.name || selectedAgentForDelegate.id}`,
        },
      });
      setDelegateModalOpen(false);
      alert("Instrução enviada. Veja a conversa criada no destino.");
    } catch (e) {
      setErr(String(e?.message || e));
      alert("Falha ao enviar instrução. Veja o console/erro.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }


async function openKnowledgeModal(agent) {
    setSelectedAgentForKnowledge(agent);
    setLoading(true);
    try {
      // Load agent's current knowledge links
      const kRes = await apiFetch(`/api/admin/agents/${agent.id}/knowledge`, { org: tenant, token });
      const kData = kRes && typeof kRes === "object" && "data" in kRes ? kRes.data : kRes;
      setAgentKnowledge(Array.isArray(kData) ? kData : []);
      
      // Load all files for selection
      const fRes = await apiFetch("/api/admin/files?institutional_only=true", { org: tenant, token });
      const fData = fRes && typeof fRes === "object" && "data" in fRes ? fRes.data : fRes;
      setAllFiles(Array.isArray(fData) ? fData : []);
      
      setKnowledgeModalOpen(true);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function linkFile(fileId) {
    setLoading(true);
    try {
      await apiFetch(`/api/admin/agents/${selectedAgentForKnowledge.id}/knowledge`, {
        method: "POST",
        org: tenant,
        token,
        body: { file_id: fileId, enabled: true }
      });
      // Refresh knowledge list
      const kRes = await apiFetch(`/api/admin/agents/${selectedAgentForKnowledge.id}/knowledge`, { org: tenant, token });
      const kData = kRes && typeof kRes === "object" && "data" in kRes ? kRes.data : kRes;
      setAgentKnowledge(Array.isArray(kData) ? kData : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function unlinkFile(linkId) {
    setLoading(true);
    try {
      await apiFetch(`/api/admin/agents/${selectedAgentForKnowledge.id}/knowledge/${linkId}`, {
        method: "DELETE",
        org: tenant,
        token
      });
      // Refresh knowledge list
      const kRes = await apiFetch(`/api/admin/agents/${selectedAgentForKnowledge.id}/knowledge`, { org: tenant, token });
      const kData = kRes && typeof kRes === "object" && "data" in kRes ? kRes.data : kRes;
      setAgentKnowledge(Array.isArray(kData) ? kData : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Get linked file IDs for filtering
  const linkedFileIds = new Set(agentKnowledge.map(k => k.file_id));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">Admin</h1>
            <Badge>org: {tenant}</Badge>
            <Badge>{loading ? "loading" : "ready"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              onClick={() => nav("/app")}
            >
              Back to Console
            </button>
            <button
              className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              onClick={() => load(tab)}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["overview", "Overview"],
            ["users", "Users"],
            ["files", "Files"],
            ["agents", "Agents"],
            ["audit", "Audit"],
            ["approvals", "Approvals"],
            ["costs", "Costs"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={
                tab === k
                  ? "rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold"
                  : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              }
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            ⚠️ {err}
          </div>
        ) : null}

        {/* Overview Tab */}
        {tab === "overview" && (
          <>
            <p className="mt-6 text-sm text-white/70">
              Operational metrics for the last window (lightweight by design). Audit is the source of truth.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-5">
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs text-white/60">{k}</div>
                  <div className="mt-2 text-2xl font-extrabold">{String(v)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Users (last 200)</h2>
                <p className="mt-1 text-sm text-white/70">Users across tenants. Sorted by newest.</p>
              </div>
              <Badge>{users.length} rows</Badge>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20">
                    <tr className="text-xs text-white/70">
                      <th className="px-4 py-3 font-semibold">when</th>
                      <th className="px-4 py-3 font-semibold">org</th>
                      <th className="px-4 py-3 font-semibold">name</th>
                      <th className="px-4 py-3 font-semibold">email</th>
                      <th className="px-4 py-3 font-semibold">role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 text-white/70">{fmt(u.created_at)}</td>
                        <td className="px-4 py-3">{u.org_slug}</td>
                        <td className="px-4 py-3">{u.name || "-"}</td>
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">
                          <Pill tone={u.role === "admin" ? "good" : "muted"}>{u.role}</Pill>
                        </td>
                      </tr>
                    ))}
                    {!users.length && !loading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-white/60" colSpan={5}>
                          No users found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Files Tab */}
        {tab === "files" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Files (last 200)</h2>
                <p className="mt-1 text-sm text-white/70">Ingestion & extraction status.</p>
              </div>
              <div className="flex items-center gap-3">
  <input ref={adminUploadRef} type="file" className="hidden" onChange={handleAdminUpload} />
  <button
    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
    onClick={() => adminUploadRef.current?.click()}
    disabled={uploading}
    title="Enviar documento para a base de conhecimento (tenant atual)"
  >
    {uploading ? "Uploading..." : "Upload"}
  </button>
  <Badge>{files.length} rows</Badge>
</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20">
                    <tr className="text-xs text-white/70">
                      <th className="px-4 py-3 font-semibold">when</th>
                      <th className="px-4 py-3 font-semibold">org</th>
                      <th className="px-4 py-3 font-semibold">filename</th>
                      <th className="px-4 py-3 font-semibold">size</th>
                      <th className="px-4 py-3 font-semibold">status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 text-white/70">{fmt(f.created_at)}</td>
                        <td className="px-4 py-3">{f.org_slug}</td>
                        <td className="px-4 py-3">{f.filename}</td>
                        <td className="px-4 py-3 text-white/80">{(f.size_bytes / 1024).toFixed(1)} KB</td>
                        <td className="px-4 py-3">
                          {f.extraction_failed ? <Pill tone="bad">failed</Pill> : <Pill tone="good">ok</Pill>}
                        </td>
                      </tr>
                    ))}
                    {!files.length && !loading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-white/60" colSpan={5}>
                          No files found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Agents Tab */}
        {tab === "agents" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Agent Studio</h2>
                <p className="mt-1 text-sm text-white/70">Create and manage AI agents with custom prompts and knowledge.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{agents.length} agents</Badge>
                <button
                  className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                  onClick={openCreateAgent}
                >
                  + New Agent
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => (
                <div key={a.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{a.name}</h3>
                        {a.is_default && <Pill tone="good">default</Pill>}
                      </div>
                      <p className="mt-1 text-sm text-white/60 line-clamp-2">{a.description || "Sem descrição"}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Pill>{a.model || "gpt-4o-mini"}</Pill>
                    <Pill tone={a.rag_enabled ? "good" : "muted"}>RAG {a.rag_enabled ? "ON" : "OFF"}</Pill>
                    {a.temperature && <Pill>temp: {a.temperature}</Pill>}
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <button
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                      onClick={() => openEditAgent(a)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                      onClick={() => openKnowledgeModal(a)}
                    >
                      Knowledge
                    </button>
                    <button
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                      onClick={() => openLinksModal(a)}
                    >
                      Links
                    </button>
                    <button
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                      onClick={() => openDelegateModal(a)}
                    >
                      Send
                    </button>
                    <button
                      className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-400/20"
                      onClick={() => deleteAgent(a.id)}
                    >
                      Delete
                    </button>
                  </div>
                  
                  <div className="mt-3 text-xs text-white/40">
                    Updated: {fmt(a.updated_at)}
                  </div>
                </div>
              ))}
              
              {!agents.length && !loading ? (
                <div className="col-span-full rounded-3xl border border-dashed border-white/20 p-8 text-center">
                  <p className="text-white/60">No agents yet. Create your first agent to get started.</p>
                </div>
              ) : null}
            </div>
          </>
        )}

        {/* Audit Tab */}
        {tab === "audit" && (
          <>
            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Audit (last 200)</h2>
                <p className="mt-1 text-sm text-white/70">Every request that matters should leave a trace here.</p>
              </div>
              <Badge>{audit.length} rows</Badge>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20">
                    <tr className="text-xs text-white/70">
                      <th className="px-4 py-3 font-semibold">when</th>
                      <th className="px-4 py-3 font-semibold">org</th>
                      <th className="px-4 py-3 font-semibold">action</th>
                      <th className="px-4 py-3 font-semibold">path</th>
                      <th className="px-4 py-3 font-semibold">status</th>
                      <th className="px-4 py-3 font-semibold">ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 text-white/70">{fmt(a.created_at)}</td>
                        <td className="px-4 py-3">{a.org_slug}</td>
                        <td className="px-4 py-3">{a.action}</td>
                        <td className="px-4 py-3 text-white/70">{a.path}</td>
                        <td className="px-4 py-3">{a.status_code}</td>
                        <td className="px-4 py-3">{a.latency_ms}</td>
                      </tr>
                    ))}

        {/* Approvals Tab */}
        {tab === "approvals" && (
          <>
            <p className="mt-6 text-sm text-white/70">
              Novos usuários ficam pendentes até aprovação. Ao aprovar, o usuário precisa fazer login novamente.
            </p>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Pendentes ({pendingUsers.length})</div>
                <button
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                  onClick={() => load("approvals")}
                >
                  Atualizar
                </button>
              </div>

              <div className='text-xs opacity-70 mb-2'>Pendentes: {pendingUsers.length} • Tenant: {tenant}</div>
        {pendingUsers.length === 0 ? (
                <div className="mt-4 text-sm text-white/60">Nenhum usuário pendente.</div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold">{u.name} <span className="text-white/60">({u.email})</span></div>
                        <div className="mt-1 text-xs text-white/60">Tenant: {u.org_slug} • Criado: {fmt(u.created_at)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15"
                          onClick={async () => {
                            await apiFetch(`/api/admin/users/${u.id}/approve`, { method: "POST", org: tenant, token });
                            await refreshAll();
                            setTab("users");
                          }}
                        >
                          Aprovar
                        </button>
                        <button
                          className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/15"
                          onClick={async () => {
                            if (!confirm("Rejeitar e remover este usuário?")) return;
                            await apiFetch(`/api/admin/users/${u.id}/reject`, { method: "POST", org: tenant, token });
                            await refreshAll();
                          }}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Costs Tab */}
        {tab === "costs" && (
          <>
            <p className="mt-6 text-sm text-white/70">
              Painel de tokens (proxy de custos). Valores monetários dependem do seu contrato/modelo; aqui focamos em auditabilidade.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-white/70">Janela:</span>
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  className={
                    costDays === d
                      ? "rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold"
                      : "rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                  }
                  onClick={() => setCostDays(d)}
                >
                  {d}d
                </button>
              ))}
              <button
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                onClick={() => load("costs")}
              >
                Atualizar
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs text-white/60">Total tokens</div>
                <div className="mt-2 text-2xl font-extrabold">{String(costs?.total?.total_tokens ?? "-")}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs text-white/60">Prompt tokens</div>
                <div className="mt-2 text-2xl font-extrabold">{String(costs?.total?.prompt_tokens ?? "-")}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs text-white/60">Completion tokens</div>
                <div className="mt-2 text-2xl font-extrabold">{String(costs?.total?.completion_tokens ?? "-")}</div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold">Por agente</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60">
                      <th className="pb-2">Agente</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2">Prompt</th>
                      <th className="pb-2">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(costs?.per_agent || []).map((r) => (
                      <tr key={r.agent_id || r.agent_name} className="border-t border-white/10">
                        <td className="py-2">{r.agent_name}</td>
                        <td className="py-2">{r.total_tokens}</td>
                        <td className="py-2">{r.prompt_tokens}</td>
                        <td className="py-2">{r.completion_tokens}</td>
                      </tr>
                    ))}
                    {(!costs?.per_agent || costs.per_agent.length === 0) ? (
                      <tr className="border-t border-white/10">
                        <td className="py-3 text-white/60" colSpan={4}>Sem dados (ainda). Faça algumas conversas e volte aqui.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
                    {!audit.length && !loading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-white/60" colSpan={6}>
                          No audit entries yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Agent Create/Edit Modal */}
      <Modal
        open={agentModalOpen}
        onClose={() => setAgentModalOpen(false)}
        title={editingAgent ? "Edit Agent" : "Create Agent"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Name *</label>
            <input
              type="text"
              value={agentForm.name}
              onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              placeholder="e.g., Customer Support Agent"
            />
          </div>
          
          <div>
            <label className="block text-sm text-white/70 mb-1">Description</label>
            <input
              type="text"
              value={agentForm.description}
              onChange={e => setAgentForm({ ...agentForm, description: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Brief description of the agent's purpose"
            />
          </div>
          
          <div>
            <label className="block text-sm text-white/70 mb-1">System Prompt *</label>
            <textarea
              value={agentForm.system_prompt}
              onChange={e => setAgentForm({ ...agentForm, system_prompt: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none h-32 resize-none"
              placeholder="Instructions for the AI agent..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Model</label>
              <select
                value={agentForm.model}
                onChange={e => setAgentForm({ ...agentForm, model: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Default (gpt-4o-mini)</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-white/70 mb-1">Temperature (0-2)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={agentForm.temperature}
                onChange={e => setAgentForm({ ...agentForm, temperature: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
                placeholder="0.7"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">RAG Top K</label>
              <input
                type="number"
                min="1"
                max="20"
                value={agentForm.rag_top_k}
                onChange={e => setAgentForm({ ...agentForm, rag_top_k: parseInt(e.target.value) || 6 })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agentForm.rag_enabled}
                  onChange={e => setAgentForm({ ...agentForm, rag_enabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">RAG Enabled</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agentForm.is_default}
                  onChange={e => setAgentForm({ ...agentForm, is_default: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Default Agent</span>
              </label>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              onClick={() => setAgentModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-50"
              onClick={saveAgent}
              disabled={!agentForm.name || loading}
            >
              {loading ? "Saving..." : (editingAgent ? "Update" : "Create")}
            </button>
          </div>
        </div>
      </Modal>

      
        {/* Agent Links Modal */}
        <Modal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} title={`Links: ${selectedAgentForLinks?.name || ""}`}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Modo</label>
              <select value={linkMode} onChange={(e) => setLinkMode(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white">
                <option value="consult">consult (somar KB no RAG)</option>
                <option value="delegate">delegate (reservado)</option>
              </select>
            </div>

            <div>
              <div className="text-sm text-white/70 mb-2">Vincular a outros agentes:</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {agents.filter(x => x.id !== selectedAgentForLinks?.id).map(x => {
                  const checked = agentLinks.includes(x.id);
                  return (
                    <label key={x.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-sm">{x.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setAgentLinks([...agentLinks, x.id]);
                          else setAgentLinks(agentLinks.filter(id => id !== x.id));
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10" onClick={() => setLinksModalOpen(false)}>
                Cancelar
              </button>
              <button className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400" onClick={saveLinks}>
                Salvar
              </button>
            </div>
          </div>
        </Modal>


        {/* Knowledge Management Modal */}
      
      {/* Delegate Modal */}
      <Modal
        open={delegateModalOpen}
        onClose={() => setDelegateModalOpen(false)}
        title={`Send Instruction: ${selectedAgentForDelegate?.name || ""}`}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/70">Destino</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={delegateTargetAgentId}
              onChange={(e) => setDelegateTargetAgentId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {agents
                .filter(a => a.id !== selectedAgentForDelegate?.id)
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.id})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-white/50">
              Requer um Agent Link com modo <b>delegate</b> do agente origem para o destino.
            </p>
          </div>

          <div>
            <label className="text-sm text-white/70">Instrução</label>
            <textarea
              className="mt-1 w-full min-h-[120px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={delegateInstruction}
              onChange={(e) => setDelegateInstruction(e.target.value)}
              placeholder="Escreva a orientação que o agente destino deve seguir..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              onClick={() => setDelegateModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/20"
              onClick={sendDelegate}
              disabled={loading}
            >
              Enviar
            </button>
          </div>
        </div>
      </Modal>

<Modal
        open={knowledgeModalOpen}
        onClose={() => setKnowledgeModalOpen(false)}
        title={`Knowledge: ${selectedAgentForKnowledge?.name || ""}`}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input ref={adminUploadRef} type="file" className="hidden" onChange={handleAdminUpload} />
            <input ref={institutionalUploadRef} type="file" className="hidden" onChange={handleInstitutionalUpload} />
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => adminUploadRef.current && adminUploadRef.current.click()}
              disabled={uploading}
              title="Faz upload e vincula direto a este agente"
            >
              {uploading ? "Enviando..." : "Upload para este agente"}
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => institutionalUploadRef.current && institutionalUploadRef.current.click()}
              disabled={uploading}
              title="Faz upload institucional (global) para depois vincular a múltiplos agentes"
            >
              {uploading ? "Enviando..." : "Upload institucional"}
            </button>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white/70 mb-2">Linked Documents</h4>
            {agentKnowledge.length === 0 ? (
              <p className="text-sm text-white/50">No documents linked yet.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {agentKnowledge.map(k => {
                  const file = allFiles.find(f => f.id === k.file_id);
                  return (
                    <div key={k.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-sm">{file?.filename || k.file_id}</span>
                      <button
                        className="text-rose-400 hover:text-rose-300 text-xs"
                        onClick={() => unlinkFile(k.id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-white/70 mb-2">Institutional Documents</h4>
            {allFiles.filter(f => !linkedFileIds.has(f.id)).length === 0 ? (
              <p className="text-sm text-white/50">No more documents available.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {allFiles.filter(f => !linkedFileIds.has(f.id)).map(f => (
                  <div key={f.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm">{f.filename}</span>
                    <button
                      className="text-emerald-400 hover:text-emerald-300 text-xs"
                      onClick={() => linkFile(f.id)}
                    >
                      + Link
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-4">
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              onClick={() => setKnowledgeModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
