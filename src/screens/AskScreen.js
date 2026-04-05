import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// For iOS simulator use localhost. For a real device, replace with your machine's local IP.
// e.g. 'http://192.168.1.x:3001'
const API_URL = 'http://localhost:3001';

const SUGGESTED_QUESTIONS = [
  'How do I build a strong connection with my child?',
  'What does Islam say about disciplining children?',
  'How can I help my child manage anger?',
  'How do I introduce Islamic values without pressure?',
  'What are healthy screen-time boundaries?',
];

export default function AskScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  async function sendMessage(text) {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    setInput('');
    const userMsg = { role: 'user', text: question };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);
    scrollToBottom();

    try {
      const history = updatedMessages.slice(0, -1).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });

      const data = await res.json();
      const answer = data.answer ?? data.error ?? 'Something went wrong. Please try again.';
      setMessages(prev => [...prev, { role: 'model', text: answer }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'model',
        text: 'Unable to connect. Make sure the chat server is running (`npm run server` in the backend folder).',
      }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom + 10}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Salaam Yusuf</Text>
          <Text style={styles.subtitle}>How can I support you?</Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setMessages([])}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Messages ── */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.messagesContent, isEmpty && styles.centerContent]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          {isEmpty ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles-outline" size={32} color="#2E7D62" />
              </View>
              <Text style={styles.emptyTitle}>Ask a parenting question</Text>
              <Text style={styles.emptyBody}>
                Get answers grounded in Islamic scholarship and child development research.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => sendMessage(q)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.suggestionText}>{q}</Text>
                    <Ionicons name="arrow-forward" size={12} color="#2E7D62" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.msgRow,
                  msg.role === 'user' ? styles.msgRowUser : styles.msgRowModel,
                ]}
              >
                {msg.role === 'model' && (
                  <View style={styles.avatarWrap}>
                    <Ionicons name="sparkles" size={14} color="#2E7D62" />
                  </View>
                )}
                <View style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleModel,
                ]}>
                  <Text style={[
                    styles.bubbleText,
                    msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextModel,
                  ]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))
          )}

          {loading && (
            <View style={[styles.msgRow, styles.msgRowModel]}>
              <View style={styles.avatarWrap}>
                <Ionicons name="sparkles" size={14} color="#2E7D62" />
              </View>
              <View style={[styles.bubble, styles.bubbleModel, styles.bubbleLoading]}>
                <ActivityIndicator size="small" color="#2E7D62" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Input ── */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask a parenting question..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1B3D2F', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', maxWidth: 240 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F0F1F3', marginTop: 6 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  // ── Scroll ──
  scroll: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingBottom: 12 },
  centerContent: { flex: 1, justifyContent: 'center' },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 20 },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#E8F5EF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  suggestions: { width: '100%', gap: 8 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  suggestionText: { fontSize: 13, color: '#374151', flex: 1, lineHeight: 20 },

  // ── Messages ──
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser:  { justifyContent: 'flex-end' },
  msgRowModel: { justifyContent: 'flex-start' },
  avatarWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E8F5EF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: {
    backgroundColor: '#1B3D2F',
    borderBottomRightRadius: 4,
  },
  bubbleModel: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  bubbleLoading: { paddingHorizontal: 18, paddingVertical: 14 },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  bubbleTextUser:  { color: '#FFFFFF' },
  bubbleTextModel: { color: '#1C1C1E' },

  // ── Input bar ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#F5F6F8',
    borderTopWidth: 1,
    borderTopColor: '#ECEDF0',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 14,
    color: '#1C1C1E',
    maxHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1B3D2F',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
});
