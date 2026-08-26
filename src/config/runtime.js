const pageParams = new URLSearchParams(window.location.search);

export const DEMO_PACKAGE_MODE = pageParams.get("demo") === "1";
export const LOCAL_DEMO_MODE = pageParams.get("localDemo") === "1" || DEMO_PACKAGE_MODE;
export const DEMO_PACKAGE_URL = "./dados_demonstracao/cenario_rede_3_unidades_200/backup_demo_rede_3_unidades_200_alunos.json";
export const HYDRATION_TIMEOUT_MS = 4500;

const suffix = LOCAL_DEMO_MODE ? "_demo" : "";
export const STORAGE_KEYS = {
  students: `all_eagle_v22_s${suffix}`,
  repo: `all_eagle_v22_r${suffix}`,
  users: `all_eagle_v22_users${suffix}`,
  units: `all_eagle_v22_units${suffix}`,
  selectedUnit: `all_eagle_v22_selected_unit${suffix}`,
  theme: `all_eagle_v22_theme${suffix}`,
  pendingSync: `all_eagle_v22_pending_sync${suffix}`,
  autoBackup: `all_eagle_v22_auto_backup${suffix}`,
  backupHistory: `all_eagle_v22_backup_history${suffix}`,
  audit: `all_eagle_v22_audit${suffix}`,
  parentLoginGuard: `all_eagle_v22_parent_login_guard${suffix}`,
  preRestoreBackup: `all_eagle_v22_pre_restore${suffix}`
};

export const REMOTE_CONFIG = {
  stateId: "alliance_mooca_kids_v22",
  systemConfigId: "alliance_system_config_v1",
  appwrite: {
    endpoint: "https://nyc.cloud.appwrite.io/v1",
    projectId: "6a5ae8f4000c42f9f83e",
    databaseId: "alliance_db",
    tableId: "app_state",
    bucketId: "alliance_files"
  },
  supabase: {
    url: "https://oozzhujtyqsaxhkluxer.supabase.co",
    anonKey: "sb_publishable_aKMcW5XwbBUj95uciZlO4w_YVOdz13J"
  }
};
