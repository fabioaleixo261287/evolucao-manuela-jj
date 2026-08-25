import { describe, expect, it } from "vitest";
import { calculateAge, getAutoCategory, getRuleInfo } from "../src/rules/graduationRules.js";

const referenceDate = new Date(2026, 7, 25);

describe("regras de categoria", () => {
  it.each([
    ["2023-08-25", "Baby Eagle"],
    ["2021-08-25", "Little Eagle"],
    ["2018-08-25", "Eagle Warrior"],
    ["2011-08-25", "Eagle Youth"]
  ])("classifica %s como %s", (birthday, category) => {
    expect(getAutoCategory(birthday, "Auto", referenceDate)).toBe(category);
  });

  it("respeita aniversário ainda não ocorrido", () => {
    expect(calculateAge("2021-08-26", referenceDate)).toBe(4);
  });

  it("mantém categoria manual", () => {
    expect(getAutoCategory("2021-08-25", "Eagle Warrior", referenceDate)).toBe("Eagle Warrior");
  });
});

describe("regras de graduação", () => {
  it("usa 12 aulas por grau no Baby Eagle Branca/Cinza", () => {
    expect(getRuleInfo("2023-08-25", "Branca", "Auto", referenceDate).aulasPorGrau).toBe(12);
  });

  it("usa 15 aulas por grau no Little Eagle Branca/Cinza", () => {
    expect(getRuleInfo("2020-08-25", "Cinza/Preta", "Auto", referenceDate).aulasPorGrau).toBe(15);
  });

  it("bloqueia faixa Verde antes do Eagle Youth", () => {
    expect(getRuleInfo("2018-08-25", "Verde", "Auto", referenceDate).elegivel).toBe(false);
  });
});
