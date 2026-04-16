const HIJRI_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

const GREGORIAN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Converts a Gregorian date to Hijri using the Julian Day algorithm.
 * Accurate to within 1-2 days (matches the most common civil Hijri calendar).
 */
function gregorianToHijri(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  // Calculate Julian Day Number
  const jd =
    Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4) +
    Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) +
    d - 32075;

  // Convert JD to Hijri
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;

  const hMonth = Math.floor((24 * l) / 709);
  const hDay   = l - Math.floor((709 * hMonth) / 24);
  const hYear  = 30 * n + j - 30;

  return { year: hYear, month: hMonth, day: hDay };
}

/**
 * Returns formatted Gregorian and Hijri date strings for display.
 * e.g. { gregorian: "Sun 13 Apr", hijri: "25 Shawwal 1447" }
 */
export function getFormattedDates(date = new Date()) {
  const dayName  = DAYS_SHORT[date.getDay()];
  const dayNum   = date.getDate();
  const month    = GREGORIAN_MONTHS_SHORT[date.getMonth()];
  const gregorian = `${month} ${dayNum}, ${date.getFullYear()}`;

  const h = gregorianToHijri(date);
  const hijri = `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}`;

  return { gregorian, hijri };
}
