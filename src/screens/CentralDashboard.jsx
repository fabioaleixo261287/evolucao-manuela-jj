import React from "react";

export default function CentralDashboard({ model, units, studentsCount, onAddUnit, onManageUsers, onOpenUnit, onLogout }) {
  const { active, activeUnits, activeRate, newThisMonth, exitsThisMonth, growthRate, retentionRate, rows, unitsWithoutNewEnrollments } = model;
  return (
    <section className="central-page">
      <div className="central-hero">
        <div className="central-hero-copy"><span className="central-hero-icon"><i className="fas fa-network-wired" /></span><div><h2>Painel Central</h2><p>Visão consolidada das unidades Alliance e acesso à operação de cada academia.</p></div></div>
        <div className="central-hero-actions">
          <button className="central-logout-btn" onClick={onLogout} title="Sair do sistema"><i className="fas fa-right-from-bracket" /> Sair</button>
          <button className="dashboard-pdf-btn" onClick={onAddUnit}><i className="fas fa-plus" /> Nova unidade</button>
        </div>
      </div>
      <div className="central-kpis">
        <div className="central-kpi"><i className="fas fa-building" /><strong>{units.length}</strong><span>Unidades cadastradas</span><small>{activeUnits} em operação</small></div>
        <div className="central-kpi"><i className="fas fa-user-graduate" /><strong>{studentsCount}</strong><span>Alunos na rede</span><small>Base consolidada</small></div>
        <div className="central-kpi"><i className="fas fa-user-check" /><strong>{active}</strong><span>Alunos ativos</span><small>{activeRate}% da base</small></div>
        <div className="central-kpi"><i className="fas fa-chart-line" /><strong>{growthRate > 0 ? "+" : ""}{growthRate}%</strong><span>Crescimento líquido</span><small>{newThisMonth} entrada{newThisMonth === 1 ? "" : "s"} · {exitsThisMonth} saída{exitsThisMonth === 1 ? "" : "s"}</small></div>
      </div>
      <div className="central-network-health">
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
      <div className="central-operations">
        <div className="central-operations-head"><div><h3>Saúde operacional das unidades</h3><p>Comparação do mês atual com frequência dos últimos 30 dias.</p></div><span><i className="fas fa-calendar-alt" /> Mês atual</span></div>
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
      <div className="central-units-head"><div><h3>Unidades</h3><p>Selecione uma unidade para acessar alunos, BI, arquivos e conversas isolados.</p></div><button className="filter-btn" onClick={onManageUsers}><i className="fas fa-users-cog" /> Usuários</button></div>
      <div className="central-unit-grid">{rows.map(row => (
        <article key={row.unit.id} className={`central-unit-card ${row.unit.status === "Inativa" ? "inactive" : ""}`}>
          <div className="central-unit-top"><div className="central-unit-title"><i className="fas fa-map-marker-alt" /><span><strong>{row.unit.nome}</strong><small>{row.unit.cidade || "Unidade Alliance"}</small></span></div><span className={`central-unit-status ${row.unit.status === "Inativa" ? "off" : ""}`}>{row.unit.status || "Ativa"}</span></div>
          <div className="central-unit-metrics"><div className="central-unit-metric"><b>{row.unitStudents.length}</b><span>Alunos</span></div><div className="central-unit-metric"><b>{row.retention}%</b><span>Retenção no mês</span></div><div className="central-unit-metric"><b>{row.netGrowth > 0 ? "+" : ""}{row.netGrowth}</b><span>Saldo no mês</span></div></div>
          <div className="central-unit-progress"><div className="central-unit-progress-head"><span>{row.activeStudents.length} de {row.unitStudents.length} alunos ativos</span><b>{row.activeBaseRate}% da base ativa</b></div><div className="central-unit-progress-track"><span style={{ width: `${row.activeBaseRate}%` }} /></div></div>
          <button className="central-unit-open" disabled={row.unit.status === "Inativa"} onClick={() => onOpenUnit(row.unit.id)}><i className="fas fa-arrow-right" /> Entrar na unidade</button>
        </article>
      ))}</div>
    </section>
  );
}
