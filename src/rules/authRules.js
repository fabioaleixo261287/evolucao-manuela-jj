export function authenticateProfessor(users, login, password) {
  const typedLogin = String(login || "").toLowerCase().trim();
  const typedPassword = String(password || "").trim();
  if (typedLogin === "admin" && typedPassword === "admin") {
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

export function findParentStudent(students, name, birthPassword) {
  const normalizedName = String(name || "").toLowerCase().trim();
  const normalizedPassword = String(birthPassword || "").replace(/\D/g, "");
  return (students || []).find(student =>
    String(student.nome || "").toLowerCase().trim() === normalizedName &&
    normalizeBirthPassword(student.nascimento) === normalizedPassword
  ) || null;
}
