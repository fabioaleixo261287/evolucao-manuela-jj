import { describe, expect, it } from "vitest";
import { authenticateProfessor, findParentStudent, normalizeBirthPassword } from "../src/rules/authRules.js";

describe("autenticação do professor", () => {
  const users = [
    { id: 2, login: "prof.teste", senha: "Demo@2026", status: "Ativo", unidadeId: "alliance-teste" },
    { id: 3, login: "inativo", senha: "123", status: "Inativo", unidadeId: "alliance-mooca" }
  ];

  it("aceita usuário ativo e preserva sua unidade", () => {
    expect(authenticateProfessor(users, " PROF.TESTE ", "Demo@2026")?.unidadeId).toBe("alliance-teste");
  });

  it("rejeita usuário inativo", () => {
    expect(authenticateProfessor(users, "inativo", "123")).toBeNull();
  });
});

describe("acesso dos pais", () => {
  const students = [{ id: 10, nome: "Miguel Demonstração", nascimento: "2018-08-25", unidadeId: "alliance-teste" }];

  it("converte nascimento ISO para DDMMAAAA", () => {
    expect(normalizeBirthPassword("2018-08-25")).toBe("25082018");
  });

  it("localiza aluno e mantém a unidade cadastrada", () => {
    expect(findParentStudent(students, "miguel demonstração", "25/08/2018")?.unidadeId).toBe("alliance-teste");
  });
});
