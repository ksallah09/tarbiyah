import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_FOCUS_AREAS, getFocusAreas, saveFocusAreas } from '../utils/focusAreas';

const ITEM_HEIGHT = 48;
const HOURS   = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIODS = ['AM','PM'];

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

const AGE_GROUPS = [
  'Infant · 0–1 yr',
  'Toddler · 2–3 yrs',
  'Early Childhood · 4–7 yrs',
  'Middle Childhood · 8–11 yrs',
  'Preteen · 12–14 yrs',
  'Teen · 15–18 yrs',
];

const LANGUAGES = ['English', 'Arabic', 'French', 'Urdu', 'Turkish'];

const BG_COLORS = ['#E8F5EF', '#FDE8C0', '#E8EEF8', '#FDE8F0', '#F0EAF8'];
const TEXT_COLORS = ['#1B3D2F', '#A0521A', '#3B5B9E', '#C0226E', '#7B4FAD'];

function getInitial(name) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?';
}

function SettingsCard({ children }) {
  return <View style={styles.settingsCard}>{children}</View>;
}

function SettingRow({ icon, iconBg, iconColor, title, subtitle, value, onPress, rightEl, last }) {
  return (
    <>
      <TouchableOpacity
        style={styles.settingRow}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        {rightEl || (onPress ? <Ionicons name="chevron-forward" size={16} color="#9CA3AF" /> : null)}
      </TouchableOpacity>
      {!last && <View style={styles.settingDivider} />}
    </>
  );
}

export default function ProfileScreen() {
  const [notifications,    setNotifications]    = useState(true);
  const [focusAreas,       setFocusAreas]       = useState([]);
  const [profileName,      setProfileName]      = useState('Yusuf Al-Hassan');
  const [reminderTime,     setReminderTime]     = useState('8:00 AM');
  const [language,         setLanguage]         = useState('English');
  const [showTimePicker,   setShowTimePicker]   = useState(false);
  const [children,         setChildren]         = useState([
    { id: '1', name: 'Ibrahim', ageGroup: 'Early Childhood · 4–7 yrs', colorIndex: 0 },
  ]);

  useEffect(() => {
    getFocusAreas().then(setFocusAreas);
    AsyncStorage.getItem('tarbiyah_profile').then(raw => {
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.name)         setProfileName(data.name);
      if (data.reminderTime) setReminderTime(data.reminderTime);
      if (data.language)     setLanguage(data.language);
      if (data.children)     setChildren(data.children);
      if (data.notifications !== undefined) setNotifications(data.notifications);
    });
  }, []);

  async function saveProfile(patch) {
    const current = { name: profileName, reminderTime, language, children, notifications };
    const updated = { ...current, ...patch };
    await AsyncStorage.setItem('tarbiyah_profile', JSON.stringify(updated));
  }

  async function toggleFocusArea(id) {
    const updated = focusAreas.includes(id)
      ? focusAreas.filter(f => f !== id)
      : [...focusAreas, id];
    setFocusAreas(updated);
    await saveFocusAreas(updated);
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

  // ── Children ──────────────────────────────────────────────
  function handleAddChild() {
    Alert.prompt(
      'Add Child',
      "Enter your child's name",
      (name) => {
        if (!name?.trim()) return;
        Alert.alert(
          'Age Group',
          'Select an age group',
          AGE_GROUPS.map((group, i) => ({
            text: group,
            onPress: () => {
              const colorIndex = children.length % BG_COLORS.length;
              const newChild = {
                id: Date.now().toString(),
                name: name.trim(),
                ageGroup: group,
                colorIndex,
              };
              const updated = [...children, newChild];
              setChildren(updated);
              saveProfile({ children: updated });
            },
          })).concat([{ text: 'Cancel', style: 'cancel' }])
        );
      },
      'plain-text',
    );
  }

  function handleChildPress(child) {
    Alert.alert(
      child.name,
      child.ageGroup,
      [
        {
          text: 'Edit Name',
          onPress: () => Alert.prompt(
            'Edit Name',
            '',
            (name) => {
              if (!name?.trim()) return;
              const updated = children.map(c =>
                c.id === child.id ? { ...c, name: name.trim() } : c
              );
              setChildren(updated);
              saveProfile({ children: updated });
            },
            'plain-text',
            child.name,
          ),
        },
        {
          text: 'Change Age Group',
          onPress: () => Alert.alert(
            'Age Group',
            'Select an age group',
            AGE_GROUPS.map(group => ({
              text: group,
              onPress: () => {
                const updated = children.map(c =>
                  c.id === child.id ? { ...c, ageGroup: group } : c
                );
                setChildren(updated);
                saveProfile({ children: updated });
              },
            })).concat([{ text: 'Cancel', style: 'cancel' }])
          ),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              `Remove ${child.name}?`,
              'This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => {
                    const updated = children.filter(c => c.id !== child.id);
                    setChildren(updated);
                    saveProfile({ children: updated });
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  // ── Reminder time ─────────────────────────────────────────
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
    Linking.openURL('mailto:support@tarbiyah.app?subject=Tarbiyah Support').catch(() =>
      Alert.alert('Support', 'Email us at support@tarbiyah.app')
    );
  }

  // ── Sign out ──────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => {} },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatarCircle}>
            <Text style={styles.profileAvatarText}>{profileName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileName}</Text>
            <Text style={styles.profileSince}>Member since January 2024</Text>
          </View>
          <TouchableOpacity style={styles.profileEditBtn} onPress={handleEditProfile}>
            <Ionicons name="pencil-outline" size={15} color="#2E7D62" />
          </TouchableOpacity>
        </View>

        {/* ── My Children ── */}
        <Text style={styles.sectionTitle}>MY CHILDREN</Text>
        <View style={styles.sectionBlock}>
          {children.map((child) => (
            <TouchableOpacity key={child.id} style={styles.childCard} activeOpacity={0.85} onPress={() => handleChildPress(child)}>
              <View style={[styles.childAvatar, { backgroundColor: BG_COLORS[child.colorIndex % BG_COLORS.length] }]}>
                <Text style={[styles.childAvatarText, { color: TEXT_COLORS[child.colorIndex % TEXT_COLORS.length] }]}>
                  {getInitial(child.name)}
                </Text>
              </View>
              <View style={styles.childInfo}>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childAgeGroup}>{child.ageGroup}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addChildBtn} onPress={handleAddChild}>
            <Ionicons name="add" size={16} color="#2E7D62" />
            <Text style={styles.addChildText}>Add Child</Text>
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
              icon="language-outline"
              iconBg="#E8F5EF"
              iconColor="#2E7D62"
              title="Language"
              value={language}
              onPress={handleLanguage}
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
                  }}
                  trackColor={{ false: '#E8EAED', true: '#A8D5C2' }}
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
              last
            />
          </SettingsCard>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionLabel}>Tarbiyah v1.0.0</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
      <TimePickerModal
        visible={showTimePicker}
        value={reminderTime}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(t) => {
          setReminderTime(t);
          saveProfile({ reminderTime: t });
          setShowTimePicker(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  scroll: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 32, paddingHorizontal: 20 },

  title: { fontSize: 28, fontWeight: '700', color: '#1B3D2F', marginBottom: 20 },

  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#1B3D2F',
    letterSpacing: 0.4, marginBottom: 10,
  },
  sectionBlock: { marginBottom: 24 },

  // ── Profile card ──
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  profileAvatarCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 19, fontWeight: '700', color: '#FFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
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
  versionLabel: { fontSize: 12, color: '#C4BDB4', textAlign: 'center', fontWeight: '500' },
});
