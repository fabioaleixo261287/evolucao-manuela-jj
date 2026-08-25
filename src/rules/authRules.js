export function authenticateProfessor(users, login, password, options = {}) {
  const typedLogin = String(login || "").toLowerCase().trim();
  const typedPassword = String(password || "").trim();
  if (options.allowLegacyAdmin && typedLogin === "admin" && typedPassword === "admin") {
    return { id: 1, nome: "Administrador", login: "admin", perfil: "Administrador", unidadeId: "all", status: "Ativo" };
  }
  return (users || []).find(user =>
    (user.status || "Ativo") === "Ativo" &&
    String(user.login || "").toLowerCase().trim() === typedLogin &&
    String(user.senha || "") === typedPassword
  ) || null;
}

export function normalizeBirthPassword(birthday) {
  const value = String(birthday || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}${month}${year}`;
  }
  return value.replace(/\D/g, "");
}

const PARENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateParentAccessCode(length = 8, randomValues) {
  const size = Math.max(6, Number(length) || 8);
  const values = randomValues || (() => {
    const bytes = new Uint32Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  })();
  return Array.from({ length: size }, (_, index) => PARENT_CODE_ALPHABET[values[index] % PARENT_CODE_ALPHABET.length]).join("");
}

export function getParentLoginGuard(state = {}, now = Date.now()) {
  const lockedUntil = Number(state.lockedUntil) || 0;
  return {
    attempts: Math.max(0, Number(state.attempts) || 0),
    lockedUntil,
    locked: lockedUntil > now,
    remainingMs: Math.max(0, lockedUntil - now)
  };
}

export function registerParentLoginFailure(state = {}, now = Date.now(), maxAttempts = 5, lockMs = 15 * 60 * 1000) {
  const current = getParentLoginGuard(state, now);
  if (current.locked) return current;
  const attempts = current.attempts + 1;
  return attempts >= maxAttempts
    ? { attempts: 0, lockedUntil: now + lockMs, locked: true, remainingMs: lockMs }
    : { attempts, lockedUntil: 0, locked: false, remainingMs: 0 };
}

export function findParentStudent(students, name, birthPassword, options = {}) {
  const normalizedName = String(name || "").toLowerCase().trim();
  const typedCredential = String(birthPassword || "").trim();
  if (!normalizedName || !typedCredential) return null;
  const matches = (students || []).filter(student => {
    const accessCode = String(student.acessoPaisSenha || "").trim();
    const validCredential = accessCode.length >= 6
      ? accessCode === typedCredential
      : options.allowLegacyBirthDate && normalizeBirthPassword(student.nascimento) === typedCredential.replace(/\D/g, "");
    return String(student.nome || "").toLowerCase().trim() === normalizedName && validCredential;
  });
  return matches.length === 1 ? matches[0] : null;
}
