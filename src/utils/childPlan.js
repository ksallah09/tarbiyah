import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAN_KEY      = 'tarbiyah_child_plan';
const LOGS_KEY      = 'tarbiyah_child_logs';
const CHECKINS_KEY  = 'tarbiyah_child_checkins';

// ── Plan ─────────────────────────────────────────────────────────────────────

export async function saveChildPlan(plan) {
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export async function getActiveChildPlan() {
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function clearChildPlan() {
  await AsyncStorage.multiRemove([PLAN_KEY, LOGS_KEY, CHECKINS_KEY]);
}

// ── Check-ins ─────────────────────────────────────────────────────────────────

export async function getCheckIns() {
  try {
    const raw = await AsyncStorage.getItem(CHECKINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveCheckIn(ci) {
  const existing = await getCheckIns();
  await AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify([ci, ...existing]));
}

// ── Action logs ───────────────────────────────────────────────────────────────
// Stored as { 'YYYY-MM-DD': [bool x5] }

export async function getActionLogs() {
  try {
    const raw = await AsyncStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function logAction(dateStr, actionIndex, completed) {
  const logs = await getActionLogs();
  if (!logs[dateStr]) logs[dateStr] = [false, false, false, false, false];
  logs[dateStr][actionIndex] = completed;
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

export async function getTodayActionLog() {
  const logs = await getActionLogs();
  return logs[todayStr()] || [false, false, false, false, false];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function daysSinceStart(startDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - start) / 86400000) + 1;
}

export function streakCount(logs) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLog = logs[key];
    if (dayLog && dayLog.some(Boolean)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
