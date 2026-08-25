import { STORAGE_KEYS } from "../config/runtime.js";

export function readStoredArray(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getStoredArrayCount(key) {
  return readStoredArray(key).length;
}

export function buildBackupPayload(students, repo, source = "manual", users = [], units = []) {
  return {
    source,
    app: "Alliance Jiu Jitsu Kids",
    version: "alliance_mooca_kids_v22",
    timestamp: new Date().toISOString(),
    students: students || [],
    repo: repo || [],
    users: users || [],
    units: units || [],
    audit: readStoredArray(STORAGE_KEYS.audit)
  };
}

export function saveAutomaticLocalBackup(students, repo, source = "auto-local", users = [], units = []) {
  try {
    const payload = buildBackupPayload(students, repo, source, users, units);
    localStorage.setItem(STORAGE_KEYS.autoBackup, JSON.stringify(payload));

    const dayKey = payload.timestamp.slice(0, 10);
    const history = readStoredArray(STORAGE_KEYS.backupHistory);
    const dailyHistory = history.filter(item => item?.timestamp?.slice(0, 10) !== dayKey);
    dailyHistory.unshift(payload);
    localStorage.setItem(STORAGE_KEYS.backupHistory, JSON.stringify(dailyHistory.slice(0, 7)));
    return payload;
  } catch (error) {
    console.warn("Não foi possível salvar o backup local automático.", error);
    return null;
  }
}
