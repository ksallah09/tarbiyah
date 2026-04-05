import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tarbiyah_focus_areas';

export const ALL_FOCUS_AREAS = [
  { id: 'spiritual-identity',   label: 'Spiritual Identity',    icon: 'moon' },
  { id: 'quran-prayer',         label: 'Quran & Prayer',         icon: 'book' },
  { id: 'character-building',   label: 'Character Building',     icon: 'heart' },
  { id: 'emotional-regulation', label: 'Emotional Regulation',   icon: 'pulse' },
  { id: 'communication',        label: 'Communication',          icon: 'chatbubble' },
  { id: 'discipline-boundaries',label: 'Discipline & Boundaries',icon: 'shield-checkmark' },
  { id: 'screen-time',          label: 'Screen Time',            icon: 'phone-portrait' },
  { id: 'social-skills',        label: 'Social Skills',          icon: 'people' },
  { id: 'academic-growth',      label: 'Academic Growth',        icon: 'school' },
  { id: 'family-connection',    label: 'Family Connection',      icon: 'home' },
];

// Returns array of selected focus area IDs
export async function getFocusAreas() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    // Default selection for first load
    return ['spiritual-identity', 'character-building', 'emotional-regulation'];
  } catch { return []; }
}

export async function saveFocusAreas(selectedIds) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(selectedIds));
  } catch {}
}
