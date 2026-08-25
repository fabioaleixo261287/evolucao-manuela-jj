import { describe, expect, it } from "vitest";
import { migrateBackupPayload, validateBackupPayload } from "../src/rules/backupRules.js";

describe("migração de backup", () => {
  it("rejeita backup sem lista de alunos", () => {
    expect(validateBackupPayload({ repo: [] }).valid).toBe(false);
  });

  it("migra backup antigo sem unidade", () => {
    const result = migrateBackupPayload({ students: [{ id: 1, nome: "Aluno" }], repo: [], users: [] });
    expect(result.valid).toBe(true);
    expect(result.payload.units[0].id).toBe("alliance-mooca");
    expect(result.payload.students[0].unidadeId).toBe("alliance-mooca");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("preserva isolamento multiunidade válido", () => {
    const result = migrateBackupPayload({
      students: [{ id: 1, unidadeId: "alliance-teste" }], repo: [], users: [],
      units: [{ id: "alliance-mooca" }, { id: "alliance-teste" }]
    });
    expect(result.payload.students[0].unidadeId).toBe("alliance-teste");
  });

  it("reconstrói unidades ausentes pelos alunos sem misturá-los", () => {
    const result = migrateBackupPayload({
      students: [
        { id: 1, unidadeId: "alliance-mooca" },
        { id: 2, unidadeId: "alliance-teste" }
      ], repo: [], users: [], units: []
    });
    expect(result.payload.units.map(unit => unit.id)).toEqual(["alliance-mooca", "alliance-teste"]);
    expect(result.payload.students.map(student => student.unidadeId)).toEqual(["alliance-mooca", "alliance-teste"]);
  });

  it("rejeita alunos duplicados", () => {
    const result = validateBackupPayload({ students: [{ id: 1 }, { id: 1 }] });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicados");
  });

  it("rejeita referência para unidade inexistente", () => {
    const result = validateBackupPayload({
      students: [{ id: 1, unidadeId: "unidade-inexistente" }],
      units: [{ id: "alliance-mooca" }]
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unidade inexistente");
  });
});
