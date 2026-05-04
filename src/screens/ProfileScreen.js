import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
  Modal,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getSavedInsights, unsaveInsight } from '../utils/savedInsights';
import { getSavedResources, unsaveResource } from '../utils/savedResources';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_FOCUS_AREAS, getFocusAreas, saveFocusAreas } from '../utils/focusAreas';
import { getCurrentUser, getSession } from '../utils/auth';
import { saveProfileToSupabase, syncProfileFromSupabase } from '../utils/profile';
import { useAuth } from '../../App';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const CATEGORY_CONFIG = {
  'Lecture/Video':      { color: '#2E7D62', icon: 'play-circle-outline' },
  'Article/Book':       { color: '#D4871A', icon: 'book-outline' },
  'Activity/Printable': { color: '#7C3AED', icon: 'color-palette-outline' },
  'Duas & Adhkar':      { color: '#0D9488', icon: 'sparkles' },
  'Podcast':            { color: '#2563EB', icon: 'mic-outline' },
  'Other':              { color: '#6B7280', icon: 'grid-outline' },
};
function catConfig(cat) { return CATEGORY_CONFIG[cat] ?? { color: '#6B7280', icon: 'grid-outline' }; }
import * as Notifications from 'expo-notifications';
import { scheduleDailyNotification, cancelDailyNotification, requestNotificationPermission } from '../utils/notifications';
import * as ImagePicker from 'expo-image-picker';
import { uploadPhoto } from '../utils/uploadPhoto';

const PROFILE_PHOTO_KEY = 'tarbiyah_profile_photo';

const ITEM_HEIGHT = 48;
const HOURS   = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIODS = ['AM','PM'];

const COUNTS = ['1', '2', '3', '4', '5+'];
const CHILD_AGE_GROUPS = [
  { id: 'under-5', label: 'Under 5',  sub: 'Toddler & Preschool' },
  { id: '5-10',    label: '5 – 10',   sub: 'Early Childhood'     },
  { id: '11-15',   label: '11 – 15',  sub: 'Pre-Teen'            },
  { id: '16-plus', label: '16+',      sub: 'Young Adult'         },
];

function ChildrenEditorModal({ visible, count, ages, onConfirm, onClose }) {
  const [localCount, setLocalCount] = useState(count);
  const [localAges,  setLocalAges]  = useState(ages);

  // sync when modal opens
  useEffect(() => {
    if (visible) { setLocalCount(count); setLocalAges(ages); }
  }, [visible]);

  function toggleAge(id) {
    setLocalAges(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  const canSave = localCount !== null && localAges.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ceStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={ceStyles.sheet}>
        <View style={ceStyles.handle} />
        <Text style={ceStyles.title}>Children</Text>

        <Text style={ceStyles.label}>HOW MANY CHILDREN?</Text>
        <View style={ceStyles.countRow}>
          {COUNTS.map(c => (
            <TouchableOpacity
              key={c}
              style={[ceStyles.countBtn, localCount === c && ceStyles.countBtnActive]}
              onPress={() => setLocalCount(c)}
            >
              <Text style={[ceStyles.countText, localCount === c && ceStyles.countTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[ceStyles.label, { marginTop: 20 }]}>WHICH AGE GROUPS?</Text>
        <View style={ceStyles.ageGrid}>
          {CHILD_AGE_GROUPS.map(ag => {
            const selected = localAges.includes(ag.id);
            return (
              <TouchableOpacity
                key={ag.id}
                style={[ceStyles.ageCard, selected && ceStyles.ageCardActive]}
                onPress={() => toggleAge(ag.id)}
                activeOpacity={0.7}
              >
                <Text style={[ceStyles.ageLabel, selected && ceStyles.ageLabelActive]}>{ag.label}</Text>
                <Text style={[ceStyles.ageSub,   selected && ceStyles.ageSubActive]}>{ag.sub}</Text>
                {selected && (
                  <View style={ceStyles.check}>
                    <Text style={ceStyles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[ceStyles.confirmBtn, !canSave && { opacity: 0.3 }]}
          onPress={() => canSave && onConfirm(localCount, localAges)}
          disabled={!canSave}
        >
          <Text style={ceStyles.confirmText}>Save</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ceStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1B3D2F', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.4, marginBottom: 12 },
  countRow: { flexDirection: 'row', gap: 8 },
  countBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E8EAED',
    alignItems: 'center', justifyContent: 'center',
  },
  countBtnActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  countText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  countTextActive: { color: '#FFFFFF' },
  ageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ageCard: {
    width: '47.5%', borderRadius: 14, borderWidth: 1.5,
    borderColor: '#E8EAED', padding: 14, position: 'relative',
  },
  ageCardActive: { backgroundColor: '#E8F5EF', borderColor: '#2E7D62' },
  ageLabel: { fontSize: 18, fontWeight: '700', color: '#9CA3AF', marginBottom: 3 },
  ageLabelActive: { color: '#1B3D2F' },
  ageSub: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  ageSubActive: { color: '#2E7D62' },
  check: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#2E7D62', alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  confirmBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

function ScrollColumn({ data, selected, onSelect }) {
  const ref = useRef(null);
  const index = data.indexOf(selected);

  useEffect(() => {
    if (ref.current && index >= 0) {
      ref.current.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: false });
    }
  }, []);

  return (
    <View style={tcStyles.col}>
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={item => item}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (data[i]) onSelect(data[i]);
        }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        style={{ height: ITEM_HEIGHT * 3 }}
        renderItem={({ item }) => (
          <View style={[tcStyles.item, item === selected && tcStyles.itemSelected]}>
            <Text style={[tcStyles.itemText, item === selected && tcStyles.itemTextSelected]}>
              {item}
            </Text>
          </View>
        )}
      />
      <View style={tcStyles.selectorTop} pointerEvents="none" />
      <View style={tcStyles.selectorBottom} pointerEvents="none" />
    </View>
  );
}

function TimePickerModal({ visible, value, onConfirm, onClose }) {
  const [hour,   setHour]   = useState(value.split(':')[0].trim());
  const [minute, setMinute] = useState(value.split(':')[1]?.split(' ')[0]?.trim() ?? '00');
  const [period, setPeriod] = useState(value.includes('PM') ? 'PM' : 'AM');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={tcStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={tcStyles.sheet}>
        <View style={tcStyles.sheetHandle} />
        <Text style={tcStyles.sheetTitle}>Daily Reminder Time</Text>

        <View style={tcStyles.pickerRow}>
          <ScrollColumn data={HOURS}   selected={hour}   onSelect={setHour} />
          <Text style={tcStyles.colon}>:</Text>
          <ScrollColumn data={MINUTES} selected={minute} onSelect={setMinute} />
          <ScrollColumn data={PERIODS} selected={period} onSelect={setPeriod} />
        </View>

        <TouchableOpacity
          style={tcStyles.confirmBtn}
          onPress={() => onConfirm(`${hour}:${minute} ${period}`)}
        >
          <Text style={tcStyles.confirmText}>Set Reminder</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const tcStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1B3D2F', textAlign: 'center', marginBottom: 20 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  col: { width: 72, position: 'relative' },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemSelected: {},
  itemText: { fontSize: 22, fontWeight: '400', color: '#9CA3AF' },
  itemTextSelected: { fontSize: 26, fontWeight: '700', color: '#1B3D2F' },
  selectorTop: {
    position: 'absolute', top: ITEM_HEIGHT, left: 0, right: 0,
    height: 1, backgroundColor: '#E8EAED',
  },
  selectorBottom: {
    position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0,
    height: 1, backgroundColor: '#E8EAED',
  },
  colon: { fontSize: 26, fontWeight: '700', color: '#1B3D2F', marginTop: -4 },
  confirmBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

const LANGUAGES = ['English', 'Arabic', 'French', 'Urdu', 'Turkish'];


function SettingsCard({ children }) {
  return <View style={styles.settingsCard}>{children}</View>;
}

function SettingRow({ icon, iconBg, iconColor, title, subtitle, value, onPress, rightEl, last, disabled }) {
  return (
    <>
      <TouchableOpacity
        style={[styles.settingRow, disabled && { opacity: 0.45 }]}
        onPress={disabled ? null : onPress}
        activeOpacity={onPress && !disabled ? 0.7 : 1}
      >
        <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, disabled && { color: '#9CA3AF' }]}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={[styles.settingValue, disabled && { color: '#9CA3AF' }]}>{value}</Text> : null}
        {rightEl || (onPress ? <Ionicons name="chevron-forward" size={16} color="#9CA3AF" /> : null)}
      </TouchableOpacity>
      {!last && <View style={styles.settingDivider} />}
    </>
  );
}

export default function ProfileScreen() {
  const { handleSignOut: authSignOut } = useAuth();
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(route?.params?.tab ?? 'settings');
  const [savedInsights,  setSavedInsights]  = useState([]);
  const [savedResources, setSavedResources] = useState([]);
  const [libQuery,       setLibQuery]       = useState('');
  const [libActiveTopic, setLibActiveTopic] = useState('All');
  const [hiddenThumbs,   setHiddenThumbs]   = useState(new Set());
  const [notifications,    setNotifications]    = useState(true);
  const [focusAreas,       setFocusAreas]       = useState([]);
  const [profileName,      setProfileName]      = useState('');
  const [profilePhoto,     setProfilePhoto]     = useState(null);
  const [userEmail,        setUserEmail]        = useState('');
  const [reminderTime,     setReminderTime]     = useState('8:00 AM');
  const [language,         setLanguage]         = useState('English');
  const [familyStructure,  setFamilyStructure]  = useState('prefer_not_to_say');
  const [showTimePicker,     setShowTimePicker]     = useState(false);
  const [showChildrenEditor, setShowChildrenEditor] = useState(false);
  const [childrenCount,      setChildrenCount]      = useState(null);
  const [childrenAges,       setChildrenAges]       = useState([]);
  const userIdRef = useRef(null);

  useFocusEffect(useCallback(() => {
    getSavedInsights().then(setSavedInsights);
    getSavedResources().then(setSavedResources);
  }, []));

  useEffect(() => {
    let localProfile = null;
    let localOnboarding = null;

    getCurrentUser().then(user => {
      userIdRef.current = user?.id ?? null;
      if (user?.email) setUserEmail(user.email);
    });

    getFocusAreas().then(setFocusAreas);

    AsyncStorage.getItem(PROFILE_PHOTO_KEY).then(uri => { if (uri) setProfilePhoto(uri); });

    Promise.all([
      AsyncStorage.getItem('tarbiyah_profile'),
      AsyncStorage.getItem('tarbiyah_onboarding_v1'),
    ]).then(([profileRaw, onboardingRaw]) => {
      if (profileRaw) {
        localProfile = JSON.parse(profileRaw);
        if (localProfile.name)                        setProfileName(localProfile.name);
        if (localProfile.reminderTime)                setReminderTime(localProfile.reminderTime);
        if (localProfile.language)                    setLanguage(localProfile.language);
        if (localProfile.familyStructure)             setFamilyStructure(localProfile.familyStructure);
        if (localProfile.notifications !== undefined) setNotifications(localProfile.notifications);
      }
      if (onboardingRaw) {
        localOnboarding = JSON.parse(onboardingRaw);
        if (localOnboarding.childrenCount) setChildrenCount(localOnboarding.childrenCount);
        if (localOnboarding.childrenAges)  setChildrenAges(localOnboarding.childrenAges);
      }
    }).then(async () => {
      // Backfill Supabase if this account predates the profile-save feature
      const user = await getCurrentUser();
      if (!user) return;
      userIdRef.current = user.id;
      const synced = await syncProfileFromSupabase(user.id);
      if (!synced && localProfile) {
        // No Supabase row yet — save local data up to Supabase now
        await saveProfileToSupabase({
          userId:        user.id,
          name:          localProfile.name,
          childrenCount: localOnboarding?.childrenCount ?? null,
          childrenAges:  localOnboarding?.childrenAges  ?? [],
          reminderTime:  localProfile.reminderTime ?? null,
          focusAreas:    await getFocusAreas(),
          language:      localProfile.language ?? 'English',
        });
      }
    });
  }, []);

  async function pickProfilePhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],

      quality: 0.8,
    });
    if (!result.canceled) {
      await saveProfilePhoto(result.assets[0].uri);
    }
  }

  async function takeProfilePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      await saveProfilePhoto(result.assets[0].uri);
    }
  }

  async function saveProfilePhoto(localUri) {
    setProfilePhoto(localUri); // show immediately
    try {
      const userId = userIdRef.current ?? `user_${Date.now()}`;
      const publicUrl = await uploadPhoto(localUri, `profiles/${userId}.jpg`);
      setProfilePhoto(publicUrl);
      await AsyncStorage.setItem(PROFILE_PHOTO_KEY, publicUrl);
    } catch {
      await AsyncStorage.setItem(PROFILE_PHOTO_KEY, localUri); // fallback to local
    }
  }

  function handleChangePhoto() {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Choose from Library', onPress: pickProfilePhoto },
      { text: 'Take a Photo',        onPress: takeProfilePhoto },
      profilePhoto ? { text: 'Remove Photo', style: 'destructive', onPress: async () => {
        setProfilePhoto(null);
        await AsyncStorage.removeItem(PROFILE_PHOTO_KEY);
      }} : null,
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean));
  }

  async function saveProfile(patch) {
    const current = { name: profileName, reminderTime, language, notifications, familyStructure };
    const updated = { ...current, ...patch };
    await AsyncStorage.setItem('tarbiyah_profile', JSON.stringify(updated));
    if (updated.familyStructure !== familyStructure) setFamilyStructure(updated.familyStructure);
    if (userIdRef.current) {
      saveProfileToSupabase({
        userId:          userIdRef.current,
        name:            updated.name,
        childrenCount:   childrenCount,
        childrenAges:    childrenAges,
        reminderTime:    updated.reminderTime,
        focusAreas:      focusAreas,
        familyStructure: updated.familyStructure ?? 'prefer_not_to_say',
        language:        updated.language ?? 'English',
      });
    }
  }

  async function toggleFocusArea(id) {
    const updated = focusAreas.includes(id)
      ? focusAreas.filter(f => f !== id)
      : [...focusAreas, id];
    setFocusAreas(updated);
    await saveFocusAreas(updated);
    if (userIdRef.current) {
      saveProfileToSupabase({
        userId:        userIdRef.current,
        name:          profileName,
        childrenCount: childrenCount,
        childrenAges:  childrenAges,
        reminderTime:  reminderTime,
        focusAreas:    updated,
        language:      language,
      });
    }
  }

  // ── Profile edit ──────────────────────────────────────────
  function handleEditProfile() {
    Alert.prompt(
      'Edit Name',
      'Enter your name',
      (name) => {
        if (!name?.trim()) return;
        setProfileName(name.trim());
        saveProfile({ name: name.trim() });
      },
      'plain-text',
      profileName,
    );
  }

  // ── Reminder time ─────────────────────────────────────────
  async function handleSaveChildren(count, ages) {
    setChildrenCount(count);
    setChildrenAges(ages);
    setShowChildrenEditor(false);
    const existing = await AsyncStorage.getItem('tarbiyah_onboarding_v1');
    const parsed = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem('tarbiyah_onboarding_v1', JSON.stringify({
      ...parsed,
      childrenCount: count,
      childrenAges: ages,
    }));
    if (userIdRef.current) {
      saveProfileToSupabase({
        userId:        userIdRef.current,
        name:          profileName,
        childrenCount: count,
        childrenAges:  ages,
        reminderTime:  reminderTime,
        focusAreas:    focusAreas,
        language:      language,
      });
    }
  }

  function handleReminderTime() {
    setShowTimePicker(true);
  }

  // ── Language ──────────────────────────────────────────────
  function handleLanguage() {
    Alert.alert(
      'Language',
      'Select your preferred language',
      LANGUAGES.map(l => ({
        text: l,
        onPress: () => {
          setLanguage(l);
          saveProfile({ language: l });
        },
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  }

  // ── Rate & Support ────────────────────────────────────────
  function handleRate() {
    Linking.openURL('https://apps.apple.com/app/id000000000').catch(() =>
      Alert.alert('Coming Soon', 'Rating will be available when the app is published.')
    );
  }

  function handleSupport() {
    Linking.openURL('mailto:support@thetarbiyahapp.com?subject=Tarbiyah Support').catch(() =>
      Alert.alert('Help & Support', 'Email us at support@thetarbiyahapp.com')
    );
  }

  // ── Delete account ────────────────────────────────────────
  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.\n\nIf you have an active subscription, please cancel it in your App Store settings before proceeding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const session = await getSession();
              const token = session?.access_token;
              if (!token) throw new Error('No session');
              const res = await fetch(`${API_URL}/auth/account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) throw new Error('Server error');
              await authSignOut();
            } catch {
              Alert.alert('Error', 'Could not delete your account. Please try again or contact support.');
            }
          },
        },
      ]
    );
  }

  // ── Sign out ──────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => authSignOut(),
        },
      ]
    );
  }

  const libAllTopics = ['All', ...Array.from(new Set(savedInsights.flatMap(i => i.tags ?? []))).sort()];
  const libFiltered = savedInsights.filter(i => {
    const matchTopic = libActiveTopic === 'All' || (i.tags ?? []).includes(libActiveTopic);
    const q = libQuery.toLowerCase();
    return matchTopic && (!q || i.insightTitle?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q));
  });
  const libTotalCount = savedInsights.length + savedResources.length;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />

      {/* ── Fixed header with tab switcher ── */}
      <View style={[styles.profileHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.profileHeaderRow}>
          <Text style={styles.profileHeaderTitle}>Profile</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.75}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        <View style={styles.profileTabRow}>
          {[
            { key: 'settings', label: 'Profile Settings' },
            { key: 'library',  label: 'My Library' },
          ].map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={styles.profileTabBtn} onPress={() => setActiveTab(tab.key)} activeOpacity={0.75}>
                <Text style={[styles.profileTabLabel, active && styles.profileTabLabelActive]}>{tab.label}</Text>
                {active && <View style={styles.profileTabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        <View style={styles.sheet}>
        <View style={styles.content}>

        {activeTab === 'library' ? (
          /* ── My Library ── */
          <>
            <View style={styles.libControls}>
              <View style={styles.libSearchBar}>
                <Ionicons name="search-outline" size={17} color="#9CA3AF" />
                <View style={{ flex: 1 }}>
                  {!libQuery && <Text style={styles.libSearchPlaceholder} pointerEvents="none">Search saved items...</Text>}
                  <TextInput style={styles.libSearchInput} value={libQuery} onChangeText={setLibQuery} />
                </View>
                {libQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setLibQuery('')}>
                    <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {libTotalCount === 0 ? (
              <View style={styles.libEmpty}>
                <Ionicons name="bookmark-outline" size={48} color="#D1D5DB" />
                <Text style={styles.libEmptyTitle}>Nothing saved yet</Text>
                <Text style={styles.libEmptyBody}>Bookmark insights or save community resources to find them here.</Text>
              </View>
            ) : (
              <>
                {libFiltered.map(item => {
                  const isSpiritual = item.type === 'spiritual';
                  const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.libCard}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('InsightDetail', { insight: item })}
                    >
                      <View style={[styles.libCardAccent, { backgroundColor: accentColor }]} />
                      <View style={styles.libCardBody}>
                        <View style={styles.libCardTopRow}>
                          <Text style={[styles.libCardType, { color: accentColor }]}>
                            {isSpiritual ? 'Spiritual Insight' : 'Research Insight'}
                          </Text>
                          <TouchableOpacity
                            onPress={async () => { await unsaveInsight(item.id); setSavedInsights(prev => prev.filter(i => i.id !== item.id)); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="bookmark" size={18} color={accentColor} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.libCardTitle}>{item.insightTitle}</Text>
                        <Text style={styles.libCardPreview} numberOfLines={2}>{item.body}</Text>
                        {item.tags?.length > 0 && (
                          <View style={styles.libTagsRow}>
                            {item.tags.slice(0, 3).map(tag => (
                              <View key={tag} style={[styles.libTag, { backgroundColor: accentColor + '15' }]}>
                                <Text style={[styles.libTagText, { color: accentColor }]}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {savedResources.map(item => {
                  const cfg = catConfig(item.category);
                  return (
                    <View key={item.id} style={[styles.libResourceCard, item.thumbnail_url && !hiddenThumbs.has(item.id) && styles.libResourceCardColumn]}>
                      {item.thumbnail_url && !hiddenThumbs.has(item.id) ? (
                        <>
                          <Image
                            source={{ uri: item.thumbnail_url }}
                            style={styles.libResourceThumb}
                            resizeMode="cover"
                            onError={() => setHiddenThumbs(prev => new Set(prev).add(item.id))}
                          />
                          <View style={[styles.libResourceThumbAccent, { backgroundColor: cfg.color }]} />
                        </>
                      ) : (
                        <View style={[styles.libResourceAccent, { backgroundColor: cfg.color }]} />
                      )}
                      <View style={styles.libResourceBody}>
                        <View style={styles.libResourceTop}>
                          <View style={[styles.libResourceCatPill, { backgroundColor: cfg.color + '18' }]}>
                            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                            <Text style={[styles.libResourceCatText, { color: cfg.color }]}>{item.category}</Text>
                          </View>
                          <Text style={styles.libResourceAge}>{item.age_range}</Text>
                        </View>
                        <Text style={styles.libResourceTitle}>{item.title}</Text>
                        {item.why_helped ? <Text style={styles.libResourceWhy}>"{item.why_helped}"</Text> : null}
                        <View style={styles.libResourceActions}>
                          <TouchableOpacity
                            style={styles.libSaveBtnActive}
                            onPress={async () => { await unsaveResource(item.id); setSavedResources(prev => prev.filter(r => r.id !== item.id)); }}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="bookmark" size={15} color="#FFFFFF" />
                            <Text style={styles.libSaveBtnText}>Saved</Text>
                          </TouchableOpacity>
                          {item.url ? (
                            <TouchableOpacity style={styles.libOpenBtn} onPress={() => Linking.openURL(item.url)} activeOpacity={0.75}>
                              <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                              <Text style={styles.libOpenBtnText}>Open</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : (
        <>
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.85} style={styles.profileAvatarWrap}>
            <View style={styles.profileAvatarCircle}>
              {profilePhoto
                ? <Image source={{ uri: profilePhoto }} style={styles.profileAvatarPhoto} />
                : <Text style={styles.profileAvatarText}>{profileName ? profileName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?'}</Text>
              }
            </View>
            <View style={styles.profileCameraBadge}>
              <Ionicons name="camera" size={11} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileName}</Text>
            {userEmail ? <Text style={styles.profileEmail}>{userEmail}</Text> : null}
          </View>
          <TouchableOpacity style={styles.profileEditBtn} onPress={handleEditProfile}>
            <Ionicons name="pencil-outline" size={15} color="#2E7D62" />
          </TouchableOpacity>
        </View>

        {/* ── My Children ── */}
        <Text style={styles.sectionTitle}>MY CHILDREN</Text>
        <View style={styles.sectionBlock}>
          {/* Count + age ranges summary card */}
          <TouchableOpacity style={styles.childrenSummaryCard} onPress={() => setShowChildrenEditor(true)} activeOpacity={0.85}>
            <View style={styles.childrenSummaryInfo}>
              <Text style={styles.childrenSummaryCount}>
                {childrenCount ? `${childrenCount} ${parseInt(childrenCount) === 1 ? 'child' : 'children'}` : 'Not set'}
              </Text>
              <Text style={styles.childrenSummaryAges}>
                {childrenAges.length > 0
                  ? CHILD_AGE_GROUPS.filter(ag => childrenAges.includes(ag.id)).map(ag => ag.label).join(' · ')
                  : 'No age groups selected'}
              </Text>
            </View>
            <Ionicons name="pencil-outline" size={15} color="#2E7D62" />
          </TouchableOpacity>

        </View>

        {/* ── My Focus Areas ── */}
        <Text style={styles.sectionTitle}>MY FOCUS AREAS</Text>
        <View style={styles.sectionBlock}>
          <View style={styles.focusCard}>
            <Text style={styles.focusDesc}>
              Areas you want to grow in as a parent. These shape your Tarbiyah experience.
            </Text>
            <View style={styles.focusGrid}>
              {ALL_FOCUS_AREAS.map(area => {
                const active = focusAreas.includes(area.id);
                return (
                  <TouchableOpacity
                    key={area.id}
                    style={[styles.focusChip, active && styles.focusChipActive]}
                    onPress={() => toggleFocusArea(area.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={active ? area.icon : `${area.icon}-outline`}
                      size={13}
                      color={active ? '#FFFFFF' : '#6B7280'}
                    />
                    <Text style={[styles.focusChipText, active && styles.focusChipTextActive]}>
                      {area.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Preferences ── */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.sectionBlock}>
          <SettingsCard>
            <SettingRow
              icon="alarm-outline"
              iconBg="#FDF3E3"
              iconColor="#D4871A"
              title="Daily Reminder Time"
              value={reminderTime}
              onPress={handleReminderTime}
            />
            <SettingRow
              icon="people-outline"
              iconBg="#E8F5EF"
              iconColor="#2E7D62"
              title="Family Situation"
              value={familyStructure === 'married' ? 'Married' : familyStructure === 'single_parent' ? 'Single Parent' : 'Not set'}
              onPress={() => {
                Alert.alert(
                  'Family Situation',
                  'Update your family situation so we can tailor advice to your reality.',
                  [
                    { text: 'Married', onPress: () => saveProfile({ familyStructure: 'married' }) },
                    { text: 'Single Parent', onPress: () => saveProfile({ familyStructure: 'single_parent' }) },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            />
            <SettingRow
              icon="language-outline"
              iconBg="#F3F4F6"
              iconColor="#9CA3AF"
              title="Language"
              value="English"
              onPress={null}
              disabled
              last
            />
          </SettingsCard>
        </View>

        {/* ── App Settings ── */}
        <Text style={styles.sectionTitle}>APP SETTINGS</Text>
        <View style={styles.sectionBlock}>
          <SettingsCard>
            <SettingRow
              icon="notifications-outline"
              iconBg="#E8F5EF"
              iconColor="#2E7D62"
              title="Daily Notifications"
              subtitle="Reminders and check-ins"
              rightEl={
                <Switch
                  value={notifications}
                  onValueChange={(val) => {
                    setNotifications(val);
                    saveProfile({ notifications: val });
                    if (val) {
                      requestNotificationPermission().then(granted => {
                        if (granted) scheduleDailyNotification(reminderTime);
                      });
                    } else {
                      cancelDailyNotification();
                    }
                  }}
                  trackColor={{ false: '#E8EAED', true: '#34C759' }}
                  thumbColor={notifications ? '#1B3D2F' : '#FFF'}
                  ios_backgroundColor="#E8EAED"
                />
              }
            />
            <SettingRow
              icon="heart-outline"
              iconBg="#FDE8F0"
              iconColor="#C0226E"
              title="Rate Tarbiyah"
              subtitle="Share your feedback"
              onPress={handleRate}
            />
            <SettingRow
              icon="help-circle-outline"
              iconBg="#F0F1F3"
              iconColor="#9CA3AF"
              title="Help & Support"
              onPress={handleSupport}
            />
            <SettingRow
              icon="information-circle-outline"
              iconBg="#EEF2FF"
              iconColor="#4F46E5"
              title="About Tarbiyah"
              onPress={() => navigation.navigate('About')}
              last
            />
          </SettingsCard>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Delete Account ── */}
        <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.versionLabel}>Tarbiyah v1.0.0</Text>
        </>
        )}{/* end settings tab */}
        </View>{/* end content */}
        </View>{/* end sheet */}
      </ScrollView>
      <TimePickerModal
        visible={showTimePicker}
        value={reminderTime}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(t) => {
          setReminderTime(t);
          saveProfile({ reminderTime: t });
          setShowTimePicker(false);
          if (notifications) scheduleDailyNotification(t);
        }}
      />
      <ChildrenEditorModal
        visible={showChildrenEditor}
        count={childrenCount}
        ages={childrenAges}
        onClose={() => setShowChildrenEditor(false)}
        onConfirm={handleSaveChildren}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },

  // ── Fixed profile header ──
  profileHeader: { backgroundColor: '#1B3D2F', paddingHorizontal: 20, paddingBottom: 12 },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  profileHeaderTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileTabRow: { flexDirection: 'row', gap: 24 },
  profileTabBtn: { paddingVertical: 14, alignItems: 'center', position: 'relative' },
  profileTabLabel: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  profileTabLabelActive: { color: '#FFFFFF', fontWeight: '700' },
  profileTabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, borderRadius: 2, backgroundColor: '#FFFFFF',
  },

  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  sheet: { flexGrow: 1, backgroundColor: '#F5F6F8', overflow: 'hidden' },
  content: { paddingTop: 20, paddingBottom: 32, paddingHorizontal: 20 },

  // ── My Library ──
  libControls: { gap: 12, marginBottom: 12 },
  libSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  libSearchInput: { fontSize: 14, color: '#1A1A2E', flex: 1 },
  libSearchPlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, fontSize: 14, color: '#9CA3AF' },
  libFilterRow: { paddingHorizontal: 4, gap: 8, alignItems: 'center' },
  libFilterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#E8EAED' },
  libFilterChipActive: { backgroundColor: '#1B3D2F' },
  libFilterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  libFilterChipTextActive: { color: '#FFFFFF' },
  libEmpty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 },
  libEmptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'center' },
  libEmptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  libCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  libCardAccent: { width: 4 },
  libCardBody: { flex: 1, padding: 14 },
  libCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  libCardType: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  libCardTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4, lineHeight: 21 },
  libCardPreview: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 10 },
  libTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  libTag: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  libTagText: { fontSize: 11, fontWeight: '600' },
  libResourceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  libResourceCardColumn: { flexDirection: 'column' },
  libResourceAccent: { width: 4 },
  libResourceThumb: { width: '100%', height: 160, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#F3F4F6' },
  libResourceThumbAccent: { height: 3, width: '100%' },
  libResourceBody: { flex: 1, padding: 14 },
  libResourceTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  libResourceCatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  libResourceCatText: { fontSize: 11, fontWeight: '700' },
  libResourceAge: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  libResourceTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', lineHeight: 21, marginBottom: 4 },
  libResourceWhy: { fontSize: 13, color: '#6B7280', lineHeight: 20, fontStyle: 'italic', marginBottom: 12 },
  libResourceActions: { flexDirection: 'row', gap: 8 },
  libSaveBtnActive: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#1B3D2F' },
  libSaveBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  libOpenBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, backgroundColor: '#1B3D2F' },
  libOpenBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  title: { fontSize: 28, fontWeight: '700', color: '#1B3D2F', marginBottom: 0 },

  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: '#1B3D2F',
    letterSpacing: 0.3, marginBottom: 10,
  },
  sectionBlock: { marginBottom: 24 },

  // ── Profile card ──
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 24, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  profileAvatarWrap: { position: 'relative' },
  profileAvatarCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarPhoto: { width: 54, height: 54, borderRadius: 27 },
  profileAvatarText: { fontSize: 19, fontWeight: '700', color: '#FFF' },
  profileCameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#2E7D62', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  profileEmail: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  profileSince: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  profileEditBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center',
  },

  // ── Children ──
  childCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  childAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontSize: 17, fontWeight: '700' },
  childInfo: { flex: 1 },
  childName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  childAgeGroup: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  childrenSummaryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  childrenSummaryInfo: { flex: 1 },
  childrenSummaryCount: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 3 },
  childrenSummaryAges: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  addChildBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#E8F5EF', borderStyle: 'dashed',
  },
  addChildText: { fontSize: 13, fontWeight: '600', color: '#2E7D62' },

  // ── Settings card ──
  settingsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginBottom: 1 },
  settingSubtitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  settingValue: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginRight: 4 },
  settingDivider: { height: 1, backgroundColor: '#F5F6F8', marginLeft: 62 },

  // ── Focus areas ──
  focusCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  focusDesc: { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 14 },
  focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  focusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100,
    backgroundColor: '#F5F6F8', borderWidth: 1.5, borderColor: '#ECEDF0',
  },
  focusChipActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  focusChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  focusChipTextActive: { color: '#FFFFFF' },

  // ── Sign out ──
  signOutBtn: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  deleteAccountBtn: {
    paddingVertical: 14, alignItems: 'center', marginBottom: 24,
  },
  deleteAccountText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  versionLabel: { fontSize: 12, color: '#C4BDB4', textAlign: 'center', fontWeight: '500' },
});
