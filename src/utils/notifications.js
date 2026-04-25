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

// ─── PIP: habit reminder (daily, repeating) ───────────────────────────────────
const PIP_REMINDER_ID_KEY  = 'tarbiyah_pip_reminder_id';
const PIP_CHECKIN_ID_KEY   = 'tarbiyah_pip_checkin_id';

export async function schedulePIPReminder(timeStr = '12:00') {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    const existing = await AsyncStorage.getItem(PIP_REMINDER_ID_KEY);
    if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  } catch {}

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr || '0', 10);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tarbiyah',
      subtitle: '🎯 Time for your daily habits',
      body: "Check off today's 5 improvement habits.",
      sound: true,
      data: { screen: 'PIPDetail' },
    },
    trigger: { type: 'calendar', repeats: true, hour, minute },
  });

  await AsyncStorage.setItem(PIP_REMINDER_ID_KEY, id);
}

export async function cancelPIPReminder() {
  try {
    const id = await AsyncStorage.getItem(PIP_REMINDER_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(PIP_REMINDER_ID_KEY);
    }
  } catch {}
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

export async function scheduleChildPlanReminder(timeStr = '08:00') {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    const existing = await AsyncStorage.getItem(CHILD_REMINDER_ID_KEY);
    if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  } catch {}

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr || '0', 10);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tarbiyah',
      subtitle: "🌱 Time for your child's daily actions",
      body: "Complete today's 5 parent actions to support your child's growth.",
      sound: true,
      data: { screen: 'ChildPlanDetail' },
    },
    trigger: { type: 'calendar', repeats: true, hour, minute },
  });

  await AsyncStorage.setItem(CHILD_REMINDER_ID_KEY, id);
}

export async function cancelChildPlanReminder() {
  try {
    const id = await AsyncStorage.getItem(CHILD_REMINDER_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(CHILD_REMINDER_ID_KEY);
    }
  } catch {}
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
  try {
    const id = await AsyncStorage.getItem(CHILD_CHECKIN_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(CHILD_CHECKIN_ID_KEY);
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
