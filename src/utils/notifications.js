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
  {
    title: "Today's reminder might be exactly what you need.",
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: 'Guidance for a better parenting day.',
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: "Today's reminder is ready to strengthen your home.",
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: "Open today's parenting wisdom for a fresh perspective.",
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: "Today's lesson may change how you approach the day.",
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: 'Parenting is hard. Let today\'s reminder help.',
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: 'A little guidance for a big responsibility.',
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: 'Your family deserves intentional moments of learning.',
    body: 'Build your knowledge, Parent with Wisdom. Read the new insights.',
  },
  {
    title: 'A stronger home starts with small but consistent improvements.',
    body: 'Check out the new parenting insights.',
  },
  {
    title: "Today's insight can help recenter your parenting.",
    body: 'Read the new parenting insights.',
  },
  {
    title: "Take a moment for today's parenting reminder.",
    body: "Read today's parenting guidance.",
  },
  {
    title: "Today's parenting insight is powerful.",
    body: "Read today's parenting insights.",
  },
  {
    title: 'A small reminder for your parenting journey.',
    body: 'Build your knowledge, Parent with Wisdom. Open today\'s insights.',
  },
  {
    title: 'Your daily dose of parenting wisdom is here.',
    body: 'Build your knowledge, Parent with Wisdom. Open today\'s insights.',
  },
  {
    title: 'Build your knowledge, Parent with Wisdom.',
    body: "Open today's parenting insights.",
  },
  {
    title: 'Are you winning the moment but losing the child?',
    body: 'Build your parenting knowledge with the Tarbiyah insights.',
  },
  {
    title: 'Your children are a trust from Allah — be the best parent you can be.',
    body: "Open today's insights.",
  },
  {
    title: 'A parenting reminder worth pausing for is here.',
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
  {
    title: "Today's wisdom may help you see things differently.",
    body: 'Build your parenting knowledge with today\'s Tarbiyah insights.',
  },
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
      title: content.title,
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
      title: '📚 Help a fellow parent today',
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
      title: "Time for your daily habits",
      body: "Check off today's 5 improvement habits in Tarbiyah.",
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
      title: `${afterDays}-day check-in — how's it going?`,
      body: "Share your progress with Tarbiyah AI and get personalised coaching feedback.",
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
