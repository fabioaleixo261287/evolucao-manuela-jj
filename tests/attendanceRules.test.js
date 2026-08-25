import { describe, expect, it } from "vitest";
import { getStudentPresenceAlertDays, shouldAlertAbsence } from "../src/rules/attendanceRules.js";

const today = new Date(2026, 7, 25);

describe("alerta de ausência", () => {
  it("não alerta aluno que nunca teve presença", () => {
    expect(getStudentPresenceAlertDays({}, today)).toBeNull();
    expect(shouldAlertAbsence({}, today)).toBe(false);
  });

  it("não alerta antes de sete dias", () => {
    expect(shouldAlertAbsence({ ultimaPresenca: "2026-08-19" }, today)).toBe(false);
  });

  it("alerta exatamente a partir de sete dias", () => {
    expect(getStudentPresenceAlertDays({ ultimaPresenca: "2026-08-18" }, today)).toBe(7);
    expect(shouldAlertAbsence({ ultimaPresenca: "2026-08-18" }, today)).toBe(true);
  });
});
