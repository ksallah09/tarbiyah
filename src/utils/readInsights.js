import AsyncStorage from '@react-native-async-storage/async-storage';

const READ_KEY        = 'tarbiyah_read_days';
const GOAL_KEY        = 'tarbiyah_goal_days';
const GOAL_CHECKED_KEY = 'tarbiyah_goal_checked';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Read tracking ──────────────────────────────────────────

async function getReadLog() {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// insightId is required to prevent cross-day bleed (old insight marked = new one shows as read)
export async function markAsRead(type, insightId) {
  const log = await getReadLog();
  const today = todayKey();
  log[today] = { ...(log[today] ?? {}), [type]: true, [insightId]: true };
  await AsyncStorage.setItem(READ_KEY, JSON.stringify(log));
}

export async function isReadToday(type, insightId) {
  const log = await getReadLog();
  // If insightId provided, check specifically for this insight
  if (insightId) return !!(log[todayKey()]?.[insightId]);
  return !!(log[todayKey()]?.[type]);
}

export async function getWeekReadDays(type) {
  const log = await getReadLog();
  return buildWeek(dateStr => !!(log[dateStr]?.[type]));
}

export async function getMonthReadDays(type) {
  const log = await getReadLog();
  const today = new Date();
  const todayStr = todayKey();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dateStr = d.toISOString().slice(0, 10);
    return {
      day: i + 1,
      completed: !!(log[dateStr]?.[type]),
      today: dateStr === todayStr,
      future: dateStr > todayStr,
    };
  });
}

// ── Goal tracking ──────────────────────────────────────────

async function getGoalLog() {
  try {
    const raw = await AsyncStorage.getItem(GOAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// type: 'spiritual' | 'practical'
export async function markGoalImplemented(type) {
  const log = await getGoalLog();
  const today = todayKey();
  log[today] = { ...(log[today] ?? {}), [type]: true };
  await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(log));
}

export async function getWeekGoalDays(type) {
  const log = await getGoalLog();
  return buildWeek(dateStr => !!(log[dateStr]?.[type]));
}

// ── Shared week builder ────────────────────────────────────

function buildWeek(isCompleted) {
  const today = new Date();
  const todayStr = todayKey();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    return {
      short: DAY_LABELS[i],
      completed: isCompleted(dateStr),
      today: dateStr === todayStr,
    };
  });
}

// ── Streak ────────────────────────────────────────────────

export async function getStreak(type) {
  const log = await getReadLog();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (log[dateStr]?.[type]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Goal checked state (persisted by date + goalId) ────────

export async function setGoalChecked(goalId, done) {
  try {
    const raw = await AsyncStorage.getItem(GOAL_CHECKED_KEY);
    const log = raw ? JSON.parse(raw) : {};
    const today = todayKey();
    log[today] = { ...(log[today] ?? {}), [goalId]: done };
    await AsyncStorage.setItem(GOAL_CHECKED_KEY, JSON.stringify(log));
  } catch {}
}

export async function getGoalsCheckedToday() {
  try {
    const raw = await AsyncStorage.getItem(GOAL_CHECKED_KEY);
    const log = raw ? JSON.parse(raw) : {};
    return log[todayKey()] ?? {};
  } catch { return {}; }
}
