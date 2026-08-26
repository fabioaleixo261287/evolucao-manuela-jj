import React from "react";

export default function CentralDashboard({ model, units, studentsCount, onAddUnit, onManageUsers, onOpenUnit, onLogout }) {
  const { active, activeUnits, activeRate, newThisMonth, exitsThisMonth, netGrowth, retentionRate, rows, unitsWithoutNewEnrollments } = model;
  const maxActive = Math.max(1, ...rows.map(row => row.activeStudents.length));
  const attentionRows = rows.filter(row => row.healthType !== "healthy");
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return JSON.parse(sessionStorage.getItem("alliance_central_collapsed") || "{}"); }
    catch { return {}; }
  });
  const toggleSection = key => setCollapsed(current => {
    const next = { ...current, [key]: !current[key] };
    sessionStorage.setItem("alliance_central_collapsed", JSON.stringify(next));
    return next;
  });
  const collapseButton = (key, label) => (
    <button className="central-collapse-btn" onClick={() => toggleSection(key)} title={`${collapsed[key] ? "Expandir" : "Recolher"} ${label}`} aria-label={`${collapsed[key] ? "Expandir" : "Recolher"} ${label}`}>
      <i className={`fas fa-chevron-${collapsed[key] ? "down" : "up"}`} />
    </button>
  );
  return (
    <section className="central-page">
      <div className="central-hero central-executive-head">
        <div className="central-hero-copy"><span className="central-hero-icon"><i className="fas fa-network-wired" /></span><div><h2>Central da Rede</h2><p>Indicadores operacionais para acompanhar desempenho e decidir onde agir.</p></div></div>
        <div className="central-hero-actions">
          <span className="central-period-chip"><i className="fas fa-calendar-alt" /> Mês atual</span>
          <button className="central-logout-btn" onClick={onLogout} title="Sair do sistema"><i className="fas fa-right-from-bracket" /> Sair</button>
          <button className="dashboard-pdf-btn" onClick={onAddUnit}><i className="fas fa-plus" /> Nova unidade</button>
        </div>
      </div>
      <div className="central-kpis">
        <div className="central-kpi"><span className="central-kpi-icon"><i className="fas fa-building" /></span><strong>{units.length}</strong><span>Unidades em operação</span><small>{activeUnits} ativa{activeUnits === 1 ? "" : "s"} na rede</small></div>
        <div className="central-kpi"><span className="central-kpi-icon"><i className="fas fa-user-graduate" /></span><strong>{studentsCount}</strong><span>Alunos na rede</span><small>{active} ativos atualmente</small></div>
        <div className="central-kpi"><span className="central-kpi-icon"><i className="fas fa-user-shield" /></span><strong>{retentionRate}%</strong><span>Retenção da rede</span><small>{exitsThisMonth} saída{exitsThisMonth === 1 ? "" : "s"} no mês</small></div>
        <div className="central-kpi"><span className="central-kpi-icon"><i className="fas fa-arrow-trend-up" /></span><strong>{netGrowth > 0 ? "+" : ""}{netGrowth}</strong><span>Saldo do mês</span><small>{newThisMonth} entrada{newThisMonth === 1 ? "" : "s"} · {exitsThisMonth} saída{exitsThisMonth === 1 ? "" : "s"}</small></div>
      </div>
      <div className={`central-section-shell ${collapsed.health ? "is-collapsed" : ""}`}>
        <div className="central-section-bar"><span>Saúde da rede</span>{collapseButton("health", "Saúde da rede")}</div>
      <div className="central-network-health central-collapsible-content">
        <div className="central-health-card">
          <div className="central-health-ring" style={{ "--value": activeRate }}><strong>{activeRate}%</strong></div>
          <div className="central-health-copy"><small>Saúde da rede</small><h3>Base ativa consolidada</h3><p>Percentual de alunos ativos considerando todas as unidades cadastradas.</p></div>
          <div className="central-health-stats"><span><b>{activeUnits}/{units.length || 0}</b><small>unidades ativas</small></span><span><b>{retentionRate}%</b><small>retenção no mês</small></span></div>
        </div>
        <div className={`central-attention-card ${unitsWithoutNewEnrollments ? "has-alert" : ""}`}>
          <i className={unitsWithoutNewEnrollments ? "fas fa-chart-area" : "fas fa-check-circle"} />
          <div><small>Captação das unidades</small><strong>{unitsWithoutNewEnrollments ? `${unitsWithoutNewEnrollments} unidade${unitsWithoutNewEnrollments === 1 ? "" : "s"} sem novas matrículas no mês` : "Todas as unidades captaram no mês"}</strong><span>{unitsWithoutNewEnrollments ? "Compare captação e retenção para direcionar o acompanhamento." : "Todas as unidades ativas registraram novas matrículas no período atual."}</span></div>
        </div>
      </div>
      </div>
      <div className={`central-operations central-section-shell ${collapsed.operations ? "is-collapsed" : ""}`}>
        <div className="central-operations-head"><div><h3>Saúde operacional das unidades</h3><p>Comparação do mês atual com frequência dos últimos 30 dias.</p></div><div className="central-section-actions"><span><i className="fas fa-calendar-alt" /> Mês atual</span>{collapseButton("operations", "Saúde operacional")}</div></div>
        <div className="central-collapsible-content">
        <div className="central-operations-scroll"><table className="central-operations-table">
          <thead><tr><th>Unidade</th><th>Ativos</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Retenção</th><th>Engajamento 30 dias</th><th>Situação</th></tr></thead>
          <tbody>{rows.map(row => <tr key={`operation-${row.unit.id}`}>
            <td><details className="central-unit-health-details"><summary title="Clique para entender a situação da unidade">{row.unit.nome}<i className="fas fa-circle-info" /></summary><div className="central-unit-health-explanation"><strong>Por que está {row.healthLabel.toLowerCase()}?</strong><span>{row.healthReasons.join("; ")}.</span><small>Critérios: saudável com retenção a partir de 90%, engajamento a partir de 70% e saldo não negativo. Crítica quando retenção fica abaixo de 80% ou engajamento abaixo de 50%. Os demais casos ficam em atenção.</small></div></details></td>
            <td>{row.activeStudents.length}</td><td className="positive">+{row.newThisMonth}</td><td className={row.exitsThisMonth ? "negative" : "neutral"}>-{row.exitsThisMonth}</td>
            <td className={row.netGrowth > 0 ? "positive" : row.netGrowth < 0 ? "negative" : "neutral"}>{row.netGrowth > 0 ? "+" : ""}{row.netGrowth} ({row.growthRate > 0 ? "+" : ""}{row.growthRate}%)</td>
            <td>{row.retention}%</td><td>{row.engagementRate}%</td><td><span className={`central-health-badge ${row.healthType}`}><i className="fas fa-circle" />{row.healthLabel}</span></td>
          </tr>)}</tbody>
        </table></div>
        </div>
      </div>
      <div className={`central-section-shell ${collapsed.decisions ? "is-collapsed" : ""}`}>
        <div className="central-section-bar"><span>Análise comparativa</span>{collapseButton("decisions", "Análise comparativa")}</div>
      <div className="central-decision-grid central-collapsible-content">
        <section className="central-comparison-panel">
          <div className="central-panel-head"><div><h3>Comparação de ativos</h3><p>Participação atual de cada unidade na base ativa da rede.</p></div><i className="fas fa-chart-simple" /></div>
          <div className="central-comparison-list">{rows.map(row => (
            <button key={`comparison-${row.unit.id}`} onClick={() => onOpenUnit(row.unit.id)} disabled={row.unit.status === "Inativa"}>
              <span><strong>{row.unit.nome}</strong><small>{row.activeBaseRate}% da base da unidade ativa</small></span>
              <i className="central-comparison-track"><b style={{ width: `${(row.activeStudents.length / maxActive) * 100}%` }} /></i>
              <em>{row.activeStudents.length}</em>
            </button>
          ))}</div>
        </section>
        <section className="central-alert-panel">
          <div className="central-panel-head"><div><h3>Prioridades da gestão</h3><p>Unidades que merecem acompanhamento neste período.</p></div><i className="fas fa-triangle-exclamation" /></div>
          <div className="central-alert-list">{attentionRows.length ? attentionRows.map(row => (
            <button key={`alert-${row.unit.id}`} onClick={() => onOpenUnit(row.unit.id)}>
              <span className={`central-health-dot ${row.healthType}`} />
              <span><strong>{row.unit.nome}</strong><small>{row.healthReasons.join(" · ")}</small></span>
              <i className="fas fa-chevron-right" />
            </button>
          )) : <div className="central-all-healthy"><i className="fas fa-circle-check" /><span><strong>Rede operacionalmente saudável</strong><small>Nenhuma unidade ultrapassou os limites de atenção.</small></span></div>}</div>
        </section>
      </div>
      </div>
      <div className={`central-section-shell central-units-section ${collapsed.units ? "is-collapsed" : ""}`}>
      <div className="central-units-head"><div><h3>Unidades</h3><p>Selecione uma unidade para acessar alunos, BI, arquivos e conversas isolados.</p></div><div className="central-section-actions"><button className="filter-btn" onClick={onManageUsers}><i className="fas fa-users-cog" /> Usuários</button>{collapseButton("units", "Unidades")}</div></div>
      <div className="central-unit-grid central-collapsible-content">{rows.map(row => (
        <article key={row.unit.id} className={`central-unit-card ${row.unit.status === "Inativa" ? "inactive" : ""}`}>
          <div className="central-unit-top"><div className="central-unit-title"><i className="fas fa-map-marker-alt" /><span><strong>{row.unit.nome}</strong><small>{row.unit.cidade || "Unidade Alliance"}</small></span></div><span className={`central-unit-status ${row.unit.status === "Inativa" ? "off" : ""}`}>{row.unit.status || "Ativa"}</span></div>
          <div className="central-unit-metrics"><div className="central-unit-metric"><b>{row.unitStudents.length}</b><span>Alunos</span></div><div className="central-unit-metric"><b>{row.retention}%</b><span>Retenção no mês</span></div><div className="central-unit-metric"><b>{row.netGrowth > 0 ? "+" : ""}{row.netGrowth}</b><span>Saldo no mês</span></div></div>
          <div className="central-unit-progress"><div className="central-unit-progress-head"><span>{row.activeStudents.length} de {row.unitStudents.length} alunos ativos</span><b>{row.activeBaseRate}% da base ativa</b></div><div className="central-unit-progress-track"><span style={{ width: `${row.activeBaseRate}%` }} /></div></div>
          <button className="central-unit-open" disabled={row.unit.status === "Inativa"} onClick={() => onOpenUnit(row.unit.id)}><i className="fas fa-arrow-right" /> Entrar na unidade</button>
        </article>
      ))}</div>
      </div>
    </section>
  );
}
