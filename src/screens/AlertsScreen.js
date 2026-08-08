import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { useAuth } from '../../App';

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY = {
  High: {
    label:    'HIGH',
    iconBg:   '#EF4444',
    badgeBg:  '#EF4444',
    badgeText:'#FFFFFF',
    tintBg:   '#FEF2F2',
    accentText:'#DC2626',
    icon:     'warning',
    heading:  'High Priority',
  },
  Important: {
    label:    'IMPORTANT',
    iconBg:   '#F59E0B',
    badgeBg:  '#F59E0B',
    badgeText:'#FFFFFF',
    tintBg:   '#FFFBEB',
    accentText:'#D97706',
    icon:     'warning',
    heading:  'Important',
  },
  Watch: {
    label:    'WATCH',
    iconBg:   '#3B82F6',
    badgeBg:  '#3B82F6',
    badgeText:'#FFFFFF',
    tintBg:   '#EFF6FF',
    accentText:'#2563EB',
    icon:     'information-circle',
    heading:  'Watch',
  },
};

const FILTERS = ['All', 'High', 'Important', 'Watch'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ── Alert card (list view) ────────────────────────────────────────────────────

function AlertCard({ alert, isUnread, onPress }) {
  const cfg = SEVERITY[alert.severity] ?? SEVERITY.Watch;
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={s.cardTop}>
        {/* Left icon */}
        <View style={[s.iconBox, { backgroundColor: cfg.iconBg }]}>
          <Ionicons name={cfg.icon} size={20} color="#FFFFFF" />
        </View>

        {/* Badge + category */}
        <View style={s.cardMeta}>
          <View style={[s.badge, { backgroundColor: cfg.badgeBg }]}>
            <Text style={[s.badgeText, { color: cfg.badgeText }]}>{cfg.label}</Text>
          </View>
          <Text style={s.category}>Safety Watch</Text>
        </View>

        {/* Time + unread dot */}
        <View style={s.timeRow}>
          {isUnread && <View style={s.unreadDot} />}
          <Text style={s.timeAgo}>{timeAgo(alert.published_at)}</Text>
        </View>
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>{alert.title}</Text>
      {!!alert.description && (
        <Text style={s.cardDesc} numberOfLines={3}>{alert.description}</Text>
      )}

      <View style={s.readMoreRow}>
        <Text style={[s.readMore, { color: cfg.accentText }]}>Read more</Text>
        <Ionicons name="arrow-forward" size={13} color={cfg.accentText} />
      </View>

      <View style={s.divider} />
    </TouchableOpacity>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function AlertDetail({ alert, onBack }) {
  const insets = useSafeAreaInsets();
  const cfg = SEVERITY[alert.severity] ?? SEVERITY.Watch;
  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header tint block */}
        <View style={[s.detailHeader, { backgroundColor: cfg.tintBg, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color={cfg.accentText} />
            <Text style={[s.backText, { color: cfg.accentText }]}>Alerts</Text>
          </TouchableOpacity>

          {/* Severity row */}
          <View style={s.detailSeverityRow}>
            <View style={[s.detailIconBox, { backgroundColor: cfg.iconBg }]}>
              <Ionicons name={cfg.icon} size={22} color="#FFFFFF" />
            </View>
            <View style={[s.detailBadge, { backgroundColor: cfg.badgeBg }]}>
              <Text style={[s.detailBadgeText, { color: cfg.badgeText }]}>{cfg.heading}</Text>
            </View>
          </View>

          <Text style={s.detailTitle}>{alert.title}</Text>

          {/* Age range chips */}
          {alert.age_ranges?.length > 0 && (
            <View style={s.chipsRow}>
              {alert.age_ranges.map(r => (
                <View key={r} style={s.ageChip}>
                  <Text style={s.ageChipText}>Ages {r}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.detailTimeAgo}>{timeAgo(alert.published_at)}</Text>
        </View>

        <View style={s.detailBody}>
          {/* What's happening */}
          {!!alert.description && (
            <>
              <Text style={s.detailSectionLabel}>What's happening</Text>
              <Text style={s.detailBodyText}>{alert.description}</Text>
            </>
          )}

          {/* What to do */}
          {!!alert.what_to_do && (
            <>
              <View style={[s.blockquote, { borderLeftColor: cfg.accentText }]}>
                <Text style={s.blockquoteLabel}>What to do</Text>
                <Text style={s.blockquoteText}>{alert.what_to_do}</Text>
              </View>
            </>
          )}

          {/* Sources */}
          {alert.source_citations?.length > 0 && (
            <>
              <Text style={s.detailSectionLabel}>Sources</Text>
              <View style={s.chipsRow}>
                {alert.source_citations.map((src, i) => (
                  <View key={i} style={s.sourceChip}>
                    <Text style={s.sourceChipText}>{src}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Reassurance footer */}
          <View style={s.footer}>
            <Ionicons name="heart-outline" size={16} color="#9CA3AF" />
            <Text style={s.footerText}>
              Stay calm and curious. This alert is meant to help you have better conversations — not to alarm you.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { markAlertsRead } = useAuth();

  const [alerts,       setAlerts]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState('All');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [lastSeen,     setLastSeen]     = useState(null);
  const [showOlder,    setShowOlder]    = useState(false);

  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'published')
        .is('archived_at', null)
        .order('published_at', { ascending: false });
      setAlerts(data ?? []);
    } catch {}
  }, []);

  // Capture lastSeen BEFORE marking read, so dots render correctly this session
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('tarbiyah_alerts_last_seen').then(val => {
      setLastSeen(val);
      markAlertsRead();
    });
    fetchAlerts().finally(() => setLoading(false));
  }, [fetchAlerts, markAlertsRead]));

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }

  const bySeverity = filter === 'All' ? alerts : alerts.filter(a => a.severity === filter);
  const recent  = bySeverity.filter(a => new Date(a.published_at) >= THIRTY_DAYS_AGO);
  const older   = bySeverity.filter(a => new Date(a.published_at) <  THIRTY_DAYS_AGO);
  const filtered = showOlder ? bySeverity : recent;

  if (selectedAlert) {
    return <AlertDetail alert={selectedAlert} onBack={() => setSelectedAlert(null)} />;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { paddingTop: 16 }]}>
        <Text style={s.heading}>Alerts</Text>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={s.separator} />

      {/* List */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#1B3D2F" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="shield-checkmark-outline" size={44} color="#D1D5DB" />
          <Text style={s.emptyText}>No alerts in this category</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B3D2F" />}
        >
          {filtered.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isUnread={lastSeen ? new Date(alert.published_at) > new Date(lastSeen) : true}
              onPress={() => setSelectedAlert(alert)}
            />
          ))}

          {/* Older alerts toggle */}
          {!showOlder && older.length > 0 && (
            <TouchableOpacity style={s.olderBtn} onPress={() => setShowOlder(true)} activeOpacity={0.7}>
              <Ionicons name="time-outline" size={15} color="#6B7280" />
              <Text style={s.olderBtnText}>See {older.length} older alert{older.length !== 1 ? 's' : ''}</Text>
              <Ionicons name="chevron-down" size={15} color="#6B7280" />
            </TouchableOpacity>
          )}
          {showOlder && older.length > 0 && (
            <TouchableOpacity style={s.olderBtn} onPress={() => setShowOlder(false)} activeOpacity={0.7}>
              <Ionicons name="chevron-up" size={15} color="#6B7280" />
              <Text style={s.olderBtnText}>Hide older alerts</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#FFFFFF' },
  header:       { paddingHorizontal: 20, backgroundColor: '#FFFFFF' },
  heading:      { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 14 },
  filterScroll: { marginBottom: 2 },
  filterRow:    { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  filterTab: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 100, backgroundColor: '#F3F4F6',
  },
  filterTabActive:     { backgroundColor: '#1B3D2F' },
  filterTabText:       { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },
  separator:           { height: 1, backgroundColor: '#F3F4F6' },

  // Cards
  card:      { paddingHorizontal: 20, paddingTop: 18, backgroundColor: '#FFFFFF' },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  cardMeta:  { flex: 1, gap: 3 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  category:    { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  timeAgo:     { fontSize: 12, color: '#9CA3AF' },
  cardTitle:   { fontSize: 17, fontWeight: '800', color: '#111827', lineHeight: 24, marginBottom: 6 },
  cardDesc:    { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 10 },
  readMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  readMore:    { fontSize: 14, fontWeight: '600' },
  divider:     { height: 8, backgroundColor: '#F3F4F6', marginHorizontal: -20 },

  // Detail
  detailHeader:      { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText:          { fontSize: 15, fontWeight: '600' },
  detailSeverityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  detailIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  detailBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
  },
  detailBadgeText:  { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  detailTitle:      { fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 30, marginBottom: 12 },
  chipsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  ageChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 100,
  },
  ageChipText:   { fontSize: 12, fontWeight: '600', color: '#374151' },
  detailTimeAgo: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  detailBody:         { paddingHorizontal: 20, paddingTop: 24 },
  detailSectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  detailBodyText:     { fontSize: 15, color: '#374151', lineHeight: 24 },

  blockquote: {
    borderLeftWidth: 3, paddingLeft: 14, marginTop: 20, marginBottom: 4,
  },
  blockquoteLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  blockquoteText:  { fontSize: 15, color: '#374151', lineHeight: 24 },

  sourceChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#F3F4F6', borderRadius: 8,
  },
  sourceChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  footer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 32, padding: 16, backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  footerText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 20 },

  olderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  olderBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  // States
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:   { fontSize: 15, color: '#9CA3AF' },
});
