import React from "react";
import { formatDateBR } from "../utils/dates.js";

export default function BeltHistory({ items, student, canEdit, onUpdateStart }) {
  const history = items.slice().reverse();
  if (!history.length) {
    return <div className="belt-history-empty">Ainda não existe histórico de troca de faixa para este aluno.</div>;
  }

  return (
    <div className="belt-history-list">
      {history.map((item, index) => {
        const previousItem = history[index + 1];
        const percent = Math.max(0, Math.min(100, Number(item.percentualFinal || 0)));
        const presence = `${item.grausBrancos || 0}B / ${item.grausVermelhos || 0}V`;
        const behavior = `${item.comportamentais || 0}/4`;
        const reason = item.current ? "Em andamento" : item.tipo === "Alteracao manual" ? "Alteração manual" : item.tipo === "Graduacao" ? "Graduação" : (item.tipo || "Finalização");
        return (
          <div key={item.id} className={`belt-history-card ${item.current ? "current" : ""}`}>
            <div className="belt-history-head">
              <div>
                <small>{item.current ? "Faixa atual" : "Faixa finalizada"}</small>
                <strong>{item.faixa}</strong>
                <em><i className="fas fa-users" /> {item.turma || "Turma atual"}</em>
              </div>
              <span className="belt-history-status">{item.current ? `${percent}%` : "Finalizada"}</span>
            </div>
            <div className="belt-history-progress"><span style={{ width: `${percent}%` }} /></div>
            <div className="belt-history-period">
              <span>
                <i className="fas fa-calendar-alt" /><b>{item.current ? "Início da Faixa Atual:" : "Início:"}</b>
                {item.current && canEdit ? (
                  <input className="belt-history-date-input" type="date" value={student.cicloFaixaInicio || student.matricula || ""} onChange={event => onUpdateStart(student.id, event.target.value)} />
                ) : <> {item.dataInicio ? formatDateBR(item.dataInicio) : "sem data"}</>}
              </span>
              <span><i className="fas fa-circle-check" /><b>Conclusão:</b> {item.dataConclusao ? formatDateBR(item.dataConclusao) : "em andamento"}</span>
            </div>
            <div className="belt-history-meta">
              <span><i className="fas fa-graduation-cap" /><b>{item.aulasFeitas}/{item.aulasNecessarias || 0}</b>Aulas</span>
              <span><i className="fas fa-clipboard-check" /><b>{presence}</b>Grau de Presença</span>
              <span><i className="fas fa-star" /><b>{behavior}</b>Graus Comportamentais</span>
              <span><i className="fas fa-flag-checkered" /><b>{reason}</b>Motivo</span>
            </div>
            <div className="belt-history-timeline">
              <span className="timeline-label">Resumo da faixa</span>
              <div className="timeline-track">
                <div className="timeline-node previous"><b>{previousItem?.faixa || "Início"}</b><small>{previousItem ? "Faixa anterior" : "Base"}</small></div>
                <div className="timeline-line" />
                <div className="timeline-node milestone"><b>{presence}</b><small>Presença</small></div>
                <div className="timeline-line" />
                <div className="timeline-node milestone"><b>{behavior}</b><small>Comportamental</small></div>
                <div className="timeline-line" />
                <div className="timeline-node current"><b>{item.faixa}</b><small>{item.current ? "Atual" : `${reason} • ${item.dataConclusao ? formatDateBR(item.dataConclusao) : "sem data"}`}</small></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
