import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAN_KEY     = 'tarbiyah_pip_plan';
const LOGS_KEY     = 'tarbiyah_pip_logs';
const CHECKINS_KEY = 'tarbiyah_pip_checkins';

// ── Plan ─────────────────────────────────────────────────────────────────────

export async function savePlan(plan) {
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export async function getActivePlan() {
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function clearPlan() {
  await AsyncStorage.multiRemove([PLAN_KEY, LOGS_KEY, CHECKINS_KEY]);
}

// ── Habit logs ────────────────────────────────────────────────────────────────
// Stored as { 'YYYY-MM-DD': [bool x5] }

export async function getHabitLogs() {
  try {
    const raw = await AsyncStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function logHabit(dateStr, habitIndex, completed) {
  const logs = await getHabitLogs();
  if (!logs[dateStr]) logs[dateStr] = [false, false, false, false, false];
  logs[dateStr][habitIndex] = completed;
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

export async function getTodayLog() {
  const logs = await getHabitLogs();
  const today = todayStr();
  return logs[today] || [false, false, false, false, false];
}

// ── Check-ins ─────────────────────────────────────────────────────────────────

export async function getCheckIns() {
  try {
    const raw = await AsyncStorage.getItem(CHECKINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveCheckIn(checkIn) {
  const list = await getCheckIns();
  list.unshift(checkIn);
  await AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify(list));
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

// Normalises a dailyHabits entry — handles both legacy strings and new { text, priority } objects.
export function normalizeHabits(habits) {
  return (habits ?? []).map((h, i) => ({
    text: typeof h === 'string' ? h : h.text,
    priority: typeof h === 'string' ? 'core' : (h.priority || 'core'),
    why: typeof h === 'string' ? null : (h.why || null),
    index: i,
  }));
}

// Returns { [habitIndex]: completedDayCount } across all logged days.
export function getHabitDayCounts(logs) {
  const counts = {};
  for (const dayLog of Object.values(logs)) {
    if (!Array.isArray(dayLog)) continue;
    dayLog.forEach((done, i) => { if (done) counts[i] = (counts[i] || 0) + 1; });
  }
  return counts;
}

// Returns the habits for the current phase of the plan.
// Falls back to top-level dailyHabits for plans generated before phase support.
export function getCurrentHabits(plan, dayNumber) {
  const phases = plan?.roadmap;
  if (!phases?.length || !phases[0]?.dailyHabits) {
    return plan?.dailyHabits ?? [];
  }
  let elapsed = 0;
  for (const phase of phases) {
    elapsed += phase.durationDays ?? 0;
    if (dayNumber <= elapsed) return phase.dailyHabits;
  }
  return phases[phases.length - 1].dailyHabits;
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
