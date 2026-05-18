import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedSyncStatus } from '../utils/familySync';
import { getMonthReadDays } from '../utils/readInsights';
import { getPartnerMonthCounts } from '../utils/readInsights';
import { getWeekCompletions, getMonthlyHabitActivityTotals, getPartnerMonthCompletions } from '../utils/childCompletions';

const ROWS_CONFIG = [
  { label: 'Spiritual',   icon: 'moon',                  color: '#4ADE80' },
  { label: 'Research',    icon: 'bulb-outline',          color: '#F59E0B' },
  { label: 'Quran',       icon: 'book-outline',          color: '#93C5FD' },
  { label: 'Habits',      icon: 'repeat-outline',        color: '#86EFAC' },
  { label: 'Activities',  icon: 'color-palette-outline', color: '#FCD34D' },
];

export default function LeaderboardCard({ navigation }) {
  const [syncStatus,    setSyncStatus]    = useState({ linked: false, partner: null });
  const [partnerSyncOn, setPartnerSyncOn] = useState(true);
  const [spirMonth,     setSpiritualMonth]   = useState([]);
  const [sciMonth,      setScientificMonth]  = useState([]);
  const [quranMonth,    setQuranMonth]       = useState([]);
  const [myHabAct,      setMyHabAct]      = useState({ habits: 0, activities: 0 });
  const [partnerCounts, setPartnerCounts] = useState({ spiritual: 0, scientific: 0, quran: 0 });
  const [prtHabAct,     setPrtHabAct]     = useState({ habits: 0, activities: 0 });

  useEffect(() => {
    AsyncStorage.getItem('tarbiyah_partner_sync_on').then(val => {
      if (val === 'false') setPartnerSyncOn(false);
    });

    getMonthReadDays('spiritual').then(setSpiritualMonth);
    getMonthReadDays('scientific').then(setScientificMonth);
    getMonthReadDays('quran').then(setQuranMonth);
    getWeekCompletions().then(counts => setMyHabAct(getMonthlyHabitActivityTotals(counts)));

    getCachedSyncStatus().then(status => {
      setSyncStatus(status);
      if (status?.linked && status?.partner?.userId) {
        getPartnerMonthCounts(status.partner.userId).then(setPartnerCounts);
        getPartnerMonthCompletions(status.partner.userId).then(setPrtHabAct);
      }
    });
  }, []);

  if (!partnerSyncOn) return null;

  const partnerFirstName = syncStatus?.partner?.name?.split(' ')[0] ?? 'Partner';
  const mySpir   = spirMonth.filter(d => d.completed).length;
  const mySci    = sciMonth.filter(d => d.completed).length;
  const myQuran  = quranMonth.filter(d => d.completed).length;
  const myTotal  = mySpir + mySci + myQuran + myHabAct.habits + myHabAct.activities;
  const prtTotal = partnerCounts.spiritual + partnerCounts.scientific + partnerCounts.quran + prtHabAct.habits + prtHabAct.activities;

  const ROWS = [
    { ...ROWS_CONFIG[0], my: mySpir,             partner: partnerCounts.spiritual },
    { ...ROWS_CONFIG[1], my: mySci,              partner: partnerCounts.scientific },
    { ...ROWS_CONFIG[2], my: myQuran,            partner: partnerCounts.quran },
    { ...ROWS_CONFIG[3], my: myHabAct.habits,    partner: prtHabAct.habits },
    { ...ROWS_CONFIG[4], my: myHabAct.activities,partner: prtHabAct.activities },
  ];

  // ── Locked (not synced) ──
  if (!syncStatus.linked) {
    return (
      <>
        <View style={s.sectionHeader}>
          <Text style={s.sectionEyebrow}>FAMILY LOG</Text>
          <Text style={s.sectionTitle}>Monthly Leaderboard</Text>
          <Text style={s.sectionSub}>How you and your partner are doing this month</Text>
        </View>
        <View style={s.card}>
        <View style={s.headerRow}>
          <Ionicons name="trophy" size={13} color="#C9A84C" />
          <Text style={s.headerText}>MONTHLY LEADERBOARD</Text>
          <View style={s.lockPill}>
            <Ionicons name="lock-closed" size={9} color="#C9A84C" />
            <Text style={s.lockText}>Sync to unlock</Text>
          </View>
        </View>
        <View style={s.colRow}>
          <Text style={s.colLabel}>YOU</Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.colLabel, { color: 'rgba(255,255,255,0.25)' }]}>PARTNER</Text>
        </View>
        {ROWS_CONFIG.map(({ label, icon, color }) => (
          <View key={label} style={s.row}>
            <Text style={s.score}>{(() => {
              if (label === 'Habits')     return myHabAct.habits;
              if (label === 'Activities') return myHabAct.activities;
              const idx = ['Spiritual','Research','Quran'].indexOf(label);
              return idx >= 0 ? [mySpir, mySci, myQuran][idx] : '—';
            })()}</Text>
            <View style={s.mid}>
              <View style={s.barWrap}>
                <View style={[s.barFill, s.barLeft, { width: '60%', backgroundColor: color + '55' }]} />
              </View>
              <View style={[s.catPill, { backgroundColor: color + '22' }]}>
                <Ionicons name={icon} size={10} color={color} />
                <Text style={[s.catText, { color }]}>{label}</Text>
              </View>
              <View style={[s.barWrap, { opacity: 0.25 }]}>
                <View style={[s.barFill, s.barRight, { width: '40%', backgroundColor: '#FFFFFF' }]} />
              </View>
            </View>
            <Text style={[s.score, { color: 'rgba(255,255,255,0.15)' }]}>?</Text>
          </View>
        ))}
        <View style={s.divider} />
        <TouchableOpacity style={s.unlockBtn} onPress={() => navigation.navigate('FamilySync')} activeOpacity={0.85}>
          <Ionicons name="people-outline" size={14} color="#1B3D2F" />
          <Text style={s.unlockText}>Sync with your partner to see the leaderboard</Text>
        </TouchableOpacity>
      </View>
      </>
    );
  }

  // ── Live ──
  const winnerData = myTotal > prtTotal
    ? { text: "You're leading — Ma Shaa Allah!",              icon: 'trophy',         iconColor: '#C9A84C' }
    : prtTotal > myTotal
      ? { text: `${partnerFirstName} is leading — keep going!`, icon: 'barbell-outline', iconColor: '#86EFAC' }
      : { text: "You're tied — great effort, both of you!",     icon: 'people-outline',  iconColor: '#93C5FD' };

  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionEyebrow}>FAMILY LOG</Text>
        <Text style={s.sectionTitle}>Monthly Leaderboard</Text>
        <Text style={s.sectionSub}>How you and your partner are doing this month</Text>
      </View>
      <View style={s.card}>
      <View style={s.headerRow}>
        <Ionicons name="trophy" size={13} color="#C9A84C" />
        <Text style={s.headerText}>MONTHLY LEADERBOARD</Text>
      </View>
      <View style={s.colRow}>
        <Text style={s.colLabel}>YOU</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.colLabel}>{partnerFirstName.toUpperCase()}</Text>
      </View>
      {ROWS.map(({ label, icon, color, my, partner }) => {
        const max = Math.max(my, partner, 1);
        return (
          <View key={label} style={s.row}>
            <Text style={[s.score, my > partner && s.scoreWin]}>{my}</Text>
            <View style={s.mid}>
              <View style={s.barWrap}>
                <View style={[s.barFill, s.barLeft, { width: `${(my / max) * 100}%`, backgroundColor: color + 'CC' }]} />
              </View>
              <View style={[s.catPill, { backgroundColor: color + '22' }]}>
                <Ionicons name={icon} size={10} color={color} />
                <Text style={[s.catText, { color }]}>{label}</Text>
              </View>
              <View style={s.barWrap}>
                <View style={[s.barFill, s.barRight, { width: `${(partner / max) * 100}%`, backgroundColor: color + 'CC' }]} />
              </View>
            </View>
            <Text style={[s.score, partner > my && s.scoreWin]}>{partner}</Text>
          </View>
        );
      })}
      <View style={s.divider} />
      <View style={s.totalRow}>
        <Text style={[s.totalNum, myTotal >= prtTotal && myTotal > 0 && s.scoreWin]}>{myTotal}</Text>
        <Text style={s.totalLabel}>TOTAL</Text>
        <Text style={[s.totalNum, prtTotal > myTotal && s.scoreWin]}>{prtTotal}</Text>
      </View>
      <View style={s.winnerRow}>
        <Ionicons name={winnerData.icon} size={13} color={winnerData.iconColor} />
        <Text style={s.winner}>{winnerData.text}</Text>
      </View>
    </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionHeader: { marginTop: 20, marginBottom: 0 },
  sectionEyebrow:{ fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  sectionSub:    { fontSize: 12, color: '#9CA3AF' },

  card:       { backgroundColor: '#1B3D2F', borderRadius: 18, padding: 18, marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 5 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  headerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#C9A84C' },
  lockPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto' },
  lockText:   { fontSize: 10, fontWeight: '700', color: '#C9A84C' },
  colRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  colLabel:   { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  score:      { width: 28, fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  scoreWin:   { color: '#FFFFFF' },
  mid:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  barWrap:    { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 2 },
  barLeft:    { alignSelf: 'flex-end' },
  barRight:   { alignSelf: 'flex-start' },
  catPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catText:    { fontSize: 10, fontWeight: '700' },
  divider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
  totalRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  totalNum:   { width: 28, fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  totalLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 1 },
  winnerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  winner:     { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  unlockBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#C9A84C', borderRadius: 12, paddingVertical: 11, marginTop: 4 },
  unlockText: { fontSize: 12, fontWeight: '700', color: '#1B3D2F' },
});
