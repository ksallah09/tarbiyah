import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const CARD_SHADOW = {
  shadowColor: '#1B3D2F',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

export default function GrowthAreaPlanScreen({ navigation, route }) {
  const { area, child } = route?.params ?? {};
  const insets = useSafeAreaInsets();

  const [activeWeek, setActiveWeek]       = useState(0);
  const [expandedWisdom, setExpandedWisdom] = useState(new Set());

  if (!area) return null;

  const weeks = area.plan ?? [];
  const week  = weeks[activeWeek];

  function toggleWisdom(key) {
    setExpandedWisdom(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function renderItem({ item, index, type }) {
    const key      = `${type}_w${activeWeek}_${index}`;
    const open     = expandedWisdom.has(key);
    const isHabit  = type === 'habit';
    const accent   = isHabit ? '#2E7D62' : '#B45309';
    const bgAccent = isHabit ? '#EDF7F2' : '#FEF6EC';
    const badgeBg  = isHabit ? '#E8F5EE' : '#FEF3E7';

    return (
      <View key={key} style={[styles.itemCard, { borderLeftColor: accent }]}>
        <View style={styles.itemTop}>
          <View style={[styles.itemBadge, { backgroundColor: badgeBg }]}>
            {isHabit
              ? <Text style={[styles.itemBadgeNum, { color: accent }]}>{index + 1}</Text>
              : <Ionicons name="star-outline" size={13} color={accent} />
            }
          </View>
          <Text style={styles.itemText}>{item.text}</Text>
        </View>

        {item.wisdom && (
          <>
            <TouchableOpacity
              style={styles.wisdomToggle}
              onPress={() => toggleWisdom(key)}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={12} color={accent} />
              <Text style={[styles.wisdomToggleText, { color: accent }]}>Wisdom behind this</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={accent} />
            </TouchableOpacity>
            {open && (
              <View style={[styles.wisdomPanel, { backgroundColor: bgAccent, borderLeftColor: accent }]}>
                <Text style={[styles.wisdomText, { color: isHabit ? '#1B4D3E' : '#92400E' }]}>{item.wisdom}</Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          {child?.name && (
            <Text style={styles.headerEyebrow}>{child.name.toUpperCase()} · GROWTH AREA</Text>
          )}
          <Text style={styles.headerTitle} numberOfLines={2}>{area.title}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        {!!area.description && (
          <View style={styles.descCard}>
            <Text style={styles.descLabel}>OVERVIEW</Text>
            <Text style={styles.descText}>{area.description}</Text>
          </View>
        )}

        {/* Islamic Foundation */}
        {!!area.islamicFoundation && (
          <View style={styles.islamicCard}>
            <View style={styles.islamicCardHeader}>
              <Ionicons name="moon" size={14} color="#C9A84C" />
              <Text style={styles.islamicCardLabel}>ISLAMIC FOUNDATION</Text>
            </View>
            <Text style={styles.islamicCardText}>{area.islamicFoundation}</Text>
          </View>
        )}

        {/* Parent's input */}
        {(area.issue || area.parentAnalysis) && (
          <View style={styles.inputCard}>
            <Text style={styles.inputCardLabel}>YOUR INPUT</Text>
            {!!area.issue && (
              <>
                <Text style={styles.inputFieldLabel}>The challenge</Text>
                <Text style={styles.inputFieldText}>{area.issue}</Text>
              </>
            )}
            {!!area.parentAnalysis && (
              <>
                <View style={styles.inputDivider} />
                <Text style={styles.inputFieldLabel}>Your insight</Text>
                <Text style={styles.inputFieldText}>{area.parentAnalysis}</Text>
              </>
            )}
          </View>
        )}

        {/* Week tabs */}
        {weeks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>4-WEEK PLAN</Text>
            <View style={styles.weekTabs}>
              {weeks.map((w, i) => {
                const active = activeWeek === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.weekTab, active && styles.weekTabActive]}
                    onPress={() => { setActiveWeek(i); setExpandedWisdom(new Set()); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.weekTabText, active && styles.weekTabTextActive]}>
                      W{w.week ?? (i + 1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {week && (
              <>
                {/* Week theme */}
                <View style={styles.weekThemeBar}>
                  <View style={styles.weekThemeDot} />
                  <Text style={styles.weekThemeText}>{week.theme}</Text>
                </View>

                {/* Islamic principle for this week */}
                {!!week.islamicPrinciple && (
                  <View style={styles.weekIslamicBar}>
                    <Ionicons name="moon-outline" size={13} color="#C9A84C" />
                    <Text style={styles.weekIslamicText}>{week.islamicPrinciple}</Text>
                  </View>
                )}

                {/* Habits */}
                {week.habits?.length > 0 && (
                  <>
                    <View style={styles.typeHeader}>
                      <View style={styles.typeIconWrap}>
                        <Ionicons name="repeat-outline" size={14} color="#1B4D3E" />
                      </View>
                      <View>
                        <Text style={styles.typeTitle}>Habits to Build</Text>
                        <Text style={styles.typeSub}>Repeat daily this week</Text>
                      </View>
                    </View>
                    {week.habits.map((item, i) => renderItem({ item, index: i, type: 'habit' }))}
                  </>
                )}

                {/* Activities */}
                {week.activities?.length > 0 && (
                  <>
                    <View style={[styles.typeHeader, { marginTop: 20 }]}>
                      <View style={[styles.typeIconWrap, styles.typeIconActivity]}>
                        <Ionicons name="color-palette-outline" size={14} color="#92400E" />
                      </View>
                      <View>
                        <Text style={[styles.typeTitle, { color: '#92400E' }]}>Activities to Try</Text>
                        <Text style={[styles.typeSub, { color: '#B45309' }]}>Pick one or do them all</Text>
                      </View>
                    </View>
                    {week.activities.map((item, i) => renderItem({ item, index: i, type: 'activity' }))}
                  </>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#1B3D2F' },
  scroll: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: '#1B3D2F',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2, flexShrink: 0,
  },
  headerMid:    { flex: 1 },
  headerEyebrow: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 28 },

  // Description
  descCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 18, marginBottom: 12, ...CARD_SHADOW,
  },
  descLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 8 },
  descText:  { fontSize: 14, color: '#374151', lineHeight: 22 },

  // Islamic foundation card
  islamicCard: {
    backgroundColor: '#FFFBF0', borderRadius: 16,
    padding: 18, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: '#C9A84C',
    ...CARD_SHADOW,
  },
  islamicCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  islamicCardLabel: {
    fontSize: 10, fontWeight: '700', color: '#B45309', letterSpacing: 1.2,
  },
  islamicCardText: { fontSize: 14, color: '#374151', lineHeight: 22 },

  // Weekly Islamic principle bar
  weekIslamicBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFFBF0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1, borderColor: '#F5DFB8',
  },
  weekIslamicText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18, fontStyle: 'italic' },

  // Parent input card
  inputCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 18, marginBottom: 20, ...CARD_SHADOW,
    borderLeftWidth: 3, borderLeftColor: '#2E7D62',
  },
  inputCardLabel:  { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 14 },
  inputFieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 6 },
  inputFieldText:  { fontSize: 13, color: '#374151', lineHeight: 20 },
  inputDivider:    { height: 1, backgroundColor: '#F0F1F3', marginVertical: 14 },

  // Section label
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 12 },

  // Week tabs
  weekTabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  weekTab: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    ...CARD_SHADOW,
  },
  weekTabActive:     { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  weekTabText:       { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  weekTabTextActive: { color: '#FFFFFF' },

  // Week theme
  weekThemeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E6F4ED', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20,
  },
  weekThemeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E7D62' },
  weekThemeText: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },

  // Section type header
  typeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  typeIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#C6E8D4', alignItems: 'center', justifyContent: 'center',
  },
  typeIconActivity: { backgroundColor: '#FDE8C8' },
  typeTitle: { fontSize: 14, fontWeight: '800', color: '#1B4D3E', marginBottom: 1 },
  typeSub:   { fontSize: 11, fontWeight: '500', color: '#2E7D62' },

  // Item cards
  itemCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderLeftWidth: 3, ...CARD_SHADOW,
  },
  itemTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  itemBadge: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemBadgeNum: { fontSize: 12, fontWeight: '800' },
  itemText: { flex: 1, fontSize: 13, color: '#1A1A2E', lineHeight: 20 },

  // Wisdom
  wisdomToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingTop: 2, paddingBottom: 4,
  },
  wisdomToggleText: { fontSize: 12, fontWeight: '600', flex: 1 },
  wisdomPanel: {
    marginTop: 8, borderRadius: 10, padding: 12,
    borderLeftWidth: 3,
  },
  wisdomText: { fontSize: 12, lineHeight: 19 },
});
