import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function EncouragementModal({ visible, emoji, title, body, onClose }) {
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.card}>
          <Text style={s.emoji}>{emoji}</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnText}>Alhamdulillah 🤲</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card:    { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  emoji:   { fontSize: 48, marginBottom: 10 },
  title:   { fontSize: 24, fontWeight: '800', color: '#1B3D2F', marginBottom: 10 },
  body:    { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn:     { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
