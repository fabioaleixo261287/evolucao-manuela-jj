import React from "react";
import BrandLockup from "../components/BrandLockup.jsx";

export function RoleSelectionScreen({ onProfessor, onParents, canInstall, onInstall }) {
  return (
    <div className="selection-screen">
      <div className="auth-shell">
        <div className="brand-card">
          <div className="auth-hero-frame"><BrandLockup /></div>
          <div className="auth-hero-copy">
            <h1 className="auth-title">Alliance Jiu Jitsu Kids</h1>
            <p className="auth-subtitle">Sistema de Evolução e Graduação</p>
          </div>
        </div>
        <div className="role-grid">
          <button className="btn-select" onClick={onProfessor}>
            <i className="fas fa-graduation-cap" />
            <span><strong>Professor</strong><small>Gestão da turma</small></span>
          </button>
          <button className="btn-select" onClick={onParents}>
            <i className="fas fa-home" />
            <span><strong>Área dos Pais</strong><small>Acompanhar evolução</small></span>
          </button>
        </div>
        {canInstall && (
          <button className="install-app-btn" onClick={onInstall}>
            <i className="fas fa-download" /> Instalar app
          </button>
        )}
      </div>
    </div>
  );
}

export function LoginScreen({ subMode, auth, onAuthChange, onLogin, onBack }) {
  return (
    <div className="auth-container">
      <div className="auth-shell">
        <div className="login-box">
          <div className="auth-hero-frame"><BrandLockup /></div>
          <h3 className="login-heading">Acesso {subMode === "Pais" ? "dos Pais" : "do Professor"}</h3>
          <input placeholder={subMode === "Professor" ? "Usuário" : "Nome do Aluno"} value={auth.user} onChange={event => onAuthChange({ ...auth, user: event.target.value })} />
          <input type="password" placeholder={subMode === "Professor" ? "Senha" : "Código de acesso do responsável"} value={auth.pass} onChange={event => onAuthChange({ ...auth, pass: event.target.value })} />
          {subMode === "Pais" && <p className="parent-access-help">Esqueceu o código? Solicite à academia uma redefinição segura.</p>}
          <button className="btn-full" style={{ background: "var(--alliance-red)", color: "white" }} onClick={onLogin}>ENTRAR</button>
          <p className="back-link" onClick={onBack}>Voltar à seleção</p>
        </div>
      </div>
    </div>
  );
}
