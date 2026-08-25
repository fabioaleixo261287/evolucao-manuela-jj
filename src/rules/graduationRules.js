const parseDate = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function calculateAge(birthday, today = new Date()) {
  const birthDate = parseDate(birthday);
  if (!birthDate) return 0;
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) age--;
  return age;
}

export function getAutoCategory(birthday, categoryOverride = "Auto", today = new Date()) {
  if (categoryOverride && categoryOverride !== "Auto") return categoryOverride;
  const age = calculateAge(birthday, today);
  if (age >= 3 && age <= 4) return "Baby Eagle";
  if (age >= 5 && age <= 7) return "Little Eagle";
  if (age >= 8 && age <= 12) return "Eagle Warrior";
  if (age >= 13 && age <= 15) return "Eagle Youth";
  return "Fora da regra";
}

export function getBeltFamily(belt = "") {
  const normalized = belt.toLowerCase();
  if (normalized.includes("amarela") || normalized.includes("laranja")) return "amarelaLaranja";
  if (normalized.includes("verde")) return "verde";
  if (normalized.includes("branca") || normalized.includes("cinza")) return "brancaCinza";
  return "desconhecida";
}

export function getRuleInfo(birthday, belt, categoryOverride = "Auto", today = new Date()) {
  const age = calculateAge(birthday, today);
  const category = getAutoCategory(birthday, categoryOverride, today);
  const family = getBeltFamily(belt);

  if (category === "Fora da regra") {
    return {
      categoria: category,
      aulasPorGrau: 0,
      elegivel: false,
      aviso: age < 3 ? "Idade mínima: 3 anos" : "Programa Kids até 15 anos"
    };
  }
  if (category === "Baby Eagle") {
    if (family === "brancaCinza") return { categoria: category, aulasPorGrau: 12, elegivel: true, aviso: "" };
    return { categoria: category, aulasPorGrau: 0, elegivel: false, aviso: "Baby Eagle usa Branca/Cinza" };
  }
  if (category === "Little Eagle" || category === "Eagle Warrior") {
    if (family === "brancaCinza") return { categoria: category, aulasPorGrau: 15, elegivel: true, aviso: "" };
    if (family === "amarelaLaranja") return { categoria: category, aulasPorGrau: 20, elegivel: true, aviso: "" };
    return { categoria: category, aulasPorGrau: 0, elegivel: false, aviso: "Verde é regra do Eagle Youth" };
  }
  if (category === "Eagle Youth") {
    if (family === "brancaCinza") return { categoria: category, aulasPorGrau: 20, elegivel: true, aviso: "" };
    if (family === "amarelaLaranja") return { categoria: category, aulasPorGrau: 22, elegivel: true, aviso: "" };
    if (family === "verde") return { categoria: category, aulasPorGrau: 25, elegivel: true, aviso: "" };
  }
  return { categoria: "Fora da regra", aulasPorGrau: 0, elegivel: false, aviso: "Faixa fora da regra" };
}

export const getRules = (birthday, belt, categoryOverride = "Auto", today = new Date()) =>
  getRuleInfo(birthday, belt, categoryOverride, today).aulasPorGrau;
