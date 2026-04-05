import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tarbiyah_goal_history';

async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Call this once per day when today's goals are loaded.
// Each entry: { date, type, label, text, insightTitle }
export async function saveGoalsForDate(date, goals) {
  try {
    const history = await getHistory();
    // Remove any existing entries for this date so we don't double-save
    const filtered = history.filter(g => g.date !== date);
    const entries = goals.map(g => ({ ...g, date }));
    await AsyncStorage.setItem(KEY, JSON.stringify([...filtered, ...entries]));
  } catch {}
}

// Returns the most recent `limit` goals of a given type, newest first.
export async function getRecentGoals(type, limit = 3) {
  const history = await getHistory();
  return history
    .filter(g => g.type === type || (type === 'scientific' && g.type === 'practical'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
