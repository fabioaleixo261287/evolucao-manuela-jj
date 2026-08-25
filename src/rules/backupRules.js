export const DEFAULT_UNIT = { id: "alliance-mooca", nome: "Alliance Mooca", status: "Ativa" };

export function validateBackupPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") errors.push("Arquivo inválido");
  if (!Array.isArray(payload?.students)) errors.push("Lista de alunos ausente");
  if (payload?.repo != null && !Array.isArray(payload.repo)) errors.push("Repositório inválido");
  if (payload?.users != null && !Array.isArray(payload.users)) errors.push("Usuários inválidos");
  if (payload?.units != null && !Array.isArray(payload.units)) errors.push("Unidades inválidas");
  return { valid: errors.length === 0, errors };
}

export function migrateBackupPayload(payload) {
  const validation = validateBackupPayload(payload);
  if (!validation.valid) return { ...validation, payload: null, warnings: [] };
  const warnings = [];
  const configuredUnits = Array.isArray(payload.units) ? payload.units : [];
  const inferredIds = [...new Set([
    ...(payload.students || []).map(item => item?.unidadeId),
    ...(payload.repo || []).map(item => item?.unidadeId),
    ...(payload.users || []).map(item => item?.unidadeId)
  ].filter(id => id && id !== "all"))];
  const inferredUnits = inferredIds.map(id => ({
    id,
    nome: id === "alliance-mooca" ? "Alliance Mooca" : id === "alliance-teste" ? "Alliance Teste" : String(id).split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    status: "Ativa"
  }));
  const sourceUnits = configuredUnits.length ? configuredUnits : (inferredUnits.length ? inferredUnits : [DEFAULT_UNIT]);
  if (!configuredUnits.length) warnings.push(inferredUnits.length ? `Backup sem cadastro de unidades: ${inferredUnits.length} unidade(s) reconstruída(s) pelos dados existentes.` : "Backup sem unidades: Alliance Mooca aplicada como unidade padrão.");
  const unitIds = new Set(sourceUnits.map(unit => unit.id));
  const students = payload.students.map(student => {
    const unidadeId = student.unidadeId && unitIds.has(student.unidadeId) ? student.unidadeId : sourceUnits[0].id;
    if (unidadeId !== student.unidadeId) warnings.push(`Aluno ${student.nome || student.id}: unidade padrão aplicada.`);
    return { ...student, unidadeId };
  });
  const repo = (payload.repo || []).map(item => ({ ...item, unidadeId: item.unidadeId && unitIds.has(item.unidadeId) ? item.unidadeId : sourceUnits[0].id }));
  return {
    valid: true,
    errors: [],
    warnings: [...new Set(warnings)],
    payload: { ...payload, students, repo, users: payload.users || [], units: sourceUnits }
  };
}
