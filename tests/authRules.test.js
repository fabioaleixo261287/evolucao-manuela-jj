import { describe, expect, it } from "vitest";
import { authenticateProfessor, findParentStudent, generateParentAccessCode, getParentLoginGuard, normalizeBirthPassword, registerParentLoginFailure } from "../src/rules/authRules.js";

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

  it("não aceita o administrador legado sem autorização explícita", () => {
    expect(authenticateProfessor([], "admin", "admin")).toBeNull();
    expect(authenticateProfessor([], "admin", "admin", { allowLegacyAdmin: true })?.perfil).toBe("Administrador");
  });
});

describe("acesso dos pais", () => {
  const students = [{ id: 10, nome: "Miguel Demonstração", nascimento: "2018-08-25", acessoPaisSenha: "Mx9#2026", unidadeId: "alliance-teste" }];

  it("converte nascimento ISO para DDMMAAAA", () => {
    expect(normalizeBirthPassword("2018-08-25")).toBe("25082018");
  });

  it("localiza aluno e mantém a unidade cadastrada", () => {
    expect(findParentStudent(students, "miguel demonstração", "Mx9#2026")?.unidadeId).toBe("alliance-teste");
  });

  it("rejeita data de nascimento como senha em produção", () => {
    expect(findParentStudent(students, "miguel demonstração", "25082018")).toBeNull();
  });

  it("mantém compatibilidade de nascimento somente na demonstração", () => {
    const legacy = [{ id: 11, nome: "Aluno Demo", nascimento: "2018-08-25", unidadeId: "alliance-teste" }];
    expect(findParentStudent(legacy, "Aluno Demo", "25082018", { allowLegacyBirthDate: true })?.id).toBe(11);
  });

  it("gera código sem caracteres visualmente ambíguos", () => {
    const code = generateParentAccessCode(8, [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it("bloqueia por 15 minutos após cinco erros", () => {
    const now = 1_000_000;
    let guard = {};
    for (let index = 0; index < 5; index += 1) guard = registerParentLoginFailure(guard, now);
    expect(getParentLoginGuard(guard, now).locked).toBe(true);
    expect(getParentLoginGuard(guard, now + 15 * 60 * 1000).locked).toBe(false);
  });
});
