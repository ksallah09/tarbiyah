import AsyncStorage from '@react-native-async-storage/async-storage';

const PLANS_KEY = 'tarbiyah_child_plans';

const logsKey     = (id) => `tarbiyah_child_logs_${id}`;
const checkinsKey = (id) => `tarbiyah_child_checkins_${id}`;

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getAllChildPlans() {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate legacy single plan
    const legacy = await AsyncStorage.getItem('tarbiyah_child_plan');
    if (legacy) {
      const plan = JSON.parse(legacy);
      if (!plan.id) plan.id = 'legacy';
      await AsyncStorage.setItem(PLANS_KEY, JSON.stringify([plan]));
      return [plan];
    }
    return [];
  } catch { return []; }
}

export async function saveChildPlan(plan) {
  const plans = await getAllChildPlans();
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export async function removeChildPlan(id) {
  const plans = await getAllChildPlans();
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans.filter(p => p.id !== id)));
  await AsyncStorage.multiRemove([logsKey(id), checkinsKey(id)]);
}

export async function clearChildPlan(id) {
  await removeChildPlan(id);
}

// Legacy compat — returns first plan
export async function getActiveChildPlan() {
  const plans = await getAllChildPlans();
  return plans[0] || null;
}

// ── Action logs ───────────────────────────────────────────────────────────────

export async function getActionLogs(planId) {
  try {
    const raw = await AsyncStorage.getItem(logsKey(planId));
    if (raw) return JSON.parse(raw);
    // Legacy migration for first plan
    if (planId === 'legacy') {
      const legacy = await AsyncStorage.getItem('tarbiyah_child_logs');
      return legacy ? JSON.parse(legacy) : {};
    }
    return {};
  } catch { return {}; }
}

export async function logAction(planId, dateStr, actionIndex, completed) {
  const logs = await getActionLogs(planId);
  if (!logs[dateStr]) logs[dateStr] = [false, false, false, false, false];
  logs[dateStr][actionIndex] = completed;
  await AsyncStorage.setItem(logsKey(planId), JSON.stringify(logs));
}

export async function getTodayActionLog(planId) {
  const logs = await getActionLogs(planId);
  return logs[todayStr()] || [false, false, false, false, false];
}

// ── Check-ins ─────────────────────────────────────────────────────────────────

export async function getCheckIns(planId) {
  try {
    const raw = await AsyncStorage.getItem(checkinsKey(planId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveCheckIn(planId, ci) {
  const existing = await getCheckIns(planId);
  await AsyncStorage.setItem(checkinsKey(planId), JSON.stringify([ci, ...existing]));
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

// Returns the parentDailyActions for the current phase of the plan.
// Falls back to top-level parentDailyActions for plans generated before phase support.
export function getCurrentActions(plan, dayNumber) {
  const phases = plan?.roadmap;
  if (!phases?.length || !phases[0]?.parentDailyActions) {
    return plan?.parentDailyActions ?? [];
  }
  let elapsed = 0;
  for (const phase of phases) {
    elapsed += phase.durationDays ?? 0;
    if (dayNumber <= elapsed) return phase.parentDailyActions;
  }
  return phases[phases.length - 1].parentDailyActions;
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
