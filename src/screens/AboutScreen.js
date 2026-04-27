import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

function Section({ title, icon, iconBg, iconColor, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

function Paragraph({ children }) {
  return <Text style={styles.body}>{children}</Text>;
}

function BulletItem({ children }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const ISLAMIC_SOURCES = [
  { name: 'Sh. Ibrahim Hindy',  role: 'Keys to Prophetic Parenting series' },
  { name: 'Dr. Yasir Qadhi',   role: 'Parenting lectures & khutbahs' },
  { name: 'Yasmin Mogahed',     role: 'Family & spiritual wellbeing' },
  { name: 'Dr. Haifaa Younis',  role: 'Raising confident Muslim children' },
  { name: 'Yaqeen Institute',   role: 'Research-based Islamic parenting articles' },
  { name: 'Dr. Rania Awaad',    role: 'Muslim mental health & family wellbeing' },
  { name: 'Mufti Menk',         role: 'Parenting responsibilities in Islam' },
  { name: 'Zaynab Ansari',      role: 'Muslim women, family & spiritual development' },
  { name: 'Muhsen',             role: 'Inclusive parenting & special needs guidance' },
];

const RESEARCH_SOURCES = [
  { name: 'Child Mind Institute',             role: 'Child & teen mental health, behaviour & development' },
  { name: 'CDC',                              role: 'Centers for Disease Control — child development milestones' },
  { name: 'UC Davis Health',                  role: 'Clinical parenting & child development guidance' },
  { name: 'NIH / NICHD',                      role: 'Research-based parenting across developmental stages' },
  { name: 'American Academy of Pediatrics',   role: 'Clinical guidance on child health & development' },
];

function SourcesCard() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: '#F5F3FF' }]}>
          <Ionicons name="library-outline" size={16} color="#7C3AED" />
        </View>
        <Text style={styles.sectionTitle}>Our Sources</Text>
      </View>
      <View style={styles.sectionCard}>
        <Paragraph>
          Tarbiyah draws from the teachings of the following trusted Islamic and research sources. We have carefully curated these so that only credible, vetted knowledge shapes the guidance you receive.
        </Paragraph>
        <TouchableOpacity style={srcStyles.toggleBtn} onPress={() => setOpen(o => !o)} activeOpacity={0.75}>
          <Text style={srcStyles.toggleText}>{open ? 'Hide sources' : 'View all sources'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#7C3AED" />
        </TouchableOpacity>
        {open && (
          <View style={srcStyles.listWrap}>
            <Text style={srcStyles.sectionLabel}>ISLAMIC GUIDANCE</Text>
            {ISLAMIC_SOURCES.map(s => (
              <View key={s.name} style={srcStyles.sourceRow}>
                <View style={[srcStyles.sourceIcon, { backgroundColor: '#E8F5EF' }]}>
                  <Ionicons name="moon" size={13} color="#1B3D2F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={srcStyles.sourceName}>{s.name}</Text>
                  <Text style={srcStyles.sourceRole}>{s.role}</Text>
                </View>
              </View>
            ))}
            <Text style={[srcStyles.sectionLabel, { marginTop: 16 }]}>RESEARCH & DEVELOPMENT</Text>
            {RESEARCH_SOURCES.map(s => (
              <View key={s.name} style={srcStyles.sourceRow}>
                <View style={[srcStyles.sourceIcon, { backgroundColor: '#FDF3E3' }]}>
                  <Ionicons name="flask" size={13} color="#D4871A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={srcStyles.sourceName}>{s.name}</Text>
                  <Text style={srcStyles.sourceRole}>{s.role}</Text>
                </View>
              </View>
            ))}
            <View style={srcStyles.disclaimer}>
              <Ionicons name="information-circle" size={17} color="#065F46" />
              <Text style={srcStyles.disclaimerText}>
                Any benefit in this guidance is from Allah alone. Any error or limitation is from the AI — not from the scholars and sources above. The sources listed are research references only and do not constitute an endorsement or official affiliation with this app.
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const srcStyles = StyleSheet.create({
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  listWrap: { marginTop: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 10 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  sourceIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sourceName: { fontSize: 14, fontWeight: '700', color: '#374151' },
  sourceRole: { fontSize: 14, color: '#374151', lineHeight: 22, marginTop: 1 },
  disclaimer: { flexDirection: 'row', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 16, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontSize: 14, color: '#065F46', lineHeight: 22 },
});

export default function AboutScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheet}>

          {/* App intro */}
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>About Tarbiyah</Text>
            <Text style={styles.introBody}>
              Tarbiyah is designed to support Muslim parents with meaningful, accessible guidance for everyday family life. The app brings together spiritual reminders, parenting reflections, and practical insights to help families grow in faith, character, and connection.
            </Text>
            <Text style={[styles.introBody, { marginTop: 12 }]}>
              Our aim is to provide content that is beneficial, trustworthy, and relevant to the real challenges and opportunities of parenting today — whether the topic is character-building, emotional development, routines, communication, or family relationships. Tarbiyah seeks to offer guidance that is both spiritually grounded and practically useful.
            </Text>
          </View>

          {/* How content is developed */}
          <Section
            title="How Our Content Is Developed"
            icon="layers-outline"
            iconBg="#E8F5EF"
            iconColor="#2E7D62"
          >
            <Paragraph>
              Our content combines spiritual wisdom from the Islamic tradition with child-development research to provide parenting guidance that is both effective and meaningful. Depending on the feature, content may be summarised, adapted, or organised into short reflections, reminders, or guided learning modules.
            </Paragraph>
            <Paragraph style={{ marginTop: 12 }}>
              Tarbiyah draws from a range of trusted sources, which may include:
            </Paragraph>
            <View style={styles.bulletList}>
              <BulletItem>The Qur'an</BulletItem>
              <BulletItem>Authentic Hadith</BulletItem>
              <BulletItem>Contemporary lectures and teachings from trusted Muslim scholars and educators</BulletItem>
              <BulletItem>Reputable parenting and child-development research</BulletItem>
              <BulletItem>Classical Islamic scholarship</BulletItem>
            </View>
            <Paragraph>
              Where possible, Tarbiyah identifies or references the source material behind a piece of content so users can understand where the guidance comes from.
            </Paragraph>
            <Paragraph style={{ marginTop: 12 }}>
              We have carefully curated these sources so that only credible, vetted knowledge shapes the guidance you receive.
            </Paragraph>
          </Section>

          {/* Sources */}
          <SourcesCard />

          {/* Transparency */}
          <Section
            title="Our Approach"
            icon="shield-checkmark-outline"
            iconBg="#EEF2FF"
            iconColor="#4F46E5"
          >
            <Paragraph>
              We want Tarbiyah to be a source of genuine benefit and trust for Muslim parents. That is why we aim to be transparent about the foundations of our content.
            </Paragraph>
            <Paragraph>
              Tarbiyah does not claim to replace direct study with qualified scholars, nor does it position any piece of content as a substitute for personal consultation. Rather, it is a tool that helps parents access beneficial guidance in a clear, practical, and spiritually meaningful way.
            </Paragraph>
          </Section>

          {/* Disclaimer */}
          <Section
            title="Important Note"
            icon="information-circle-outline"
            iconBg="#FDF3E3"
            iconColor="#D4871A"
          >
            <Paragraph>
              Tarbiyah is intended for educational and personal benefit. It does not replace qualified scholarly, medical, psychological, legal, or professional advice. For sensitive or high-stakes matters, users should consult an appropriately qualified professional or scholar.
            </Paragraph>
          </Section>

          <Text style={styles.versionLabel}>Tarbiyah: Islamic Parenting · v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#1B3D2F',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  sheet: {
    flexGrow: 1,
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Intro card
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B3D2F',
    marginBottom: 12,
  },
  introBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  body: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },

  bulletList: { gap: 8, marginVertical: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D62',
    marginTop: 8,
    flexShrink: 0,
  },
  bulletText: { fontSize: 14, color: '#374151', lineHeight: 22, flex: 1 },

  versionLabel: {
    fontSize: 12,
    color: '#C4BDB4',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
  },
});
