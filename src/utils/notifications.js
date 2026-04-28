import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Notification handler (must be set before any scheduling) ─────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DAILY_NOTIF_ID_KEY   = 'tarbiyah_daily_notif_id';
const WEEKLY_SHARE_NOTIF_ID_KEY = 'tarbiyah_weekly_share_notif_id';
const DAILY_CACHE_KEY      = 'tarbiyah_daily_cache';
const PROFILE_KEY          = 'tarbiyah_profile';

// ─── Rotating message pool ────────────────────────────────────────────────────
const FALLBACK_MESSAGES = [
  { subtitle: "📖 Today's reminder might be exactly what you need.", body: "Open your daily parenting insights." },
  { subtitle: "🌿 Guidance for a better parenting day.", body: "Your daily insights are ready." },
  { subtitle: "🏡 Today's reminder is ready to strengthen your home.", body: "Open your daily parenting insights." },
  { subtitle: "✨ A fresh perspective for your parenting journey.", body: "Open today's wisdom." },
  { subtitle: "📖 Today's lesson may change how you approach the day.", body: "Your daily insights are ready." },
  { subtitle: "🤲 Parenting is hard. Let today's reminder help.", body: "Open your daily parenting insights." },
  { subtitle: "🌱 A little guidance for a big responsibility.", body: "Your daily insights are ready." },
  { subtitle: "💛 Your family deserves intentional moments of learning.", body: "Read today's new insights." },
  { subtitle: "🏡 A stronger home starts with small, consistent steps.", body: "Open today's parenting insights." },
  { subtitle: "✨ Today's insight can help recenter your parenting.", body: "Read your daily parenting insights." },
  { subtitle: "🌿 Take a moment for today's parenting reminder.", body: "Your daily wisdom is ready." },
  { subtitle: "💡 Today's parenting insight is powerful.", body: "Open your daily insights." },
  { subtitle: "🌱 A small reminder for a big journey.", body: "Your daily insights are ready." },
  { subtitle: "📖 Your daily dose of parenting wisdom is here.", body: "Open today's insights." },
  { subtitle: "🤲 Parent with wisdom — build your knowledge.", body: "Open today's parenting insights." },
  { subtitle: "💭 Are you winning the moment but losing the child?", body: "Open today's insights." },
  { subtitle: "🌿 Your children are a trust from Allah.", body: "Be the best parent you can be — open today's insights." },
  { subtitle: "📖 A parenting reminder worth pausing for.", body: "Open your daily insights." },
  { subtitle: "✨ Today's wisdom may help you see things differently.", body: "Your daily insights are ready." },
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
      title: 'Tarbiyah',
      subtitle: content.subtitle,
      body: content.body,
      sound: true,
      data: { screen: 'Home' },
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
      title: 'Tarbiyah',
      subtitle: '📚 Help a fellow parent today',
      body: 'Share a resource that\'s helped your family — a video, article, or activity. It only takes a minute.',
      sound: true,
      data: { screen: 'Resources' },
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
  if (!phases?.length || !phases[0]?.dailyHabits) {
    const habits = plan?.dailyHabits ?? [];
    return habits.length ? habits[(dayNumber - 1) % habits.length] : null;
  }
  let elapsed = 0;
  for (const phase of phases) {
    elapsed += phase.durationDays ?? 0;
    if (dayNumber <= elapsed) {
      const habits = phase.dailyHabits ?? [];
      return habits.length ? habits[(dayNumber - 1) % habits.length] : null;
    }
  }
  const last = phases[phases.length - 1].dailyHabits ?? [];
  return last.length ? last[(dayNumber - 1) % last.length] : null;
}

function getActionForDay(plan, dayNumber) {
  const phases = plan?.roadmap;
  const toText = (a) => (typeof a === 'string' ? a : a?.text ?? '');
  const coreOnly = (arr) => {
    const core = arr.filter(a => typeof a === 'string' || a?.priority === 'core');
    return core.length ? core : arr; // fall back to all if no core tagged (legacy plans)
  };
  if (!phases?.length || !phases[0]?.parentDailyActions) {
    const actions = coreOnly(plan?.parentDailyActions ?? []);
    return actions.length ? toText(actions[(dayNumber - 1) % actions.length]) : null;
  }
  let elapsed = 0;
  for (const phase of phases) {
    elapsed += phase.durationDays ?? 0;
    if (dayNumber <= elapsed) {
      const actions = coreOnly(phase.parentDailyActions ?? []);
      return actions.length ? toText(actions[(dayNumber - 1) % actions.length]) : null;
    }
  }
  const actions = coreOnly(phases[phases.length - 1].parentDailyActions ?? []);
  return actions.length ? toText(actions[(dayNumber - 1) % actions.length]) : null;
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
    const body = habit
      ? `${habit} — open the app to check it off and see all 5 habits.`
      : "Check off today's 5 improvement habits.";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Tarbiyah',
        subtitle: '🎯 Time for your daily habits',
        body,
        sound: true,
        data: { screen: 'PIPDetail' },
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
      title: 'Tarbiyah',
      subtitle: `💬 ${afterDays}-day check-in — how's it going?`,
      body: 'Share your progress and get personalised coaching to adjust your plan.',
      sound: true,
      data: { screen: 'PIPDetail' },
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
    const body = action
      ? `${action} — open the app to check it off and see all 5 actions.`
      : "Complete today's 5 parent actions to support your child's growth.";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Tarbiyah',
        subtitle: "🌱 Time for your child's daily actions",
        body,
        sound: true,
        data: { screen: 'ChildPlanDetail', planId: plan.id },
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
export async function scheduleChildPlanCheckIn(afterDays, fromDateIso) {
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
      title: 'Tarbiyah',
      subtitle: `💬 ${afterDays}-day check-in — how is your child doing?`,
      body: "Share your child's progress and get personalised coaching to adjust the plan.",
      sound: true,
      data: { screen: 'ChildPlanDetail' },
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
      title: 'Tarbiyah',
      subtitle: '🏆 You completed your journey!',
      body: 'Open the app to reflect on your progress and see what\'s next.',
      sound: true,
      data: { screen: 'PIPDetail' },
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
      title: 'Tarbiyah',
      subtitle: '🌱 Your child\'s journey is complete!',
      body: 'Open the app to reflect on their progress and see what\'s next.',
      sound: true,
      data: { screen: 'ChildPlanDetail', planId: plan.id },
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
