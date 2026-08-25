import { LOCAL_DEMO_MODE, REMOTE_CONFIG } from "../config/runtime.js";

const HYDRATION_TIMEOUT_MS = 4500;

export function createSupabaseClient() {
  if (LOCAL_DEMO_MODE) return null;
  const external = window.SUPABASE_CONFIG || {};
  const url = external.url || REMOTE_CONFIG.supabase.url;
  const anonKey = external.anonKey || REMOTE_CONFIG.supabase.anonKey;
  if (!url || !anonKey || !window.supabase?.createClient) return null;
  return window.supabase.createClient(url, anonKey);
}

export function getAppwriteConfig() {
  const external = window.APPWRITE_CONFIG || {};
  return {
    endpoint: external.endpoint || REMOTE_CONFIG.appwrite.endpoint,
    projectId: external.projectId || REMOTE_CONFIG.appwrite.projectId,
    databaseId: external.databaseId || REMOTE_CONFIG.appwrite.databaseId,
    tableId: external.tableId || REMOTE_CONFIG.appwrite.tableId,
    bucketId: external.bucketId || REMOTE_CONFIG.appwrite.bucketId,
    rowId: external.rowId || REMOTE_CONFIG.stateId
  };
}

export function createAppwriteServices() {
  if (LOCAL_DEMO_MODE) return null;
  const config = getAppwriteConfig();
  if (!config.endpoint || !config.projectId || !config.databaseId || !config.tableId) return null;
  const client = window.Appwrite?.Client
    ? new window.Appwrite.Client().setEndpoint(config.endpoint).setProject(config.projectId)
    : null;
  return {
    config,
    client,
    storage: client && window.Appwrite.Storage ? new window.Appwrite.Storage(client) : null,
    ID: window.Appwrite?.ID || null
  };
}

export function parseRemoteJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function withTimeout(promise, timeoutMs = HYDRATION_TIMEOUT_MS, label = "Tempo limite excedido") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function appwriteFetch(config, path, options = {}, timeoutMs = HYDRATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${config.endpoint}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Response-Format": "1.9.5",
      ...(options.headers || {})
    }
  }).finally(() => clearTimeout(timer));
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail.message || `Appwrite HTTP ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export function getAppwriteState(config) {
  return appwriteFetch(config, `/tablesdb/${config.databaseId}/tables/${config.tableId}/rows/${config.rowId}`);
}

export function getAppwriteErrorMessage(error) {
  if (error?.name === "AbortError" || String(error?.message || "").toLowerCase().includes("tempo limite")) {
    return "Appwrite demorou para responder. Usando dados locais.";
  }
  const message = error?.detail?.message || error?.message || "erro desconhecido";
  const code = error?.status ? ` ${error.status}` : "";
  return `Erro Appwrite${code}: ${message}`;
}

export function saveAppwriteState(config, students, repo, updatedAt) {
  const data = {
    students: JSON.stringify(students),
    repo: JSON.stringify(repo),
    updated_at: updatedAt
  };
  return appwriteFetch(config, `/tablesdb/${config.databaseId}/tables/${config.tableId}/rows/${config.rowId}`, {
    method: "PUT",
    body: JSON.stringify({
      data,
      permissions: ['read("any")', 'update("any")', 'delete("any")']
    })
  });
}

export function getAppwriteSystemConfig(config) {
  return appwriteFetch(config, `/tablesdb/${config.databaseId}/tables/${config.tableId}/rows/${REMOTE_CONFIG.systemConfigId}`);
}

export function saveAppwriteSystemConfig(config, users, units, updatedAt = new Date().toISOString()) {
  return appwriteFetch(config, `/tablesdb/${config.databaseId}/tables/${config.tableId}/rows/${REMOTE_CONFIG.systemConfigId}`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        students: JSON.stringify(users || []),
        repo: JSON.stringify(units || []),
        updated_at: updatedAt
      },
      permissions: ['read("any")', 'update("any")', 'delete("any")']
    })
  });
}

export function parseSystemConfig(row) {
  return {
    users: parseRemoteJson(row?.students, []),
    units: parseRemoteJson(row?.repo, []),
    updatedAt: row?.updated_at || row?.$updatedAt || ""
  };
}
