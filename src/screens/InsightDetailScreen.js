import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { saveInsight, unsaveInsight, isInsightSaved } from '../utils/savedInsights';
import { markAsRead, isReadToday } from '../utils/readInsights';

const ASSET_MAP = {
  'Nouman Ali Khan.png':              require('../../assets/Nouman Ali Khan.png'),
  'YAsmin-MOgahed.png':               require('../../assets/YAsmin-MOgahed.png'),
  'belal-assaad.jpg':                 require('../../assets/belal-assaad.jpg'),
  'national-inst-child-health.jpeg':  require('../../assets/national-inst-child-health.jpeg'),
  'childmind.png':                    require('../../assets/childmind.png'),
  'spiritual-insights.png':           require('../../assets/spiritual-insights.png'),
  'science-insights.png':             require('../../assets/science-insights.png'),
};

const SPIRITUAL_GRADIENT = ['#6B7C45', '#1B3D2F'];
const SCIENCE_GRADIENT   = ['#D4A55A', '#A0521A'];

export default function InsightDetailScreen({ route, navigation }) {
  const { insight } = route.params;
  const [saved, setSaved] = useState(false);
  const [read, setRead]   = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    isInsightSaved(insight.id).then(setSaved);
    isReadToday(insight.type, insight.id).then(setRead);
  }, [insight.id, insight.type]);

  async function handleMarkRead() {
    await markAsRead(insight.type, insight.id);
    setRead(true);
  }

  async function toggleSave() {
    if (saved) {
      await unsaveInsight(insight.id);
      setSaved(false);
    } else {
      await saveInsight(insight);
      setSaved(true);
    }
  }

  async function handleShare() {
    const text = `${insight.insightTitle}\n\n${insight.body}\n\n— ${insight.speakerName}\n\nShared from Tarbiyah`;
    await Share.share({ message: text });
  }

  const isSpiritual = insight.type === 'spiritual';
  const gradient    = isSpiritual ? SPIRITUAL_GRADIENT : SCIENCE_GRADIENT;
  const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
  const typeLabel   = isSpiritual ? 'Spiritual Insight' : 'Scientific Insight';
  const goalLabel   = isSpiritual ? 'Spiritual Goal' : 'Practical Goal';
  const goalIcon    = isSpiritual ? 'moon' : 'bulb-outline';

  const sourceIcon =
    insight.sourceDetail?.sourceType === 'youtube' ? 'logo-youtube' :
    insight.sourceDetail?.sourceType === 'pdf'     ? 'document-text-outline' :
    'globe-outline';
  const sourceTypeLabel =
    insight.sourceDetail?.sourceType === 'youtube' ? 'YouTube' :
    insight.sourceDetail?.sourceType === 'pdf'     ? 'PDF' : 'Article';

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={toggleSave}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{typeLabel}</Text>
        </View>

        {insight.insightTitle ? (
          <Text style={styles.headerInsightTitle}>{insight.insightTitle}</Text>
        ) : null}

        <Text style={styles.headerSubtitle}>{insight.dailyInsight}</Text>
      </LinearGradient>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Key Takeaway ── */}
        <Text style={[styles.sectionLabel, { color: accentColor }]}>KEY TAKEAWAY</Text>
        <Text style={styles.bodyText}>{insight.body}</Text>

        <View style={styles.divider} />

        {/* ── Action step ── */}
        {insight.actionStep && (
          <>
            <View style={[styles.goalRow, { borderLeftWidth: 3, borderLeftColor: accentColor, paddingHorizontal: 12 }]}>
              <View style={styles.goalContent}>
                <View style={styles.goalMeta}>
                  <Ionicons name={goalIcon} size={12} color={accentColor} />
                  <Text style={[styles.goalMetaLabel, { color: accentColor }]}>{goalLabel}</Text>
                </View>
                <Text style={styles.goalText}>{insight.actionStep}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </>
        )}

        <TouchableOpacity
          style={[styles.readBtn, { backgroundColor: read ? '#E8F5EF' : accentColor }]}
          onPress={handleMarkRead}
          activeOpacity={read ? 1 : 0.82}
          disabled={read}
        >
          <Ionicons
            name={read ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={22}
            color={read ? accentColor : '#FFFFFF'}
          />
          <Text style={[styles.readBtnText, { color: read ? accentColor : '#FFFFFF' }]}>
            {read ? 'You read this' : 'Mark as Read'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* ── Source attribution ── */}
        {insight.sourceDetail && (
          <>
            <View style={styles.sourceBlock}>
              <View style={styles.sourceTopRow}>
                <Text style={styles.sourceExtractedLabel}>AI-EXTRACTED INSIGHT FROM</Text>
                <View style={[styles.sourceTypeBadge, { backgroundColor: accentColor + '15' }]}>
                  <Ionicons name={sourceIcon} size={11} color={accentColor} />
                  <Text style={[styles.sourceTypeBadgeText, { color: accentColor }]}>
                    {sourceTypeLabel}
                  </Text>
                </View>
              </View>
              <Text style={styles.sourceTitle}>"{insight.sourceDetail.sourceTitle}"</Text>
              <View style={styles.sourceByline}>
                <Image
                  source={ASSET_MAP[insight.speakerImage] ?? ASSET_MAP['spiritual-insights.png']}
                  style={styles.sourceBylineImage}
                />
                <Text style={styles.sourceBylineName}>{insight.sourceDetail?.speakerOrAuthor ?? insight.speakerName}</Text>
              </View>
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* ── Tags ── */}
        {insight.tags?.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: accentColor }]}>TOPICS</Text>
            <View style={styles.tagsRow}>
              {insight.tags.map(tag => (
                <View key={tag} style={[styles.tag, { backgroundColor: accentColor + '15' }]}>
                  <Text style={[styles.tagText, { color: accentColor }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  // ── Header ──
  header: {
    paddingHorizontal: 22,
    paddingBottom: 30,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerInsightTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 31,
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // ── Scroll ──
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 22, paddingTop: 28 },

  // ── Section label ──
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 12,
  },

  // ── Body ──
  bodyText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 28,
    marginBottom: 4,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: '#F0F1F3',
    marginVertical: 24,
  },

  // ── Goal ──
  goalRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  checkboxGreen:     { borderColor: '#2E7D62' },
  checkboxAmber:     { borderColor: '#D4871A' },
  checkboxGreenDone: { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  checkboxAmberDone: { backgroundColor: '#D4871A', borderColor: '#D4871A' },
  goalContent: { flex: 1 },
  goalMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  goalMetaLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  goalText: { fontSize: 16, color: '#1C1C1E', lineHeight: 28 },
  goalTextDone: { color: '#A0ADB8', textDecorationLine: 'line-through' },

  // ── Tags ──
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12, fontWeight: '600' },

  // ── Mark as Read ──
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  readBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Source block ──
  sourceBlock: {
    gap: 10,
  },
  sourceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceExtractedLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#9CA3AF',
  },
  sourceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  sourceTypeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  sourceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 22,
  },
  sourceByline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sourceBylineImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sourceBylineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
    flexWrap: 'wrap',
  },
});
