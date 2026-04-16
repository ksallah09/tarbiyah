import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Linking,
  ImageBackground,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { saveInsight, unsaveInsight, isInsightSaved } from '../utils/savedInsights';
import { markAsRead, isReadToday } from '../utils/readInsights';

const SPIRITUAL_IMAGES = [
  require('../../assets/spiritual-1.jpg'),
  require('../../assets/spiritual-2.jpg'),
  require('../../assets/spiritual-3.jpg'),
  require('../../assets/spiritual-4.jpg'),
  require('../../assets/spiritual-5.jpg'),
  require('../../assets/spiritual-7.jpg'),
];

const SCIENCE_IMAGES = [
  require('../../assets/science-1.jpg'),
  require('../../assets/science-2.jpg'),
  require('../../assets/science-3.jpg'),
  require('../../assets/science-4.jpg'),
  require('../../assets/science-5.jpg'),
  require('../../assets/science-6.jpg'),
  require('../../assets/science-7.jpg'),
];


export default function InsightDetailScreen({ route, navigation }) {
  const { insight, imgIndex = Math.floor(Date.now() / 86_400_000) } = route.params;
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

  const isSpiritual  = insight.type === 'spiritual';
  const accentColor  = isSpiritual ? '#2E7D62' : '#D4871A';
  const headerImage  = isSpiritual
    ? SPIRITUAL_IMAGES[imgIndex % SPIRITUAL_IMAGES.length]
    : SCIENCE_IMAGES[(imgIndex + 1) % SCIENCE_IMAGES.length];
  const overlayColors = isSpiritual
    ? ['rgba(10,30,20,0.35)', 'rgba(10,30,20,0.82)']
    : ['rgba(30,15,5,0.35)', 'rgba(30,15,5,0.82)'];
  const typeLabel   = isSpiritual ? 'Spiritual Insight' : 'Research Insight';
  const goalLabel   = isSpiritual ? 'Spiritual Tip' : 'Practical Tip';
  const goalIcon    = isSpiritual ? 'moon' : 'bulb-outline';

  const sourceIcon =
    insight.sourceDetail?.sourceType === 'youtube' ? 'logo-youtube' :
    insight.sourceDetail?.sourceType === 'pdf'     ? 'document-text-outline' :
    'globe-outline';


  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Image Header ── */}
      <ImageBackground
        source={headerImage}
        style={styles.header}
        imageStyle={styles.headerImg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={overlayColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.headerOverlay, { paddingTop: insets.top + 12 }]}
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
      </ImageBackground>

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
              <Text style={styles.sourceExtractedLabel}>THIS INSIGHT WAS INSPIRED BY</Text>
              <Text style={styles.sourceTitle}>"{insight.sourceDetail.sourceTitle}"</Text>
              {insight.sourceDetail?.speakerOrAuthor ? (
                <Text style={styles.sourceBylineName}>{insight.sourceDetail.speakerOrAuthor}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.sourceLink, { borderColor: accentColor + '40', backgroundColor: accentColor + '08' }]}
                onPress={() => {
                  const url = insight.sourceDetail?.sourceUrl ?? insight.source;
                  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                    Linking.openURL(url);
                  }
                }}
                activeOpacity={0.75}
              >
                <Ionicons name={sourceIcon} size={14} color={accentColor} />
                <Text style={[styles.sourceLinkText, { color: accentColor }]}>
                  View Source
                </Text>
                <Ionicons name="open-outline" size={13} color={accentColor} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
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
    overflow: 'hidden',
  },
  headerImg: {},
  headerOverlay: {
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
  sourceExtractedLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  sourceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 22,
  },
  sourceBylineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    flexWrap: 'wrap',
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  sourceLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
