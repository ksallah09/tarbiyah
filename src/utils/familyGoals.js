import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

const STORAGE_KEY = 'tarbiyah_family_goals_v1';
const FAMILY_ID_KEY = 'tarbiyah_family_id';

// ─── Notification setup ───────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Family ID (prep for spouse sync) ────────────────────────────────────────

export async function getFamilyId() {
  let id = await AsyncStorage.getItem(FAMILY_ID_KEY);
  if (!id) {
    // Generate a stable family ID tied to the user's auth ID if available
    const { data } = await supabase.auth.getSession();
    id = data?.session?.user?.id
      ? `family_${data.session.user.id}`
      : `family_local_${Date.now()}`;
    await AsyncStorage.setItem(FAMILY_ID_KEY, id);
  }
  return id;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function loadFamilyGoals() {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    if (token) {
      const familyId = await getFamilyId();
      const { data, error } = await supabase
        .from('family_goals')
        .select('*')
        .eq('family_id', familyId)
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (!error && data) {
        if (data.length > 0) {
          // Map snake_case DB columns back to camelCase for local use
          const mapped = data.map(r => ({
            id:              r.id,
            title:           r.title,
            icon:            r.icon,
            iconColor:       r.icon_color,
            frequencyType:   r.frequency_type,
            frequencyLabel:  r.frequency_label,
            reminderEnabled: r.reminder_enabled,
            reminderTime:    r.reminder_time,
            reminderDays:    r.reminder_days,
            active:          r.active,
            createdAt:       r.created_at,
          }));
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
          return mapped;
        } else {
          // Supabase has no goals for this family — push local goals up to sync them
          const localRaw = await AsyncStorage.getItem(STORAGE_KEY);
          const localGoals = localRaw ? JSON.parse(localRaw) : [];
          if (localGoals.length > 0) {
            for (const goal of localGoals) {
              const row = {
                id:              goal.id,
                family_id:       familyId,
                title:           goal.title,
                icon:            goal.icon,
                icon_color:      goal.iconColor,
                frequency_type:  goal.frequencyType,
                frequency_label: goal.frequencyLabel,
                reminder_enabled: goal.reminderEnabled,
                reminder_time:   goal.reminderTime,
                reminder_days:   goal.reminderDays,
                active:          goal.active ?? true,
                created_at:      goal.createdAt ?? new Date().toISOString(),
              };
              supabase.from('family_goals').upsert(row, { onConflict: 'id' }).then();
            }
          }
          return localGoals;
        }
      }
    }
  } catch {}

  // Offline fallback
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveFamilyGoal(goal) {
  // Persist locally first
  const goals = await loadFamilyGoals();
  const exists = goals.findIndex(g => g.id === goal.id);
  if (exists >= 0) goals[exists] = goal;
  else goals.push(goal);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(goals));

  // Schedule notifications
  await scheduleGoalNotifications(goal);

  // Sync to Supabase (fire-and-forget)
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (token) {
    const familyId = await getFamilyId();
    // Map camelCase local fields to snake_case DB columns
    const row = {
      id:              goal.id,
      family_id:       familyId,
      title:           goal.title,
      icon:            goal.icon,
      icon_color:      goal.iconColor,
      frequency_type:  goal.frequencyType,
      frequency_label: goal.frequencyLabel,
      reminder_enabled: goal.reminderEnabled,
      reminder_time:   goal.reminderTime,
      reminder_days:   goal.reminderDays,
      active:          goal.active ?? true,
      created_at:      goal.createdAt ?? new Date().toISOString(),
    };
    supabase
      .from('family_goals')
      .upsert(row, { onConflict: 'id' })
      .then(({ error }) => { if (error) console.warn('Family goal sync error:', error.message); });
  }
}

export async function deleteFamilyGoal(goalId) {
  // Cancel notifications
  await cancelGoalNotifications(goalId);

  // Remove locally
  const goals = await loadFamilyGoals();
  const updated = goals.filter(g => g.id !== goalId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // Soft-delete in Supabase
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.access_token) {
    const familyId = await getFamilyId();
    supabase
      .from('family_goals')
      .update({ active: false })
      .eq('id', goalId)
      .eq('family_id', familyId)
      .then();
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

const NOTIF_ID_KEY_PREFIX = 'tarbiyah_goal_notifs_';

async function cancelGoalNotifications(goalId) {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_ID_KEY_PREFIX + goalId);
    if (raw) {
      const ids = JSON.parse(raw);
      for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIF_ID_KEY_PREFIX + goalId);
    }
  } catch {}
}

async function scheduleGoalNotifications(goal) {
  if (!goal.reminderEnabled) return;
  try {
    await cancelGoalNotifications(goal.id);

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    const scheduledIds = [];
    const [hour, minute] = (goal.reminderTime || '08:00').split(':').map(Number);

    if (goal.frequencyType === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Family Goal Reminder',
          body: goal.title,
          data: { goalId: goal.id },
        },
        trigger: { type: 'daily', hour, minute },
      });
      scheduledIds.push(id);
    } else if (goal.frequencyType === 'weekly' && goal.reminderDays?.length) {
      for (const weekday of goal.reminderDays) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Family Goal Reminder',
            body: goal.title,
            data: { goalId: goal.id },
          },
          trigger: { type: 'weekly', weekday, hour, minute },
        });
        scheduledIds.push(id);
      }
    }

    if (scheduledIds.length > 0) {
      await AsyncStorage.setItem(NOTIF_ID_KEY_PREFIX + goal.id, JSON.stringify(scheduledIds));
    }
  } catch (err) {
    console.warn('Failed to schedule goal notification:', err.message);
  }
}

// ─── Suggested goals ──────────────────────────────────────────────────────────

export const SUGGESTED_GOALS = [
  {
    icon: 'moon',
    iconColor: '#6B7C45',
    title: 'Pray together as a family',
    subtitle: 'At least one prayer together each day',
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'restaurant-outline',
    iconColor: '#D4871A',
    title: 'Eat together as a family',
    subtitle: 'Share a meal together',
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'moon-outline',
    iconColor: '#2E7D62',
    title: 'Go to the masjid together',
    subtitle: 'Attend a prayer or masjid program',
    defaultFrequency: 'weekly',
    defaultDays: [6],
  },
  {
    icon: 'book-outline',
    iconColor: '#6B9FD4',
    title: 'Read Quran as a family',
    subtitle: 'A few verses or a page together',
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'hand-left-outline',
    iconColor: '#9B59B6',
    title: 'Make dua together',
    subtitle: 'Supplicate as a family before bed or after prayer',
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'library-outline',
    iconColor: '#F59E0B',
    title: 'Bedtime Islamic story',
    subtitle: 'Share a story from the Quran or Seerah',
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'walk-outline',
    iconColor: '#10B981',
    title: 'Family outdoor activity',
    subtitle: 'Walk, play or exercise together',
    defaultFrequency: 'weekly',
    defaultDays: [1, 7],
  },
  {
    icon: 'phone-portrait-outline',
    iconColor: '#EF4444',
    title: 'Screen-free family time',
    subtitle: 'Devices down, family connected',
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'chatbubbles-outline',
    iconColor: '#3B82F6',
    title: 'Family check-in',
    subtitle: "Ask each child how they're feeling today",
    defaultFrequency: 'daily',
    defaultDays: [],
  },
  {
    icon: 'school-outline',
    iconColor: '#8B5CF6',
    title: 'Learn something Islamic together',
    subtitle: 'A hadith, name of Allah, or Islamic concept',
    defaultFrequency: 'weekly',
    defaultDays: [1],
  },
];

export const FREQUENCY_OPTIONS = [
  { label: 'Every day',         type: 'daily',  days: [],             daysPerWeek: 7 },
  { label: '5 times a week',    type: 'weekly', days: [2,3,4,5,6],    daysPerWeek: 5 },
  { label: '3 times a week',    type: 'weekly', days: [2,4,6],        daysPerWeek: 3 },
  { label: 'Twice a week',      type: 'weekly', days: [1,5],          daysPerWeek: 2 },
  { label: 'Once a week',       type: 'weekly', days: [6],            daysPerWeek: 1 },
  { label: 'Weekends only',     type: 'weekly', days: [1,7],          daysPerWeek: 2 },
];

export const REMINDER_TIMES = [
  { label: 'Early morning — 5:00 AM',  value: '05:00' },
  { label: 'Morning — 8:00 AM',        value: '08:00' },
  { label: 'Midday — 12:00 PM',        value: '12:00' },
  { label: 'Afternoon — 3:30 PM',      value: '15:30' },
  { label: 'Evening — 6:00 PM',        value: '18:00' },
  { label: 'Night — 8:30 PM',          value: '20:30' },
  { label: 'Bedtime — 9:30 PM',        value: '21:30' },
];
