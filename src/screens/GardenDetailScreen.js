import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MannerGarden from '../components/MannerGarden';
import { getCachedSyncStatus } from '../utils/familySync';
import { getAllChildProfiles } from '../utils/childProfiles';

export default function GardenDetailScreen({ route, navigation }) {
  const { tree } = route.params;

  const [myProfileName, setMyProfileName] = useState('');
  const [partnerLinked, setPartnerLinked] = useState(false);
  const [childColor,    setChildColor]    = useState(tree.child_color ?? null);

  useEffect(() => {
    AsyncStorage.getItem('tarbiyah_profile').then(raw => {
      if (raw) setMyProfileName(JSON.parse(raw).name?.split(' ')[0] ?? '');
    });
    getCachedSyncStatus().then(s => setPartnerLinked(!!s?.linked));
    // Try to pick up the local color if this child exists in the user's profiles
    getAllChildProfiles().then(profiles => {
      const match = profiles.find(p => p.id === tree.child_id);
      if (match?.color) setChildColor(match.color);
    });
  }, []);

  const child = {
    id:     tree.child_id,
    name:   tree.child_name,
    gender: tree.child_gender ?? null,
    color:  childColor,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{tree.child_name}'s Garden</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <MannerGarden
          child={child}
          myProfileName={myProfileName}
          partnerLinked={partnerLinked}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F5F5F5' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  scroll:      { padding: 16, paddingBottom: 48 },
});
