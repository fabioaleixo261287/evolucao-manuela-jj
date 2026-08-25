import { describe, expect, it } from "vitest";
import { buildCentralMetrics } from "../src/rules/centralMetrics.js";

describe("indicadores centrais", () => {
  it("mantém alunos isolados e classifica unidade com saldo negativo em atenção", () => {
    const result = buildCentralMetrics({
      referenceDate: new Date(2026, 7, 25),
      units: [{ id: "a" }, { id: "b" }],
      students: [
        { id: 1, unidadeId: "a", status: "Ativo", matricula: "2026-08-10", presencas: ["2026-08-20"] },
        { id: 2, unidadeId: "b", status: "Inativo", statusAlteradoEm: "2026-08-15", presencas: [] }
      ],
      getStudentUnitId: student => student.unidadeId,
      getStudentPresenceDates: student => student.presencas
    });
    expect(result.rows[0].unitStudents.map(student => student.id)).toEqual([1]);
    expect(result.rows[1].unitStudents.map(student => student.id)).toEqual([2]);
    expect(result.rows[1].netGrowth).toBe(-1);
    expect(result.rows[1].healthType).toBe("critical");
  });
});
