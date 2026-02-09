import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../ui/api.js";
import { setSession, getTenant } from "../lib/auth.js";

export default function AuthPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState("login");
  const [tenant, setTenant] = useState(getTenant());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function doLogin() {
    setStatus("Entrando...");
    try {
      const { data } = await apiFetch("/api/auth/login", {
        method: "POST",
        org: tenant,
        body: { tenant, email, password },
      });
      if (data.user?.role === "admin" || data.user?.approved_at) {
        setSession({ token: data.access_token, user: data.user, tenant });
        nav(data.user?.role === "admin" ? "/admin" : "/app");
      } else {
        setStatus("Conta criada. Aguardando aprovação do admin para liberar acesso.");
        setTab("login");
      }
    } catch (e) {
      if ((e.message || "").toLowerCase().includes("pending approval")) {
        setStatus("Sua conta ainda está pendente de aprovação do admin.");
      } else {
        setStatus(e.message || "Falha no login");
      }
    }
  }

  async function doRegister() {
    setStatus("Criando conta...");
    try {
      const { data } = await apiFetch("/api/auth/register", {
        method: "POST",
        org: tenant,
        body: { tenant, email, name, password },
      });
      if (data.user?.role === "admin" || data.user?.approved_at) {
        setSession({ token: data.access_token, user: data.user, tenant });
        nav(data.user?.role === "admin" ? "/admin" : "/app");
      } else {
        setStatus("Conta criada. Aguardando aprovação do admin para liberar acesso.");
        setTab("login");
      }
    } catch (e) {
      setStatus(e.message || "Falha no registro");
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui", background: "#fff", borderRadius: 16 }}>
      <h2 style={{ marginBottom: 4 }}>Acesso</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("login")} style={tabBtn(tab === "login")}>Login</button>
        <button onClick={() => setTab("register")} style={tabBtn(tab === "register")}>Registrar</button>
      </div>

      <label style={lbl}>Tenant</label>
      <input style={inp} value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="public" />

      {tab === "register" ? (
        <>
          <label style={lbl}>Nome</label>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
        </>
      ) : null}

      <label style={lbl}>Email</label>
      <input style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" />

      <label style={lbl}>Senha</label>
      <input style={inp} value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        {tab === "login" ? (
          <button style={btnPrimary} onClick={doLogin}>Entrar</button>
        ) : (
          <button style={btnPrimary} onClick={doRegister}>Criar conta</button>
        )}
        <button style={btnSecondary} onClick={() => nav("/")}>Voltar</button>
      </div>

      {status ? <p style={{ marginTop: 14, color: "#444" }}>{status}</p> : null}
    </div>
  );
}

const lbl = { display: "block", marginTop: 12, marginBottom: 6, color: "#333" };
const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", color: "#111" };
const btnPrimary = { background: "#111", color: "#fff", padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer" };
const btnSecondary = { background: "#f3f3f3", color: "#111", padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" };
const tabBtn = (active) => ({
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid " + (active ? "#111" : "#ddd"),
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#111",
  cursor: "pointer",
});
