import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Notification handler (must be set before any scheduling) ─────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Android channel (required for Android 8+) ────────────────────────────────
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Tarbiyah',
    importance: Notifications.AndroidImportance.HIGH,
    sound: true,
    vibrationPattern: [0, 250, 250, 250],
  });
}

const DAILY_NOTIF_ID_KEY   = 'tarbiyah_daily_notif_id';
const WEEKLY_SHARE_NOTIF_ID_KEY = 'tarbiyah_weekly_share_notif_id';
const DAILY_CACHE_KEY      = 'tarbiyah_daily_cache';
const PROFILE_KEY          = 'tarbiyah_profile';

// ─── Rotating message pool ────────────────────────────────────────────────────
const FALLBACK_MESSAGES = [
  { title: "📖 Daily wisdom", body: "Today's reminder might be exactly what you need. Read today's insights." },
  { title: "🌿 Tarbiyah", body: "A little guidance for a better parenting day. Your insights are ready." },
  { title: "🏡 Daily reminder", body: "Strengthen your home with today's parenting insight." },
  { title: "✨ Fresh perspective", body: "A new angle on your parenting journey is waiting for you." },
  { title: "📖 Today's lesson", body: "This one may change how you approach the rest of your day." },
  { title: "🤲 Tarbiyah", body: "Parenting is hard. Let today's wisdom be a small help." },
  { title: "🌱 Daily reminder", body: "A little guidance for a big responsibility. Your insights are ready." },
  { title: "💛 Tarbiyah", body: "Your family deserves intentional moments. Today's insights are ready." },
  { title: "🏡 Small steps", body: "A stronger home starts with consistency. Read today's insights." },
  { title: "✨ Tarbiyah", body: "Today's insight can help recenter your parenting. Take a moment." },
  { title: "🌿 Daily wisdom", body: "Your daily parenting reminder is ready. Take a moment to read it." },
  { title: "🌱 Small reminder", body: "A small reminder for a big journey. Your daily insights are ready." },
  { title: "📖 Tarbiyah", body: "Your daily dose of parenting wisdom is here. Read today's insights." },
  { title: "🤲 Daily wisdom", body: "Parent with wisdom — your daily knowledge reminder is ready." },
  { title: "💭 Tarbiyah", body: "Are you winning the moment but losing the child? Read today's insights." },
  { title: "🌿 Daily reminder", body: "Your children are a trust from Allah. Be the best parent you can be." },
  { title: "📖 Worth pausing for", body: "A parenting reminder worth your time is ready. Read today's insights." },
  { title: "✨ Tarbiyah", body: "Today's wisdom may help you see things differently. Your insights await." },
];

// Picks a message based on the day of the year so it rotates daily and is consistent
function getDailyFallbackMessage() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return FALLBACK_MESSAGES[dayOfYear % FALLBACK_MESSAGES.length];
}

// ─── Permission ───────────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!Device.isDevice) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Push token — save to Supabase so backend can send pushes ─────────────────
export async function savePushTokenToSupabase() {
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!tokenData) return;

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;

    await supabase
      .from('profiles')
      .update({ push_token: tokenData })
      .eq('user_id', userId);
  } catch (e) {
    console.warn('[Notifications] savePushToken error:', e);
  }
}

// ─── Parse reminder time string → { hour, minute } ───────────────────────────
function parseReminderTime(timeStr) {
  // Format: "8:00 AM" or "10:30 PM"
  try {
    const [timePart, period] = timeStr.trim().split(' ');
    let [hour, minute] = timePart.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return { hour, minute: minute || 0 };
  } catch {
    return { hour: 8, minute: 0 };
  }
}

// ─── Build notification content ───────────────────────────────────────────────
export async function buildTestNotificationContent() {
  return buildNotificationContent();
}

async function buildNotificationContent() {
  return getDailyFallbackMessage();
}

// ─── Schedule daily notification ─────────────────────────────────────────────
export async function scheduleDailyNotification(reminderTimeStr) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancel any existing daily notification
  await cancelDailyNotification();

  const { hour, minute } = parseReminderTime(reminderTimeStr ?? '8:00 AM');
  const content = await buildNotificationContent();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: true,
      data: { screen: 'Home' },
      android: { channelId: 'default' },
    },
    trigger: {
      type: 'calendar',
      repeats: true,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(DAILY_NOTIF_ID_KEY, id);
}

// ─── Schedule weekly share reminder (Fridays at 7 PM) ────────────────────────
export async function scheduleWeeklyShareNotification() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelWeeklyShareNotification();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📚 Help a fellow parent today',
      body: 'Share a resource that\'s helped your family — a video, article, or activity. It only takes a minute.',
      sound: true,
      data: { screen: 'Community' },
      android: { channelId: 'default' },
    },
    trigger: {
      type: 'calendar',
      repeats: true,
      weekday: 6, // Friday (1=Sunday … 6=Friday)
      hour: 19,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(WEEKLY_SHARE_NOTIF_ID_KEY, id);
}

export async function cancelWeeklyShareNotification() {
  try {
    const id = await AsyncStorage.getItem(WEEKLY_SHARE_NOTIF_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(WEEKLY_SHARE_NOTIF_ID_KEY);
    }
  } catch {}
}

// ─── Cancel daily notification ────────────────────────────────────────────────
export async function cancelDailyNotification() {
  try {
    const id = await AsyncStorage.getItem(DAILY_NOTIF_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(DAILY_NOTIF_ID_KEY);
    }
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHabitForDay(plan, dayNumber) {
  const phases = plan?.roadmap;
  const toObj = (h) => (typeof h === 'string' ? { text: h } : h ?? {});
  const coreOnly = (arr) => {
    const core = arr.filter(h => typeof h === 'string' || h?.priority === 'core');
    return core.length ? core : arr;
  };
  if (!phases?.length || !phases[0]?.dailyHabits) {
    const habits = coreOnly(plan?.dailyHabits ?? []);
    return habits.length ? toObj(habits[(dayNumber - 1) % habits.length]) : null;
  }
  let elapsed = 0;
  for (const phase of phases) {
    elapsed += phase.durationDays ?? 0;
    if (dayNumber <= elapsed) {
      const habits = coreOnly(phase.dailyHabits ?? []);
      return habits.length ? toObj(habits[(dayNumber - 1) % habits.length]) : null;
    }
  }
  const habits = coreOnly(phases[phases.length - 1].dailyHabits ?? []);
  return habits.length ? toObj(habits[(dayNumber - 1) % habits.length]) : null;
}

function getActionForDay(plan, dayNumber) {
  const phases = plan?.roadmap;
  const toObj = (a) => (typeof a === 'string' ? { text: a } : a ?? {});
  const coreOnly = (arr) => {
    const core = arr.filter(a => typeof a === 'string' || a?.priority === 'core');
    return core.length ? core : arr;
  };
  if (!phases?.length || !phases[0]?.parentDailyActions) {
    const actions = coreOnly(plan?.parentDailyActions ?? []);
    return actions.length ? toObj(actions[(dayNumber - 1) % actions.length]) : null;
  }
  let elapsed = 0;
  for (const phase of phases) {
    elapsed += phase.durationDays ?? 0;
    if (dayNumber <= elapsed) {
      const actions = coreOnly(phase.parentDailyActions ?? []);
      return actions.length ? toObj(actions[(dayNumber - 1) % actions.length]) : null;
    }
  }
  const actions = coreOnly(phases[phases.length - 1].parentDailyActions ?? []);
  return actions.length ? toObj(actions[(dayNumber - 1) % actions.length]) : null;
}

// Turns a habit/action sentence into a short notification title (up to 6 words)
function toNotifTitle(text, fallback = 'Tarbiyah') {
  if (!text) return fallback;
  const clean = text.replace(/[.!?,;].*$/, '').trim();
  const words = clean.split(/\s+/);
  if (words.length <= 6) return words.join(' ');
  return words.slice(0, 6).join(' ') + '…';
}

async function cancelNotificationIds(storageKey) {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const ids = JSON.parse(raw);
      const list = Array.isArray(ids) ? ids : [ids];
      await Promise.all(list.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    } catch {
      await Notifications.cancelScheduledNotificationAsync(raw).catch(() => {});
    }
    await AsyncStorage.removeItem(storageKey);
  } catch {}
}

// ─── PIP: habit reminder ──────────────────────────────────────────────────────
const PIP_REMINDER_ID_KEY = 'tarbiyah_pip_reminder_id';
const PIP_CHECKIN_ID_KEY  = 'tarbiyah_pip_checkin_id';

export async function schedulePIPReminder(timeStr = '12:00', plan) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelNotificationIds(PIP_REMINDER_ID_KEY);
  if (!plan) return;

  const [h, m] = timeStr.split(':').map(Number);
  const startDate = new Date(plan.startDate);
  startDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysSoFar = Math.floor((today - startDate) / 86400000);
  const remaining = plan.durationDays - daysSoFar;
  const count = Math.min(Math.max(remaining, 0), 30);

  const ids = [];
  for (let i = 0; i < count; i++) {
    const fireDate = new Date();
    fireDate.setDate(fireDate.getDate() + i);
    fireDate.setHours(h, m, 0, 0);
    if (fireDate <= new Date()) continue;

    const dayNumber = daysSoFar + i + 1;
    const habit = getHabitForDay(plan, dayNumber);
    const habitText = habit?.text ?? null;
    const body = habitText
      ? `${habitText} — open the app to check it off and see all 5 habits.`
      : "Check off today's 5 improvement habits.";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: habit?.notifTitle || toNotifTitle(habitText, '🎯 Your daily habits are ready'),
        body,
        sound: true,
        data: { screen: 'PIPDetail' },
        android: { channelId: 'default' },
      },
      trigger: { type: 'date', date: fireDate },
    });
    ids.push(id);
  }

  await AsyncStorage.setItem(PIP_REMINDER_ID_KEY, JSON.stringify(ids));
}

export async function cancelPIPReminder() {
  await cancelNotificationIds(PIP_REMINDER_ID_KEY);
}

// ─── PIP: check-in notification (one-time, fires after N days) ────────────────
export async function schedulePIPCheckIn(afterDays, fromDateIso) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    const existing = await AsyncStorage.getItem(PIP_CHECKIN_ID_KEY);
    if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  } catch {}

  const fireDate = new Date(fromDateIso);
  fireDate.setDate(fireDate.getDate() + afterDays);
  fireDate.setHours(12, 0, 0, 0);

  if (fireDate <= new Date()) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${afterDays}-day check-in — how's it going?`,
      body: 'Share your progress and get personalised coaching to adjust your plan.',
      sound: true,
      data: { screen: 'PIPDetail' },
      android: { channelId: 'default' },
    },
    trigger: { type: 'date', date: fireDate },
  });

  await AsyncStorage.setItem(PIP_CHECKIN_ID_KEY, id);
}

export async function cancelPIPCheckIn() {
  try {
    const id = await AsyncStorage.getItem(PIP_CHECKIN_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(PIP_CHECKIN_ID_KEY);
    }
  } catch {}
}

// ─── Child Plan: daily action reminder ───────────────────────────────────────
const CHILD_REMINDER_ID_KEY = 'tarbiyah_child_reminder_id';
const CHILD_CHECKIN_ID_KEY  = 'tarbiyah_child_checkin_id';

const childReminderKey = (planId) => `tarbiyah_child_reminder_${planId}`;

export async function scheduleChildPlanReminder(timeStr = '08:00', plan) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancel old single-key format + per-plan key
  await cancelNotificationIds(CHILD_REMINDER_ID_KEY);
  if (plan?.id) await cancelNotificationIds(childReminderKey(plan.id));
  if (!plan) return;

  const [h, m] = timeStr.split(':').map(Number);
  const startDate = new Date(plan.startDate);
  startDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysSoFar = Math.floor((today - startDate) / 86400000);
  const remaining = plan.durationDays - daysSoFar;
  const count = Math.min(Math.max(remaining, 0), 20);

  const ids = [];
  for (let i = 0; i < count; i++) {
    const fireDate = new Date();
    fireDate.setDate(fireDate.getDate() + i);
    fireDate.setHours(h, m, 0, 0);
    if (fireDate <= new Date()) continue;

    const dayNumber = daysSoFar + i + 1;
    const action = getActionForDay(plan, dayNumber);
    const actionText = action?.text ?? null;
    const body = actionText
      ? `${actionText} — open the app to check it off and see all 5 actions.`
      : "Complete today's 5 parent actions to support your child's growth.";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: action?.notifTitle || toNotifTitle(actionText, "🌱 Your child's actions are ready"),
        body,
        sound: true,
        data: { screen: 'ChildPlanDetail', planId: plan.id },
        android: { channelId: 'default' },
      },
      trigger: { type: 'date', date: fireDate },
    });
    ids.push(id);
  }

  await AsyncStorage.setItem(childReminderKey(plan.id), JSON.stringify(ids));
}

export async function cancelChildPlanReminder(planId) {
  await cancelNotificationIds(CHILD_REMINDER_ID_KEY);
  if (planId) await cancelNotificationIds(childReminderKey(planId));
}

// ─── Child Plan: check-in notification (one-time, fires after N days) ─────────
export async function scheduleChildPlanCheckIn(afterDays, fromDateIso, planId) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    const existing = await AsyncStorage.getItem(CHILD_CHECKIN_ID_KEY);
    if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  } catch {}

  const fireDate = new Date(fromDateIso);
  fireDate.setDate(fireDate.getDate() + afterDays);
  fireDate.setHours(12, 0, 0, 0);

  if (fireDate <= new Date()) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${afterDays}-day check-in — how is your child doing?`,
      body: "Share your child's progress and get personalised coaching to adjust the plan.",
      sound: true,
      data: { screen: 'ChildPlanDetail', ...(planId ? { planId } : {}) },
      android: { channelId: 'default' },
    },
    trigger: { type: 'date', date: fireDate },
  });

  await AsyncStorage.setItem(CHILD_CHECKIN_ID_KEY, id);
}

export async function cancelChildPlanCheckIn() {
  await cancelNotificationIds(CHILD_CHECKIN_ID_KEY);
}

// ─── Plan completion notifications ────────────────────────────────────────────
const PIP_COMPLETION_ID_KEY   = 'tarbiyah_pip_completion_id';
const CHILD_COMPLETION_ID_KEY = (planId) => `tarbiyah_child_completion_${planId}`;

export async function schedulePIPCompletion(plan) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelNotificationIds(PIP_COMPLETION_ID_KEY);

  const fireDate = new Date(plan.startDate);
  fireDate.setDate(fireDate.getDate() + plan.durationDays);
  fireDate.setHours(10, 0, 0, 0);
  if (fireDate <= new Date()) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏆 You completed your journey!',
      body: 'Open the app to reflect on your progress and see what\'s next.',
      sound: true,
      data: { screen: 'PIPDetail' },
      android: { channelId: 'default' },
    },
    trigger: { type: 'date', date: fireDate },
  });
  await AsyncStorage.setItem(PIP_COMPLETION_ID_KEY, id);
}

export async function cancelPIPCompletion() {
  await cancelNotificationIds(PIP_COMPLETION_ID_KEY);
}

export async function scheduleChildPlanCompletion(plan) {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await cancelNotificationIds(CHILD_COMPLETION_ID_KEY(plan.id));

  const fireDate = new Date(plan.startDate);
  fireDate.setDate(fireDate.getDate() + plan.durationDays);
  fireDate.setHours(10, 0, 0, 0);
  if (fireDate <= new Date()) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌱 Your child's journey is complete!",
      body: 'Open the app to reflect on their progress and see what\'s next.',
      sound: true,
      data: { screen: 'ChildPlanDetail', planId: plan.id },
      android: { channelId: 'default' },
    },
    trigger: { type: 'date', date: fireDate },
  });
  await AsyncStorage.setItem(CHILD_COMPLETION_ID_KEY(plan.id), id);
}

export async function cancelChildPlanCompletion(planId) {
  if (planId) await cancelNotificationIds(CHILD_COMPLETION_ID_KEY(planId));
}

// ─── Top-up: reschedule plan notifications when app foregrounds ───────────────
// Call this from App.js on AppState change to 'active' to keep notifications
// fresh and cycling through the correct phase habits as days progress.
export async function topUpPlanNotifications(pipPlan, childPlans = []) {
  try {
    if (pipPlan) {
      const raw = await AsyncStorage.getItem(PIP_REMINDER_ID_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(ids) || ids.length < 7) {
        await schedulePIPReminder(pipPlan.reminderTime ?? '12:00', pipPlan);
      }
    }
    for (const plan of childPlans) {
      const raw = await AsyncStorage.getItem(childReminderKey(plan.id));
      const ids = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(ids) || ids.length < 5) {
        await scheduleChildPlanReminder(plan.reminderTime ?? '08:00', plan);
      }
    }
  } catch {}
}

// ─── Family Goal: end-of-week reminder ───────────────────────────────────────
const FAMILY_GOAL_REMINDER_ID_KEY = 'tarbiyah_family_goal_reminder_id';

function getNextSaturday7pm() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const fire = new Date(now);
  fire.setHours(19, 0, 0, 0);

  if (day === 6) {
    if (now.getHours() >= 19) fire.setDate(fire.getDate() + 7);
  } else {
    fire.setDate(fire.getDate() + ((6 - day + 7) % 7));
  }
  return fire;
}

export async function updateFamilyGoalReminder(hasIncompleteGoals) {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelNotificationIds(FAMILY_GOAL_REMINDER_ID_KEY);

    if (!hasIncompleteGoals) return;

    const fireDate = getNextSaturday7pm();
    if (fireDate <= new Date()) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Family Goals',
        body: "This week didn't go as planned — your family goals are incomplete. Next week is a new opportunity to nurture faith and connection in your family. You've got this.",
        sound: true,
        data: { screen: 'Progress' },
        android: { channelId: 'default' },
      },
      trigger: { type: 'date', date: fireDate },
    });

    await AsyncStorage.setItem(FAMILY_GOAL_REMINDER_ID_KEY, id);
  } catch {}
}

// ─── Called on app open — reschedules with latest insight titles ──────────────
export async function refreshDailyNotification() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return;
    const profile = JSON.parse(raw);

    // Respect the notifications toggle
    if (profile.notifications === false) return;

    const reminderTime = profile.reminderTime ?? '8:00 AM';
    await scheduleDailyNotification(reminderTime);
    await scheduleWeeklyShareNotification();
  } catch {}
}

// ─── Generation-complete notifications ───────────────────────────────────────

export async function notifyGrowthPlanReady(childName) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${childName}'s growth plan is ready`,
        body: 'Tap to view the plan and start today.',
        sound: true,
        data: { screen: 'Dashboards' },
      },
      trigger: null,
    });
  } catch {}
}

export async function notifyModuleReady(topic) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your module is ready',
        body: `Your personalised module on "${topic}" is ready to explore.`,
        sound: true,
        data: { screen: 'Learn' },
      },
      trigger: null,
    });
  } catch {}
}

// ─── Child habit & activity notifications (B + C + D) ─────────────────────────

const HABIT_NOTIF_IDS_KEY    = 'tarbiyah_habit_notif_ids';
const ACTIVITY_NOTIF_IDS_KEY = 'tarbiyah_activity_notif_ids';
const CHILD_PROFILES_KEY     = 'tarbiyah_child_profiles';

// Expo calendar trigger weekday: 1=Sun 2=Mon 3=Tue 4=Wed 5=Thu 6=Fri 7=Sat
const DAY_META = {
  sun: { weekday: 1, idx: 0 },
  mon: { weekday: 2, idx: 1 },
  tue: { weekday: 3, idx: 2 },
  wed: { weekday: 4, idx: 3 },
  thu: { weekday: 5, idx: 4 },
  fri: { weekday: 6, idx: 5 },
  sat: { weekday: 7, idx: 6 },
};

const SLOT_HOUR  = { morning: 9,  afternoon: 14, evening: 18 };
const SLOT_EMOJI = { morning: '🌅', afternoon: '☀️', evening: '🌙' };

function getCurrentWeekHabit(child, dayIdx = 0) {
  const area = (child?.growthAreas ?? [])[0];
  if (!area?.plan?.length) return null;
  const daysSince = Math.floor(
    (Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000
  );
  const weekIdx = Math.min(Math.floor(daysSince / 7), area.plan.length - 1);
  const habits = area.plan[Math.max(0, weekIdx)]?.habits ?? [];
  return habits.length ? habits[dayIdx % habits.length] : null;
}

function getCurrentWeekActivity(child, dayIdx = 0) {
  const area = (child?.growthAreas ?? [])[0];
  if (!area?.plan?.length) return null;
  const daysSince = Math.floor(
    (Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000
  );
  const weekIdx = Math.min(Math.floor(daysSince / 7), area.plan.length - 1);
  const activities = area.plan[Math.max(0, weekIdx)]?.activities ?? [];
  return activities.length ? activities[dayIdx % activities.length] : null;
}

function truncateToSentence(text, maxLen = 110) {
  if (!text || text.length <= maxLen) return text ?? '';
  const cut = text.slice(0, maxLen);
  const boundary = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(','), cut.lastIndexOf(' '));
  return boundary > maxLen * 0.6 ? cut.slice(0, boundary).trimEnd() + '…' : cut.trimEnd() + '…';
}

async function cancelByKey(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const ids = JSON.parse(raw);
    await Promise.all(ids.map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    ));
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function scheduleChildHabitNotifications() {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const [profileRaw, childrenRaw] = await Promise.all([
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(CHILD_PROFILES_KEY),
    ]);

    const profile      = profileRaw  ? JSON.parse(profileRaw)  : {};
    const children     = childrenRaw ? JSON.parse(childrenRaw) : [];
    const availability = profile.availability ?? {};

    if (profile.notifications === false) return;

    await cancelByKey(HABIT_NOTIF_IDS_KEY);
    await cancelByKey(ACTIVITY_NOTIF_IDS_KEY);

    if (!children.length) return;

    const habitIds = [];

    // Schedule one concrete notification per day slot — skip if no plan content yet
    for (const [dayKey, { weekday, idx }] of Object.entries(DAY_META)) {
      const slots = availability[dayKey] ?? [];
      if (!slots.length) continue;

      const child = children[idx % children.length];
      const habit = getCurrentWeekHabit(child, idx);

      // Skip this day entirely if there's no actual habit text to show
      if (!habit?.text) continue;

      const habitText = `${truncateToSentence(habit.text, 100)} Open Tarbiyah to check it off.`;

      for (const slot of slots) {
        const hour  = SLOT_HOUR[slot];
        const emoji = SLOT_EMOJI[slot];
        if (!hour) continue;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${emoji} ${child.name} · This week's habit`,
            body: habitText,
            sound: true,
            data: { screen: 'Dashboards', childId: child.id },
            android: { channelId: 'default' },
          },
          // Use a one-time date trigger for each upcoming occurrence of this weekday/slot
          // so the text stays fresh — rescheduled weekly when the app opens
          trigger: { type: 'calendar', repeats: false, weekday, hour, minute: 0 },
        });
        habitIds.push(id);
      }
    }

    await AsyncStorage.setItem(HABIT_NOTIF_IDS_KEY, JSON.stringify(habitIds));

    // Friday 3pm — weekly activity preview (only if actual content exists)
    const fridayChild = children[DAY_META.fri.idx % children.length];
    const activity    = getCurrentWeekActivity(fridayChild, DAY_META.fri.idx);

    if (activity?.text) {
      const activityText = `${truncateToSentence(activity.text, 100)} Open Tarbiyah to see more.`;
      const activityId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎯 ${fridayChild.name} · This week's activity`,
          body: activityText,
          sound: true,
          data: { screen: 'Dashboards', childId: fridayChild.id },
          android: { channelId: 'default' },
        },
        trigger: { type: 'calendar', repeats: false, weekday: 6, hour: 15, minute: 0 },
      });
      await AsyncStorage.setItem(ACTIVITY_NOTIF_IDS_KEY, JSON.stringify([activityId]));
    }
  } catch (err) {
    console.error('scheduleChildHabitNotifications error:', err);
  }
}
