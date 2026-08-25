import React from "react";
import { calculateAge, getAutoCategory, getBeltFamily, getRuleInfo, getRules } from "./rules/graduationRules.js";
import { getStudentPresenceAlertDays, shouldAlertAbsence } from "./rules/attendanceRules.js";
import { addDaysISO, formatDateBR, getTodayISO, parseLocalDate } from "./utils/dates.js";
import { AVATAR_BOY, AVATAR_GIRL, AvatarOptions, getDefaultPresetForSex, StudentAvatar } from "./components/StudentAvatar.jsx";
import { DEMO_PACKAGE_MODE, DEMO_PACKAGE_URL, HYDRATION_TIMEOUT_MS, LOCAL_DEMO_MODE, REMOTE_CONFIG, STORAGE_KEYS } from "./config/runtime.js";
import { buildBackupPayload, getStoredArrayCount, saveAutomaticLocalBackup } from "./services/localState.js";
import { createAppwriteServices, createSupabaseClient, getAppwriteErrorMessage, getAppwriteState, getAppwriteSystemConfig, parseRemoteJson, parseSystemConfig, saveAppwriteState, saveAppwriteSystemConfig, withTimeout } from "./services/remoteState.js";
import BrandLockup from "./components/BrandLockup.jsx";
import { LoginScreen, RoleSelectionScreen } from "./screens/AuthScreens.jsx";
import BeltHistory from "./components/BeltHistory.jsx";
import { authenticateProfessor, findParentStudent } from "./rules/authRules.js";
import { migrateBackupPayload } from "./rules/backupRules.js";
import { buildCentralMetrics } from "./rules/centralMetrics.js";
import CentralDashboard from "./screens/CentralDashboard.jsx";
import MetricRuleInfo from "./components/MetricRuleInfo.jsx";


    const beltOrder = ["Branca", "Cinza/Branca", "Cinza", "Cinza/Preta", "Amarela/Branca", "Amarela", "Amarela/Preta", "Laranja/Branca", "Laranja", "Laranja/Preta", "Verde/Branca", "Verde", "Verde/Preta"];
    const groups = ["Baby Eagle", "Little Eagle", "Eagle Warrior", "Eagle Youth"];
    const categoryOptions = ["Auto", "Baby Eagle", "Little Eagle", "Eagle Warrior", "Eagle Youth"];
    const classDays = [1, 3, 5, 6]; // Segunda, quarta, sexta e sábado.
    const LOCAL_STUDENTS_KEY = STORAGE_KEYS.students;
    const LOCAL_REPO_KEY = STORAGE_KEYS.repo;
    const LOCAL_USERS_KEY = STORAGE_KEYS.users;
    const LOCAL_UNITS_KEY = STORAGE_KEYS.units;
    const LOCAL_SELECTED_UNIT_KEY = STORAGE_KEYS.selectedUnit;
    const LOCAL_THEME_KEY = STORAGE_KEYS.theme;
    const LOCAL_PENDING_SYNC_KEY = STORAGE_KEYS.pendingSync;
    const LOCAL_AUTO_BACKUP_KEY = STORAGE_KEYS.autoBackup;
    const LOCAL_BACKUP_HISTORY_KEY = STORAGE_KEYS.backupHistory;
    const LOCAL_AUDIT_KEY = STORAGE_KEYS.audit;
    const SUPABASE_STATE_ID = REMOTE_CONFIG.stateId;
    const createDefaultSystemUsers = () => ([
        { id: 1, nome: "Administrador", login: "admin", senha: "admin", perfil: "Administrador", unidadeId: "all", status: "Ativo", createdAt: new Date().toISOString() }
    ]);

    const FILE_LIMITS = {
        avatar: 350 * 1024,
        chatImage: 650 * 1024,
        repoImage: 900 * 1024,
        genericFile: 1200 * 1024
    };

    const getBase64Bytes = (dataUrl = "") => {
        const base64 = String(dataUrl).split(",")[1] || "";
        return Math.ceil((base64.length * 3) / 4);
    };

    const formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const getDataSignature = (students, repo) => {
        try {
            return JSON.stringify({
                students: students || [],
                repo: repo || []
            });
        } catch (e) {
            return `${Date.now()}`;
        }
    };

    const dataUrlToFile = (dataUrl, fileName) => {
        const [meta, base64] = String(dataUrl).split(",");
        const mime = meta.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
        const binary = atob(base64 || "");
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new File([bytes], fileName, { type: mime });
    };

    const buildStorageFileName = (file, type) => {
        const safeName = (file?.name || "arquivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const prefix = type === "avatar" ? "avatar" : type === "chat" ? "chat" : "repo";
        return `${prefix}_${Date.now()}_${safeName}`;
    };

    const compressImage = (base64Str, maxWidth = 900, quality = 0.58) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onerror = () => resolve(base64Str);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        });
    };

    function getBehaviorChallenge(student = {}) {
        const start = student.desafioInicio || "";
        const days = Number(student.desafioDias) || 0;
        if (!start || days <= 0) return null;
        const end = addDaysISO(start, days);
        const startDate = parseLocalDate(start);
        const endDate = parseLocalDate(end);
        const today = parseLocalDate(getTodayISO());
        const remaining = endDate ? Math.ceil((endDate - today) / 86400000) : null;
        return {
            title: student.desafioTitulo || "Desafio comportamental",
            start,
            days,
            end,
            active: !!student.desafioAtivo,
            reached: !!student.desafioAtivo && !!endDate && today >= endDate,
            remaining,
            elapsed: startDate ? Math.max(0, Math.floor((today - startDate) / 86400000) + 1) : 0
        };
    }


    function getBeltVisualStyle(faixa = "") {
        const normalized = String(faixa).toLowerCase();
        const primary = normalized.startsWith("branca") ? "#f5f5f2"
            : normalized.startsWith("cinza") ? "#9ca3af"
            : normalized.startsWith("amarela") ? "#f4c430"
            : normalized.startsWith("laranja") ? "#f97316"
            : normalized.startsWith("verde") ? "#22a866"
            : "#58a6ff";
        const secondary = normalized.includes("/branca") ? "#f5f5f2"
            : normalized.includes("/preta") ? "#171717"
            : primary;
        return {
            "--belt-primary": primary,
            "--belt-secondary": secondary
        };
    }
    function getPrevisaoGraduacao(aulasAtuais, nascimento, faixa, categoriaOverride = "Auto") {
        const ruleInfo = getRuleInfo(nascimento, faixa, categoriaOverride);
        const rules = ruleInfo.aulasPorGrau;
        if (!ruleInfo.elegivel || rules <= 0) return ruleInfo.aviso;
        const aulasSeguras = Math.max(0, Number(aulasAtuais) || 0);
        const totalAulasNecessarias = rules * 9;
        const aulasFaltantes = Math.max(0, totalAulasNecessarias - aulasSeguras);
        
        if (aulasFaltantes <= 0) return "Pronto para exame!";
        
        const dataPrevisa = new Date();
        let aulasContadas = 0;
        while (aulasContadas < aulasFaltantes) {
            dataPrevisa.setDate(dataPrevisa.getDate() + 1);
            if (classDays.includes(dataPrevisa.getDay())) aulasContadas++;
        }
        
        return dataPrevisa.toLocaleDateString('pt-BR');
    }

    function getGraduationProgress(aulasAtuais, nascimento, faixa, comp = {}, categoriaOverride = "Auto") {
        const ruleInfo = getRuleInfo(nascimento, faixa, categoriaOverride);
        const rules = ruleInfo.aulasPorGrau;
        if (!ruleInfo.elegivel || rules <= 0) {
            return {
                total: 0,
                feitas: 0,
                faltantes: 0,
                percentual: 0,
                elegivel: false,
                aviso: ruleInfo.aviso,
                aulasPorGrau: 0,
                previsao: ruleInfo.aviso
            };
        }
        const aulasSeguras = Math.max(0, Number(aulasAtuais) || 0);
        const total = rules * 9;
        const feitas = Math.min(aulasSeguras, total);
        const faltantes = Math.max(0, total - feitas);
        const aulasPercentual = total ? (feitas / total) * 100 : 0;
        const meritos = ["Rel", "Comp", "Notas", "Hab"];
        const meritosFeitos = meritos.filter(k => comp?.[k]).length;
        const percentual = Math.min(100, Math.round((aulasPercentual * 0.75) + ((meritosFeitos / meritos.length) * 25)));
        return {
            total,
            feitas,
            faltantes,
            percentual,
            elegivel: ruleInfo.elegivel,
            aviso: ruleInfo.aviso,
            aulasPorGrau: rules,
            previsao: getPrevisaoGraduacao(aulasSeguras, nascimento, faixa, categoriaOverride)
        };
    }

    function getPresenceDegreeStates(aulas = 0, rules = 1, savedStates = null) {
        if (Array.isArray(savedStates) && savedStates.length === 4) {
            return savedStates.map(state => Math.max(0, Math.min(2, Number(state) || 0)));
        }
        const graus = rules > 0 ? Math.floor(aulas / rules) : 0;
        return Array.from({length: 4}).map((_, i) => {
            if (graus > i + 4) return 2; // Vermelho sobreposto.
            if (graus > i) return 1; // Branco convencional.
            return 0;
        });
    }

    function getBehaviorDoneCount(comp = {}) {
        return ["Rel", "Comp", "Notas", "Hab"].filter(key => comp?.[key]).length;
    }

    function runAllianceRuleTests() {
        const results = [];
        const assertEqual = (name, actual, expected) => {
            const passed = actual === expected;
            results.push({ name, passed, actual, expected });
            if (!passed) throw new Error(`${name}: esperado ${expected}, recebido ${actual}`);
        };
        const birthdayForAge = (age) => {
            const date = new Date();
            date.setFullYear(date.getFullYear() - age);
            date.setDate(date.getDate() - 1);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        };

        assertEqual("3 a 4 anos: Baby Eagle", getAutoCategory(birthdayForAge(3)), "Baby Eagle");
        assertEqual("5 a 7 anos: Little Eagle", getAutoCategory(birthdayForAge(5)), "Little Eagle");
        assertEqual("8 a 12 anos: Eagle Warrior", getAutoCategory(birthdayForAge(8)), "Eagle Warrior");
        assertEqual("13 a 15 anos: Eagle Youth", getAutoCategory(birthdayForAge(13)), "Eagle Youth");
        assertEqual("16 anos: fora da regra", getAutoCategory(birthdayForAge(16)), "Fora da regra");
        assertEqual("Baby Branca/Cinza: 12 aulas", getRules(birthdayForAge(3), "Branca"), 12);
        assertEqual("Little Branca/Cinza: 15 aulas", getRules(birthdayForAge(5), "Cinza/Preta"), 15);
        assertEqual("Little Amarela/Laranja: 20 aulas", getRules(birthdayForAge(5), "Amarela/Branca"), 20);
        assertEqual("Youth Verde: 25 aulas", getRules(birthdayForAge(13), "Verde/Branca"), 25);
        assertEqual("Progresso completo Little: 100%", getGraduationProgress(135, birthdayForAge(5), "Branca", {Rel:true, Comp:true, Notas:true, Hab:true}).percentual, 100);
        assertEqual("Graus preservam brancos ao iniciar vermelhos", getPresenceDegreeStates(5 * 15, 15).join(","), "2,1,1,1");

        return { passed: results.length, results };
    }

    window.__ALLIANCE_RULES__ = { getAutoCategory, getRuleInfo, getRules, getGraduationProgress, getPresenceDegreeStates };
    window.__runAllianceRuleTests = runAllianceRuleTests;

    function buildBeltCycleRecord(student, nextBelt, changeType = "Graduacao") {
        const rules = getRules(student.nascimento, student.faixa, student.categoriaOverride);
        const progress = getGraduationProgress(student.aulas, student.nascimento, student.faixa, student.comp, student.categoriaOverride);
        const states = rules > 0 ? getPresenceDegreeStates(student.aulas, rules, student.presenceDegrees) : [0, 0, 0, 0];
        const todayIso = getTodayISO();
        return {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            faixa: student.faixa,
            proximaFaixa: nextBelt,
            turma: getAutoCategory(student.nascimento, student.categoriaOverride),
            dataInicio: student.cicloFaixaInicio || student.matricula || "",
            dataConclusao: todayIso,
            aulasFeitas: Math.max(0, Number(student.aulas) || 0),
            aulasNecessarias: progress.total || (rules > 0 ? rules * 9 : 0),
            percentualFinal: progress.percentual || 0,
            grausBrancos: states.filter(state => state >= 1).length,
            grausVermelhos: states.filter(state => state === 2).length,
            comportamentais: getBehaviorDoneCount(student.comp),
            tipo: changeType
        };
    }

    function getBeltHistory(student, progress) {
        const closedCycles = Array.isArray(student.beltHistory) ? student.beltHistory : [];
        const currentRules = getRules(student.nascimento, student.faixa, student.categoriaOverride);
        const currentStates = currentRules > 0 ? getPresenceDegreeStates(student.aulas, currentRules, student.presenceDegrees) : [0, 0, 0, 0];
        return [
            ...closedCycles,
            {
                id: "current",
                faixa: student.faixa,
                proximaFaixa: beltOrder[beltOrder.indexOf(student.faixa) + 1] || student.faixa,
                turma: getAutoCategory(student.nascimento, student.categoriaOverride),
                dataInicio: student.cicloFaixaInicio || student.matricula || "",
                dataConclusao: "",
                aulasFeitas: progress.feitas || 0,
                aulasNecessarias: progress.total || 0,
                percentualFinal: progress.percentual || 0,
                grausBrancos: currentStates.filter(state => state >= 1).length,
                grausVermelhos: currentStates.filter(state => state === 2).length,
                comportamentais: getBehaviorDoneCount(student.comp),
                tipo: "Em andamento",
                current: true
            }
        ];
    }

    function getClassesFromDegreeStates(states, rules) {
        return states.reduce((total, state) => total + state, 0) * rules;
    }

    function getCurrentCycleClasses(aulas = 0, rules = 1) {
        const safeRules = Math.max(1, Number(rules) || 1);
        const safeAulas = Math.max(0, Number(aulas) || 0);
        const total = safeRules * 9;
        if (safeAulas >= total) return safeRules;
        return safeAulas % safeRules;
    }

    const statusOptions = ["Ativo", "Experimental", "Pausado", "Transferido", "Inativo"];
    const DEFAULT_UNIT_ID = "alliance-mooca";
    const DEFAULT_UNIT_NAME = "Alliance Mooca";
    const defaultUnitOptions = [
        { id: DEFAULT_UNIT_ID, nome: DEFAULT_UNIT_NAME, status: "Ativa" }
    ];
    const getStudentUnitId = (student) => student?.unidadeId || DEFAULT_UNIT_ID;
    const getStudentUnitName = (student, units = defaultUnitOptions) => units.find(unit => unit.id === getStudentUnitId(student))?.nome || DEFAULT_UNIT_NAME;
    const normalizeStudent = (student) => ({ ...student, unidadeId: getStudentUnitId(student) });
    const behaviorDegreeOptions = [
        { key: "Rel", label: "Relacionamento", short: "Relac.", className: "degree-rel" },
        { key: "Comp", label: "Comportamento", short: "Comp.", className: "degree-comp" },
        { key: "Notas", label: "Notas / organização", short: "Notas", className: "degree-notas" },
        { key: "Hab", label: "Hábitos", short: "Hab.", className: "degree-hab" }
    ];
    const createEmptyStudentForm = () => ({
        nome: "",
        nascimento: "",
        faixa: "Branca",
        sexo: "M",
        categoriaOverride: "Auto",
        unidadeId: DEFAULT_UNIT_ID,
        status: "Ativo",
        responsavel: "",
        telefone: "",
        email: "",
        matricula: getTodayISO(),
        ultimaPresenca: "",
        necessidades: "",
        observacoesInternas: "",
        avatar: "preset-boy-1",
        autorizacaoImagem: false,
        desafioAtivo: false,
        desafioTitulo: "",
        desafioGrau: "Rel",
        desafioInicio: "",
        desafioDias: ""
    });

    function App() {
        const [mode, setMode] = React.useState(null); 
        const [subMode, setSubMode] = React.useState(null);
        const [auth, setAuth] = React.useState({ user: '', pass: '' });
        const appwriteServices = React.useMemo(() => createAppwriteServices(), []);
        const supabaseClient = React.useMemo(() => createSupabaseClient(), []);
        
        const [students, setStudents] = React.useState(() => {
            try { return JSON.parse(localStorage.getItem(LOCAL_STUDENTS_KEY) || "[]").map(normalizeStudent); } 
            catch(e) { return []; }
        });
        const [repo, setRepo] = React.useState(() => {
            try { return JSON.parse(localStorage.getItem(LOCAL_REPO_KEY) || "[]"); }
            catch(e) { return []; }
        });
        const [users, setUsers] = React.useState(() => {
            try {
                const stored = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
                return Array.isArray(stored) && stored.length ? stored : createDefaultSystemUsers();
            } catch(e) {
                return createDefaultSystemUsers();
            }
        });
        const [units, setUnits] = React.useState(() => {
            try {
                const stored = JSON.parse(localStorage.getItem(LOCAL_UNITS_KEY) || "[]");
                return Array.isArray(stored) && stored.length ? stored : defaultUnitOptions;
            } catch(e) {
                return defaultUnitOptions;
            }
        });
        const [selectedUnitId, setSelectedUnitId] = React.useState(() => localStorage.getItem(LOCAL_SELECTED_UNIT_KEY) || DEFAULT_UNIT_ID);
        const [unitForm, setUnitForm] = React.useState({ nome: "", cidade: "São Paulo", status: "Ativa" });
        const [currentUser, setCurrentUser] = React.useState(null);

        const [searchTerm, setSearchTerm] = React.useState("");
        const [filterGroup, setFilterGroup] = React.useState("Todos");
        const [professorView, setProfessorView] = React.useState("alunos");
        const [parentSection, setParentSection] = React.useState("evolucao");
        const [expandedSearchStudentId, setExpandedSearchStudentId] = React.useState(null);
        const [summaryDetail, setSummaryDetail] = React.useState(null);
        const [dashboardDetail, setDashboardDetail] = React.useState(null);
        const [dashboardInsightMenu, setDashboardInsightMenu] = React.useState(null);
        const [dashboardStudentDetailFilters, setDashboardStudentDetailFilters] = React.useState(null);
        const [dashboardFilters, setDashboardFilters] = React.useState({ group: "Todos", faixa: "Todas", status: "Todos", period: "month" });
        const [dashboardDraftFilters, setDashboardDraftFilters] = React.useState({ group: "Todos", faixa: "Todas", status: "Todos", period: "month" });
        const revealDashboardDetail = (detailKey, options = {}) => {
            if (!options.keepStudentFilters) setDashboardStudentDetailFilters(null);
            setDashboardDetail(detailKey);
            setTimeout(() => {
                document.getElementById("dashboard-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 120);
        };
        const [selectedChatId, setSelectedChatId] = React.useState(null);
        const [conversationSearch, setConversationSearch] = React.useState("");
        const [form, setForm] = React.useState(createEmptyStudentForm);
        const [userForm, setUserForm] = React.useState({ nome: "", login: "", senha: "", perfil: "Professor", unidadeId: DEFAULT_UNIT_ID, status: "Ativo" });
        const [auditSearch, setAuditSearch] = React.useState("");
        const [chatInputs, setChatInputs] = React.useState({});
        const [openChats, setOpenChats] = React.useState({});
        const [degreeDirections, setDegreeDirections] = React.useState({});
        const [modalOpen, setModalOpen] = React.useState(null);
        const [viewImage, setViewImage] = React.useState(null);
        const [installPrompt, setInstallPrompt] = React.useState(null);
        const [isStandaloneApp, setIsStandaloneApp] = React.useState(() =>
            window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
        );
        const [editingStudent, setEditingStudent] = React.useState(null);
        const [avatarPickerStudent, setAvatarPickerStudent] = React.useState(null);
        const [storageWarning, setStorageWarning] = React.useState("");
        const [isHydrated, setIsHydrated] = React.useState(false);
        const [dbStatus, setDbStatus] = React.useState(LOCAL_DEMO_MODE ? "Modo demonstração local - produção desconectada" : (appwriteServices ? "Conectando ao Appwrite..." : (supabaseClient ? "Conectando ao Supabase..." : "Banco não configurado")));
        const [pendingSync, setPendingSync] = React.useState(() => localStorage.getItem(LOCAL_PENDING_SYNC_KEY) === "1");
        const [lastAutoBackupAt, setLastAutoBackupAt] = React.useState(() => {
            try { return JSON.parse(localStorage.getItem(LOCAL_AUTO_BACKUP_KEY) || "{}").timestamp || ""; }
            catch(e) { return ""; }
        });
        const applyingRemoteRef = React.useRef(false);
        const pendingLocalSaveRef = React.useRef(false);
        const lastLocalChangeRef = React.useRef(0);
        const lastSavedAtRef = React.useRef("");
        const lastLocalSignatureRef = React.useRef("");
        const lastRemoteSignatureRef = React.useRef("");
        const systemConfigHydratedRef = React.useRef(false);
        const [theme, setTheme] = React.useState("dark");

        React.useEffect(() => {
            if (!DEMO_PACKAGE_MODE) return;
            let active = true;
            fetch(DEMO_PACKAGE_URL, { cache: "no-store" })
                .then(response => {
                    if (!response.ok) throw new Error(`Pacote demonstrativo indisponível (${response.status})`);
                    return response.json();
                })
                .then(data => {
                    if (!active) return;
                    if (!Array.isArray(data.students) || !data.students.length) {
                        throw new Error("Pacote demonstrativo sem alunos.");
                    }
                    const demoStudents = data.students.map(normalizeStudent);
                    const demoRepo = Array.isArray(data.repo) ? data.repo : [];
                    const demoUsers = Array.isArray(data.users) && data.users.length ? data.users : createDefaultSystemUsers();
                    const demoUnits = Array.isArray(data.units) && data.units.length ? data.units : defaultUnitOptions;
                    localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(demoStudents));
                    localStorage.setItem(LOCAL_REPO_KEY, JSON.stringify(demoRepo));
                    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(demoUsers));
                    localStorage.setItem(LOCAL_UNITS_KEY, JSON.stringify(demoUnits));
                    localStorage.setItem(LOCAL_SELECTED_UNIT_KEY, demoUnits[0].id);
                    setStudents(demoStudents);
                    setRepo(demoRepo);
                    setUsers(demoUsers);
                    setUnits(demoUnits);
                    setSelectedUnitId(demoUnits[0].id);
                    setDbStatus(`Demonstração carregada: ${demoStudents.length} alunos em ${demoUnits.length} unidades`);
                })
                .catch(err => {
                    console.error(err);
                    if (active) setDbStatus(`Erro ao carregar demonstração: ${err.message}`);
                });
            return () => { active = false; };
        }, []);

        const currentProfile = currentUser?.perfil || "Administrador";
        const canAccessDashboard = currentProfile !== "Recepção";
        const canManageUsers = currentProfile === "Administrador";
        const isCentralAdmin = currentProfile === "Administrador";
        const unitOptions = units.filter(unit => (unit.status || "Ativa") === "Ativa" || unit.id === selectedUnitId);
        const effectiveUnitId = isCentralAdmin ? selectedUnitId : (currentUser?.unidadeId || DEFAULT_UNIT_ID);
        const selectedUnit = units.find(unit => unit.id === effectiveUnitId) || units[0] || defaultUnitOptions[0];
        const scopedStudents = students.filter(student => getStudentUnitId(student) === effectiveUnitId);
        const scopedRepo = repo.filter(item => (item.unidadeId || DEFAULT_UNIT_ID) === effectiveUnitId);
        const auditValue = (value) => {
            if (value === undefined || value === null || value === "") return "não informado";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value);
        };
        const createAuditLog = (action, field, before, after) => {
            const actor = currentUser?.nome || currentUser?.login || (mode === "Professor" ? "Professor" : "Sistema");
            const timestamp = new Date().toLocaleString("pt-BR");
            const entry = `AUDITORIA | ${timestamp} | Usuário: ${actor} | ${action} | ${field}: ${auditValue(before)} -> ${auditValue(after)}`;
            try {
                const stored = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
                const audit = Array.isArray(stored) ? stored : [];
                audit.unshift(entry);
                localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(audit.slice(0, 1000)));
            } catch (e) {
                console.warn("Não foi possível registrar a auditoria local.", e);
            }
            return entry;
        };

        const markPendingSync = React.useCallback((message = "Banco offline. Alterações salvas localmente e pendentes de sincronização.") => {
            pendingLocalSaveRef.current = true;
            localStorage.setItem(LOCAL_PENDING_SYNC_KEY, "1");
            setPendingSync(true);
            setDbStatus(message);
        }, []);

        const clearPendingSync = React.useCallback((message) => {
            pendingLocalSaveRef.current = false;
            localStorage.removeItem(LOCAL_PENDING_SYNC_KEY);
            setPendingSync(false);
            if (message) setDbStatus(message);
        }, []);

        const syncLocalChangesNow = React.useCallback(async () => {
            const currentSignature = getDataSignature(students, repo);
            if (!appwriteServices && !supabaseClient) {
                markPendingSync("Banco não configurado. Backup local automático mantido.");
                return false;
            }
            try {
                const updatedAt = new Date().toISOString();
                if (appwriteServices) {
                    await saveAppwriteState(appwriteServices.config, students, repo, updatedAt);
                    lastSavedAtRef.current = updatedAt;
                    lastRemoteSignatureRef.current = currentSignature;
                    clearPendingSync("Pendências sincronizadas com Appwrite");
                    return true;
                }
                const { error } = await withTimeout(
                    supabaseClient.from("app_state").upsert({
                        id: SUPABASE_STATE_ID,
                        students,
                        repo,
                        updated_at: updatedAt
                    }),
                    12000,
                    "Tempo limite ao salvar no Supabase"
                );
                if (error) throw error;
                lastSavedAtRef.current = updatedAt;
                lastRemoteSignatureRef.current = currentSignature;
                clearPendingSync("Pendências sincronizadas com Supabase");
                return true;
            } catch (err) {
                console.error(err);
                markPendingSync(appwriteServices
                    ? `${getAppwriteErrorMessage(err)} Alterações mantidas localmente.`
                    : "Erro ao salvar no Supabase. Alterações mantidas localmente."
                );
                return false;
            }
        }, [students, repo, appwriteServices, supabaseClient, markPendingSync, clearPendingSync]);

        React.useEffect(() => {
            setExpandedSearchStudentId(null);
        }, [searchTerm, filterGroup]);

        React.useEffect(() => {
            if (mode === "Professor" && !canAccessDashboard && professorView === "painel") {
                setProfessorView("alunos");
            }
        }, [mode, canAccessDashboard, professorView]);

        React.useEffect(() => {
            try {
                localStorage.setItem(LOCAL_UNITS_KEY, JSON.stringify(units));
                localStorage.setItem(LOCAL_SELECTED_UNIT_KEY, selectedUnitId);
            } catch (e) {
                console.warn("Não foi possível salvar a configuração das unidades.", e);
            }
        }, [units, selectedUnitId]);

        React.useEffect(() => {
            document.body.classList.toggle("auth-mode", !mode);
            document.body.classList.toggle("parent-mode", mode === "Pais");
            document.body.classList.toggle("conversation-mode", mode === "Professor" && professorView === "conversas");
            return () => {
                document.body.classList.remove("auth-mode");
                document.body.classList.remove("parent-mode");
                document.body.classList.remove("conversation-mode");
            };
        }, [mode, professorView]);

        React.useEffect(() => {
            document.body.classList.toggle("theme-light", theme === "light");
            document.body.classList.toggle("theme-dark", theme === "dark");
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffc400" : "#c9a554");
            localStorage.setItem(LOCAL_THEME_KEY, theme);
            return () => {
                document.body.classList.remove("theme-light");
                document.body.classList.remove("theme-dark");
            };
        }, [theme]);

        React.useEffect(() => {
            const handleInstallPrompt = (event) => {
                event.preventDefault();
                setInstallPrompt(event);
            };
            const handleAppInstalled = () => {
                setInstallPrompt(null);
                setIsStandaloneApp(true);
            };
            window.addEventListener("beforeinstallprompt", handleInstallPrompt);
            window.addEventListener("appinstalled", handleAppInstalled);
            return () => {
                window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
                window.removeEventListener("appinstalled", handleAppInstalled);
            };
        }, []);

        React.useEffect(() => {
            const hydrationFallback = setTimeout(() => {
                setIsHydrated(current => {
                    if (!current) {
                        setDbStatus(appwriteServices
                            ? "Appwrite demorou para responder. Usando dados locais."
                            : (supabaseClient ? "Supabase demorou para responder. Usando dados locais." : "Banco não configurado")
                        );
                        return true;
                    }
                    return current;
                });
            }, HYDRATION_TIMEOUT_MS + 800);

            const loadRemoteData = async () => {
                if (appwriteServices) {
                    try {
                        const localStudents = JSON.parse(localStorage.getItem(LOCAL_STUDENTS_KEY) || "[]").map(normalizeStudent);
                        const localRepo = JSON.parse(localStorage.getItem(LOCAL_REPO_KEY) || "[]");
                        const localSignature = getDataSignature(localStudents, localRepo);
                        lastLocalSignatureRef.current = localSignature;
                        let data = null;

                        try {
                            data = await getAppwriteState(appwriteServices.config);
                        } catch (err) {
                            if (err.status !== 404) throw err;
                        }

                        if (data) {
                            const remoteStudents = parseRemoteJson(data.students, []).map(normalizeStudent);
                            const remoteRepo = parseRemoteJson(data.repo, []);
                            const remoteIsEmpty = remoteStudents.length === 0 && remoteRepo.length === 0;
                            const localHasData = localStudents.length > 0 || localRepo.length > 0;

                            if (remoteIsEmpty && localHasData) {
                                const updatedAt = new Date().toISOString();
                                await saveAppwriteState(appwriteServices.config, localStudents, localRepo, updatedAt);
                                lastSavedAtRef.current = updatedAt;
                                lastRemoteSignatureRef.current = localSignature;
                                applyingRemoteRef.current = true;
                                setStudents(localStudents);
                                setRepo(localRepo);
                                setDbStatus("Base local enviada ao Appwrite");
                            } else {
                                lastSavedAtRef.current = data.updated_at || data.$updatedAt || "";
                                lastRemoteSignatureRef.current = getDataSignature(remoteStudents, remoteRepo);
                                lastLocalSignatureRef.current = lastRemoteSignatureRef.current;
                                applyingRemoteRef.current = true;
                                setStudents(remoteStudents);
                                setRepo(remoteRepo);
                                setDbStatus("Sincronizado com Appwrite");
                            }
                        } else {
                            const updatedAt = new Date().toISOString();
                            await saveAppwriteState(appwriteServices.config, localStudents, localRepo, updatedAt);
                            lastSavedAtRef.current = updatedAt;
                            lastRemoteSignatureRef.current = localSignature;
                            setDbStatus("Dados locais enviados ao Appwrite");
                        }

                        try {
                            const configRow = await getAppwriteSystemConfig(appwriteServices.config);
                            const remoteConfig = parseSystemConfig(configRow);
                            if (remoteConfig.users.length) setUsers(remoteConfig.users);
                            if (remoteConfig.units.length) setUnits(remoteConfig.units);
                        } catch (configError) {
                            if (configError.status === 404) {
                                await saveAppwriteSystemConfig(appwriteServices.config, users, units);
                            } else {
                                console.warn("Configuração multiunidade mantida localmente.", configError);
                            }
                        } finally {
                            systemConfigHydratedRef.current = true;
                        }
                    } catch (err) {
                        console.error(err);
                        setDbStatus(getAppwriteErrorMessage(err));
                    } finally {
                        setIsHydrated(true);
                    }
                    return;
                }

                if (!supabaseClient) {
                    setIsHydrated(true);
                    return;
                }

                try {
                    const localStudents = JSON.parse(localStorage.getItem(LOCAL_STUDENTS_KEY) || "[]").map(normalizeStudent);
                    const localRepo = JSON.parse(localStorage.getItem(LOCAL_REPO_KEY) || "[]");
                    const localSignature = getDataSignature(localStudents, localRepo);
                    lastLocalSignatureRef.current = localSignature;
                    const { data, error } = await withTimeout(
                        supabaseClient
                            .from("app_state")
                            .select("students, repo")
                            .eq("id", SUPABASE_STATE_ID)
                            .maybeSingle(),
                        12000,
                        "Tempo limite ao conectar Supabase"
                    );

                    if (error) throw error;

                    if (data) {
                        const remoteStudents = (Array.isArray(data.students) ? data.students : []).map(normalizeStudent);
                        const remoteRepo = Array.isArray(data.repo) ? data.repo : [];
                        const remoteIsEmpty = remoteStudents.length === 0 && remoteRepo.length === 0;
                        const localHasData = localStudents.length > 0 || localRepo.length > 0;

                        if (remoteIsEmpty && localHasData) {
                            const updatedAt = new Date().toISOString();
                            await withTimeout(
                                supabaseClient.from("app_state").upsert({
                                    id: SUPABASE_STATE_ID,
                                    students: localStudents,
                                    repo: localRepo,
                                    updated_at: updatedAt
                                }),
                                12000,
                                "Tempo limite ao enviar dados ao Supabase"
                            );
                            lastSavedAtRef.current = updatedAt;
                            lastRemoteSignatureRef.current = localSignature;
                            applyingRemoteRef.current = true;
                            setStudents(localStudents);
                            setRepo(localRepo);
                            setDbStatus("Base local enviada ao Supabase");
                        } else {
                            lastSavedAtRef.current = data.updated_at || "";
                            lastRemoteSignatureRef.current = getDataSignature(remoteStudents, remoteRepo);
                            lastLocalSignatureRef.current = lastRemoteSignatureRef.current;
                            applyingRemoteRef.current = true;
                            setStudents(remoteStudents);
                            setRepo(remoteRepo);
                            setDbStatus("Sincronizado com Supabase");
                        }
                    } else {
                        const updatedAt = new Date().toISOString();
                        await withTimeout(
                            supabaseClient.from("app_state").insert({
                                id: SUPABASE_STATE_ID,
                                students: localStudents,
                                repo: localRepo,
                                updated_at: updatedAt
                            }),
                            12000,
                            "Tempo limite ao criar dados no Supabase"
                        );
                        lastSavedAtRef.current = updatedAt;
                        lastRemoteSignatureRef.current = localSignature;
                        setDbStatus("Dados locais enviados ao Supabase");
                    }
                } catch (err) {
                    console.error(err);
                    setDbStatus("Erro ao conectar Supabase. Usando dados locais.");
                } finally {
                    setIsHydrated(true);
                }
            };

            loadRemoteData();
            return () => clearTimeout(hydrationFallback);
        }, [appwriteServices, supabaseClient]);

        React.useEffect(() => {
            if (!isHydrated || !systemConfigHydratedRef.current || !appwriteServices) return;
            const timer = setTimeout(() => {
                saveAppwriteSystemConfig(appwriteServices.config, users, units)
                    .catch(error => console.warn("Não foi possível sincronizar usuários e unidades.", error));
            }, 1800);
            return () => clearTimeout(timer);
        }, [users, units, isHydrated, appwriteServices]);

        React.useEffect(() => { 
            if (!isHydrated) return;
            const currentSignature = getDataSignature(students, repo);
            const signatureChanged = currentSignature !== lastLocalSignatureRef.current;
            try {
                if (signatureChanged) {
                    localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(students));
                    localStorage.setItem(LOCAL_REPO_KEY, JSON.stringify(repo));
                    saveAutomaticLocalBackup(students, repo, "auto-local", users, units);
                    const backupStamp = new Date().toISOString();
                    const storedBackup = JSON.parse(localStorage.getItem(LOCAL_AUTO_BACKUP_KEY) || "{}");
                    setLastAutoBackupAt(storedBackup.timestamp || backupStamp);
                    lastLocalSignatureRef.current = currentSignature;
                }
                setStorageWarning("");
            } catch(e) {
                setStorageWarning("O armazenamento do navegador está cheio. Gere um backup e remova arquivos grandes.");
            }

            if (applyingRemoteRef.current) {
                applyingRemoteRef.current = false;
                return;
            }

            if (!signatureChanged || currentSignature === lastRemoteSignatureRef.current) return;

            pendingLocalSaveRef.current = true;
            localStorage.setItem(LOCAL_PENDING_SYNC_KEY, "1");
            setPendingSync(true);
            lastLocalChangeRef.current = Date.now();
            if (appwriteServices) {
                const syncTimer = setTimeout(async () => {
                    try {
                        const updatedAt = new Date().toISOString();
                        await saveAppwriteState(appwriteServices.config, students, repo, updatedAt);
                        lastSavedAtRef.current = updatedAt;
                        lastRemoteSignatureRef.current = currentSignature;
                        clearPendingSync("Sincronizado com Appwrite");
                    } catch (err) {
                        console.error(err);
                        markPendingSync(`${getAppwriteErrorMessage(err)} Alterações mantidas localmente.`);
                    }
                }, 1800);

                return () => clearTimeout(syncTimer);
            }

            if (!supabaseClient) return;
            const syncTimer = setTimeout(async () => {
                try {
                    const updatedAt = new Date().toISOString();
                    const { error } = await withTimeout(
                        supabaseClient.from("app_state").upsert({
                            id: SUPABASE_STATE_ID,
                            students,
                            repo,
                            updated_at: updatedAt
                        }),
                        12000,
                        "Tempo limite ao salvar no Supabase"
                    );
                    if (error) throw error;
                    lastSavedAtRef.current = updatedAt;
                    lastRemoteSignatureRef.current = currentSignature;
                    clearPendingSync("Sincronizado com Supabase");
                } catch (err) {
                    console.error(err);
                    markPendingSync("Erro ao salvar no Supabase. Alterações mantidas localmente.");
                }
            }, 1800);

            return () => clearTimeout(syncTimer);
        }, [students, repo, isHydrated, appwriteServices, supabaseClient, markPendingSync, clearPendingSync]);

        React.useEffect(() => {
            try {
                localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
            } catch (e) {
                console.warn("Não foi possível salvar os usuários locais.", e);
            }
        }, [users]);

        React.useEffect(() => {
            if (!isHydrated || !pendingSync) return;
            const retry = () => syncLocalChangesNow();
            const retryTimer = setInterval(retry, 20000);
            window.addEventListener("online", retry);
            retry();
            return () => {
                clearInterval(retryTimer);
                window.removeEventListener("online", retry);
            };
        }, [isHydrated, pendingSync, syncLocalChangesNow]);

        React.useEffect(() => {
            if (appwriteServices && isHydrated) {
                const refreshTimer = setInterval(async () => {
                    try {
                        if (document.hidden) return;
                        const localChangeIsFresh = Date.now() - lastLocalChangeRef.current < 8000;
                        if (pendingLocalSaveRef.current || localChangeIsFresh) return;
                        const data = await getAppwriteState(appwriteServices.config);
                        const remoteUpdatedAt = data?.updated_at || data?.$updatedAt || "";
                        if (!remoteUpdatedAt) return;
                        if (lastSavedAtRef.current && new Date(remoteUpdatedAt) <= new Date(lastSavedAtRef.current)) return;
                        lastSavedAtRef.current = remoteUpdatedAt;
                        applyingRemoteRef.current = true;
                        const remoteStudents = parseRemoteJson(data.students, []).map(normalizeStudent);
                        const remoteRepo = parseRemoteJson(data.repo, []);
                        lastRemoteSignatureRef.current = getDataSignature(remoteStudents, remoteRepo);
                        lastLocalSignatureRef.current = lastRemoteSignatureRef.current;
                        setStudents(remoteStudents);
                        setRepo(remoteRepo);
                        setDbStatus("Sincronizado com Appwrite");
                    } catch (err) {
                        console.error(err);
                        setDbStatus(getAppwriteErrorMessage(err));
                    }
                }, 60000);

                return () => clearInterval(refreshTimer);
            }

            if (!supabaseClient || !isHydrated) return;
            const refreshTimer = setInterval(async () => {
                try {
                    if (document.hidden) return;
                    const { data: stampData, error: stampError } = await withTimeout(
                        supabaseClient
                            .from("app_state")
                            .select("updated_at")
                            .eq("id", SUPABASE_STATE_ID)
                            .maybeSingle(),
                        12000,
                        "Tempo limite ao atualizar Supabase"
                    );
                    if (stampError) throw stampError;
                    if (!stampData?.updated_at) return;
                    const localChangeIsFresh = Date.now() - lastLocalChangeRef.current < 8000;
                    if (pendingLocalSaveRef.current || localChangeIsFresh) return;
                    if (lastSavedAtRef.current && new Date(stampData.updated_at) <= new Date(lastSavedAtRef.current)) return;
                    const { data, error } = await withTimeout(
                        supabaseClient
                            .from("app_state")
                            .select("students, repo, updated_at")
                            .eq("id", SUPABASE_STATE_ID)
                            .maybeSingle(),
                        12000,
                        "Tempo limite ao carregar dados do Supabase"
                    );
                    if (error) throw error;
                    if (!data) return;
                    lastSavedAtRef.current = data.updated_at || lastSavedAtRef.current;
                    const remoteStudents = (Array.isArray(data.students) ? data.students : []).map(normalizeStudent);
                    lastRemoteSignatureRef.current = getDataSignature(remoteStudents, data.repo || []);
                    lastLocalSignatureRef.current = lastRemoteSignatureRef.current;
                    applyingRemoteRef.current = true;
                    setStudents(remoteStudents);
                    setRepo(Array.isArray(data.repo) ? data.repo : []);
                    setDbStatus("Sincronizado com Supabase");
                } catch (err) {
                    console.error(err);
                    setDbStatus("Erro ao atualizar Supabase");
                }
            }, 30000);

            return () => clearInterval(refreshTimer);
        }, [appwriteServices, supabaseClient, isHydrated]);

        const handleLogin = () => {
            if (subMode === 'Professor') {
                const loggedUser = authenticateProfessor(users, auth.user, auth.pass);
                if (loggedUser) {
                    setCurrentUser(loggedUser);
                    if (loggedUser.perfil === "Administrador") {
                        setProfessorView("central");
                    } else {
                        setSelectedUnitId(loggedUser.unidadeId || DEFAULT_UNIT_ID);
                        setProfessorView("alunos");
                    }
                    setMode('Professor');
                }
                else alert('Usuário ou senha incorretos.');
            } else {
                const aluno = findParentStudent(students, auth.user, auth.pass);
                if (aluno) {
                    setSelectedUnitId(getStudentUnitId(aluno));
                    setMode('Pais');
                    setSearchTerm(aluno.nome);
                    setFilterGroup("Todos");
                    setExpandedSearchStudentId(null);
                    setProfessorView("alunos");
                }
                else alert('Dados incorretos.');
            }
        };

        const createMessageTimestamp = () => {
            const now = new Date();
            return {
                date: now.toLocaleDateString('pt-BR'),
                time: now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            };
        };

        const getMessageMeta = (message) => {
            if (!message) return "";
            return message.date ? `${message.date} ${message.time || ""}`.trim() : (message.time || "");
        };

        const uploadAppwriteFile = async (fileToUpload, type) => {
            if (!appwriteServices?.storage || !appwriteServices?.ID?.unique) return null;
            const result = await appwriteServices.storage.createFile({
                bucketId: appwriteServices.config.bucketId,
                fileId: appwriteServices.ID.unique(),
                file: fileToUpload
            });
            const fileId = result?.$id;
            if (!fileId) return null;
            const fileUrl = appwriteServices.storage.getFileView({
                bucketId: appwriteServices.config.bucketId,
                fileId
            }).toString();
            return { fileId, fileUrl, type };
        };

        const handleFile = async (file, type, id = null) => {
            if(!file) return;
            const isImage = file.type.startsWith('image/');
            const genericLimit = type === "repo" ? FILE_LIMITS.genericFile : FILE_LIMITS.chatImage;
            if (!isImage && file.size > genericLimit) {
                alert(`Arquivo muito grande. Limite: ${formatBytes(genericLimit)}.`);
                return;
            }
            const reader = new FileReader();
            document.getElementById('compress-loader').style.display = 'block';
            reader.onload = async (e) => {
                try {
                    let finalData = e.target.result;
                    if (isImage) {
                        const imageOptions = type === "avatar"
                            ? { maxWidth: 420, quality: 0.5, limit: FILE_LIMITS.avatar }
                            : type === "repo"
                                ? { maxWidth: 1000, quality: 0.58, limit: FILE_LIMITS.repoImage }
                                : { maxWidth: 820, quality: 0.55, limit: FILE_LIMITS.chatImage };
                        finalData = await compressImage(finalData, imageOptions.maxWidth, imageOptions.quality);
                        if (getBase64Bytes(finalData) > imageOptions.limit) {
                            finalData = await compressImage(finalData, Math.round(imageOptions.maxWidth * 0.75), 0.45);
                        }
                        if (getBase64Bytes(finalData) > imageOptions.limit) {
                            alert(`Imagem muito grande mesmo apos otimizar. Limite: ${formatBytes(imageOptions.limit)}.`);
                            return;
                        }
                    } else if (getBase64Bytes(finalData) > genericLimit) {
                        alert(`Arquivo muito grande. Limite: ${formatBytes(genericLimit)}.`);
                        return;
                    }

                    let uploadedFile = null;
                    try {
                        const uploadFile = isImage
                            ? dataUrlToFile(finalData, buildStorageFileName(file, type))
                            : new File([file], buildStorageFileName(file, type), { type: file.type || "application/octet-stream" });
                        uploadedFile = await uploadAppwriteFile(uploadFile, type);
                    } catch (uploadErr) {
                        console.warn("Falha ao enviar arquivo para o Appwrite Storage. Mantendo arquivo no JSON local.", uploadErr);
                    }
                    
                    if (type === 'avatar') {
                        setStudents(prev => prev.map(s => s.id === id ? { ...s, avatar: uploadedFile?.fileUrl || finalData, avatarFileId: uploadedFile?.fileId || s.avatarFileId } : s));
                    } else if (type === 'chat') {
                        const timestamp = createMessageTimestamp();
                        const msgAnexo = { 
                            id: Date.now(), sender: mode, author: mode === "Professor" ? "Professor" : "PAIS",
                            text: isImage ? "" : `Arquivo: ${file.name}`,
                            fileData: uploadedFile ? "" : finalData,
                            fileName: file.name, isImage: isImage,
                            fileUrl: uploadedFile?.fileUrl || "",
                            fileId: uploadedFile?.fileId || "",
                            date: timestamp.date,
                            time: timestamp.time,
                            readBy: [mode] 
                        };
                        setStudents(prev => prev.map(s => s.id === id ? { ...s, chat: [...(s.chat || []), msgAnexo] } : s));
                    } else if (type === 'repo') {
                        const newItem = { id: Date.now(), unidadeId: effectiveUnitId, name: file.name, data: uploadedFile ? "" : finalData, fileUrl: uploadedFile?.fileUrl || "", fileId: uploadedFile?.fileId || "", date: new Date().toLocaleDateString('pt-BR') };
                        setRepo(prev => [...prev, newItem]);
                    }
                } catch (err) {
                    alert("Não foi possível carregar o arquivo.");
                } finally {
                    document.getElementById('compress-loader').style.display = 'none';
                }
            };
            reader.onerror = () => {
                document.getElementById('compress-loader').style.display = 'none';
                alert("Não foi possível ler o arquivo.");
            };
            reader.readAsDataURL(file);
        };

        const selectStudentAvatar = (studentId, avatarId) => {
            setStudents(prev => prev.map(student => student.id === studentId
                ? { ...student, avatar: avatarId, avatarFileId: "" }
                : student
            ));
            setAvatarPickerStudent(null);
        };

        const togglePresenca = (sid, boxIndex, clickCount = 1) => {
            if(mode !== "Professor") return;
            const aluno = students.find(s => s.id === sid);
            const ruleInfo = aluno ? getRuleInfo(aluno.nascimento, aluno.faixa, aluno.categoriaOverride) : null;
            if (!ruleInfo?.elegivel) {
                alert(ruleInfo?.aviso || "Aluno fora da regra de graduação.");
                return;
            }
            const hojeIso = getTodayISO();
            setStudents(prev => prev.map(s => {
                if (s.id === sid) {
                    const rules = getRules(s.nascimento, s.faixa, s.categoriaOverride);
                    const currentRemainder = getCurrentCycleClasses(s.aulas, rules);
                    if (boxIndex === currentRemainder - 1 && clickCount >= 2) {
                        if (!window.confirm(`Remover a última presença de ${s.nome}? Esta ação ficará registrada no histórico.`)) return s;
                        const novaAula = s.aulas - 1;
                        const { presenceDegrees, ...rest } = s;
                        return { ...rest, aulas: Math.max(0, novaAula), ultimaPresenca: hojeIso, historico: [...(s.historico || []), createAuditLog("Remoção de presença", "Aulas", s.aulas, Math.max(0, novaAula))] };
                    } else if (boxIndex === currentRemainder) {
                        if (s.aulas >= rules * 9) return s;
                        const novaAula = s.aulas + 1;
                        const log = [createAuditLog("Presença registrada", "Aulas", s.aulas, novaAula)];
                        if (novaAula % rules === 0) {
                            const n = novaAula / rules;
                            log.push(n <= 4 ? `GRAU DE PRESENÇA BRANCO (${n}º)` : `GRAU DE PRESENÇA VERMELHO (${n-4}º)`);
                        }
                        const { presenceDegrees, ...rest } = s;
                        return { ...rest, aulas: novaAula, ultimaPresenca: hojeIso, historico: [...(s.historico || []), ...log] };
                    }
                    return s;
                }
                return s;
            }));
        };

        const toggleMerito = (sid, key, label) => {
            if(mode !== "Professor") return;
            setStudents(prev => prev.map(s => s.id === sid ? { ...s, comp: { ...s.comp, [key]: !s.comp?.[key] }, historico: [...(s.historico || []), createAuditLog("Grau comportamental alterado", label, !!s.comp?.[key], !s.comp?.[key])] } : s));
        };

        const updateBehaviorChallenge = (sid, patch, logMessage = "") => {
            if(mode !== "Professor") return;
            const target = students.find(s => s.id === sid);
            if (Object.prototype.hasOwnProperty.call(patch, "desafioAtivo") && target) {
                if (target.desafioAtivo && patch.desafioAtivo === false && !window.confirm(`Finalizar o desafio de ${target.nome}?`)) return;
                if (!target.desafioAtivo && patch.desafioAtivo === true && target.desafioConclusao && !window.confirm(`Reabrir o desafio concluído de ${target.nome}?`)) return;
            }
            setStudents(prev => prev.map(s => {
                if (s.id !== sid) return s;
                const changedChallengeState = Object.prototype.hasOwnProperty.call(patch, "desafioAtivo") && !!s.desafioAtivo !== !!patch.desafioAtivo;
                const audit = changedChallengeState ? createAuditLog(patch.desafioAtivo ? (s.desafioConclusao ? "Desafio reaberto" : "Desafio iniciado") : "Desafio finalizado", "Status do desafio", s.desafioAtivo ? "Ativo" : "Inativo", patch.desafioAtivo ? "Ativo" : "Concluído") : "";
                const historico = logMessage || audit ? [...(s.historico || []), logMessage || audit] : s.historico;
                return { ...s, ...patch, historico };
            }));
        };

        const updateCurrentBeltStart = (sid, dateValue) => {
            if(mode !== "Professor") return;
            setStudents(prev => prev.map(s => {
                if (s.id !== sid) return s;
                return {
                    ...s,
                    cicloFaixaInicio: dateValue,
                    historico: [...(s.historico || []), createAuditLog("Início da faixa alterado", "Data", s.cicloFaixaInicio ? formatDateBR(s.cicloFaixaInicio) : "sem data", dateValue ? formatDateBR(dateValue) : "sem data")]
                };
            }));
        };

        const toggleMeritoWithChallenge = (sid, key, label) => {
            if(mode !== "Professor") return;
            const target = students.find(s => s.id === sid);
            const willClose = target && !target.comp?.[key] && target.desafioAtivo && target.desafioGrau === key;
            if (willClose && !window.confirm(`Marcar ${label} e finalizar o desafio de ${target.nome}?`)) return;
            setStudents(prev => prev.map(s => {
                if (s.id !== sid) return s;
                const willMark = !s.comp?.[key];
                const shouldCloseChallenge = willMark && s.desafioAtivo && s.desafioGrau === key;
                const challengeInfo = shouldCloseChallenge ? getBehaviorChallenge(s) : null;
                const logs = [`${willMark ? "CONCLUIDO" : "REMOVIDO"} ${label}`];
                if (shouldCloseChallenge) {
                    logs.push(`DESAFIO COMPORTAMENTAL ENCERRADO: ${challengeInfo?.title || label} vinculado ao grau ${label} | ${new Date().toLocaleDateString('pt-BR')}`);
                }
                return {
                    ...s,
                    comp: { ...s.comp, [key]: willMark },
                    desafioAtivo: shouldCloseChallenge ? false : s.desafioAtivo,
                    desafioConclusao: shouldCloseChallenge ? getTodayISO() : s.desafioConclusao,
                    historico: [...(s.historico || []), ...logs]
                };
            }));
        };

        const toggleGrauPresenca = (sid, degreeIndex) => {
            if(mode !== "Professor") return;
            const aluno = students.find(s => s.id === sid);
            const ruleInfo = aluno ? getRuleInfo(aluno.nascimento, aluno.faixa, aluno.categoriaOverride) : null;
            if (!ruleInfo?.elegivel) {
                alert(ruleInfo?.aviso || "Aluno fora da regra de graduação.");
                return;
            }

            const directionKey = `${sid}-${degreeIndex}`;
            let nextDirection = null;
            setStudents(prev => prev.map(s => {
                if (s.id !== sid) return s;
                const rules = getRules(s.nascimento, s.faixa, s.categoriaOverride);
                const states = getPresenceDegreeStates(s.aulas || 0, rules, s.presenceDegrees);
                const currentState = states[degreeIndex];
                const direction = degreeDirections[directionKey] || "up";
                let nextState = currentState;
                const hoje = new Date().toLocaleDateString('pt-BR');
                let log = "";

                if (currentState === 0) {
                    nextState = 1;
                    nextDirection = "up";
                    log = `Grau de presença branco adicionado (${degreeIndex + 1}) | ${hoje}`;
                } else if (currentState === 1) {
                    if (direction === "down") {
                        nextState = 0;
                        nextDirection = "up";
                        log = `Grau de presença zerado (${degreeIndex + 1}) | ${hoje}`;
                    } else {
                        nextState = 2;
                        nextDirection = "down";
                        log = `Grau de presença vermelho adicionado (${degreeIndex + 1}) | ${hoje}`;
                    }
                } else {
                    nextState = 1;
                    nextDirection = "down";
                    log = `Grau de presença voltou para branco (${degreeIndex + 1}) | ${hoje}`;
                }

                const nextStates = states.map((state, i) => i === degreeIndex ? nextState : state);
                const novaAula = Math.min(rules * 9, getClassesFromDegreeStates(nextStates, rules));
                return { ...s, aulas: novaAula, presenceDegrees: nextStates, historico: [...(s.historico || []), log] };
            }));
            setDegreeDirections(prev => ({ ...prev, [directionKey]: nextDirection || "up" }));
        };

        const graduarAluno = (sid) => {
            if(mode !== "Professor") return;
            setStudents(prev => prev.map(s => {
                if (s.id === sid) {
                    const cur = beltOrder.indexOf(s.faixa);
                    const prox = beltOrder[cur + 1] || s.faixa;
                    const { presenceDegrees, ...rest } = s;
                    return { ...rest, faixa: prox, aulas: 0, comp: {}, historico: [...(s.historico || []), `GRADUADO: ${prox}`] };
                }
                return s;
            }));
        };

        const graduarAlunoComHistorico = (sid) => {
            if(mode !== "Professor") return;
            const target = students.find(s => s.id === sid);
            if (!target) return;
            const targetBelt = beltOrder[beltOrder.indexOf(target.faixa) + 1] || target.faixa;
            if (!window.confirm(`Confirmar graduação de ${target.nome}: ${target.faixa} para ${targetBelt}?`)) return;
            setStudents(prev => prev.map(s => {
                if (s.id !== sid) return s;
                const cur = beltOrder.indexOf(s.faixa);
                const prox = beltOrder[cur + 1] || s.faixa;
                const beltRecord = buildBeltCycleRecord(s, prox, "Graduacao");
                const { presenceDegrees, ...rest } = s;
                return {
                    ...rest,
                    faixa: prox,
                    aulas: 0,
                    comp: {},
                    cicloFaixaInicio: getTodayISO(),
                    beltHistory: [...(s.beltHistory || []), beltRecord],
                    historico: [...(s.historico || []), createAuditLog("Graduação concluída", "Faixa", s.faixa, prox)]
                };
            }));
        };

        const downloadBackup = () => {
            const data = buildBackupPayload(students, repo, "manual-json", users, units);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_eagle_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        const downloadAutomaticLocalBackup = () => {
            try {
                const data = JSON.parse(localStorage.getItem(LOCAL_AUTO_BACKUP_KEY) || "null") || buildBackupPayload(students, repo, "auto-local", users, units);
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_auto_alliance_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert("Não foi possível baixar o backup automático local.");
            }
        };

        const importBackup = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const migration = migrateBackupPayload(data);
                    if (migration.valid) {
                        const migrated = migration.payload;
                        const restoredStudents = migrated.students.map(normalizeStudent);
                        const restoredRepo = migrated.repo;
                        const restoredUsers = migrated.users.length ? migrated.users : users;
                        const restoredUnits = migrated.units.length ? migrated.units : units;
                        const restoredUnitId = restoredUnits.some(unit => unit.id === selectedUnitId) ? selectedUnitId : restoredUnits[0]?.id || DEFAULT_UNIT_ID;
                        localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(restoredStudents));
                        localStorage.setItem(LOCAL_REPO_KEY, JSON.stringify(restoredRepo));
                        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(restoredUsers));
                        localStorage.setItem(LOCAL_UNITS_KEY, JSON.stringify(restoredUnits));
                        localStorage.setItem(LOCAL_SELECTED_UNIT_KEY, restoredUnitId);
                        setStudents(restoredStudents);
                        setRepo(restoredRepo);
                        setUsers(restoredUsers);
                        setUnits(restoredUnits);
                        setSelectedUnitId(restoredUnitId);
                        const warning = migration.warnings.length ? `\n\nAjustes automáticos:\n${migration.warnings.join("\n")}` : "";
                        alert(`Backup restaurado: ${restoredStudents.length} alunos, ${restoredUnits.length} unidades e ${restoredUsers.length} usuários.${warning}`);
                        setModalOpen(null);
                    } else {
                        alert(`Arquivo de backup inválido: ${migration.errors.join("; ")}`);
                    }
                } catch (err) {
                    alert("Erro ao ler o arquivo.");
                }
            };
            reader.readAsText(file);
        };

        const sendMessage = (sid) => {
            const txt = chatInputs[sid] || "";
            if(!txt.trim()) return;
            const timestamp = createMessageTimestamp();
            const novaMsg = { 
                id: Date.now(), sender: mode, author: mode === "Professor" ? "Professor" : "PAIS",
                text: txt, date: timestamp.date, time: timestamp.time, readBy: [mode]
            };
            setStudents(prev => prev.map(s => s.id === sid ? { ...s, chat: [...(s.chat || []), novaMsg] } : s));
            setChatInputs({ ...chatInputs, [sid]: "" });
        };

        const openProfessorConversation = (sid) => {
            setSelectedChatId(sid);
            setStudents(prev => prev.map(s => s.id === sid ? {
                ...s,
                chat: (s.chat || []).map(m => !(m.readBy || []).includes("Professor") ? { ...m, readBy: [...(m.readBy || []), "Professor"] } : m)
            } : s));
        };

        const markChatAsRead = (sid, reader) => {
            setStudents(prev => prev.map(s => s.id === sid ? {
                ...s,
                chat: (s.chat || []).map(m => !(m.readBy || []).includes(reader) ? { ...m, readBy: [...(m.readBy || []), reader] } : m)
            } : s));
        };

        const agendarExamePeloAlerta = (sid) => {
            if (mode !== "Pais") return;
            setChatInputs({ ...chatInputs, [sid]: "AGENDAR EXAME DE FAIXA" });
            setOpenChats({ ...openChats, [sid]: true });
            setTimeout(() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }, 100);
        };

        const filtered = scopedStudents.filter(s => {
            const matchesName = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGroup = filterGroup === "Todos" || getAutoCategory(s.nascimento, s.categoriaOverride) === filterGroup;
            return matchesName && matchesGroup;
        });
        const professorHasQuery = searchTerm.trim().length > 0 || filterGroup !== "Todos";
        const displayedStudents = mode === "Professor" ? (professorHasQuery ? filtered : []) : filtered;
        const useCompactStudentResults = mode === "Professor" && professorHasQuery;
        const renderedStudents = expandedSearchStudentId ? displayedStudents.filter(s => s.id === expandedSearchStudentId) : displayedStudents;
        const allConversationStudents = scopedStudents
            .map(s => {
                const chat = s.chat || [];
                const lastMessage = chat[chat.length - 1];
                const unread = chat.filter(m => !(m.readBy || []).includes("Professor")).length;
                return { ...s, lastMessage, unread };
            })
            .sort((a, b) => (b.unread - a.unread) || ((b.lastMessage?.id || 0) - (a.lastMessage?.id || 0)) || a.nome.localeCompare(b.nome));
        const conversationStudents = allConversationStudents.filter(s => s.nome.toLowerCase().includes(conversationSearch.toLowerCase()));
        const selectedConversation = conversationStudents.find(s => s.id === selectedChatId) || null;
        const totalUnreadProfessor = allConversationStudents.reduce((total, s) => total + s.unread, 0);
        const openDashboardStudents = (filters = {}) => {
            setDashboardStudentDetailFilters(filters);
            revealDashboardDetail("alunos", { keepStudentFilters: true });
        };
        const openDashboardFilteredStudents = (sourceFilters = dashboardFilters) => {
            const filters = {};
            if (sourceFilters.group !== "Todos") filters.group = sourceFilters.group;
            if (sourceFilters.faixa !== "Todas") filters.faixa = sourceFilters.faixa;
            if (sourceFilters.status !== "Todos") filters.status = sourceFilters.status;
            openDashboardStudents(filters);
        };
        const openStudentFromDashboard = (studentName) => {
            const targetStudent = scopedStudents.find(s => s.nome === studentName);
            setProfessorView("alunos");
            setSearchTerm(studentName);
            setFilterGroup("Todos");
            setExpandedSearchStudentId(targetStudent?.id || null);
            setSummaryDetail(null);
        };
        const today = new Date();
        const parseDashboardDate = (value) => {
            if (!value) return null;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                const [day, month, year] = value.split("/").map(Number);
                return new Date(year, month - 1, day);
            }
            return parseLocalDate(value);
        };
        const getDashboardPeriodStart = () => {
            if (dashboardFilters.period === "all") return null;
            const start = new Date(today);
            start.setHours(0, 0, 0, 0);
            if (dashboardFilters.period === "day") {
                return start;
            }
            if (dashboardFilters.period === "month") {
                start.setDate(1);
                return start;
            }
            const days = Number(dashboardFilters.period || 30);
            start.setDate(start.getDate() - Math.max(0, days - 1));
            return start;
        };
        const dashboardPeriodStart = getDashboardPeriodStart();
        const dashboardPeriodLabel = dashboardFilters.period === "all"
            ? "todo o historico"
            : dashboardFilters.period === "day"
                ? "hoje"
                : dashboardFilters.period === "month"
                    ? "mês atual"
                    : dashboardFilters.period === "7"
                        ? "semana atual"
                        : `ultimos ${dashboardFilters.period} dias`;
        const isInDashboardPeriod = (value) => {
            if (!dashboardPeriodStart) return true;
            const date = parseDashboardDate(value);
            return !!date && date >= dashboardPeriodStart && date <= today;
        };
        const getPreviousDashboardPeriod = () => {
            if (!dashboardPeriodStart) return null;
            const currentStart = new Date(dashboardPeriodStart);
            const currentEnd = new Date(today);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd.setHours(23, 59, 59, 999);
            const duration = currentEnd.getTime() - currentStart.getTime() + 1;
            const previousEnd = new Date(currentStart.getTime() - 1);
            const previousStart = new Date(previousEnd.getTime() - duration + 1);
            return { start: previousStart, end: previousEnd };
        };
        const previousDashboardPeriod = getPreviousDashboardPeriod();
        const isInPreviousDashboardPeriod = (value) => {
            if (!previousDashboardPeriod) return false;
            const date = parseDashboardDate(value);
            return !!date && date >= previousDashboardPeriod.start && date <= previousDashboardPeriod.end;
        };
        const formatPeriodComparison = (current, previous) => {
            if (!previousDashboardPeriod) return "Histórico completo";
            if (previous === 0) return current > 0 ? "Novo no período" : "Sem alteração";
            const delta = Math.round(((current - previous) / previous) * 100);
            if (delta === 0) return "Estável vs período anterior";
            return `${delta > 0 ? "+" : ""}${delta}% vs período anterior`;
        };
        const exportDashboardCsv = () => {
            const headers = ["Aluno", "Turma", "Faixa", "Status", "Ultima presenca", "Progresso", "Aulas faltam", "Mensagens pendentes", "Responsavel", "WhatsApp"];
            const lines = [headers, ...studentsWithProgress.map(s => [
                s.nome,
                getAutoCategory(s.nascimento, s.categoriaOverride),
                s.faixa || "",
                s.status || "Ativo",
                s.ultimaPresenca ? formatDateBR(s.ultimaPresenca) : "",
                `${s.progresso.percentual || 0}%`,
                s.progresso.faltantes ?? "",
                s.unread || 0,
                s.responsavel || "",
                s.telefone || ""
            ])].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";"));
            const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `dashboard-alliance-${getTodayISO()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        };

        const downloadAuditTrail = () => {
            let audit = [];
            try { audit = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]"); } catch(e) {}
            const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), audit }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `auditoria_alliance_${getTodayISO()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
        const getAuditTrail = () => {
            try {
                const stored = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
                return Array.isArray(stored) ? stored : [];
            } catch(e) {
                return [];
            }
        };

        const generateStudentReport = (student) => {
            const reportWindow = window.open("", "_blank", "width=900,height=900");
            if (!reportWindow) return alert("Permita pop-ups para gerar o relatório do aluno.");
            const progress = getGraduationProgress(student.aulas, student.nascimento, student.faixa, student.comp, student.categoriaOverride);
            const challenge = getBehaviorChallenge(student);
            const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
            const historyRows = (student.beltHistory || []).map(item => `<li><strong>${esc(item.faixa || item.belt || "Faixa")}</strong><span>${esc(item.inicio ? formatDateBR(item.inicio) : "Sem data")} - ${esc(item.conclusao ? formatDateBR(item.conclusao) : "Em andamento")}</span></li>`).join("");
            const auditRows = (student.historico || []).slice().reverse().slice(0, 30).map(item => `<li>${esc(item)}</li>`).join("");
            reportWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - ${esc(student.nome)}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:36px}h1{margin-bottom:4px}h2{margin-top:28px;border-bottom:2px solid #d4a62a;padding-bottom:6px}.sub{color:#657084}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.kpi{border:1px solid #d9dee8;border-radius:8px;padding:14px}.kpi strong{display:block;font-size:24px}.kpi span,li span{display:block;color:#657084;font-size:12px;margin-top:4px}ul{padding:0;list-style:none}li{padding:9px 0;border-bottom:1px solid #e5e8ef}button{background:#172033;color:#fff;border:0;border-radius:6px;padding:10px 16px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Salvar em PDF / Imprimir</button><h1>${esc(student.nome)}</h1><div class="sub">Relatório individual gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div><div class="grid"><div class="kpi"><strong>${esc(student.faixa)}</strong><span>Faixa atual</span></div><div class="kpi"><strong>${esc(getAutoCategory(student.nascimento, student.categoriaOverride))}</strong><span>Turma</span></div><div class="kpi"><strong>${esc(progress.percentual || 0)}%</strong><span>Evolução</span></div><div class="kpi"><strong>${esc(student.aulas || 0)}</strong><span>Aulas realizadas</span></div><div class="kpi"><strong>${Object.values(student.comp || {}).filter(Boolean).length}/4</strong><span>Graus comportamentais</span></div><div class="kpi"><strong>${challenge?.active ? "Ativo" : "Sem desafio ativo"}</strong><span>Desafio</span></div></div><h2>Desafio comportamental</h2><p>${challenge?.active ? `${esc(challenge.title)} - ${esc(formatDateBR(challenge.start))} até ${esc(formatDateBR(challenge.end))}` : "Nenhum desafio ativo."}</p><h2>Histórico de faixas</h2><ul>${historyRows || "<li>Nenhum ciclo anterior registrado.</li>"}</ul><h2>Histórico operacional recente</h2><ul>${auditRows || "<li>Nenhuma alteração registrada.</li>"}</ul></body></html>`);
            reportWindow.document.close();
        };
        const downloadDelimitedFile = (filename, headers, rows) => {
            const safeRows = Array.isArray(rows) ? rows : [];
            const lines = [headers, ...safeRows].map(row =>
                row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")
            );
            const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        };
        const escapeTableValue = (value) => String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        const downloadExcelTable = (filename, headers, rows) => {
            const safeRows = Array.isArray(rows) ? rows : [];
            const table = `
                <table>
                    <thead><tr>${headers.map(header => `<th>${escapeTableValue(header)}</th>`).join("")}</tr></thead>
                    <tbody>${safeRows.map(row => `<tr>${row.map(value => `<td>${escapeTableValue(value)}</td>`).join("")}</tr>`).join("")}</tbody>
                </table>
            `;
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${table}</body></html>`;
            const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        };
        const dashboardStudents = scopedStudents.filter(s => {
            const group = getAutoCategory(s.nascimento, s.categoriaOverride);
            const status = s.status || "Ativo";
            const matchesGroup = dashboardFilters.group === "Todos" || group === dashboardFilters.group;
            const matchesFaixa = dashboardFilters.faixa === "Todas" || s.faixa === dashboardFilters.faixa;
            const matchesStatus = dashboardFilters.status === "Todos" || status === dashboardFilters.status;
            return matchesGroup && matchesFaixa && matchesStatus;
        });
        const dashboardFilterActive = dashboardFilters.group !== "Todos" || dashboardFilters.faixa !== "Todas" || dashboardFilters.status !== "Todos";
        const applyStudentDetailFilters = (list, filters = {}) => list.filter(s => {
            const group = getAutoCategory(s.nascimento, s.categoriaOverride);
            const status = s.status || "Ativo";
            const matchesGroup = !filters.group || group === filters.group;
            const matchesFaixa = !filters.faixa || s.faixa === filters.faixa;
            const matchesStatus = !filters.status || (Array.isArray(filters.status) ? filters.status.includes(status) : status === filters.status);
            return matchesGroup && matchesFaixa && matchesStatus;
        });
        const dashboardDetailStudents = dashboardStudentDetailFilters ? applyStudentDetailFilters(dashboardStudents, dashboardStudentDetailFilters) : dashboardStudents;
        const dashboardDetailFilterLabel = dashboardStudentDetailFilters
            ? Object.entries(dashboardStudentDetailFilters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" - ")
            : null;
        const activeStudents = dashboardStudents.filter(s => (s.status || "Ativo") === "Ativo");
        const inactiveStudents = dashboardStudents.filter(s => (s.status || "Ativo") === "Inativo");
        const experimentalStudents = dashboardStudents.filter(s => (s.status || "Ativo") === "Experimental");
        const disconnectedStudents = dashboardStudents.filter(s => ["Pausado", "Transferido"].includes(s.status || "Ativo"));
        const readyList = dashboardStudents.filter(s => {
            const rules = getRules(s.nascimento, s.faixa, s.categoriaOverride);
            return rules > 0 && s.aulas >= rules * 9 && s.comp?.Rel && s.comp?.Comp && s.comp?.Notas && s.comp?.Hab;
        });
        const dashboardRows = {
            categorias: groups.map(group => ({
                label: group,
                value: dashboardStudents.filter(s => getAutoCategory(s.nascimento, s.categoriaOverride) === group).length
            })),
            faixas: beltOrder.map(faixa => ({
                label: faixa,
                value: dashboardStudents.filter(s => s.faixa === faixa).length
            })).filter(row => row.value > 0),
            status: statusOptions.map(status => ({
                label: status,
                value: dashboardStudents.filter(s => (s.status || "Ativo") === status).length
            })).filter(row => row.value > 0)
        };
        const maxCategory = Math.max(1, ...dashboardRows.categorias.map(row => row.value));
        const maxBelt = Math.max(1, ...dashboardRows.faixas.map(row => row.value));
        const maxStatus = Math.max(1, ...dashboardRows.status.map(row => row.value));
        const dashboardBeltAgeRows = dashboardRows.faixas.map(row => {
            const beltStudents = dashboardStudents.filter(s => s.faixa === row.label);
            const ages = beltStudents.map(s => Number(calculateAge(s.nascimento))).filter(age => Number.isFinite(age));
            const averageAge = ages.length ? Math.round(ages.reduce((total, age) => total + age, 0) / ages.length) : null;
            return { ...row, averageAge, ageLabel: averageAge === null ? "sem idade" : `${averageAge} anos media` };
        });
        const dashboardTotal = Math.max(1, dashboardStudents.length);
        const groupRowsWithPercent = dashboardRows.categorias.map(row => ({
            ...row,
            percent: Math.round((row.value / dashboardTotal) * 100)
        }));
        const beltRowsWithPercent = dashboardBeltAgeRows.map(row => ({
            ...row,
            percent: Math.round((row.value / dashboardTotal) * 100)
        }));
        const topBeltRow = beltRowsWithPercent.length
            ? [...beltRowsWithPercent].sort((a, b) => {
                const valueDiff = b.value - a.value;
                if (valueDiff) return valueDiff;
                return b.percent - a.percent;
            })[0]
            : null;
        const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        previousMonthEnd.setHours(23, 59, 59, 999);
        const previousMonthDashboardStudents = dashboardStudents.filter(student => {
            const enrollmentDate = parseLocalDate(student.matricula || student.cicloFaixaInicio || "");
            return !enrollmentDate || enrollmentDate <= previousMonthEnd;
        });
        const previousMonthDashboardCount = previousMonthDashboardStudents.length;
        const dashboardStudentDelta = dashboardStudents.length - previousMonthDashboardCount;
        const dashboardStudentDeltaPercent = previousMonthDashboardCount > 0
            ? Math.round((dashboardStudentDelta / previousMonthDashboardCount) * 100)
            : (dashboardStudents.length > 0 ? 100 : 0);
        const dashboardStudentDeltaLabel = previousMonthDashboardCount <= 0
            ? (dashboardStudents.length > 0 ? "Nova base no período" : "Sem base anterior")
            : dashboardStudentDelta === 0
                ? "Estável vs mês anterior"
                : `${dashboardStudentDelta > 0 ? "+" : ""}${dashboardStudentDeltaPercent}% vs mês anterior`;
        const getDashboardInsightExportData = (type) => {
            switch (type) {
                case "turmas":
                    return {
                        title: "distribuicao-por-turma",
                        headers: ["Turma", "Alunos", "Percentual"],
                        rows: groupRowsWithPercent.map(row => [row.label, row.value, `${row.percent}%`])
                    };
                case "faixas":
                    return {
                        title: "distribuicao-por-faixa",
                        headers: ["Faixa", "Alunos", "Idade média", "Percentual"],
                        rows: beltRowsWithPercent.map(row => [row.label, row.value, row.averageAge ?? "-", `${row.percent}%`])
                    };
                case "frequencia":
                    return {
                        title: "top-frequencia",
                        headers: ["Posição", "Aluno", "Turma", "Faixa", "Presenças", "Percentual do líder"],
                        rows: studentPresenceRanking.map((student, index) => [
                            index + 1,
                            student.nome,
                            student.turma,
                            student.faixa,
                            student.count,
                            `${highestPresenceCount > 0 ? Math.round((student.count / highestPresenceCount) * 100) : 0}%`
                        ])
                    };
                default:
                    return null;
            }
        };
        const exportDashboardInsight = (type, format = "csv") => {
            const data = getDashboardInsightExportData(type);
            if (!data) return;
            const filenameBase = `${data.title}-${getTodayISO()}`;
            if (format === "excel") {
                downloadExcelTable(`${filenameBase}.xls`, data.headers, data.rows);
            } else {
                downloadDelimitedFile(`${filenameBase}.csv`, data.headers, data.rows);
            }
            setDashboardInsightMenu(null);
        };
        const renderDashboardInsightMenu = (type) => (
            <div className="dashboard-insight-menu-wrap">
                <button
                    type="button"
                    className="dashboard-insight-menu"
                    aria-label="Exportar dados do card"
                    onClick={(event) => {
                        event.stopPropagation();
                        setDashboardInsightMenu(current => current === type ? null : type);
                    }}
                >
                    <i className="fas fa-ellipsis"></i>
                </button>
                {dashboardInsightMenu === type && (
                    <div className="dashboard-insight-dropdown" onClick={event => event.stopPropagation()}>
                        <button type="button" onClick={() => exportDashboardInsight(type, "csv")}>
                            <i className="fas fa-file-csv"></i>
                            <span>Exportar CSV</span>
                        </button>
                        <button type="button" onClick={() => exportDashboardInsight(type, "excel")}>
                            <i className="fas fa-file-excel"></i>
                            <span>Exportar Excel</span>
                        </button>
                    </div>
                )}
            </div>
        );
        const studentsWithProgress = dashboardStudents.map(s => ({
            ...s,
            progresso: getGraduationProgress(s.aulas, s.nascimento, s.faixa, s.comp, s.categoriaOverride),
            unread: s.chat?.filter(m => !(m.readBy || []).includes("Professor")).length || 0
        }));
        const examCandidates = studentsWithProgress
            .filter(s => s.progresso.elegivel && s.progresso.percentual >= 75)
            .sort((a, b) => b.progresso.percentual - a.progresso.percentual);
        const nearGraduation = examCandidates
            .slice(0, 5);
        const imageAuthPending = dashboardStudents.filter(s => !s.autorizacaoImagem).length;
        const challengeStudents = dashboardStudents
            .map(s => ({ ...s, desafioInfo: getBehaviorChallenge(s) }))
            .filter(s => s.desafioInfo?.active);
        const challengeReachedStudents = challengeStudents
            .filter(s => s.desafioInfo.reached)
            .sort((a, b) => parseLocalDate(a.desafioInfo.end) - parseLocalDate(b.desafioInfo.end));
        const retentionRate = dashboardStudents.length ? Math.round((activeStudents.length / dashboardStudents.length) * 100) : 0;
        const operationalStatusRows = [
            {
                label: "Ativos",
                value: activeStudents.length,
                percent: Math.round((activeStudents.length / dashboardTotal) * 100),
                type: "normal",
                filter: { status: "Ativo" },
                note: `${Math.round((activeStudents.length / dashboardTotal) * 100)}% ativos`
            },
            {
                label: "Inativos",
                value: inactiveStudents.length,
                percent: Math.round((inactiveStudents.length / dashboardTotal) * 100),
                type: "warning",
                filter: { status: "Inativo" },
                note: `${inactiveStudents.length} aluno${inactiveStudents.length === 1 ? "" : "s"}`
            },
            {
                label: "Desligados",
                value: disconnectedStudents.length,
                percent: Math.round((disconnectedStudents.length / dashboardTotal) * 100),
                type: "alert",
                filter: { status: ["Pausado", "Transferido"] },
                note: `${disconnectedStudents.length} aluno${disconnectedStudents.length === 1 ? "" : "s"}`
            },
            {
                label: "Experimentais",
                value: experimentalStudents.length,
                percent: Math.round((experimentalStudents.length / dashboardTotal) * 100),
                type: "info",
                filter: { status: "Experimental" },
                note: `${experimentalStudents.length} aluno${experimentalStudents.length === 1 ? "" : "s"}`
            }
        ];
        const getChallengeStatus = (info) => {
            if (!info?.active) return { label: "Concluído", type: "done" };
            if (info.remaining === 0) return { label: "Vence hoje", type: "today" };
            if ((info.remaining ?? 1) < 0 || info.reached) return { label: "Vencido", type: "overdue" };
            return { label: "Em andamento", type: "active" };
        };
        const challengeStatusText = (info) => {
            const status = getChallengeStatus(info);
            if (status.type === "active") return `${status.label} - faltam ${Math.max(0, info.remaining)} dia${info.remaining === 1 ? "" : "s"}`;
            return status.label;
        };
        const averageProgress = studentsWithProgress.length ? Math.round(studentsWithProgress.reduce((total, s) => total + (s.progresso.percentual || 0), 0) / studentsWithProgress.length) : 0;
        const totalUnreadDashboard = studentsWithProgress.reduce((total, s) => total + s.unread, 0);
        const unreadConversationCount = studentsWithProgress.filter(s => s.unread > 0).length;
        const topUnread = studentsWithProgress
            .filter(s => s.unread > 0)
            .sort((a, b) => b.unread - a.unread)
            .slice(0, 5);
        const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
        const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
        const getStudentPresenceDates = (student) => {
            const historyDates = (student.historico || [])
                .map(item => {
                    const text = String(item || "");
                    const match = text.match(/^Aula\s+\d+\s+\|\s+(\d{2}\/\d{2}\/\d{4})$/);
                    return match ? match[1] : null;
                })
                .filter(Boolean);
            return historyDates.length ? historyDates : (student.ultimaPresenca ? [student.ultimaPresenca] : []);
        };
        const recentPresenceStudents = dashboardStudents.flatMap(s => getStudentPresenceDates(s).filter(dateValue => isInDashboardPeriod(dateValue)).map(dateValue => ({ studentId: s.id, studentName: s.nome, group: getAutoCategory(s.nascimento, s.categoriaOverride), faixa: s.faixa, date: dateValue })));
        const previousPresenceCount = dashboardStudents.reduce((total, student) => total + getStudentPresenceDates(student).filter(isInPreviousDashboardPeriod).length, 0);
        const dailyPresenceMap = recentPresenceStudents.reduce((acc, item) => {
            const parsedDate = parseDashboardDate(item.date);
            if (!parsedDate) return acc;
            const day = String(parsedDate.getDate()).padStart(2, "0");
            const key = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${day}`;
            if (!acc[key]) acc[key] = { key, label: day, displayDate: parsedDate.toLocaleDateString("pt-BR"), weekday: weekdayLabels[parsedDate.getDay()], count: 0, date: parsedDate, students: [] };
            acc[key].count += 1;
            if (!acc[key].students.some(student => student.id === item.studentId)) {
                acc[key].students.push({ id: item.studentId, name: item.studentName, group: item.group, faixa: item.faixa });
            }
            return acc;
        }, {});
        const buildEmptyPresenceRow = (date) => {
            const day = String(date.getDate()).padStart(2, "0");
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${day}`;
            return { key, label: day, displayDate: date.toLocaleDateString("pt-BR"), weekday: weekdayLabels[date.getDay()], count: 0, date: new Date(date), students: [] };
        };
        const dailyPresenceRows = (() => {
            if (!dashboardPeriodStart) {
                return Object.values(dailyPresenceMap).sort((a, b) => a.date - b.date).slice(-31);
            }
            const rows = [];
            const cursor = new Date(dashboardPeriodStart);
            const hardLimit = 31;
            const earliest = new Date(today);
            earliest.setHours(0, 0, 0, 0);
            earliest.setDate(earliest.getDate() - (hardLimit - 1));
            if (cursor < earliest) cursor.setTime(earliest.getTime());
            while (cursor <= today) {
                const emptyRow = buildEmptyPresenceRow(cursor);
                rows.push(dailyPresenceMap[emptyRow.key] || emptyRow);
                cursor.setDate(cursor.getDate() + 1);
            }
            return rows;
        })();
        const maxDailyPresence = Math.max(1, ...dailyPresenceRows.map(row => row.count));
        const busiestPresenceDate = [...dailyPresenceRows].filter(row => row.count > 0).sort((a, b) => (b.count - a.count) || (b.date - a.date))[0] || null;
        const recentMessages = dashboardStudents.reduce((total, s) => {
            return total + (s.chat || []).filter(m => isInDashboardPeriod(m.date)).length;
        }, 0);
        const previousMessages = dashboardStudents.reduce((total, s) => {
            return total + (s.chat || []).filter(m => isInPreviousDashboardPeriod(m.date)).length;
        }, 0);
        const presenceComparisonLabel = formatPeriodComparison(recentPresenceStudents.length, previousPresenceCount);
        const messageComparisonLabel = formatPeriodComparison(recentMessages, previousMessages);
        const getBirthdayThisYear = (student) => {
            const birthday = parseLocalDate(student.nascimento);
            if (!birthday) return null;
            const date = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
            date.setHours(0, 0, 0, 0);
            return date;
        };
        const getBirthdayPeriodRange = () => {
            const start = new Date(today);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            if (dashboardFilters.period === "day") {
                return { start, end, label: "hoje" };
            }
            if (dashboardFilters.period === "7") {
                end.setDate(start.getDate() + 6);
                return { start, end, label: "semana atual" };
            }
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            monthEnd.setHours(0, 0, 0, 0);
            return { start: monthStart, end: monthEnd, label: "mês atual" };
        };
        const birthdayPeriod = getBirthdayPeriodRange();
        const birthdayStudents = dashboardStudents
            .map(s => ({ ...s, birthdayThisYear: getBirthdayThisYear(s) }))
            .filter(s => s.birthdayThisYear && s.birthdayThisYear >= birthdayPeriod.start && s.birthdayThisYear <= birthdayPeriod.end)
            .sort((a, b) => a.birthdayThisYear - b.birthdayThisYear);
        const todayBirthdayStudents = birthdayStudents.filter(s =>
            s.birthdayThisYear &&
            s.birthdayThisYear.getDate() === today.getDate() &&
            s.birthdayThisYear.getMonth() === today.getMonth()
        );
        const presenceByDay = dashboardStudents.reduce((acc, s) => {
            getStudentPresenceDates(s).forEach(dateValue => {
                if (!isInDashboardPeriod(dateValue)) return;
                const date = parseDashboardDate(dateValue);
                if (!date) return;
                const weekday = date.getDay();
                const label = weekdayLabels[weekday];
                if (!acc[label]) acc[label] = { count: 0, weekday, dates: {} };
                acc[label].count += 1;
                const formatted = formatDateBR(dateValue);
                if (formatted) acc[label].dates[formatted] = (acc[label].dates[formatted] || 0) + 1;
            });
            return acc;
        }, {});
        const presenceByWeekdayRows = Object.entries(presenceByDay)
            .map(([label, info]) => ({ label, ...info }))
            .sort((a, b) => {
                const countDiff = b.count - a.count;
                if (countDiff) return countDiff;
                return weekdayOrder.indexOf(a.weekday) - weekdayOrder.indexOf(b.weekday);
            });
        const busiestPresenceDay = presenceByWeekdayRows[0] ? [presenceByWeekdayRows[0].label, presenceByWeekdayRows[0].count] : null;
        const busiestPresenceLabel = busiestPresenceDate ? `${busiestPresenceDate.weekday} ${busiestPresenceDate.displayDate} (${busiestPresenceDate.count} presença${busiestPresenceDate.count === 1 ? "" : "s"})` : "Sem presença no período";
        const groupedRecentPresenceStudents = Object.values(recentPresenceStudents.reduce((acc, item) => {
            if (!acc[item.studentId]) {
                const sourceStudent = dashboardStudents.find(student => student.id === item.studentId) || {};
                acc[item.studentId] = {
                    id: item.studentId,
                    nome: item.studentName,
                    turma: item.group,
                    faixa: item.faixa,
                    nascimento: sourceStudent.nascimento || "",
                    sexo: sourceStudent.sexo || "M",
                    avatar: sourceStudent.avatar || "",
                    status: sourceStudent.status || "Ativo",
                    count: 0,
                    lastDate: "",
                    lastDateParsed: null
                };
            }
            acc[item.studentId].count += 1;
            const parsedDate = parseDashboardDate(item.date);
            if (parsedDate && (!acc[item.studentId].lastDateParsed || parsedDate > acc[item.studentId].lastDateParsed)) {
                acc[item.studentId].lastDate = item.date;
                acc[item.studentId].lastDateParsed = parsedDate;
            }
            return acc;
        }, {})).sort((a, b) => {
            const countDiff = b.count - a.count;
            if (countDiff) return countDiff;
            const dateDiff = (b.lastDateParsed?.getTime?.() || 0) - (a.lastDateParsed?.getTime?.() || 0);
            if (dateDiff) return dateDiff;
            return a.nome.localeCompare(b.nome, "pt-BR");
        });
        const studentPresenceRanking = Object.values(recentPresenceStudents.reduce((acc, item) => {
            if (!acc[item.studentId]) {
                const sourceStudent = dashboardStudents.find(student => student.id === item.studentId) || {};
                acc[item.studentId] = {
                    id: item.studentId,
                    nome: item.studentName,
                    turma: item.group,
                    faixa: item.faixa,
                    count: 0,
                    nascimento: sourceStudent.nascimento || "",
                    sexo: sourceStudent.sexo || "M",
                    avatar: sourceStudent.avatar || "",
                    status: sourceStudent.status || "Ativo"
                };
            }
            acc[item.studentId].count += 1;
            return acc;
        }, {})).sort((a, b) => {
            const countDiff = b.count - a.count;
            if (countDiff) return countDiff;
            return a.nome.localeCompare(b.nome);
        });
        const highestPresenceCount = studentPresenceRanking[0]?.count || 0;
        const noRecentPresenceList = activeStudents.filter(s => {
            return shouldAlertAbsence(s, today);
        }).map(s => {
            const lastPresence = parseLocalDate(s.ultimaPresenca);
            const days = getStudentPresenceAlertDays(s);
            return { ...s, daysWithoutPresence: days, missingPresenceSinceEnrollment: !lastPresence };
        }).sort((a, b) => (b.daysWithoutPresence ?? 9999) - (a.daysWithoutPresence ?? 9999));
        const studentsWithoutRecentPresence = noRecentPresenceList.length;
        const imagePendingStudents = dashboardStudents.filter(s => !s.autorizacaoImagem);
        const lowProgressStudents = studentsWithProgress
            .filter(s => s.progresso.elegivel && s.progresso.percentual < 30)
            .sort((a, b) => a.progresso.percentual - b.progresso.percentual);
        const attentionStudents = [
            ...topUnread.map(s => ({ ...s, priorityReason: `${s.unread} mensagem${s.unread === 1 ? "" : "s"} pendente${s.unread === 1 ? "" : "s"}`, priorityType: "Mensagem" })),
            ...todayBirthdayStudents.map(s => ({ ...s, priorityReason: `aniversaria hoje • ${calculateAge(s.nascimento)} anos`, priorityType: "Aniversário" })),
            ...challengeReachedStudents.slice(0, 5).map(s => ({ ...s, priorityReason: `desafio atingiu o prazo em ${formatDateBR(s.desafioInfo.end)}`, priorityType: "Desafio" })),
            ...noRecentPresenceList.slice(0, 5).map(s => ({ ...s, priorityReason: s.daysWithoutPresence === null ? "sem presença registrada" : `${s.daysWithoutPresence} dias sem presença`, priorityType: "Presença" })),
            ...examCandidates.slice(0, 5).map(s => ({ ...s, priorityReason: `${s.progresso.percentual}% pronto para exame`, priorityType: "Exame" }))
        ].filter((item, index, arr) => arr.findIndex(other => other.id === item.id && other.priorityType === item.priorityType) === index);
        const attentionRows = Object.values(attentionStudents.reduce((acc, item) => {
            if (!acc[item.id]) acc[item.id] = { ...item, priorityTypes: [], priorityReasons: [] };
            if (!acc[item.id].priorityTypes.includes(item.priorityType)) acc[item.id].priorityTypes.push(item.priorityType);
            acc[item.id].priorityReasons.push(item.priorityReason);
            return acc;
        }, {}));
        const followUpStudents = [...topUnread, ...noRecentPresenceList, ...challengeReachedStudents]
            .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index);
        const followUpCount = followUpStudents.length;
        const todayActionCount = attentionRows.length;
        const dashboardInsightText = totalUnreadDashboard > 0
            ? `${totalUnreadDashboard} mensagem${totalUnreadDashboard === 1 ? "" : "s"} pendente${totalUnreadDashboard === 1 ? "" : "s"} pedem atenção antes da próxima aula.`
            : noRecentPresenceList.length > 0
                ? `${noRecentPresenceList.length} aluno${noRecentPresenceList.length === 1 ? "" : "s"} sem presença recente merece${noRecentPresenceList.length === 1 ? "" : "m"} acompanhamento.`
                : examCandidates.length > 0
                    ? `${examCandidates.length} aluno${examCandidates.length === 1 ? "" : "s"} já aparece${examCandidates.length === 1 ? "" : "m"} perto do exame.`
                    : "A turma não possui alertas críticos no momento.";
        const dashboardDetailMap = {
            alunos: {
                title: "Alunos cadastrados",
                subtitle: dashboardDetailFilterLabel || (dashboardFilterActive ? "Lista filtrada da base atual" : "Lista completa da base atual"),
                rows: dashboardDetailStudents.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${calculateAge(s.nascimento)} anos • ${getAutoCategory(s.nascimento, s.categoriaOverride)}`,
                    studentCard: true,
                    compactMiniCard: true,
                    avatar: s.avatar,
                    sexo: s.sexo,
                    nascimento: s.nascimento,
                    faixa: s.faixa,
                    turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                    status: s.status || "Ativo",
                    action: () => openStudentFromDashboard(s.nome)
                }))
            },
            prontos: {
                title: "Prontos para exame",
                subtitle: "Alunos acima de 75% de conclusão",
                rows: examCandidates.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${s.progresso.percentual}% concluído - faltam ${s.progresso.faltantes} aula${s.progresso.faltantes === 1 ? "" : "s"}`,
                    studentCard: true,
                    avatar: s.avatar,
                    sexo: s.sexo,
                    nascimento: s.nascimento,
                    faixa: s.faixa,
                    turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                    status: s.status || "Ativo",
                    action: () => openStudentFromDashboard(s.nome)
                }))
            },
            mensagens: {
                title: "Mensagens pendentes",
                subtitle: "Conversas com leitura pendente para o professor",
                rows: studentsWithProgress.filter(s => s.unread > 0).map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${s.unread} mensagem${s.unread === 1 ? "" : "s"} sem leitura`,
                    studentCard: true,
                    avatar: s.avatar,
                    sexo: s.sexo,
                    nascimento: s.nascimento,
                    faixa: s.faixa,
                    turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                    status: s.status || "Ativo",
                    action: () => { setProfessorView("conversas"); openProfessorConversation(s.id); },
                    actionLabel: "Abrir"
                }))
            },
            evolucao: {
                title: "Evolução média",
                subtitle: "Ranking de progresso até a próxima faixa",
                rows: studentsWithProgress
                    .filter(s => s.progresso.elegivel)
                    .sort((a, b) => b.progresso.percentual - a.progresso.percentual)
                    .map(s => ({
                        id: s.id,
                        name: s.nome,
                        meta: `${s.progresso.percentual}% concluído • ${s.progresso.faltantes} aulas faltam`,
                        studentCard: true,
                        avatar: s.avatar,
                        sexo: s.sexo,
                        nascimento: s.nascimento,
                        faixa: s.faixa,
                        turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                        status: s.status || "Ativo",
                        action: () => openStudentFromDashboard(s.nome)
                    }))
            },
            presenca: {
                title: "Sem presença recente",
                subtitle: "Alunos sem data de presença ou há 7 dias ou mais",
                rows: noRecentPresenceList.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: s.ultimaPresenca
                        ? `Última presença: ${formatDateBR(s.ultimaPresenca)}`
                        : (s.daysWithoutPresence !== null ? `${s.daysWithoutPresence} dias sem presença registrada` : "Sem presença registrada"),
                    studentCard: true,
                    compactPresenceCard: true,
                    avatar: s.avatar,
                    sexo: s.sexo,
                    nascimento: s.nascimento,
                    faixa: s.faixa,
                    turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                    status: s.status || "Ativo",
                    action: () => openStudentFromDashboard(s.nome)
                }))
            },
            "presencas-periodo": {
                title: "Presenças no período",
                subtitle: `Alunos com presença registrada em ${dashboardPeriodLabel}`,
                rows: groupedRecentPresenceStudents
                    .map(item => ({
                        id: item.id,
                        name: item.nome,
                        meta: `${item.count} presença${item.count === 1 ? "" : "s"} • última presença ${formatDateBR(item.lastDate) || "-"}`,
                        studentCard: true,
                        compactMiniCard: true,
                        avatar: item.avatar,
                        sexo: item.sexo,
                        nascimento: item.nascimento,
                        faixa: item.faixa,
                        turma: item.turma,
                        status: item.status,
                        action: () => openStudentFromDashboard(item.nome),
                        actionLabel: "Aluno"
                    }))
            },
            frequencia: {
                title: "Top frequência no período",
                subtitle: studentPresenceRanking.length ? `Alunos com maior assiduidade em ${dashboardPeriodLabel}` : "Sem frequência registrada no período",
                rows: studentPresenceRanking.map((item, index) => ({
                    id: item.id,
                    name: item.nome,
                    meta: `${item.count} presença${item.count === 1 ? "" : "s"} • ${item.turma}`,
                    studentCard: true,
                    compactMiniCard: true,
                    ranking: index + 1,
                    avatar: item.avatar,
                    sexo: item.sexo,
                    nascimento: item.nascimento,
                    faixa: item.faixa,
                    turma: item.turma,
                    status: item.status || "Ativo",
                    action: () => openStudentFromDashboard(item.nome),
                    actionLabel: "Aluno"
                }))
            },
            meta: {
                title: "Evolução média da turma",
                subtitle: "Alunos que precisam de ação hoje: mensagens, ausência ou desafio vencido",
                rows: followUpStudents.map(s => {
                    const motivos = [];
                    const unread = s.unread || ((s.chat || []).filter(m => !(m.readBy || []).includes("Professor")).length);
                    const absent = noRecentPresenceList.find(item => item.id === s.id);
                    const challenge = challengeReachedStudents.find(item => item.id === s.id);
                    if (unread > 0) motivos.push(`${unread} mensagem${unread === 1 ? "" : "s"} pendente${unread === 1 ? "" : "s"}`);
                    if (absent) motivos.push(absent.daysWithoutPresence === null ? "sem presença registrada" : `${absent.daysWithoutPresence} dias sem presença`);
                    if (challenge) motivos.push(`desafio vencido em ${formatDateBR(challenge.desafioInfo.end)}`);
                    return {
                        id: s.id,
                        name: s.nome,
                        meta: motivos.join(" • "),
                        studentCard: true,
                        avatar: s.avatar,
                        sexo: s.sexo,
                        nascimento: s.nascimento,
                        faixa: s.faixa,
                        turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                        status: s.status || "Ativo",
                        action: () => unread > 0 ? (setProfessorView("conversas"), openProfessorConversation(s.id)) : openStudentFromDashboard(s.nome),
                        actionLabel: unread > 0 ? "Conversa" : "Aluno"
                    };
                })
            },
            imagem: {
                title: "Autorização pendente",
                subtitle: "Alunos sem autorizacao de uso de imagem marcada",
                rows: dashboardStudents.filter(s => !s.autorizacaoImagem).map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${s.responsavel || "Responsável não informado"} • autorização não marcada`,
                    studentCard: true,
                    avatar: s.avatar,
                    sexo: s.sexo,
                    nascimento: s.nascimento,
                    faixa: s.faixa,
                    turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                    status: s.status || "Ativo",
                    action: () => { setEditingStudent({...s}); setModalOpen("edit"); }
                }))
            },
            desafios: {
                title: "Desafios vencidos",
                subtitle: "Alunos com desafio que atingiu ou passou do prazo",
                rows: challengeReachedStudents.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${challengeStatusText(s.desafioInfo)} • ${s.desafioInfo.title || "Sem descrição"} • ${behaviorDegreeOptions.find(option => option.key === s.desafioGrau)?.label || "Grau não informado"} • término ${formatDateBR(s.desafioInfo.end)}`,
                    action: () => openStudentFromDashboard(s.nome),
                    actionLabel: "Aluno"
                }))
            },
            "desafios-ativos": {
                title: "Desafios ativos",
                subtitle: "Alunos em desafio comportamental, incluindo os que ainda estao no prazo",
                rows: challengeStudents.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${challengeStatusText(s.desafioInfo)} - ${s.desafioInfo.title || "Sem descricao"} - ${behaviorDegreeOptions.find(option => option.key === s.desafioGrau)?.label || "Grau nao informado"} - inicio ${formatDateBR(s.desafioInfo.start)} - termino ${formatDateBR(s.desafioInfo.end)}`,
                    action: () => openStudentFromDashboard(s.nome),
                    actionLabel: "Aluno"
                }))
            },
            aniversariantes: {
                title: "Aniversariantes",
                subtitle: `Alunos com aniversario em ${birthdayPeriod.label}`,
                rows: birthdayStudents.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${s.birthdayThisYear.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${calculateAge(s.nascimento)} anos - ${getAutoCategory(s.nascimento, s.categoriaOverride)} - ${s.faixa}`,
                    studentCard: true,
                    compactMiniCard: true,
                    avatar: s.avatar,
                    sexo: s.sexo,
                    nascimento: s.nascimento,
                    faixa: s.faixa,
                    turma: getAutoCategory(s.nascimento, s.categoriaOverride),
                    status: s.status || "Ativo",
                    action: () => openStudentFromDashboard(s.nome),
                    actionLabel: "Aluno"
                }))
            },
            movimento: {
                title: "Maior dia de movimento",
                subtitle: busiestPresenceDate ? `${busiestPresenceDate.weekday}, ${busiestPresenceDate.displayDate} - ${busiestPresenceDate.count} presenças` : "Sem presenças no período selecionado",
                rows: busiestPresenceDate ? busiestPresenceDate.students.map(student => {
                    const sourceStudent = dashboardStudents.find(s => s.id === student.id) || {};
                    return {
                        id: student.id,
                        name: student.name,
                        meta: `${student.group} • ${student.faixa} • presente em ${busiestPresenceDate.displayDate}`,
                        studentCard: true,
                        compactMiniCard: true,
                        avatar: sourceStudent.avatar,
                        sexo: sourceStudent.sexo,
                        nascimento: sourceStudent.nascimento,
                        faixa: student.faixa || sourceStudent.faixa,
                        turma: student.group || getAutoCategory(sourceStudent.nascimento, sourceStudent.categoriaOverride),
                        status: sourceStudent.status || "Ativo",
                        action: () => openStudentFromDashboard(student.name),
                        actionLabel: "Aluno"
                    };
                }) : []
            },
            arquivos: {
                title: "Arquivos",
                subtitle: "Anexos disponiveis no repositorio interno",
                rows: scopedRepo.map((file, index) => ({
                    id: file.id || index,
                    name: file.name || file.fileName || file.titulo || `Arquivo ${index + 1}`,
                    meta: file.category || file.categoria || file.type || "Arquivo salvo",
                    action: () => setModalOpen("repo"),
                    actionLabel: "Ver"
                }))
            },
            prioridades: {
                title: "Atenção da semana",
                subtitle: "Lista operacional: quem olhar primeiro e por qual motivo",
                rows: attentionStudents.map((s, index) => ({
                    id: `${s.id}-${s.priorityType}-${index}`,
                    name: s.nome,
                    meta: `${s.priorityType}: ${s.priorityReason}`,
                    action: () => s.priorityType === "Mensagem" ? (setProfessorView("conversas"), openProfessorConversation(s.id)) : openStudentFromDashboard(s.nome),
                    actionLabel: s.priorityType === "Mensagem" ? "Conversa" : "Aluno"
                }))
            },
            "evolucao-baixa": {
                title: "Alunos abaixo de 30%",
                subtitle: "Alunos que podem precisar de incentivo ou revisão de presença",
                rows: lowProgressStudents.map(s => ({
                    id: s.id,
                    name: s.nome,
                    meta: `${s.progresso.percentual}% concluído - faltam ${s.progresso.faltantes} aulas`,
                    action: () => openStudentFromDashboard(s.nome)
                }))
            }
        };
        const activeDashboardDetail = dashboardDetail ? dashboardDetailMap[dashboardDetail] : null;
        const generateDashboardReport = () => {
            const esc = value => String(value ?? "").replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char] || char));
            const rows = (items, emptyText) => items.length
                ? items.map(item => `<li><strong>${esc(item.name || item.nome)}</strong><span>${esc(item.meta || item.priorityReason || "")}</span></li>`).join("")
                : `<li><strong>${esc(emptyText)}</strong><span></span></li>`;
            const readyRows = examCandidates.map(s => ({ name: s.nome, meta: `${s.progresso.percentual}% concluído - ${s.progresso.faltantes} aulas faltam` }));
            const followRows = followUpStudents.map(s => {
                const unread = s.unread || ((s.chat || []).filter(m => !(m.readBy || []).includes("Professor")).length);
                const absent = noRecentPresenceList.find(item => item.id === s.id);
                const challenge = challengeReachedStudents.find(item => item.id === s.id);
                const motivos = [];
                if (unread > 0) motivos.push(`${unread} mensagem${unread === 1 ? "" : "s"} pendente${unread === 1 ? "" : "s"}`);
                if (absent) motivos.push(absent.daysWithoutPresence === null ? "sem presença registrada" : `${absent.daysWithoutPresence} dias sem presença`);
                if (challenge) motivos.push(`desafio vencido em ${formatDateBR(challenge.desafioInfo.end)}`);
                return { name: s.nome, meta: motivos.join(" • ") };
            });
            const challengeRows = challengeReachedStudents.map(s => ({ name: s.nome, meta: `${s.desafioInfo.title} - ${formatDateBR(s.desafioInfo.end)}` }));
            const birthdayRows = birthdayStudents.map(s => ({
                name: s.nome,
                meta: `${s.birthdayThisYear.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} • ${calculateAge(s.nascimento)} anos • ${getAutoCategory(s.nascimento, s.categoriaOverride)}`
            }));
            const report = window.open("", "_blank", "width=980,height=720");
            if (!report) return alert("Permita pop-ups para gerar o relatório em PDF.");
            report.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório do Painel</title><style>
                body{font-family:Arial,sans-serif;margin:32px;color:#151515} h1{margin:0 0 6px;font-size:28px} h2{font-size:16px;margin:24px 0 10px;text-transform:uppercase;border-bottom:2px solid #c9a554;padding-bottom:6px}.sub{color:#555;font-weight:700}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.kpi{border:1px solid #ddd;border-radius:10px;padding:12px}.kpi strong{display:block;font-size:24px}.kpi span{font-size:11px;text-transform:uppercase;color:#666;font-weight:700}ul{list-style:none;padding:0;margin:0}li{display:grid;grid-template-columns:1fr 2fr;gap:10px;border-bottom:1px solid #eee;padding:9px 0}li span{color:#555}.summary{background:#f4f8fb;border:1px solid #d7e8f5;border-radius:12px;padding:14px;line-height:1.45}@media print{button{display:none}body{margin:18mm}}
            </style></head><body><button onclick="window.print()">Salvar em PDF / Imprimir</button><h1>Alliance Jiu Jitsu Kids</h1><div class="sub">${esc(professorView === "central" ? "Painel Central da Rede" : (selectedUnit?.nome || DEFAULT_UNIT_NAME))} • Relatório do painel - ${esc(new Date().toLocaleDateString("pt-BR"))} - ${esc(dashboardPeriodLabel)}</div><div class="grid"><div class="kpi"><strong>${dashboardStudents.length}</strong><span>alunos filtrados</span></div><div class="kpi"><strong>${readyStudents}</strong><span>prontos para exame</span></div><div class="kpi"><strong>${followUpCount}</strong><span>meta de acompanhamento</span></div><div class="kpi"><strong>${averageProgress}%</strong><span>evolução média</span></div></div><div class="summary"><strong>Resumo executivo:</strong> ${esc(dashboardInsightText)} Maior dia de movimento: ${esc(busiestPresenceLabel)}. Presenças no período: ${recentPresenceStudents.length}. Mensagens no período: ${recentMessages}. Aniversariantes no período: ${birthdayStudents.length}.</div><h2>Alunos prontos para exame</h2><ul>${rows(readyRows, "Nenhum aluno pronto para exame")}</ul><h2>Alunos que precisam de acompanhamento</h2><ul>${rows(followRows, "Nenhum aluno precisa de ação hoje")}</ul><h2>Aniversariantes do período</h2><ul>${rows(birthdayRows, "Nenhum aniversariante no período selecionado")}</ul><h2>Desafios vencidos</h2><ul>${rows(challengeRows, "Nenhum desafio vencido")}</ul><h2>Maior dia de movimento</h2><ul><li><strong>${esc(busiestPresenceLabel)}</strong><span>Baseado nas presenças registradas no período selecionado.</span></li></ul><script>setTimeout(() => window.print(), 400)<\/script></body></html>`);
            report.document.close();
        };

        React.useEffect(() => {
            if (mode === "Professor" && professorView === "conversas" && selectedConversation && selectedConversation.unread > 0) {
                openProfessorConversation(selectedConversation.id);
            }
        }, [mode, professorView, selectedConversation?.id, selectedConversation?.unread]);

        const installApp = async () => {
            if (!installPrompt) return;
            installPrompt.prompt();
            await installPrompt.userChoice.catch(() => null);
            setInstallPrompt(null);
        };

        const readyStudents = readyList.length;
        if (!mode) {
            if (!subMode) return <RoleSelectionScreen onProfessor={() => setSubMode("Professor")} onParents={() => setSubMode("Pais")} canInstall={!!installPrompt && !isStandaloneApp} onInstall={installApp} />;
            return <LoginScreen subMode={subMode} auth={auth} onAuthChange={setAuth} onLogin={handleLogin} onBack={() => { setSubMode(null); setAuth({user:'', pass:''}); }} />;
        }

        return (
            <div className={`container ${mode === "Professor" && ["central", "conversas", "painel"].includes(professorView) ? "wide-container" : ""}`}>
                <header className="header-main">
                    <div className="app-brand-header" aria-label="Alliance Jiu Jitsu Kids">
                        <BrandLockup compact>
                            <div className="brand-unit-label"><i className="fas fa-location-dot"></i>{professorView === "central" ? "Painel Central da Rede" : (selectedUnit?.nome || DEFAULT_UNIT_NAME)}</div>
                        </BrandLockup>
                    </div>
                    {/* Botão de backup */}
                    {mode === "Professor" && (
                        <div className="btn-settings-hidden" onClick={() => setModalOpen('backup')}>
                            <i className="fas fa-cog"></i>
                        </div>
                    )}
                </header>

                {storageWarning && <div className="warning-banner">{storageWarning}</div>}

                {mode === "Professor" && professorView !== "central" && (
                    <div className="unit-context-bar">
                        <div className="unit-context-info">
                            <span className="unit-context-icon"><i className="fas fa-building"></i></span>
                            <span><small>Unidade em operação</small><strong>{selectedUnit?.nome || DEFAULT_UNIT_NAME}</strong></span>
                        </div>
                        {isCentralAdmin && (
                            <div className="unit-context-actions">
                                <select value={effectiveUnitId} onChange={e => { setSelectedUnitId(e.target.value); setSearchTerm(""); setFilterGroup("Todos"); setExpandedSearchStudentId(null); }}>
                                    {unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}
                                </select>
                                <button className="filter-btn" onClick={() => setProfessorView("central")}><i className="fas fa-th-large"></i> Central</button>
                            </div>
                        )}
                    </div>
                )}
                {mode === "Professor" && totalUnreadProfessor > 0 && !["conversas", "central"].includes(professorView) && (
                    <div className="pending-message-alert">
                        <div>
                            <strong><i className="fas fa-bell"></i> Mensagens pendentes de leitura</strong>
                            <span>{totalUnreadProfessor} {totalUnreadProfessor === 1 ? "mensagem" : "mensagens"} aguardando visualização em {unreadConversationCount} conversa{unreadConversationCount === 1 ? "" : "s"}.</span>
                        </div>
                        <button onClick={() => setProfessorView("conversas")}><i className="fab fa-whatsapp"></i> Ver mensagens</button>
                    </div>
                )}

                {mode === "Professor" && (
                    <>
                        {professorView === "central" && isCentralAdmin && (
                            <CentralDashboard
                                model={buildCentralMetrics({ students, units, getStudentUnitId, getStudentPresenceDates, parsePresenceDate: parseDashboardDate })}
                                units={units}
                                studentsCount={students.length}
                                onAddUnit={() => setModalOpen("units")}
                                onManageUsers={() => setModalOpen("users")}
                                onOpenUnit={unitId => { setSelectedUnitId(unitId); setProfessorView("alunos"); setSearchTerm(""); setFilterGroup("Todos"); }}
                                onLogout={() => { setMode(null); setSubMode(null); setCurrentUser(null); setAuth({user:'', pass:''}); setSearchTerm(""); setFilterGroup("Todos"); setExpandedSearchStudentId(null); setProfessorView("alunos"); }}
                            />
                        )}
                        {professorView === "alunos" && (
                            <div className="summary-grid">
                                <div className="summary-item"><strong>{scopedStudents.length}</strong><span>alunos</span></div>
                                <div className={`summary-item clickable ${summaryDetail === "prontos" ? "active" : ""}`} onClick={() => setSummaryDetail(summaryDetail === "prontos" ? null : "prontos")}><strong>{readyStudents}</strong><span>prontos para exame</span></div>
                                <div className="summary-item"><strong>{scopedRepo.length}</strong><span>arquivos</span></div>
                            </div>
                        )}
                        {professorView === "alunos" && summaryDetail === "prontos" && (
                            <div className="summary-ready-list">
                                <div className="summary-ready-head">
                                    <span>Alunos prontos para exame</span>
                                    <small>{readyList.length}</small>
                                </div>
                                {readyList.length > 0 ? readyList.map(s => {
                                    const progress = getGraduationProgress(s.aulas, s.nascimento, s.faixa, s.comp, s.categoriaOverride);
                                    return (
                                        <button key={s.id} className="summary-ready-row" onClick={() => openStudentFromDashboard(s.nome)}>
                                            <strong>{s.nome}</strong>
                                            <span>{progress.percentual}% - {s.faixa}</span>
                                        </button>
                                    );
                                }) : (
                                    <div className="summary-ready-empty">Nenhum aluno pronto no momento.</div>
                                )}
                            </div>
                        )}
                        {professorView === "alunos" && (
                            <div className="search-container">
                                <div className={`search-field ${searchTerm || filterGroup !== "Todos" ? "has-clear" : ""}`}>
                                    <i className="fas fa-search search-icon"></i>
                                    <input
                                        className="search-input"
                                        placeholder="Buscar por nome..."
                                        value={searchTerm}
                                        onFocus={() => setFilterGroup("Todos")}
                                        onChange={e => {
                                            setFilterGroup("Todos");
                                            setSearchTerm(e.target.value);
                                            setExpandedSearchStudentId(null);
                                        }}
                                    />
                                    {(searchTerm || filterGroup !== "Todos") && (
                                        <button className="search-clear-btn" onClick={() => { setSearchTerm(""); setFilterGroup("Todos"); setExpandedSearchStudentId(null); }}>
                                            <i className="fas fa-times"></i> Limpar
                                        </button>
                                    )}
                                </div>
                                <div className="filter-bar">
                                    {groups.map(g => (
                                        <button key={g} className={`filter-btn ${filterGroup === g ? 'active' : ''}`} onClick={() => { setSearchTerm(""); setExpandedSearchStudentId(null); setFilterGroup(g); }}>{g}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {mode === "Professor" && professorView === "painel" && (
                    <section className="dashboard-page">
                        <div className="dashboard-command-top">
                            <div className="dashboard-command-brand">
                                <span className="dashboard-command-mark"></span>
                                <div>
                                    <h3>Painel da turma</h3>
                                    <p>Visao geral da turma e acompanhamentos importantes.</p>
                                </div>
                            </div>
                            <div className="dashboard-command-actions">
                                <button className="dashboard-pdf-btn" onClick={generateDashboardReport}><i className="fas fa-file-pdf"></i> Gerar PDF</button>
                                <button className="dashboard-back-btn" onClick={() => setProfessorView("alunos")}><i className="fas fa-arrow-left"></i> Alunos</button>
                            </div>
                        </div>

                        <div className="dashboard-hero dashboard-hero-old">
                            <div>
                                <h3>Painel da turma</h3>
                                <p>Indicadores internos para acompanhar evolução.</p>
                            </div>
                            <button className="filter-btn" onClick={() => setProfessorView("alunos")}><i className="fas fa-arrow-left"></i> Voltar para alunos</button>
                        </div>

                        <div className="dashboard-filters dashboard-filters-command">
                            <div className="dashboard-filter">
                                <label>Período</label>
                                <select value={dashboardDraftFilters.period} onChange={e => setDashboardDraftFilters({...dashboardDraftFilters, period: e.target.value})}>
                                    <option value="day">Hoje</option>
                                    <option value="7">Semana</option>
                                    <option value="month">Mês</option>
                                    <option value="90">Últimos 90 dias</option>
                                    <option value="all">Todo histórico</option>
                                </select>
                            </div>
                            <div className="dashboard-filter">
                                <label>Turma</label>
                                <select value={dashboardDraftFilters.group} onChange={e => setDashboardDraftFilters({...dashboardDraftFilters, group: e.target.value})}>
                                    <option value="Todos">Todas</option>
                                    {groups.map(group => <option key={group} value={group}>{group}</option>)}
                                </select>
                            </div>
                            <div className="dashboard-filter">
                                <label>Faixa</label>
                                <select value={dashboardDraftFilters.faixa} onChange={e => setDashboardDraftFilters({...dashboardDraftFilters, faixa: e.target.value})}>
                                    <option value="Todas">Todas</option>
                                    {beltOrder.map(faixa => <option key={faixa} value={faixa}>{faixa}</option>)}
                                </select>
                            </div>
                            <div className="dashboard-filter">
                                <label>Status</label>
                                <select value={dashboardDraftFilters.status} onChange={e => setDashboardDraftFilters({...dashboardDraftFilters, status: e.target.value})}>
                                    <option value="Todos">Todos</option>
                                    {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                                </select>
                            </div>
                            <button className="dashboard-search-action" onClick={() => { setDashboardFilters(dashboardDraftFilters); openDashboardFilteredStudents(dashboardDraftFilters); }}>
                                <i className="fas fa-search"></i> Consultar
                            </button>
                            <button className="dashboard-clear" onClick={() => { const cleanFilters = { group: "Todos", faixa: "Todas", status: "Todos", period: "month" }; setDashboardDraftFilters(cleanFilters); setDashboardFilters(cleanFilters); setDashboardDetail(null); setDashboardStudentDetailFilters(null); }}>
                                Limpar filtros
                            </button>
                        </div>

                        <div className="dashboard-command-summary">
                            <button className="dashboard-command-focus" onClick={() => revealDashboardDetail("prioridades")}>
                                <span className="dashboard-command-icon"><i className="fas fa-calendar-check"></i></span>
                                <span>
                                    <small>Ações de hoje</small>
                                    <strong>{todayActionCount}</strong>
                                    <em>pendências</em>
                                </span>
                            </button>
                            <div className="dashboard-command-breakdown">
                                <div><i className="dashboard-dot yellow"></i><span>Confirmar presença</span><b>{studentsWithoutRecentPresence}</b></div>
                                <div><i className="dashboard-dot blue"></i><span>Responder mensagens</span><b>{unreadConversationCount}</b></div>
                                <div><i className="dashboard-dot red"></i><span>Desafios vencidos</span><b>{challengeReachedStudents.length}</b></div>
                                <div><i className="dashboard-dot"></i><span>Aniversariantes do mês</span><b>{birthdayStudents.length}</b></div>
                            </div>
                            <button className="dashboard-command-goal" onClick={() => revealDashboardDetail("meta")}>
                                <span className="dashboard-command-icon target"><i className="fas fa-bullseye"></i></span>
                                <span>
                                    <small>Evolução média da turma <i className="fas fa-circle-info" title="Média do progresso dos alunos exibidos pelos filtros atuais, calculada conforme aulas e requisitos da faixa vigente."></i></small>
                                    <strong>{averageProgress}%</strong>
                                    <em>da turma acompanhada</em>
                                </span>
                                <i className="dashboard-command-progress" style={{"--progress": `${Math.min(100, averageProgress)}%`}}></i>
                            </button>
                        </div>

                        <div className="dashboard-command-kpis">
                            <button className="dashboard-command-kpi" onClick={() => revealDashboardDetail("presencas-periodo")}>
                                <span className="dashboard-command-kpi-icon blue"><i className="fas fa-users"></i></span>
                                <span><b>{recentPresenceStudents.length}</b><small>Presenças no período</small><em>{presenceComparisonLabel}</em></span>
                                <i className="sparkline blue"></i>
                            </button>
                            <button className="dashboard-command-kpi" onClick={() => revealDashboardDetail("mensagens")}>
                                <span className="dashboard-command-kpi-icon blue"><i className="fas fa-comment-dots"></i></span>
                                <span><b>{recentMessages}</b><small>Mensagens no período</small><em>{messageComparisonLabel}</em></span>
                                <i className="sparkline blue"></i>
                            </button>
                            <button className="dashboard-command-kpi" onClick={() => revealDashboardDetail("presenca")}>
                                <span className="dashboard-command-kpi-icon red"><i className="fas fa-user-clock"></i></span>
                                <span><b>{studentsWithoutRecentPresence}</b><small>Alunos sem presença</small><em>7 dias ou mais</em></span>
                                <i className="sparkline red"></i>
                            </button>
                            <button className="dashboard-command-kpi" onClick={() => revealDashboardDetail("desafios")}>
                                <span className="dashboard-command-kpi-icon green"><i className="fas fa-trophy"></i></span>
                                <span><b>{challengeReachedStudents.length}</b><small>Desafios vencidos</small><em>prazo atingido</em></span>
                                <i className="sparkline green"></i>
                            </button>
                            <button className="dashboard-command-kpi" onClick={() => revealDashboardDetail("aniversariantes")}>
                                <span className="dashboard-command-kpi-icon yellow"><i className="fas fa-cake-candles"></i></span>
                                <span><b>{birthdayStudents.length}</b><small>Aniversariantes</small><em>{birthdayPeriod.label}</em></span>
                                <i className="sparkline blue"></i>
                            </button>
                            <button className="dashboard-command-kpi" onClick={() => revealDashboardDetail("desafios-ativos")}>
                                <span className="dashboard-command-kpi-icon yellow"><i className="fas fa-stopwatch"></i></span>
                                <span><b>{challengeStudents.length}</b><small>Desafios ativos</small><em>em acompanhamento</em></span>
                                <i className="sparkline green"></i>
                            </button>
                        </div>

                        <div className="dashboard-command-grid">
                            <div className="dashboard-command-card action-card">
                                <div className="dashboard-command-card-title"><span>Ações de hoje</span><b>{todayActionCount}</b></div>
                                <div className="dashboard-command-list">
                                    {attentionRows.length > 0 ? attentionRows.slice(0, 5).map((s, index) => (
                                        <button className="dashboard-command-row" key={`command-${s.id}-${index}`} onClick={() => s.priorityTypes.includes("Mensagem") ? (setProfessorView("conversas"), openProfessorConversation(s.id)) : openStudentFromDashboard(s.nome)}>
                                            <StudentAvatar className="mini-avatar" src={s.avatar} sexo={s.sexo} alt={s.nome} />
                                            <span className="dashboard-action-copy">
                                                <b>{s.nome}</b>
                                                <small>{s.priorityReasons?.[0] || (s.ultimaPresenca ? `Última presença: ${formatDateBR(s.ultimaPresenca)}` : "Sem presença registrada")}</small>
                                            </span>
                                            <span className="dashboard-action-tags"><em>{s.priorityTypes[0] || "Ação"}</em></span>
                                            <i className="fas fa-chevron-right"></i>
                                        </button>
                                    )) : <div className="dashboard-note">Nenhuma ação pendente para hoje.</div>}
                                </div>
                                <button className="dashboard-command-link" onClick={() => revealDashboardDetail("prioridades")}>Ver todas as ações <i className="fas fa-chevron-right"></i></button>
                            </div>
                            <div className="dashboard-command-card chart-card">
                                <div className="dashboard-command-card-title">
                                    <span>Presenças no período</span>
                                    <select
                                        className="dashboard-period-select"
                                        value={dashboardFilters.period}
                                        onChange={e => setDashboardFilters({...dashboardFilters, period: e.target.value})}
                                    >
                                        <option value="day">hoje</option>
                                        <option value="7">semana atual</option>
                                        <option value="month">mês atual</option>
                                    </select>
                                </div>
                                <div className="dashboard-bars-chart">
                                    {dailyPresenceRows.length > 0 ? dailyPresenceRows.map(row => (
                                        <span key={row.key} className={row.count === 0 ? "empty" : ""} title={`${row.label}: ${row.count} presença${row.count === 1 ? "" : "s"}`} style={{height: row.count === 0 ? "6%" : `${18 + (row.count / maxDailyPresence) * 82}%`}}><i>{row.label}</i></span>
                                    )) : <div className="dashboard-note">Sem presenças no período.</div>}
                                </div>
                                <div className="dashboard-command-best-day" onClick={() => revealDashboardDetail("movimento")}>
                                    <span className="dashboard-command-icon"><i className="fas fa-calendar-day"></i></span>
                                    <span><small>Dia de maior presença</small><strong>{busiestPresenceDate ? `${busiestPresenceDate.weekday} - ${busiestPresenceDate.displayDate}` : "Sem dados"}</strong><em>{busiestPresenceDate ? `${busiestPresenceDate.count} presenças - clique para ver alunos` : "Sem presença no período"}</em></span>
                                    <i className="sparkline green"></i>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-main-grid">
                            <div className="dashboard-panel dashboard-operational-panel">
                                <div className="dashboard-panel-title"><span>Leitura executiva</span><i className="fas fa-chart-line"></i></div>
                                <div className="dashboard-note-block">
                                    <p>{dashboardInsightText} A visão atual considera {dashboardPeriodLabel} e os filtros selecionados de turma, faixa e status.</p>
                                    <div className="dashboard-note-chips">
                                        <button className="dashboard-note-chip" onClick={() => revealDashboardDetail("prioridades")}><strong>{followUpCount}</strong><span>Ações de hoje</span></button>
                                        <button className="dashboard-note-chip" onClick={() => revealDashboardDetail("mensagens")}><strong>{recentMessages}</strong><span>Mensagens no período</span></button>
                                        <button className="dashboard-note-chip" onClick={() => revealDashboardDetail("presenca")}><strong>{studentsWithoutRecentPresence}</strong><span>Sem presença recente</span></button>
                                        <button className="dashboard-note-chip" onClick={() => revealDashboardDetail("meta")}><strong>{averageProgress}%</strong><span>Evolução média</span></button>
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-analytics-stack">
                                <div className="dashboard-panel">
                                    <div className="dashboard-panel-title"><span>Dia de maior presença</span><i className="fas fa-calendar-week"></i></div>
                                    <div className="dashboard-list">
                                        {presenceByWeekdayRows.length > 0 ? presenceByWeekdayRows.map(row => (
                                            <div className="dashboard-weekday-row" key={row.label}>
                                                <span>{row.label}</span>
                                                <div className="dashboard-bar"><i style={{width: `${(row.count / Math.max(1, presenceByWeekdayRows[0].count)) * 100}%`}}></i></div>
                                                <b>{row.count}</b>
                                            </div>
                                        )) : <div className="dashboard-note">Sem presenças no período.</div>}
                                    </div>
                                </div>
                                <div className="dashboard-insight dashboard-actions">
                                    <h4>Ações rápidas</h4>
                                    <button className="dashboard-action-btn" onClick={() => revealDashboardDetail("prioridades")}><span>Ver atenção da semana</span><i className="fas fa-bell"></i></button>
                                    <button className="dashboard-action-btn" onClick={() => revealDashboardDetail("desafios")}><span>Desafios de graus comportamentais</span><i className="fas fa-stopwatch"></i></button>
                                    <button className="dashboard-action-btn" onClick={() => revealDashboardDetail("evolucao-baixa")}><span>Alunos abaixo de 30%</span><i className="fas fa-chart-line"></i></button>
                                    <button className="dashboard-action-btn" onClick={generateDashboardReport}><span>Gerar relatório do painel</span><i className="fas fa-file-pdf"></i></button>
                                    <button className="dashboard-action-btn" onClick={exportDashboardCsv}><span>Exportar CSV do painel</span><i className="fas fa-file-export"></i></button>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-section-title">Indicadores complementares</div>
                        <div className="dashboard-grid">
                            <div className={`dashboard-card ${dashboardDetail === "meta" ? "active" : ""}`} onClick={() => revealDashboardDetail("meta")}><strong>{followUpCount}</strong><span>Evolução média da turma</span><small>Mensagens, ausência e desafios vencidos</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "prontos" ? "active" : ""}`} onClick={() => revealDashboardDetail("prontos")}><strong>{readyStudents}</strong><span>Prontos para exame</span><small>{examCandidates.length} acima de 75% de conclusão</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "desafios" ? "active" : ""}`} onClick={() => revealDashboardDetail("desafios")}><strong>{challengeReachedStudents.length}</strong><span>Desafios vencidos</span><small>{challengeStudents.length} desafio{challengeStudents.length === 1 ? "" : "s"} ativo{challengeStudents.length === 1 ? "" : "s"}</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "presenca" ? "active" : ""}`} onClick={() => revealDashboardDetail("presenca")}><strong>{studentsWithoutRecentPresence}</strong><span>Sem presença recente</span><small>Sem data ou há 7 dias ou mais</small></div>
                        </div>

                        <div className="dashboard-section-title">Base e gestão</div>
                        <div className="dashboard-grid">
                            <div className={`dashboard-card ${dashboardDetail === "evolucao" ? "active" : ""}`} onClick={() => revealDashboardDetail("evolucao")}><strong>{averageProgress}%</strong><span>Evolução média</span><small>Baseado no progresso para a próxima faixa</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "movimento" ? "active" : ""}`} onClick={() => revealDashboardDetail("movimento")}><strong>{busiestPresenceDay ? busiestPresenceDay[1] : 0}</strong><span>Maior movimento</span><small>{busiestPresenceLabel}</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "frequencia" ? "active" : ""}`} onClick={() => revealDashboardDetail("frequencia")}><strong>{highestPresenceCount}</strong><span>Top frequência</span><small>{studentPresenceRanking[0] ? `${studentPresenceRanking[0].nome} lidera no ${dashboardPeriodLabel}` : "Sem presenças no período"}</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "alunos" ? "active" : ""}`} onClick={() => revealDashboardDetail("alunos")}><strong>{dashboardStudents.length}</strong><span>Alunos cadastrados</span><small>{activeStudents.length} ativos ou em acompanhamento</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "imagem" ? "active" : ""}`} onClick={() => revealDashboardDetail("imagem")}><strong>{imageAuthPending}</strong><span>Autorização pendente</span><small>Alunos sem autorização de imagem marcada</small></div>
                            <div className={`dashboard-card ${dashboardDetail === "arquivos" ? "active" : ""}`} onClick={() => revealDashboardDetail("arquivos")}><strong>{scopedRepo.length}</strong><span>Arquivos</span><small>Anexos disponíveis no repositório interno</small></div>
                        </div>

                        <div className="dashboard-priority-grid">
                            <div className="dashboard-priority-card">
                                <h4><span>Mensagens</span><i className="fab fa-whatsapp"></i></h4>
                                <div className="dashboard-mini-list">
                                    {topUnread.length > 0 ? topUnread.slice(0, 3).map(s => (
                                        <button className="dashboard-mini-row" key={`mini-msg-${s.id}`} onClick={() => { setProfessorView("conversas"); openProfessorConversation(s.id); }}>
                                            <b>{s.nome}</b>
                                            <small>{s.unread} mensagem{s.unread === 1 ? "" : "s"} pendente{s.unread === 1 ? "" : "s"}</small>
                                        </button>
                                    )) : <div className="dashboard-note">Sem mensagens pendentes.</div>}
                                </div>
                            </div>
                            <div className="dashboard-priority-card">
                                <h4><span>Ausência</span><i className="fas fa-calendar-times"></i></h4>
                                <div className="dashboard-mini-list">
                                    {noRecentPresenceList.length > 0 ? noRecentPresenceList.slice(0, 3).map(s => (
                                        <button className="dashboard-mini-row" key={`mini-pres-${s.id}`} onClick={() => openStudentFromDashboard(s.nome)}>
                                            <b>{s.nome}</b>
                                            <small>{s.daysWithoutPresence === null ? "sem presença registrada" : `${s.daysWithoutPresence} dias sem presença`}</small>
                                        </button>
                                    )) : <div className="dashboard-note">Sem ausência recente.</div>}
                                </div>
                            </div>
                            <div className="dashboard-priority-card">
                                <h4><span>Desafios</span><i className="fas fa-stopwatch"></i></h4>
                                <div className="dashboard-mini-list">
                                    {challengeStudents.length > 0 ? challengeStudents.slice(0, 3).map(s => {
                                        const challengeStatus = getChallengeStatus(s.desafioInfo);
                                        return (
                                            <button className={`dashboard-mini-row ${["today", "overdue"].includes(challengeStatus.type) ? "alert" : ""}`} key={`mini-challenge-${s.id}`} onClick={() => openStudentFromDashboard(s.nome)}>
                                                <b>{s.nome}</b>
                                                <small>{challengeStatusText(s.desafioInfo)} - {behaviorDegreeOptions.find(option => option.key === s.desafioGrau)?.label || s.desafioInfo.title}</small>
                                            </button>
                                        );
                                    }) : <div className="dashboard-note">Sem desafios ativos.</div>}
                                </div>
                            </div>
                            <div className="dashboard-priority-card">
                                <h4><span>Aniversariantes</span><i className="fas fa-cake-candles"></i></h4>
                                <div className="dashboard-mini-list">
                                    {birthdayStudents.length > 0 ? birthdayStudents.slice(0, 3).map(s => (
                                        <button className="dashboard-mini-row" key={`mini-birthday-${s.id}`} onClick={() => openStudentFromDashboard(s.nome)}>
                                            <b>{s.nome}</b>
                                            <small>{s.birthdayThisYear.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - {calculateAge(s.nascimento)} anos</small>
                                        </button>
                                    )) : <div className="dashboard-note">Sem aniversariantes no período.</div>}
                                </div>
                            </div>
                            <div className="dashboard-priority-card">
                                <h4><span>Top frequência</span><i className="fas fa-ranking-star"></i></h4>
                                <div className="dashboard-mini-list">
                                    {studentPresenceRanking.length > 0 ? studentPresenceRanking.slice(0, 3).map((s, index) => (
                                        <button className="dashboard-mini-row" key={`mini-frequency-${s.id}`} onClick={() => openStudentFromDashboard(s.nome)}>
                                            <b>{index + 1}º {s.nome}</b>
                                            <small>{s.count} presença{s.count === 1 ? "" : "s"} • {s.turma}</small>
                                        </button>
                                    )) : <div className="dashboard-note">Sem frequência registrada no período.</div>}
                                </div>
                            </div>
                            <div className="dashboard-priority-card">
                                <h4><span>Exame</span><i className="fas fa-medal"></i></h4>
                                <div className="dashboard-mini-list">
                                    {examCandidates.length > 0 ? examCandidates.slice(0, 3).map(s => (
                                        <button className="dashboard-mini-row" key={`mini-exam-${s.id}`} onClick={() => openStudentFromDashboard(s.nome)}>
                                            <b>{s.nome}</b>
                                            <small>{s.progresso.percentual}% concluído - {s.progresso.faltantes} aulas faltam</small>
                                        </button>
                                    )) : <div className="dashboard-note">Nenhum aluno apto agora.</div>}
                                </div>
                            </div>
                        </div>

                        {activeDashboardDetail && <div id="dashboard-detail-panel" className="dashboard-detail">
                            <div className="dashboard-detail-head">
                                <div>
                                    <strong>{activeDashboardDetail.title}</strong>
                                    <span>{activeDashboardDetail.subtitle}</span>
                                </div>
                                <button className="dashboard-detail-action" onClick={() => { setDashboardDetail(null); setDashboardStudentDetailFilters(null); }}>Limpar</button>
                            </div>
                            <div className={`dashboard-detail-list ${dashboardDetail === "presenca" ? "compact-presence-list" : ""} ${["alunos", "frequencia", "aniversariantes"].includes(dashboardDetail) ? "compact-mini-list" : ""}`}>
                                {activeDashboardDetail.rows.length > 0 ? activeDashboardDetail.rows.map(row => (
                                    row.studentCard ? (
                                        <div className={`dashboard-detail-student-card ${row.compactPresenceCard ? "presence-compact" : ""} ${row.compactMiniCard ? "mini-compact" : ""}`} key={`${dashboardDetail}-${row.id}`} onClick={row.action}>
                                            <StudentAvatar className="student-compact-avatar" src={row.avatar} sexo={row.sexo} alt={row.name} />
                                            <div className="dashboard-detail-student-main">
                                                <b>{row.ranking ? `${row.ranking}º lugar • ${row.name}` : row.name}</b>
                                                <small>{row.meta}</small>
                                                {!row.compactPresenceCard && !row.compactMiniCard && <div className="dashboard-detail-student-meta">
                                                    {row.status ? <b>{row.status}</b> : null}
                                                    {row.nascimento ? <b>{calculateAge(row.nascimento)} anos</b> : null}
                                                    {row.turma ? <b>{row.turma}</b> : null}
                                                    {row.faixa ? <b>{row.faixa}</b> : null}
                                                </div>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="dashboard-detail-row" key={`${dashboardDetail}-${row.id}`} onClick={row.action}>
                                            <div>
                                                <b>{row.name}</b>
                                                <small>{row.meta}</small>
                                            </div>
                                            <button className="dashboard-detail-action" onClick={(e) => { e.stopPropagation(); row.action(); }}>{row.actionLabel || "Abrir"}</button>
                                        </div>
                                    )
                                )) : (
                                    <div className="dashboard-note">Nenhum item encontrado para este indicador.</div>
                                )}
                            </div>
                        </div>}

                        <div className="dashboard-command-distributions dashboard-command-distributions-after-detail">
                            <div className="dashboard-command-card compact-panel">
                                <div className="dashboard-insight-panel">
                                    <div className="dashboard-insight-head">
                                        <span className="dashboard-insight-icon"><i className="fas fa-layer-group"></i></span>
                                        <div className="dashboard-insight-copy">
                                            <strong>Distribuição por turma</strong>
                                            <span>Alunos matriculados por turma</span>
                                        </div>
                                        <MetricRuleInfo title="Regra da distribuição por turma">Considera os alunos exibidos pelos filtros do painel. A turma vem da categoria automática por idade ou da categoria manual do cadastro. O percentual é calculado sobre o total filtrado.</MetricRuleInfo>
                                        {renderDashboardInsightMenu("turmas")}
                                    </div>
                                    <div className="dashboard-compact-list">
                                        {groupRowsWithPercent.map(row => (
                                            <button className="dashboard-compact-row" key={`cmd-cat-${row.label}`} onClick={() => openDashboardStudents({ group: row.label })}>
                                                <span>{row.label}<small>{row.value} aluno{row.value === 1 ? "" : "s"} • {row.percent}%</small></span>
                                                <div className="dashboard-bar tall normal"><i style={{width: `${maxCategory > 0 ? (row.value / maxCategory) * 100 : 0}%`}}></i></div>
                                                <span className="dashboard-compact-metric"><b>{row.value}</b><small className="dashboard-compact-percent">{row.percent}%</small></span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="dashboard-frequency-footer">
                                        <div>
                                            <strong>Total de alunos</strong>
                                            <b>{dashboardStudents.length}</b>
                                            <span><i className={`fas ${dashboardStudentDelta > 0 ? "fa-arrow-trend-up" : dashboardStudentDelta < 0 ? "fa-arrow-trend-down" : "fa-minus"}`}></i>{dashboardStudentDeltaLabel}</span>
                                        </div>
                                        <div>
                                            <strong>Turmas ativas</strong>
                                            <b>{dashboardRows.categorias.filter(row => row.value > 0).length}</b>
                                            <span><i className="fas fa-arrow-trend-up"></i>{dashboardStudents.length > 0 ? `${Math.max(...groupRowsWithPercent.map(row => row.percent))}% na turma` : "Sem base ativa"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-command-card compact-panel">
                                <div className="dashboard-insight-panel">
                                    <div className="dashboard-insight-head">
                                        <span className="dashboard-insight-icon dashboard-header-belt-icon">
                                            <span className="dashboard-tied-belt-icon" aria-hidden="true">
                                                <span className="dashboard-tied-belt-band"></span>
                                                <span className="dashboard-tied-belt-knot"></span>
                                                <span className="dashboard-tied-belt-tail tail-left"></span>
                                                <span className="dashboard-tied-belt-tail tail-right"></span>
                                            </span>
                                        </span>
                                        <div className="dashboard-insight-copy">
                                            <strong>Distribuição por faixa</strong>
                                            <span>Base atual por graduação</span>
                                        </div>
                                        <MetricRuleInfo title="Regra da distribuição por faixa">Agrupa os alunos exibidos pela faixa atual cadastrada. Mostra quantidade, participação sobre a base filtrada e média de idade de cada faixa.</MetricRuleInfo>
                                        {renderDashboardInsightMenu("faixas")}
                                    </div>
                                    <div className="dashboard-compact-list">
                                        {beltRowsWithPercent.length > 0 ? beltRowsWithPercent.map(row => (
                                            <button className="dashboard-compact-row dashboard-belt-themed" style={getBeltVisualStyle(row.label)} key={`cmd-belt-${row.label}`} onClick={() => openDashboardStudents({ faixa: row.label })}>
                                                <span>{row.label}<small>{row.value} aluno{row.value === 1 ? "" : "s"} • média {row.averageAge ?? "-"} anos • {row.percent}%</small></span>
                                                <div className="dashboard-bar tall info"><i style={{width: `${maxBelt > 0 ? (row.value / maxBelt) * 100 : 0}%`}}></i></div>
                                                <span className="dashboard-compact-metric"><b>{row.value}</b><small className="dashboard-compact-percent">{row.percent}%</small></span>
                                            </button>
                                        )) : <div className="dashboard-note">Nenhuma faixa com aluno ainda.</div>}
                                    </div>
                                    <div className="dashboard-frequency-footer dashboard-belt-footer dashboard-belt-themed" style={getBeltVisualStyle(topBeltRow?.label)}>
                                        <div className="dashboard-belt-footer-main">
                                            <span className="dashboard-belt-footer-badge">
                                                <span className="dashboard-tied-belt-icon" aria-hidden="true">
                                                    <span className="dashboard-tied-belt-band"></span>
                                                    <span className="dashboard-tied-belt-knot"></span>
                                                    <span className="dashboard-tied-belt-tail tail-left"></span>
                                                    <span className="dashboard-tied-belt-tail tail-right"></span>
                                                </span>
                                            </span>
                                            <div className="dashboard-belt-footer-copy">
                                                <strong>Maior faixa</strong>
                                                <b>{topBeltRow?.label || "-"}</b>
                                                <small>{topBeltRow ? `${topBeltRow.value} aluno${topBeltRow.value === 1 ? "" : "s"}` : "Sem alunos cadastrados"}</small>
                                            </div>
                                        </div>
                                        <div className="dashboard-belt-footer-share">
                                            <div className="dashboard-belt-footer-share-ring" style={{"--share": topBeltRow?.percent || 0}}>
                                                <b>{topBeltRow?.percent || 0}%</b>
                                            </div>
                                            <small>do total</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-command-card compact-panel">
                                <div className="dashboard-insight-panel">
                                    <div className="dashboard-insight-head">
                                        <span className="dashboard-insight-icon"><i className="fas fa-trophy"></i></span>
                                        <div className="dashboard-insight-copy">
                                            <strong>Top frequência</strong>
                                            <span>Aluno com maior frequência no período</span>
                                        </div>
                                        <MetricRuleInfo title="Regra do Top frequência">Conta as presenças registradas dentro do período e dos filtros selecionados. A ordem vai da maior para a menor quantidade. Os 100% representam o líder como referência; não são uma taxa de presença nas aulas.</MetricRuleInfo>
                                        {renderDashboardInsightMenu("frequencia")}
                                    </div>
                                    <div className="dashboard-compact-list">
                                    {studentPresenceRanking.length > 0 ? studentPresenceRanking.slice(0, 5).map((student, index) => {
                                        const defaultAvatar = student.sexo === "F" ? AVATAR_GIRL : AVATAR_BOY;
                                        return (
                                            <button className={`dashboard-compact-row ${index === 0 ? "featured" : ""}`} key={`cmd-frequency-${student.id}`} onClick={() => openStudentFromDashboard(student.nome)}>
                                                {index === 0 ? (
                                                    <span className="dashboard-frequency-card">
                                                        <span className="dashboard-frequency-card-top">
                                                            <StudentAvatar src={student.avatar} sexo={student.sexo} className="dashboard-frequency-avatar" alt={student.nome} />
                                                            <span className="dashboard-frequency-content">
                                                                <em className="dashboard-rank-chip">1º lugar</em>
                                                                <strong className="dashboard-frequency-name">{student.nome}</strong>
                                                                <small className="dashboard-frequency-meta">{student.turma} • {student.faixa}</small>
                                                            </span>
                                                            <span className="dashboard-frequency-card-score">
                                                                <strong>{highestPresenceCount > 0 ? Math.round((student.count / highestPresenceCount) * 100) : 0}%</strong>
                                                                <small>no período</small>
                                                            </span>
                                                        </span>
                                                        <small className="dashboard-frequency-extra">{student.count} presença{student.count === 1 ? "" : "s"} registradas no {dashboardPeriodLabel}</small>
                                                    </span>
                                                ) : (
                                                    <span>{index + 1}º {student.nome}<small>{student.turma} - {student.faixa} - {student.count} presença{student.count === 1 ? "" : "s"}</small></span>
                                                )}
                                                <div className="dashboard-bar tall info"><i style={{width: `${highestPresenceCount > 0 ? (student.count / highestPresenceCount) * 100 : 0}%`}}></i></div>
                                                <span className="dashboard-compact-metric"><b>{student.count}</b><small className="dashboard-compact-percent">{highestPresenceCount > 0 ? Math.round((student.count / highestPresenceCount) * 100) : 0}%</small></span>
                                            </button>
                                        );
                                    }) : <div className="dashboard-note">Sem frequência registrada no período.</div>}
                                    </div>
                                    <div className="dashboard-frequency-footer">
                                        <div>
                                            <strong>Frequência média</strong>
                                            <b>{studentPresenceRanking.length > 0 ? Math.round(studentPresenceRanking.reduce((sum, student) => sum + student.count, 0) / studentPresenceRanking.length) : 0}</b>
                                        </div>
                                        <div>
                                            <strong>No período</strong>
                                            <b>{recentPresenceStudents.length}</b>
                                            <span><i className="fas fa-arrow-trend-up"></i>{dashboardPeriodLabel}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-command-distributions dashboard-command-distributions-after-detail">
                            <div className="dashboard-command-card compact-panel">
                                <div className="dashboard-command-card-title"><span>Situação da base</span><MetricRuleInfo title="Regra da situação da base">Conta os alunos exibidos conforme o status atual do cadastro: ativos, inativos, desligados ou transferidos e experimentais. Os percentuais usam a base filtrada como total.</MetricRuleInfo><i className="fas fa-circle-check"></i></div>
                                <div className="dashboard-status-card">
                                    <div className="dashboard-status-headline">
                                        <i className="fas fa-database"></i>
                                        <div>
                                            <strong>Situação da base</strong>
                                            <span>Visão geral da base de alunos</span>
                                        </div>
                                        <b>{dashboardStudents.length}</b>
                                    </div>
                                    <div className="dashboard-status-list">
                                        {operationalStatusRows.length > 0 ? operationalStatusRows.map(row => (
                                            <button
                                                className={`dashboard-status-row ${row.type}`}
                                                key={`cmd-status-${row.label}`}
                                                onClick={() => row.detail ? revealDashboardDetail(row.detail) : openDashboardStudents(row.filter)}
                                            >
                                                <i className={`dashboard-status-icon fas ${row.label === "Ativos" ? "fa-circle-check" : row.label === "Inativos" ? "fa-clock" : row.label === "Desligados" ? "fa-circle-minus" : "fa-user-astronaut"}`}></i>
                                                <span className="dashboard-status-copy">
                                                    <strong>{row.label}</strong>
                                                    <small>{row.note}</small>
                                                </span>
                                                <b className="dashboard-status-metric">{row.value} aluno{row.value === 1 ? "" : "s"}</b>
                                                <b className="dashboard-status-percent">{row.percent}%</b>
                                                <span className="dashboard-status-progress"><i style={{width: `${Math.max(4, row.percent)}%`}}></i></span>
                                            </button>
                                        )) : <div className="dashboard-note">Nenhum status informado.</div>}
                                    </div>
                                    <div className="dashboard-status-footer">
                                        <div>
                                            <small>Total na base</small>
                                            <strong>{dashboardStudents.length}</strong>
                                        </div>
                                        <div>
                                            <small>Taxa de retenção</small>
                                            <strong>{retentionRate}%</strong>
                                            <span><i className="fas fa-arrow-trend-up"></i> base ativa atual</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </section>
                )}

                {mode === "Professor" && professorView === "conversas" && (
                    <section className="conversation-page">
                        <div className="conversation-title">
                            <div>
                                <h3>Conversas</h3>
                                <span>{allConversationStudents.length} alunos cadastrados{totalUnreadProfessor > 0 ? ` • ${totalUnreadProfessor} pendente${totalUnreadProfessor === 1 ? "" : "s"} de leitura` : ""}</span>
                            </div>
                            <div className="conversation-actions">
                                <button className="filter-btn" onClick={() => setProfessorView("alunos")}><i className="fas fa-arrow-left"></i> Voltar para alunos</button>
                            </div>
                        </div>
                    <div className="conversation-view">
                        <aside className="conversation-list">
                            <div className="conversation-search">
                                <i className="fas fa-search"></i>
                                <input placeholder="Buscar conversa..." value={conversationSearch} onChange={e => setConversationSearch(e.target.value)} />
                            </div>
                            <div className="conversation-scroll">
                            {conversationStudents.length > 0 ? conversationStudents.map(s => {
                                const defaultAvatar = s.sexo === "F" ? AVATAR_GIRL : AVATAR_BOY;
                                const lastText = s.lastMessage?.isImage ? "Imagem recebida" : (s.lastMessage?.text || (s.lastMessage?.fileName ? `Arquivo: ${s.lastMessage.fileName}` : "Sem mensagens"));
                                return (
                                    <div key={s.id} className={`conversation-item ${selectedConversation?.id === s.id ? "active" : ""} ${s.unread > 0 ? "unread" : ""}`} onClick={() => openProfessorConversation(s.id)}>
                                        <StudentAvatar src={s.avatar} sexo={s.sexo} className="conversation-avatar" alt={s.nome} />
                                        <div className="conversation-main">
                                            <div className="conversation-name">{s.nome}</div>
                                            <div className="conversation-last">{lastText}</div>
                                            {s.unread > 0 && <div className="conversation-pending-label"><i className="fas fa-bell"></i> Pendente de leitura</div>}
                                        </div>
                                        {s.unread > 0 && <div className="unread-dot">{s.unread}</div>}
                                    </div>
                                );
                            }) : (
                                <div className="conversation-empty">Nenhuma conversa encontrada.</div>
                            )}
                            </div>
                        </aside>
                        <div className="conversation-panel">
                            {selectedConversation ? (
                                <>
                                    <div className="chat-header">
                                        <span><i className="fab fa-whatsapp" style={{color: 'var(--whatsapp-green)'}}></i> {selectedConversation.nome}</span>
                                        <small style={{color:'#888', fontWeight:800}}>{selectedConversation.chat?.length || 0} mensagens</small>
                                    </div>
                                    <div className="chat-msgs">
                                        {(selectedConversation.chat || []).map(m => (
                                            <div key={m.id} className={`msg-wrapper ${m.sender === "Professor" ? 'self' : 'other'}`}>
                                                <span className="msg-author">{m.author}</span>
                                                <div className="msg-bubble">
                                                    {m.isImage && (m.fileUrl || m.fileData) && <img src={m.fileUrl || m.fileData} className="chat-img-preview" onClick={() => setViewImage(m)} />}
                                                    {!m.isImage && (m.fileUrl || m.fileData) && <a href={m.fileUrl || m.fileData} download={m.fileName} style={{color:'#c9a554', textDecoration:'none'}}><i className="fas fa-file-download"></i> {m.fileName}</a>}
                                                    {m.text && <div>{m.text}</div>}
                                                    <div className="msg-meta">{getMessageMeta(m)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="conversation-composer">
                                        <label style={{cursor:'pointer'}}><i className="fas fa-camera" style={{color:'#555'}}></i><input type="file" style={{display:'none'}} accept="image/*" onChange={e => handleFile(e.target.files[0], 'chat', selectedConversation.id)}/></label>
                                        <input placeholder="Mensagem..." value={chatInputs[selectedConversation.id] || ""} onChange={e => setChatInputs({...chatInputs, [selectedConversation.id]: e.target.value})} onKeyDown={e => e.key === 'Enter' && sendMessage(selectedConversation.id)}/>
                                        <i className="fas fa-paper-plane" style={{color: 'var(--alliance-green)', cursor:'pointer'}} onClick={() => sendMessage(selectedConversation.id)}></i>
                                    </div>
                                </>
                            ) : (
                                    <div className="conversation-empty">Selecione uma conversa para abrir as mensagens.</div>
                                )}
                        </div>
                    </div>
                    </section>
                )}

                {!(mode === "Professor" && ["central", "conversas", "painel"].includes(professorView)) && renderedStudents.length === 0 && (
                    <div className="empty-state">
                        <img className="empty-eagle-mark" src="alliance-eagle-mark-closed.png" alt="" />
                            <strong>{students.length === 0 ? "Nenhum aluno cadastrado" : (mode === "Professor" && !professorHasQuery ? "Faça uma consulta" : "Nenhum aluno encontrado")}</strong>
                        <span>{mode === "Professor" ? "Digite um nome ou escolha uma categoria para exibir os alunos." : "Confira o nome e a data de nascimento usados no acesso."}</span>
                    </div>
                )}

                {!(mode === "Professor" && ["central", "conversas", "painel"].includes(professorView)) && renderedStudents.length > 0 && (
                    <div className={useCompactStudentResults ? "student-results-grid" : ""}>
                    {renderedStudents.map(s => {
                    const ruleInfo = getRuleInfo(s.nascimento, s.faixa, s.categoriaOverride);
                    const rules = ruleInfo.aulasPorGrau;
                    const presenceDegreeStates = rules > 0 ? getPresenceDegreeStates(s.aulas, rules, s.presenceDegrees) : [0, 0, 0, 0];
                    const pronto = rules > 0 && (s.aulas >= rules * 9) && s.comp?.Rel && s.comp?.Comp && s.comp?.Notas && s.comp?.Hab;
                    const unread = s.chat?.filter(m => !(m.readBy || []).includes(mode)).length || 0;
                    const defaultAvatar = s.sexo === "F" ? AVATAR_GIRL : AVATAR_BOY;
                    const progresso = getGraduationProgress(s.aulas, s.nascimento, s.faixa, s.comp, s.categoriaOverride);
                    const currentCycleClasses = rules > 0 ? getCurrentCycleClasses(s.aulas, rules) : 0;
                    const desafioInfo = getBehaviorChallenge(s);
                    const showCompactStudentCard = useCompactStudentResults && expandedSearchStudentId !== s.id;

                    if (showCompactStudentCard) {
                        return (
                            <div key={s.id} className="student-compact-card" onClick={() => setExpandedSearchStudentId(s.id)}>
                                <StudentAvatar src={s.avatar} sexo={s.sexo} className="student-compact-avatar" alt={s.nome} />
                                <div className="student-compact-main">
                                    <strong>{s.nome}</strong>
                                    <span>{calculateAge(s.nascimento)} anos - {getAutoCategory(s.nascimento, s.categoriaOverride)} - {s.faixa}</span>
                                    <div className="student-compact-meta">
                                        <b>{s.status || "Ativo"}</b>
                                        {ruleInfo.elegivel && <b>{progresso.percentual}% concluido</b>}
                                        {s.ultimaPresenca && <b>{formatDateBR(s.ultimaPresenca)}</b>}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={s.id} className={`card ${mode === "Pais" ? "parent-card" : ""} ${useCompactStudentResults ? "expanded-result-card" : ""}`}>
                            <div className="student-top">
                                <div className="avatar-container">
                                    <StudentAvatar src={s.avatar} sexo={s.sexo} className="avatar" alt={s.nome} />
                                    {(mode === "Professor" || mode === "Pais") && <button type="button" className="edit-badge" title="Alterar foto ou escolher avatar" onClick={() => setAvatarPickerStudent({ id: s.id, nome: s.nome, sexo: s.sexo || "M", avatar: s.avatar || "" })}><i className="fas fa-camera"></i></button>}
                                </div>
                                <div style={{flex:1}}>
                                    <h3 style={{margin:0, fontSize:'19px', color: 'white'}}>
                                        {s.nome} 
                                        {mode === "Professor" && <i className="fas fa-edit btn-edit-info" onClick={() => { setEditingStudent({...s}); setModalOpen('edit'); }}></i>}
                                        {(mode === "Professor" || mode === "Pais") && <i className="fas fa-file-pdf btn-edit-info" title="Gerar relatório individual" onClick={() => generateStudentReport(s)}></i>}
                                    </h3>
                                    <div className="cat-badge">{s.faixa}</div><br/>
                                    <small style={{color:'#666', fontWeight:'bold'}}>{calculateAge(s.nascimento)} ANOS • {getAutoCategory(s.nascimento, s.categoriaOverride)}{s.categoriaOverride && s.categoriaOverride !== "Auto" ? " (MANUAL)" : ""}{ruleInfo.elegivel ? ` • ${rules} AULAS/GRAU` : ''}</small><br/>
                                    {mode === "Pais" && (
                                        <details className="student-info-toggle">
                                            <summary><i className="fas fa-user-edit"></i> Informações do aluno</summary>
                                            <div className="parent-header-info">
                                            <div className="student-info-chip"><strong>{getStudentUnitName(s, units)}</strong>Unidade</div>
                                            <div className={`student-info-chip status-badge ${(s.status || "Ativo").toLowerCase()}`}><strong>{s.status || "Ativo"}</strong>Status</div>
                                            {s.responsavel && <div className="student-info-chip"><strong>{s.responsavel}</strong>Respons&aacute;vel</div>}
                                            {s.telefone && <div className="student-info-chip"><strong>{s.telefone}</strong>WhatsApp</div>}
                                            {s.matricula && <div className="student-info-chip"><strong>{formatDateBR(s.matricula)}</strong>Matr&iacute;cula</div>}
                                            {s.ultimaPresenca && <div className="student-info-chip"><strong>{formatDateBR(s.ultimaPresenca)}</strong>Última presença</div>}
                                <div className="student-info-chip"><strong>{s.autorizacaoImagem ? "Sim" : "Não"}</strong>Autorização de imagem</div>
                                            {desafioInfo?.active && <div className={`student-info-chip challenge-chip ${desafioInfo.reached ? "overdue" : ""}`}><strong>{desafioInfo.reached ? "Prazo atingido" : formatDateBR(desafioInfo.end)}</strong>{behaviorDegreeOptions.find(option => option.key === s.desafioGrau)?.label || desafioInfo.title}</div>}
                                            </div>
                                        </details>
                                    )}
                                </div>
                                {mode === "Pais" && (
                                    <div className="parent-nav-inline">
                                        <div className="action-item" onClick={() => window.open('https://alliancemooca.com.br/blog/', '_blank')}><i className="fas fa-up-right-from-square"></i><span>Site</span></div>
                                        <div className="action-item" onClick={() => setModalOpen('repo')}><i className="fas fa-folder-tree"></i><span>Arquivos</span></div>
                                        <div className="action-item" onClick={() => { setMode(null); setSubMode(null); setCurrentUser(null); setAuth({user:'', pass:''}); setSearchTerm(""); setFilterGroup("Todos"); setExpandedSearchStudentId(null); }}><i className="fas fa-right-from-bracket"></i><span>Sair</span></div>
                                    </div>
                                )}
                                {mode === "Professor" && (
                                    <button className="student-chat-shortcut" onClick={() => { setProfessorView("conversas"); openProfessorConversation(s.id); }}>
                                        <i className="fab fa-whatsapp"></i> Conversa
                                    </button>
                                )}
                                {mode === "Professor" && <i className="fas fa-trash-alt" style={{color:'#333', padding:'10px'}} onClick={() => {
                                    if (!window.confirm(`Excluir definitivamente o aluno ${s.nome}? Esta ação não poderá ser desfeita.`)) return;
                                    createAuditLog("Aluno excluído", "Cadastro", s.nome, "Excluído");
                                    setStudents(students.filter(x => x.id !== s.id));
                                }}></i>}
                            </div>
                            {mode === "Pais" && (
                                <div className="parent-jump-nav">
                                    <button className={`parent-jump-btn ${parentSection === "evolucao" ? "active" : ""}`} onClick={() => setParentSection("evolucao")}>
                                        <i className="fas fa-route"></i> Evolução
                                    </button>
                                    <button className={`parent-jump-btn ${parentSection === "desafio" ? "active" : ""}`} onClick={() => setParentSection("desafio")}>
                                        <i className="fas fa-stopwatch"></i> Desafio
                                    </button>
                                    <button className={`parent-jump-btn ${parentSection === "conversa" ? "active" : ""}`} onClick={() => setParentSection("conversa")}>
                                        <i className="fab fa-whatsapp"></i> Conversa
                                    </button>
                                </div>
                            )}

                            {(mode !== "Pais" || parentSection === "evolucao") && <div className="graduation-panel" id={mode === "Pais" ? `parent-evolution-${s.id}` : undefined}>
                                <div className="graduation-head">
                                    <div className="graduation-title"><i className="fas fa-route"></i> Caminho até a próxima faixa</div>
                                    <div className="graduation-date"><i className="fas fa-calendar-alt"></i> {progresso.previsao}</div>
                                </div>
                                <div className="progress-track">
                                    <div className="progress-fill" style={{width: `${progresso.percentual}%`}}></div>
                                </div>
                                <div className="graduation-meta">
                                    {progresso.elegivel ? (
                                        <>
                                            <span><strong>{progresso.faltantes}</strong>aulas faltam</span>
                                            <span><strong>{progresso.feitas}/{progresso.total}</strong>aulas feitas</span>
                                            <span><strong>{progresso.percentual}%</strong>concluído</span>
                                        </>
                                    ) : (
                                        <span style={{gridColumn: '1 / -1'}}><strong>Fora da regra</strong>{progresso.aviso}</span>
                                    )}
                                </div>
                            </div>}

                            {mode === "Pais" && (
                                <div className={`parent-grid ${parentSection === "conversa" ? "chat-only" : ""}`}>
                                    <div className="parent-side">
                                        {parentSection === "desafio" && <div className="parent-panel parent-challenge-box" id={`parent-challenge-${s.id}`}>
                                            <div className="parent-panel-title">
                                                <span><i className="fas fa-stopwatch"></i> Desafio comportamental</span>
                                                {desafioInfo?.active && <b className={`belt-history-status ${desafioInfo.reached ? "overdue" : ""}`}>{desafioInfo.reached ? "Atingido" : "Ativo"}</b>}
                                            </div>
                                            <div className="parent-challenge-body">
                                                {desafioInfo?.active ? (
                                                    <>
                                                        <div className="parent-challenge-summary">
                                                            <span><b>{behaviorDegreeOptions.find(option => option.key === s.desafioGrau)?.label || "Grau"}</b>Grau para concluir</span>
                                                            <span><b>{desafioInfo.title}</b>Desafio</span>
                                                            <span><b>{formatDateBR(desafioInfo.start)}</b>Inicio</span>
                                                            <span><b>{formatDateBR(desafioInfo.end)}</b>Termino</span>
                                                        </div>
                                                        <div className={`student-info-chip challenge-chip ${desafioInfo.reached ? "overdue" : ""}`}>
                                                            <strong>{desafioInfo.reached ? "Prazo atingido" : `Faltam ${Math.max(0, desafioInfo.remaining)} dia${desafioInfo.remaining === 1 ? "" : "s"}`}</strong>
                                                            Acompanhamento do professor
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="belt-history-empty">Nenhum desafio comportamental ativo no momento.</div>
                                                )}
                                            </div>
                                        </div>}
                                        {(parentSection === "evolucao" || parentSection === "desafio") && <details className="parent-detail">
                                            <summary><span><i className="fas fa-medal"></i> Detalhes da graduação</span><i className="fas fa-chevron-down"></i></summary>
                                            <div className="parent-detail-body">
                                                <span className="section-label">Aulas de Presença</span>
                                                {!ruleInfo.elegivel ? (
                                                    <div className="rule-warning"><i className="fas fa-exclamation-triangle"></i> {ruleInfo.aviso}</div>
                                                ) : pronto ? (
                                                    <button className="alert-parents" onClick={() => agendarExamePeloAlerta(s.id)}>
                                                        <i className="fas fa-star"></i> AGENDAR EXAME DE FAIXA (CLIQUE AQUI)
                                                    </button>
                                                ) : (
                                                    <div className="bar">
                                                        {Array.from({length:rules}).map((_, i) => (
                                                            <div key={i} className={`box-class ${i < currentCycleClasses ? 'done' : ''} ${s.aulas >= rules * 9 && i >= currentCycleClasses ? 'locked' : ''}`}>{i+1}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                <span className="section-label">Graus de Presença</span>
                                                <div className="degree-row">
                                                    {Array.from({length:4}).map((_, i) => {
                                                        let c = "";
                                                        if (presenceDegreeStates[i] === 2) c = "bg-red";
                                                        else if (presenceDegreeStates[i] === 1) c = "bg-white";
                                                        return <div key={i} className={`degree-box ${c}`} style={{cursor:'default'}}></div>;
                                                    })}
                                                </div>
                                                <span className="section-label">Graus Comportamentais</span>
                                                <div className="degree-row" style={{ alignItems: 'flex-end', padding: '15px 12px' }}>
                                                    {[
                                                        {k:'Rel', i:'fa-users', c:'bg-yellow', l:'Relacionamento'}, 
                                                        {k:'Comp', i:'fa-brain', c:'bg-blue', l:'Comportamento'}, 
                                                        {k:'Notas', i:'fa-graduation-cap', c:'bg-red', l:'Notas'}, 
                                                        {k:'Hab', i:'fa-apple-alt', c:'bg-green', l:'Hábitos'}
                                                    ].map(m => (
                                                        <div key={m.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                            <div className={`merit-bar ${s.comp?.[m.k] ? m.c : ''}`} style={{ cursor: 'default', opacity: s.comp?.[m.k] ? 1 : 0.45 }}>
                                                                <i className={`fas ${m.i}`}></i>
                                                            </div>
                                                            <small style={{ color: '#aaa', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', textAlign: 'center' }}>{m.l}</small>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </details>}
                                        {parentSection === "evolucao" && <details className="parent-detail">
                                            <summary><span><i className="fas fa-history"></i> Histórico de evolução</span><i className="fas fa-chevron-down"></i></summary>
                                            <div className="parent-detail-body">
                                                <BeltHistory items={getBeltHistory(s, progresso)} student={s} canEdit={mode === "Professor"} onUpdateStart={updateCurrentBeltStart} />
                                            </div>
                                        </details>}
                                    </div>
                                    {parentSection === "conversa" && <div className="parent-panel parent-chat" id={`parent-chat-${s.id}`}>
                                        <div className="parent-panel-title">
                                            <span><i className="fab fa-whatsapp" style={{color: 'var(--whatsapp-green)'}}></i> Conversa com o professor</span>
                                            {unread > 0 && <b className="unread-dot">{unread}</b>}
                                        </div>
                                        {unread > 0 && (
                                            <div className="parent-alert">
                                                <span><i className="fas fa-bell"></i> {unread} mensagem{unread > 1 ? "s" : ""} nova{unread > 1 ? "s" : ""}</span>
                                                <button onClick={() => markChatAsRead(s.id, "Pais")}>Marcar como lida</button>
                                            </div>
                                        )}
                                        <div className="chat-msgs">
                                            {s.chat?.map(m => (
                                                <div key={m.id} className={`msg-wrapper ${m.sender === mode ? 'self' : 'other'}`}>
                                                    <span className="msg-author">{m.author}</span>
                                                    <div className="msg-bubble">
                                                        {m.isImage && (m.fileUrl || m.fileData) && <img src={m.fileUrl || m.fileData} className="chat-img-preview" onClick={() => setViewImage(m)} />}
                                                        {!m.isImage && (m.fileUrl || m.fileData) && <a href={m.fileUrl || m.fileData} download={m.fileName} style={{color:'#c9a554', textDecoration:'none'}}><i className="fas fa-file-download"></i> {m.fileName}</a>}
                                                        {m.text && <div>{m.text}</div>}
                                                        <div className="msg-meta">{getMessageMeta(m)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="parent-composer">
                                            <label style={{cursor:'pointer'}}><i className="fas fa-camera" style={{color:'#555'}}></i><input type="file" style={{display:'none'}} accept="image/*" onChange={e => handleFile(e.target.files[0], 'chat', s.id)}/></label>
                                            <input placeholder="Mensagem..." value={chatInputs[s.id] || ""} onChange={e => setChatInputs({...chatInputs, [s.id]: e.target.value})} onKeyDown={e => e.key === 'Enter' && sendMessage(s.id)}/>
                                            <i className="fas fa-paper-plane" style={{color: 'var(--alliance-green)', cursor:'pointer'}} onClick={() => sendMessage(s.id)}></i>
                                        </div>
                                    </div>}
                                </div>
                            )}

                            {mode !== "Pais" && (
                            <>
                            <span className="section-label">Aulas de Presença</span>
                            {!ruleInfo.elegivel ? (
                                <div className="rule-warning"><i className="fas fa-exclamation-triangle"></i> {ruleInfo.aviso}</div>
                            ) : mode === "Pais" && pronto ? (
                                <button className="alert-parents" onClick={() => agendarExamePeloAlerta(s.id)}>
                                    <i className="fas fa-star"></i> AGENDAR EXAME DE FAIXA (CLIQUE AQUI)
                                </button>
                            ) : (
                                <div className="bar">
                                    {Array.from({length:rules}).map((_, i) => (
                                        <div key={i} className={`box-class ${i < currentCycleClasses ? 'done' : ''} ${s.aulas >= rules * 9 && i >= currentCycleClasses ? 'locked' : ''}`} onClick={(e) => togglePresenca(s.id, i, e.detail)}>{i+1}</div>
                                    ))}
                                </div>
                            )}

                            <span className="section-label">Graus de Presença</span>
                            <div className="degree-row">
                                {Array.from({length:4}).map((_, i) => {
                                    let c = "";
                                    if (presenceDegreeStates[i] === 2) c = "bg-red";
                                    else if (presenceDegreeStates[i] === 1) c = "bg-white";
                                    return <div key={i} className={`degree-box ${c}`} onClick={() => toggleGrauPresenca(s.id, i)}></div>;
                                })}
                            </div>

                            <span className="section-label">Graus Comportamentais</span>
                            <div className="degree-row" style={{ alignItems: 'flex-end', padding: '15px 12px' }}>
                                {[
                                    {k:'Rel', i:'fa-users', c:'bg-yellow', l:'Relac.'}, 
                                    {k:'Comp', i:'fa-brain', c:'bg-blue', l:'Comp.'}, 
                                    {k:'Notas', i:'fa-graduation-cap', c:'bg-red', l:'Notas'}, 
                                    {k:'Hab', i:'fa-apple-alt', c:'bg-green', l:'Hab.'}
                                ].map(m => (
                                    <div key={m.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.l}</span>
                                        <div 
                                            className={`degree-box ${s.comp?.[m.k] ? m.c : ''}`} 
                                            onClick={() => toggleMeritoWithChallenge(s.id, m.k, m.l)}
                                            style={{ width: '100%', margin: 0, height: '42px' }}
                                        >
                                            <i className={`fas ${m.i}`} style={{ color: s.comp?.[m.k] ? '#000' : '#444', fontSize: '15px' }}></i>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {mode === "Professor" && (
                                <>
                                    <span className="section-label">Desafio de Graus Comportamentais</span>
                                    <div className="challenge-panel">
                                        <label className="check-row">
                                            <input
                                                type="checkbox"
                                                checked={!!s.desafioAtivo}
                                                onChange={e => {
                                                    const ativo = e.target.checked;
                                                    updateBehaviorChallenge(
                                                        s.id,
                                                        ativo
                                                            ?
                                                             {
                                                                desafioAtivo: true,
                                                                desafioTitulo: s.desafioTitulo || "",
                                                                desafioGrau: s.desafioGrau || "Rel",
                                                                desafioInicio: s.desafioInicio || getTodayISO(),
                                                                desafioDias: s.desafioDias || "7"
                                                            }
                                                            : { desafioAtivo: false },
                                                        ""
                                                    );
                                                }}
                                            />
                                            Desafio ativo para acompanhar graus comportamentais
                                        </label>
                                        {s.desafioAtivo ? (
                                            <div className="form-grid">
                                                <textarea className="challenge-description" placeholder="Escreva o desafio comportamental. Ex: Cumprimentar os colegas ao chegar e ajudar a organizar o tatame." value={s.desafioTitulo || ""} onChange={e => updateBehaviorChallenge(s.id, { desafioTitulo: e.target.value })}></textarea>
                                                <div className="challenge-degree-picker">
                                                    <label className="field-label">Grau que encerra o desafio</label>
                                                    <div className="challenge-degree-options">
                                                        {behaviorDegreeOptions.map(option => (
                                                            <button
                                                                type="button"
                                                                key={option.key}
                                                                className={`challenge-degree-btn ${option.className} ${(s.desafioGrau || "Rel") === option.key ? "active" : ""}`}
                                                                onClick={() => updateBehaviorChallenge(s.id, { desafioGrau: option.key })}
                                                                title={option.label}
                                                            >
                                                                <i></i>
                                                                <span>{option.short}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="field-label">Inicio do desafio</label>
                                                    <input type="date" value={s.desafioInicio || ""} onChange={e => updateBehaviorChallenge(s.id, { desafioInicio: e.target.value })} />
                                                </div>
                                                <input type="number" min="1" placeholder="Quantidade de dias" value={s.desafioDias || ""} onChange={e => updateBehaviorChallenge(s.id, { desafioDias: e.target.value })} />
                                                <div className={`student-info-chip challenge-chip ${desafioInfo?.reached ? "overdue" : ""}`}>
                                                    <strong>{desafioInfo?.end ? formatDateBR(desafioInfo.end) : "Informe inicio e dias"}</strong>
                                                    {desafioInfo?.reached ? "Prazo atingido" : "Termino previsto"}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="challenge-empty">Nenhum desafio ativo para este aluno.</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {mode === "Professor" && pronto && (
                                <button className="btn-full btn-graduar" onClick={() => graduarAlunoComHistorico(s.id)}><i className="fas fa-medal"></i> GRADUAR PARA {beltOrder[beltOrder.indexOf(s.faixa)+1]}</button>
                            )}

                            <details className="hist-details">
                                <summary className="hist-summary"><span><i className="fas fa-medal"></i> Histórico de faixas</span><i className="fas fa-chevron-down"></i></summary>
                                <div className="hist-content" style={{maxHeight:'360px'}}><BeltHistory items={getBeltHistory(s, progresso)} student={s} canEdit={mode === "Professor"} onUpdateStart={updateCurrentBeltStart} /></div>
                            </details>

                            <details className="hist-details">
                                <summary className="hist-summary"><span><i className="fas fa-history"></i> Histórico</span><i className="fas fa-chevron-down"></i></summary>
                                <div className="hist-content">{s.historico?.slice().reverse().map((h, i) => <div key={i} style={{padding:'6px 0', borderBottom:'1px solid #222'}}>{h}</div>)}</div>
                            </details>

                            {mode !== "Professor" && <div className="chat-container" id={`chat-${s.id}`}>
                                <div className="chat-header" onClick={() => { setOpenChats({...openChats, [s.id]: !openChats[s.id]}); if(!openChats[s.id]) setStudents(prev => prev.map(x => x.id === s.id ? {...x, chat: (x.chat||[]).map(m => !(m.readBy || []).includes(mode) ? {...m, readBy: [...(m.readBy || []), mode]} : m)} : x)); }}>
                                    <span style={{fontSize:'12px'}}><i className="fab fa-whatsapp" style={{color: 'var(--whatsapp-green)'}}></i> CONVERSA {unread > 0 && <span style={{background: 'var(--alliance-red)', padding:'2px 6px', borderRadius:'10px', fontSize:'9px', marginLeft:'5px'}}>{unread}</span>}</span>
                                    <i className={`fas fa-chevron-${openChats[s.id] ? 'up' : 'down'}`} style={{fontSize:'10px'}}></i>
                                </div>
                                {openChats[s.id] && (
                                    <>
                                        <div className="chat-msgs">
                                            {s.chat?.map(m => (
                                                <div key={m.id} className={`msg-wrapper ${m.sender === mode ? 'self' : 'other'}`}>
                                                    <span className="msg-author">{m.author}</span>
                                                    <div className="msg-bubble">
                                                        {m.isImage && (m.fileUrl || m.fileData) && <img src={m.fileUrl || m.fileData} className="chat-img-preview" onClick={() => setViewImage(m)} />}
                                                        {!m.isImage && (m.fileUrl || m.fileData) && <a href={m.fileUrl || m.fileData} download={m.fileName} style={{color:'#c9a554', textDecoration:'none'}}><i className="fas fa-file-download"></i> {m.fileName}</a>}
                                                        {m.text && <div>{m.text}</div>}
                                                        <div className="msg-meta">{getMessageMeta(m)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{display:'flex', padding:'12px', background:'#1a1a1a', gap:'10px', alignItems:'center'}}>
                                            <label style={{cursor:'pointer'}}><i className="fas fa-camera" style={{color:'#555'}}></i><input type="file" style={{display:'none'}} accept="image/*" onChange={e => handleFile(e.target.files[0], 'chat', s.id)}/></label>
                                            <input style={{flex:1, border:'none', background:'#000', color:'white', padding:'12px 18px', borderRadius:'25px', fontSize:'14px', margin:0}} placeholder="Mensagem..." value={chatInputs[s.id] || ""} onChange={e => setChatInputs({...chatInputs, [s.id]: e.target.value})} onKeyDown={e => e.key === 'Enter' && sendMessage(s.id)}/>
                                            <i className="fas fa-paper-plane" style={{color: 'var(--alliance-green)', cursor:'pointer'}} onClick={() => sendMessage(s.id)}></i>
                                        </div>
                                    </>
                                )}
                            </div>}
                            </>
                            )}
                        </div>
                    );
                    })}
                    </div>
                )}

                {mode !== "Pais" && mode === "Professor" && professorView === "alunos" && !expandedSearchStudentId && <div className="action-bar">
                    {mode === "Professor" ? (
                        <>
                            {isCentralAdmin && <div className="action-item" onClick={() => setProfessorView("central")}><i className="fas fa-building"></i><span>CENTRAL</span></div>}
                            <div className="action-item" onClick={() => { setProfessorView("alunos"); setForm({...createEmptyStudentForm(), unidadeId: effectiveUnitId}); setModalOpen('add'); }}><i className="fas fa-user-plus"></i><span>ALUNO</span></div>
                            <div className="action-item" onClick={() => setModalOpen('repo')}><i className="fas fa-folder-open"></i><span>ARQUIVOS</span></div>
                            {canAccessDashboard && <div className="action-item" onClick={() => setProfessorView("painel")}><i className="fas fa-chart-pie"></i><span>PAINEL</span></div>}
                            <div className="action-item" onClick={() => setProfessorView("conversas")}>
                                {totalUnreadProfessor > 0 && <b className="nav-badge">{totalUnreadProfessor > 99 ? "99+" : totalUnreadProfessor}</b>}
                                <i className="fab fa-whatsapp"></i><span>CONVERSAS</span>
                            </div>
                            <div className="action-item" onClick={() => window.open('https://alliancemooca.com.br/blog/', '_blank')}><i className="fas fa-globe"></i><span>SITE</span></div>
                            <div className="action-item" onClick={() => { setMode(null); setSubMode(null); setCurrentUser(null); setAuth({user:'', pass:''}); setSearchTerm(""); }}><i className="fas fa-sign-out-alt"></i><span>SAIR</span></div>
                        </>
                    ) : (
                        <>
                            <div className="action-item" onClick={() => window.open('https://alliancemooca.com.br/blog/', '_blank')}><i className="fas fa-globe"></i><span>SITE</span></div>
                            <div className="action-item" onClick={() => setModalOpen('repo')}><i className="fas fa-folder-open"></i><span>ARQUIVOS</span></div>
                            <div className="action-item" onClick={() => { setMode(null); setSubMode(null); setCurrentUser(null); setAuth({user:'', pass:''}); setSearchTerm(""); }}><i className="fas fa-sign-out-alt"></i><span>SAIR</span></div>
                        </>
                    )}
                </div>}

                {/* MODAL BACKUP */}
                {modalOpen === 'backup' && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Gestão de Dados</h3>
                            <div className="data-status-card">
                                <span><i className={`fas ${(appwriteServices || supabaseClient) && !dbStatus.includes("Erro") ? "fa-database" : "fa-exclamation-triangle"}`}></i> Banco</span>
                                <strong>{appwriteServices ? "Appwrite" : (supabaseClient ? "Supabase" : "Somente navegador")} · {dbStatus}{!isHydrated ? "..." : ""}</strong>
                            </div>
                            <div className="data-status-card">
                                <span><i className={`fas ${pendingSync ? "fa-cloud-upload-alt" : "fa-check-circle"}`}></i> Sincronização</span>
                                <strong>{pendingSync ? "Alterações pendentes no navegador" : "Sem pendências locais"}</strong>
                            </div>
                            <div className="data-status-card">
                                <span><i className="fas fa-shield-alt"></i> Backup local</span>
                                <strong>{lastAutoBackupAt ? new Date(lastAutoBackupAt).toLocaleString("pt-BR") : "Ainda não gerado"} · {getStoredArrayCount(LOCAL_BACKUP_HISTORY_KEY)} versão(ões) diária(s)</strong>
                            </div>
                            <div className="data-status-card">
                                <span><i className="fas fa-clock-rotate-left"></i> Auditoria</span>
                                <strong>{getStoredArrayCount(LOCAL_AUDIT_KEY)} alteração(ões) registrada(s)</strong>
                            </div>
                            <div className="theme-toggle-row">
                                <button type="button" className={`theme-choice ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>
                                    <i className="fas fa-moon"></i> Tema escuro
                                </button>
                                <button type="button" className={`theme-choice ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>
                                    <i className="fas fa-sun"></i> Tema claro
                                </button>
                            </div>
                            <button className="btn-full" style={{background: 'var(--alliance-green)', color:'white'}} onClick={downloadBackup}>
                                <i className="fas fa-download"></i> GERAR BACKUP (.JSON)
                            </button>
                            <button className="btn-full" style={{background: '#f6c400', color:'#071827'}} onClick={downloadAutomaticLocalBackup}>
                                <i className="fas fa-save"></i> BAIXAR BACKUP AUTOMÁTICO LOCAL
                            </button>
                            <button className="btn-full" style={{background: '#3498db', color:'white'}} onClick={syncLocalChangesNow}>
                                <i className="fas fa-sync-alt"></i> SINCRONIZAR PENDÊNCIAS AGORA
                            </button>
                            <button className="btn-full" style={{background: '#172033', color:'#f6c400', border:'1px solid rgba(246,196,0,0.35)'}} onClick={downloadAuditTrail}>
                                <i className="fas fa-file-shield"></i> BAIXAR AUDITORIA
                            </button>
                            <button className="btn-full" style={{background: '#172033', color:'#f6c400', border:'1px solid rgba(246,196,0,0.35)'}} onClick={() => { setAuditSearch(""); setModalOpen('audit'); }}>
                                <i className="fas fa-magnifying-glass-chart"></i> CONSULTAR AUDITORIA
                            </button>
                            {canManageUsers && (
                                <button className="btn-full" style={{background: '#0f2438', color:'#f6c400', border:'1px solid rgba(246,196,0,0.35)'}} onClick={() => setModalOpen('users')}>
                                    <i className="fas fa-users-gear"></i> USUÁRIOS DO SISTEMA
                                </button>
                            )}
                            <label className="btn-full" style={{background: 'var(--alliance-red)', color:'white', display:'block', textAlign:'center', cursor:'pointer', marginTop:'15px'}}>
                                <i className="fas fa-upload"></i> IMPORTAR BACKUP
                                <input type="file" style={{display:'none'}} accept=".json" onChange={importBackup} />
                            </label>
                            <button className="btn-full" onClick={() => setModalOpen(null)}>FECHAR</button>
                        </div>
                    </div>
                )}

                {modalOpen === 'audit' && canManageUsers && (() => {
                    const query = auditSearch.trim().toLocaleLowerCase("pt-BR");
                    const entries = getAuditTrail().filter(entry => !query || String(entry).toLocaleLowerCase("pt-BR").includes(query));
                    return (
                        <div className="modal-overlay">
                            <div className="modal-content">
                                <h3>Auditoria do Sistema</h3>
                                <p style={{color:'var(--text-muted)', fontSize:'13px'}}>Consulte usuário, data, ação e valores alterados. Os registros mais recentes aparecem primeiro.</p>
                                <div className="audit-toolbar">
                                    <input aria-label="Pesquisar auditoria" placeholder="Pesquisar usuário, aluno ou alteração..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
                                    <button className="filter-btn" onClick={() => setAuditSearch("")}><i className="fas fa-eraser"></i> LIMPAR</button>
                                </div>
                                <div className="audit-list">
                                    {entries.length ? entries.slice(0, 250).map((entry, index) => <div className="audit-entry" key={`${index}-${entry}`}>{entry}</div>) : <div className="audit-empty">Nenhuma alteração encontrada.</div>}
                                </div>
                                <button className="btn-full" onClick={downloadAuditTrail}><i className="fas fa-download"></i> BAIXAR AUDITORIA COMPLETA</button>
                                <button className="btn-full" onClick={() => setModalOpen('backup')}>VOLTAR</button>
                            </div>
                        </div>
                    );
                })()}

                {modalOpen === 'units' && isCentralAdmin && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Unidades da Rede</h3>
                            <p style={{color:'var(--text-muted)', marginTop:'-8px', fontSize:'13px'}}>Cadastre a unidade e depois vincule professores e recepção ao acesso correto.</p>
                            <div className="form-grid">
                                <div>
                                    <label className="field-label">Nome da unidade</label>
                                    <input placeholder="Ex.: Alliance Tatuapé" value={unitForm.nome} onChange={e => setUnitForm({...unitForm, nome:e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Cidade</label>
                                    <input placeholder="Cidade" value={unitForm.cidade} onChange={e => setUnitForm({...unitForm, cidade:e.target.value})} />
                                </div>
                            </div>
                            <button className="btn-full" style={{background:'var(--alliance-green)', color:'#fff'}} onClick={() => {
                                const nome = unitForm.nome.trim();
                                if (!nome) return alert("Informe o nome da unidade.");
                                const baseId = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `unidade-${Date.now()}`;
                                const id = units.some(unit => unit.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
                                setUnits([...units, { id, nome, cidade: unitForm.cidade.trim() || "São Paulo", status:"Ativa", createdAt:new Date().toISOString() }]);
                                setUnitForm({ nome:"", cidade:"São Paulo", status:"Ativa" });
                            }}><i className="fas fa-plus"></i> ADICIONAR UNIDADE</button>
                            <div style={{display:'grid', gap:'10px', margin:'18px 0'}}>
                                {units.map(unit => {
                                    const count = students.filter(student => getStudentUnitId(student) === unit.id).length;
                                    return <div key={unit.id} style={{display:'grid', gridTemplateColumns:'1fr auto', gap:'10px', alignItems:'center', padding:'13px', border:'1px solid var(--border-color)', borderRadius:'14px', background:'rgba(255,255,255,.03)'}}>
                                        <div><strong style={{display:'block', color:'var(--text-main)'}}>{unit.nome}</strong><small style={{color:'var(--text-muted)'}}>{unit.cidade || "Sem cidade"} • {count} aluno{count === 1 ? "" : "s"} • {unit.status || "Ativa"}</small></div>
                                        <button className="filter-btn" disabled={unit.id === DEFAULT_UNIT_ID} onClick={() => setUnits(units.map(item => item.id === unit.id ? {...item, status:item.status === "Inativa" ? "Ativa" : "Inativa"} : item))}>{unit.id === DEFAULT_UNIT_ID ? "Principal" : (unit.status === "Inativa" ? "Ativar" : "Inativar")}</button>
                                    </div>;
                                })}
                            </div>
                            <button className="btn-full" onClick={() => setModalOpen(null)}>FECHAR</button>
                        </div>
                    </div>
                )}

                {modalOpen === 'users' && canManageUsers && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Usuários do Sistema</h3>
                            <p style={{color:'#9aa6b2', marginTop:'-8px', fontSize:'13px'}}>Crie acessos para professores, recepção ou administradores. O acesso dos pais continua pelo nome do aluno e nascimento.</p>
                            <label className="field-label">Nome</label>
                            <input placeholder="Nome do usuário" value={userForm.nome} onChange={e => setUserForm({...userForm, nome: e.target.value})} />
                            <div className="form-grid">
                                <div>
                                    <label className="field-label">Login</label>
                                    <input placeholder="Login" value={userForm.login} onChange={e => setUserForm({...userForm, login: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Senha</label>
                                    <input type="password" placeholder="Senha" value={userForm.senha} onChange={e => setUserForm({...userForm, senha: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Perfil</label>
                                    <select value={userForm.perfil} onChange={e => setUserForm({...userForm, perfil: e.target.value, unidadeId: e.target.value === "Administrador" ? "all" : (userForm.unidadeId === "all" ? effectiveUnitId : userForm.unidadeId)})}>
                                        <option value="Administrador">Administrador</option>
                                        <option value="Professor">Professor</option>
                                        <option value="Recepção">Recepção (sem painel)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">Unidade de acesso</label>
                                    <select disabled={userForm.perfil === "Administrador"} value={userForm.perfil === "Administrador" ? "all" : (userForm.unidadeId || effectiveUnitId)} onChange={e => setUserForm({...userForm, unidadeId: e.target.value})}>
                                        {userForm.perfil === "Administrador" && <option value="all">Todas as unidades</option>}
                                        {unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">Status</label>
                                    <select value={userForm.status} onChange={e => setUserForm({...userForm, status: e.target.value})}>
                                        <option value="Ativo">Ativo</option>
                                        <option value="Inativo">Inativo</option>
                                    </select>
                                </div>
                            </div>
                            <button className="btn-full" style={{background:'var(--alliance-green)', color:'#fff'}} onClick={() => {
                                const nome = userForm.nome.trim();
                                const login = userForm.login.trim();
                                const senha = userForm.senha.trim();
                                if (!nome || !login || !senha) return alert("Preencha nome, login e senha.");
                                if (users.some(user => String(user.login || "").toLowerCase().trim() === login.toLowerCase())) return alert("Já existe um usuário com este login.");
                                const unidadeId = userForm.perfil === "Administrador" ? "all" : (userForm.unidadeId || effectiveUnitId);
                                setUsers([...users, { ...userForm, unidadeId, nome, login, senha, id: Date.now(), createdAt: new Date().toISOString() }]);
                                setUserForm({ nome: "", login: "", senha: "", perfil: "Professor", unidadeId: effectiveUnitId, status: "Ativo" });
                            }}>
                                <i className="fas fa-user-plus"></i> ADICIONAR USUÁRIO
                            </button>
                            <div style={{display:'grid', gap:'10px', margin:'18px 0'}}>
                                {users.map(user => (
                                    <div key={user.id} style={{display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:'10px', alignItems:'center', padding:'12px', border:'1px solid var(--border-color)', borderRadius:'14px', background:'rgba(255,255,255,0.03)'}}>
                                        <div>
                                            <strong style={{display:'block', color:'#fff'}}>{user.nome}</strong>
                                            <small style={{color:'#9aa6b2'}}>{user.login} • {user.perfil} • {user.perfil === "Administrador" ? "Todas as unidades" : (units.find(unit => unit.id === (user.unidadeId || DEFAULT_UNIT_ID))?.nome || DEFAULT_UNIT_NAME)} • {user.status || "Ativo"}</small>
                                        </div>
                                        <button className="filter-btn" onClick={() => {
                                            const novaSenha = prompt(`Nova senha para ${user.nome}:`, "");
                                            if (novaSenha === null) return;
                                            if (!novaSenha.trim()) return alert("Informe uma senha válida.");
                                            setUsers(users.map(item => item.id === user.id ? { ...item, senha: novaSenha.trim(), senhaAtualizadaEm: new Date().toISOString() } : item));
                                            alert("Senha alterada com sucesso.");
                                        }}>
                                            Senha
                                        </button>
                                        <button className="filter-btn" onClick={() => setUsers(users.map(item => item.id === user.id ? { ...item, status: (item.status || "Ativo") === "Ativo" ? "Inativo" : "Ativo" } : item))}>
                                            {(user.status || "Ativo") === "Ativo" ? "Inativar" : "Ativar"}
                                        </button>
                                        {user.login !== "admin" && (
                                            <button className="filter-btn" onClick={() => confirm("Remover este usuário?") && setUsers(users.filter(item => item.id !== user.id))}>
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button className="btn-full" onClick={() => setModalOpen('backup')}>VOLTAR</button>
                            <button className="btn-full" onClick={() => setModalOpen(null)}>FECHAR</button>
                        </div>
                    </div>
                )}

                {/* MODAL ADICIONAR ALUNO */}
                {modalOpen === 'add' && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Novo Aluno</h3>
                            <label className="field-label">Nome completo</label>
                            <input placeholder="Nome Completo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                            <div className="form-grid">
                                <div>
                                    <label className="field-label">Data de nascimento</label>
                                    <input type="date" value={form.nascimento} onChange={e => setForm({...form, nascimento: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Sexo</label>
                                    <select value={form.sexo} onChange={e => { const sexo = e.target.value; setForm({...form, sexo, avatar: getAvatarPreset(form.avatar)?.sexo === sexo ? form.avatar : getDefaultPresetForSex(sexo)}); }}>
                                        <option value="M">Masculino</option>
                                        <option value="F">Feminino</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">Unidade</label>
                                    <select value={form.unidadeId || DEFAULT_UNIT_ID} onChange={e => setForm({...form, unidadeId: e.target.value})}>
                                        {unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="avatar-picker-inline">
                                <label className="field-label">Avatar opcional</label>
                                <AvatarOptions sexo={form.sexo || "M"} value={form.avatar} onSelect={avatar => setForm({...form, avatar})} />
                            </div>
                            <div className="form-grid">
                                <div>
                                    <label className="field-label">Status</label>
                                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                        {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">Matrícula</label>
                                    <input type="date" value={form.matricula} onChange={e => setForm({...form, matricula: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Responsável</label>
                                    <input placeholder="Nome do responsável" value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">WhatsApp do responsável</label>
                                    <input placeholder="WhatsApp do responsável" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">E-mail do responsável</label>
                                    <input placeholder="E-mail do responsável" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                                </div>
                            </div>
                            <textarea placeholder="Observação interna / necessidade especial" value={form.necessidades} onChange={e => setForm({...form, necessidades: e.target.value})}></textarea>
                            <textarea placeholder="Observações internas do professor" value={form.observacoesInternas} onChange={e => setForm({...form, observacoesInternas: e.target.value})}></textarea>
                            <label className="check-row">
                                <input type="checkbox" checked={form.autorizacaoImagem} onChange={e => setForm({...form, autorizacaoImagem: e.target.checked})} />
                                Autorização de uso de imagem
                            </label>
                            <label className="field-label">Turma</label>
                            <select value={form.categoriaOverride} onChange={e => setForm({...form, categoriaOverride: e.target.value})}>
                                {categoryOptions.map(c => <option key={c} value={c}>{c === "Auto" ? `Automática: ${form.nascimento ? getAutoCategory(form.nascimento) : "pela idade"}` : c}</option>)}
                            </select>
                            <label className="field-label">Faixa</label>
                            <select value={form.faixa} onChange={e => setForm({...form, faixa: e.target.value})}>
                                {beltOrder.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <button className="btn-full" style={{background: 'var(--alliance-green)', color:'white'}} onClick={() => {
                                if(!form.nome || !form.nascimento) return alert("Preencha tudo!");
                                const nome = form.nome.trim();
                                const exists = students.some(s => s.nome.toLowerCase().trim() === nome.toLowerCase() && s.nascimento === form.nascimento);
                                if (exists) return alert("Este aluno já está cadastrado.");
                                const categoriaTexto = form.categoriaOverride === "Auto" ? getAutoCategory(form.nascimento) : `${form.categoriaOverride} (manual)`;
                                setStudents([...students, normalizeStudent({ ...form, unidadeId: form.unidadeId || effectiveUnitId, nome, id: Date.now(), aulas: 0, cicloFaixaInicio: form.matricula || getTodayISO(), beltHistory: [], historico: [`Matrícula realizada em ${new Date().toLocaleDateString('pt-BR')}`, `Turma inicial: ${categoriaTexto}`, `Unidade inicial: ${getStudentUnitName(form, units)}`] })]);
                                setModalOpen(null);
                                setForm({...createEmptyStudentForm(), unidadeId: effectiveUnitId});
                            }}>SALVAR</button>
                            <button className="btn-full" onClick={() => setModalOpen(null)}>CANCELAR</button>
                        </div>
                    </div>
                )}

                {/* MODAL REPOSITÓRIO */}
                {modalOpen === 'repo' && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Arquivos e Materiais</h3>
                            {mode === "Professor" && (
                                <div style={{marginBottom:'20px'}}>
                                    <label className="btn-full" style={{background: 'var(--alliance-red)', color:'white', display:'block', textAlign:'center', cursor:'pointer'}}>
                                        <i className="fas fa-upload"></i> UPLOAD ARQUIVO
                                        <input type="file" style={{display:'none'}} onChange={e => handleFile(e.target.files[0], 'repo')} />
                                    </label>
                                </div>
                            )}
                            <div style={{marginTop:'15px'}}>
                                {scopedRepo.length === 0 && <p style={{textAlign:'center', color:'#555'}}>Nenhum arquivo disponível nesta unidade.</p>}
                                {scopedRepo.map(r => (
                                    <div key={r.id} className="repo-item">
                                        <div style={{flex:1, overflow:'hidden', marginRight:'10px'}}>
                                            <div style={{fontSize:'13px', fontWeight:'bold', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.name}</div>
                                            <div style={{fontSize:'10px', color:'#555'}}>{r.date}</div>
                                        </div>
                                        <div style={{display:'flex', gap:'15px'}}>
                                            <a href={r.fileUrl || r.data} download={r.name} style={{color:'#c9a554'}}><i className="fas fa-download"></i></a>
                                            {mode === "Professor" && <i className="fas fa-trash" style={{color:'var(--alliance-red)', cursor:'pointer'}} onClick={() => confirm("Excluir arquivo?") && setRepo(repo.filter(x => x.id !== r.id))}></i>}
                                        </div>
                                    </div>
                                ))}
                                <button className="btn-full" onClick={() => setModalOpen(null)}>FECHAR</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL EDITAR ALUNO */}
                {modalOpen === 'edit' && editingStudent && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Editar Aluno</h3>
                            <label className="field-label">Nome completo</label>
                            <input placeholder="Nome" value={editingStudent.nome} onChange={e => setEditingStudent({...editingStudent, nome: e.target.value})} />
                            <div className="form-grid">
                                <div>
                                    <label className="field-label">Data de nascimento</label>
                                    <input type="date" value={editingStudent.nascimento} onChange={e => setEditingStudent({...editingStudent, nascimento: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Sexo</label>
                                    <select value={editingStudent.sexo || "M"} onChange={e => { const sexo = e.target.value; setEditingStudent({...editingStudent, sexo, avatar: getAvatarPreset(editingStudent.avatar)?.sexo === sexo ? editingStudent.avatar : getDefaultPresetForSex(sexo)}); }}>
                                        <option value="M">Masculino</option>
                                        <option value="F">Feminino</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">Unidade</label>
                                    <select value={editingStudent.unidadeId || DEFAULT_UNIT_ID} onChange={e => setEditingStudent({...editingStudent, unidadeId: e.target.value})}>
                                        {unitOptions.map(unit => <option key={unit.id} value={unit.id}>{unit.nome}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="avatar-picker-inline">
                                <label className="field-label">Avatar opcional</label>
                                <AvatarOptions sexo={editingStudent.sexo || "M"} value={editingStudent.avatar || ""} onSelect={avatar => setEditingStudent({...editingStudent, avatar, avatarFileId: ""})} />
                            </div>
                            <div className="form-grid">
                                <div>
                                    <label className="field-label">Status</label>
                                    <select value={editingStudent.status || "Ativo"} onChange={e => setEditingStudent({...editingStudent, status: e.target.value})}>
                                        {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="field-label">Matrícula</label>
                                    <input type="date" value={editingStudent.matricula || ""} onChange={e => setEditingStudent({...editingStudent, matricula: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Última presença</label>
                                    <input type="date" value={editingStudent.ultimaPresenca || ""} onChange={e => setEditingStudent({...editingStudent, ultimaPresenca: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">Responsável</label>
                                    <input placeholder="Nome do responsável" value={editingStudent.responsavel || ""} onChange={e => setEditingStudent({...editingStudent, responsavel: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">WhatsApp do responsável</label>
                                    <input placeholder="WhatsApp do responsável" value={editingStudent.telefone || ""} onChange={e => setEditingStudent({...editingStudent, telefone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="field-label">E-mail do responsável</label>
                                    <input placeholder="E-mail do responsável" value={editingStudent.email || ""} onChange={e => setEditingStudent({...editingStudent, email: e.target.value})} />
                                </div>
                            </div>
                            <textarea placeholder="Observação interna / necessidade especial" value={editingStudent.necessidades || ""} onChange={e => setEditingStudent({...editingStudent, necessidades: e.target.value})}></textarea>
                            <textarea placeholder="Observações internas do professor" value={editingStudent.observacoesInternas || ""} onChange={e => setEditingStudent({...editingStudent, observacoesInternas: e.target.value})}></textarea>
                            <label className="check-row">
                                <input type="checkbox" checked={!!editingStudent.autorizacaoImagem} onChange={e => setEditingStudent({...editingStudent, autorizacaoImagem: e.target.checked})} />
                                Autorização de uso de imagem
                            </label>
                            <label className="field-label">Turma</label>
                            <select value={editingStudent.categoriaOverride || "Auto"} onChange={e => setEditingStudent({...editingStudent, categoriaOverride: e.target.value})}>
                                {categoryOptions.map(c => <option key={c} value={c}>{c === "Auto" ? `Automática: ${getAutoCategory(editingStudent.nascimento)}` : c}</option>)}
                            </select>
                            <label className="field-label">Faixa</label>
                            <select value={editingStudent.faixa} onChange={e => setEditingStudent({...editingStudent, faixa: e.target.value})}>
                                {beltOrder.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <button className="btn-full" style={{background: 'var(--alliance-green)', color:'white'}} onClick={() => {
                                if(!editingStudent.nome.trim() || !editingStudent.nascimento) return alert("Preencha tudo!");
                                const alunoOriginal = students.find(s => s.id === editingStudent.id);
                                const hoje = new Date().toLocaleDateString('pt-BR');
                                const logs = [];
                                let alunoAtualizado = normalizeStudent({ ...editingStudent, nome: editingStudent.nome.trim() });

                                if (alunoOriginal && alunoOriginal.faixa !== alunoAtualizado.faixa) {
                                    if (!window.confirm(`Alterar a faixa de ${alunoOriginal.nome} de ${alunoOriginal.faixa} para ${alunoAtualizado.faixa}? O ciclo atual será encerrado e os contadores serão reiniciados.`)) return;
                                    logs.push(createAuditLog("Faixa alterada manualmente", "Faixa", alunoOriginal.faixa, alunoAtualizado.faixa));
                                    const { presenceDegrees, ...semGrausPresenca } = alunoAtualizado;
                                    alunoAtualizado = { ...semGrausPresenca, aulas: 0, comp: {}, cicloFaixaInicio: getTodayISO(), beltHistory: [...(alunoOriginal.beltHistory || []), buildBeltCycleRecord(alunoOriginal, alunoAtualizado.faixa, "Alteracao manual")] };
                                }

                                const categoriaAnterior = alunoOriginal?.categoriaOverride || "Auto";
                                const categoriaNova = alunoAtualizado.categoriaOverride || "Auto";
                                if (alunoOriginal && categoriaAnterior !== categoriaNova) {
                                    logs.push(createAuditLog("Turma alterada", "Turma", categoriaAnterior === "Auto" ? "Automática" : categoriaAnterior, categoriaNova === "Auto" ? "Automática" : categoriaNova));
                                }

                                if (alunoOriginal && getStudentUnitId(alunoOriginal) !== getStudentUnitId(alunoAtualizado)) {
                                    logs.push(createAuditLog("Unidade alterada", "Unidade", getStudentUnitName(alunoOriginal, units), getStudentUnitName(alunoAtualizado, units)));
                                }

                                const statusAnterior = alunoOriginal?.status || "Ativo";
                                const statusNovo = alunoAtualizado.status || "Ativo";
                                if (alunoOriginal && statusAnterior !== statusNovo) {
                                    logs.push(createAuditLog("Status alterado", "Status", statusAnterior, statusNovo));
                                    alunoAtualizado = { ...alunoAtualizado, statusAlteradoEm: getTodayISO() };
                                }

                                const desafioDepois = getBehaviorChallenge(alunoAtualizado);
                                const desafioMudou = alunoOriginal && (
                                    !!alunoOriginal.desafioAtivo !== !!alunoAtualizado.desafioAtivo ||
                                    (alunoOriginal.desafioTitulo || "") !== (alunoAtualizado.desafioTitulo || "") ||
                                    (alunoOriginal.desafioGrau || "Rel") !== (alunoAtualizado.desafioGrau || "Rel") ||
                                    (alunoOriginal.desafioInicio || "") !== (alunoAtualizado.desafioInicio || "") ||
                                    String(alunoOriginal.desafioDias || "") !== String(alunoAtualizado.desafioDias || "")
                                );
                                if (desafioMudou) {
                                    logs.push(`DESAFIO COMPORTAMENTAL: ${desafioDepois?.active ? `${desafioDepois.title} de ${formatDateBR(desafioDepois.start)} ate ${formatDateBR(desafioDepois.end)}` : "desativado"} | ${hoje}`);
                                }

                                if (logs.length) alunoAtualizado = { ...alunoAtualizado, historico: [...(alunoOriginal?.historico || []), ...logs] };
                                setStudents(students.map(s => s.id === editingStudent.id ? alunoAtualizado : s));
                                setModalOpen(null);
                            }}>ATUALIZAR</button>
                            <button className="btn-full" onClick={() => setModalOpen(null)}>FECHAR</button>
                        </div>
                    </div>
                )}

                {avatarPickerStudent && (
                    <div className="modal-overlay" onClick={() => setAvatarPickerStudent(null)}>
                        <div className="modal-content avatar-picker-modal" onClick={event => event.stopPropagation()}>
                            <h3>Escolher avatar</h3>
                            <p>Selecione uma opção para {avatarPickerStudent.nome} ou envie uma foto própria.</p>
                            <AvatarOptions
                                sexo={avatarPickerStudent.sexo}
                                value={avatarPickerStudent.avatar}
                                onSelect={avatar => selectStudentAvatar(avatarPickerStudent.id, avatar)}
                            />
                            <label className="btn-full avatar-upload-button">
                                <i className="fas fa-camera"></i> ENVIAR FOTO
                                <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={event => {
                                        handleFile(avatarPickerStudent.id, event.target.files[0], 'avatar');
                                        setAvatarPickerStudent(null);
                                    }}
                                />
                            </label>
                            <button className="btn-full" onClick={() => setAvatarPickerStudent(null)}>FECHAR</button>
                        </div>
                    </div>
                )}

                {viewImage && (
                    <div className="modal-overlay" onClick={() => setViewImage(null)}>
                        <img src={viewImage.fileUrl || viewImage.fileData} style={{maxWidth:'100%', maxHeight:'90vh', borderRadius:'10px'}} />
                    </div>
                )}
            </div>
        );
    }

export default App;



