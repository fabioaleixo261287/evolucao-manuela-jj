export function parseLocalDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayISO(today = new Date()) {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateBR(value) {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "";
}

export function addDaysISO(value, days) {
  const date = parseLocalDate(value);
  const safeDays = Math.max(0, Number(days) || 0);
  if (!date || !safeDays) return "";
  const end = new Date(date);
  end.setDate(end.getDate() + safeDays);
  return getTodayISO(end);
}
