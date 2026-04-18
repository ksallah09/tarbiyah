import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

export default function OnboardingName({ navigation, route }) {
  const insets      = useSafeAreaInsets();
  const data        = route.params ?? {};
  const [name, setName]       = useState('');
  const [ready, setReady]     = useState(false);
  const inputOpacity          = useRef(new Animated.Value(0)).current;
  const inputRef              = useRef(null);

  function handleComplete() {
    setReady(true);
    Animated.timing(inputOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start(() => inputRef.current?.focus());
  }

  function handleNext() {
    if (!name.trim()) return;
    navigation.navigate('OnboardingChildren', { ...data, name: name.trim() });
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1B3D2F', '#0D2419']}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
            <ProgressDots current={0} total={5} />

            <View style={styles.textWrap}>
              <TypewriterText
                lines={['What should\nwe call you?']}
                charDelay={30}
                style={styles.question}
                onComplete={handleComplete}
              />
            </View>

            <Animated.View style={[styles.inputWrap, { opacity: inputOpacity }]}>
              <View>
                {!name && <Text style={styles.inputPlaceholder} pointerEvents="none">Your name...</Text>}
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder=""
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                />
              </View>
              <TouchableOpacity
                style={[styles.btn, !name.trim() && styles.btnDisabled]}
                onPress={handleNext}
                activeOpacity={0.85}
                disabled={!name.trim()}
              >
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signInLink}
                onPress={() => navigation.navigate('OnboardingAccount', { isReturningUser: true })}
              >
                <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  question: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  inputWrap: {
    gap: 16,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '500',
    paddingVertical: 12,
    paddingHorizontal: 4,
    letterSpacing: 0,
  },
  inputPlaceholder: {
    position: 'absolute',
    top: 12,
    left: 4,
    fontSize: 22,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0,
    pointerEvents: 'none',
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.3,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
  },
  
  signInLink: { alignItems: 'center', paddingVertical: 12 },
  signInLinkText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
