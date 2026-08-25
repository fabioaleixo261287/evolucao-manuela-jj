import { parseLocalDate } from "../utils/dates.js";

export function buildCentralMetrics({ students, units, getStudentUnitId, getStudentPresenceDates, parsePresenceDate = parseLocalDate, referenceDate = new Date() }) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const nextMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const engagementStart = new Date(referenceDate);
  engagementStart.setDate(engagementStart.getDate() - 29);
  engagementStart.setHours(0, 0, 0, 0);
  const isCurrentEnrollment = student => {
    const date = parseLocalDate(student.matricula || "");
    return date && date >= monthStart && date < nextMonthStart;
  };
  const exitedThisMonth = student => {
    const date = parseLocalDate(student.statusAlteradoEm || "");
    return ["Inativo", "Transferido"].includes(student.status || "Ativo") && date && date >= monthStart && date < nextMonthStart;
  };
  const active = students.filter(student => (student.status || "Ativo") === "Ativo").length;
  const activeUnits = units.filter(unit => (unit.status || "Ativa") !== "Inativa").length;
  const activeRate = students.length ? Math.round((active / students.length) * 100) : 0;
  const newThisMonth = students.filter(isCurrentEnrollment).length;
  const exitsThisMonth = students.filter(exitedThisMonth).length;
  const activeAtMonthStart = Math.max(0, active - newThisMonth + exitsThisMonth);
  const netGrowth = newThisMonth - exitsThisMonth;
  const growthRate = activeAtMonthStart ? Math.round((netGrowth / activeAtMonthStart) * 100) : (netGrowth > 0 ? 100 : 0);
  const retentionRate = activeAtMonthStart ? Math.round(((activeAtMonthStart - exitsThisMonth) / activeAtMonthStart) * 100) : 0;
  const rows = units.map(unit => {
    const unitStudents = students.filter(student => getStudentUnitId(student) === unit.id);
    const activeStudents = unitStudents.filter(student => (student.status || "Ativo") === "Ativo");
    const activeBaseRate = unitStudents.length ? Math.round((activeStudents.length / unitStudents.length) * 100) : 0;
    const unitNew = unitStudents.filter(isCurrentEnrollment).length;
    const unitExits = unitStudents.filter(exitedThisMonth).length;
    const unitStart = Math.max(0, activeStudents.length - unitNew + unitExits);
    const unitNet = unitNew - unitExits;
    const unitGrowth = unitStart ? Math.round((unitNet / unitStart) * 100) : (unitNet > 0 ? 100 : 0);
    const retention = unitStart ? Math.round(((unitStart - unitExits) / unitStart) * 100) : 0;
    const engaged = activeStudents.filter(student => getStudentPresenceDates(student).some(value => {
      const date = parsePresenceDate(value);
      return date && date >= engagementStart && date <= referenceDate;
    })).length;
    const engagementRate = activeStudents.length ? Math.round((engaged / activeStudents.length) * 100) : 0;
    const healthType = retention < 80 || engagementRate < 50 ? "critical" : (retention < 90 || engagementRate < 70 || unitNet < 0 ? "attention" : "healthy");
    const healthLabel = healthType === "critical" ? "Crítica" : healthType === "attention" ? "Atenção" : "Saudável";
    const healthReasons = [
      retention < 80 ? `retenção crítica em ${retention}%` : retention < 90 ? `retenção requer atenção em ${retention}%` : `retenção saudável em ${retention}%`,
      engagementRate < 50 ? `engajamento crítico em ${engagementRate}%` : engagementRate < 70 ? `engajamento requer atenção em ${engagementRate}%` : `engajamento saudável em ${engagementRate}%`,
      unitNet < 0 ? `saldo negativo de ${unitNet} aluno${Math.abs(unitNet) === 1 ? "" : "s"}` : `${unitNet > 0 ? "saldo positivo de " : "saldo estável em "}${unitNet} aluno${Math.abs(unitNet) === 1 ? "" : "s"}`
    ];
    return { unit, unitStudents, activeStudents, activeBaseRate, retention, newThisMonth: unitNew, exitsThisMonth: unitExits, netGrowth: unitNet, growthRate: unitGrowth, engagementRate, healthType, healthLabel, healthReasons };
  });
  return { active, activeUnits, activeRate, newThisMonth, exitsThisMonth, netGrowth, growthRate, retentionRate, rows, unitsWithoutNewEnrollments: rows.filter(row => (row.unit.status || "Ativa") !== "Inativa" && row.newThisMonth === 0).length };
}
