import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';
import { saveOnboardingData, resetOnboarding, markOnboardingComplete } from '../../utils/onboarding';
import { useAuth } from '../../../App';
import { saveFocusAreas } from '../../utils/focusAreas';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signUp, signIn, signInWithApple, signInWithGoogle } from '../../utils/auth';
import { saveProfileToSupabase, syncProfileFromSupabase } from '../../utils/profile';
import { syncModulesFromRemote } from '../../utils/modules';
import { syncReadHistoryFromRemote } from '../../utils/readInsights';
import { syncGoalHistoryFromRemote } from '../../utils/goalHistory';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingAccount({ navigation, route }) {
  const insets            = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  const data              = route.params ?? {};
  const isReturningUser   = data.isReturningUser ?? false;
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [ready, setReady]       = useState(false);
  const contentOpacity          = useRef(new Animated.Value(0)).current;
  const passwordRef             = useRef(null);

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }

  async function persistOnboardingData(userId) {
    await Promise.all([
      saveOnboardingData({
        name: data.name,
        childrenCount: data.childrenCount,
        childrenAges: data.childrenAges,
        reminderTime: data.reminderTime,
        email: email.trim().toLowerCase(),
        complete: true,
      }),
      saveFocusAreas(data.focusAreas ?? []),
      AsyncStorage.setItem('tarbiyah_profile', JSON.stringify({
        name: data.name,
        children: data.childrenCount,
        childrenAges: data.childrenAges,
        reminderTime: data.reminderTime,
        familyStructure: data.familyStructure ?? 'prefer_not_to_say',
        language: 'English',
      })),
      userId && saveProfileToSupabase({
        userId,
        name:            data.name,
        childrenCount:   data.childrenCount,
        childrenAges:    data.childrenAges,
        reminderTime:    data.reminderTime,
        focusAreas:      data.focusAreas ?? [],
        familyStructure: data.familyStructure ?? 'prefer_not_to_say',
        language:        'English',
      }),
    ].filter(Boolean));
  }

  async function handleCreate() {
    const emailVal = email.trim().toLowerCase();
    if (!emailVal || !password) {
      Alert.alert('Required', 'Please enter your email and a password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { user, error } = await signUp(emailVal, password);
      if (error) {
        const alreadyExists = error.message?.toLowerCase().includes('already registered')
          || error.message?.toLowerCase().includes('already exists')
          || error.status === 422;
        if (alreadyExists) {
          Alert.alert(
            'Account Already Exists',
            'An account with this email already exists. Would you like to sign in instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => handleSignIn() },
            ]
          );
        } else {
          Alert.alert('Sign Up Failed', error.message);
        }
        return;
      }
      await persistOnboardingData(user?.id);
      navigation.navigate('OnboardingAllSet', { name: data.name });
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Sync all user data from Supabase after sign-in (fire-and-forget)
  function syncAllUserData(userId) {
    syncModulesFromRemote().catch(() => {});
    syncReadHistoryFromRemote().catch(() => {});
    syncGoalHistoryFromRemote().catch(() => {});
  }

  // After returning-user sign-in: sync from Supabase.
  // If no profile row exists the account is new or was deleted —
  // show an alert, then on dismiss sign out, clear local data, and restart onboarding.
  async function finishReturningSignIn(userId) {
    const synced = await syncProfileFromSupabase(userId);
    if (!synced) {
      Alert.alert(
        'No Account Found',
        "We couldn't find a profile linked to this sign-in. Please create a new account to get started.",
        [{
          text: 'OK',
          onPress: async () => {
            await Promise.all([
              signOut(),
              resetOnboarding(),
              AsyncStorage.multiRemove(['tarbiyah_profile', 'tarbiyah_focus_areas']),
            ]);
            navigation.popToTop();
          },
        }]
      );
      return;
    }
    syncAllUserData(userId);
    await markOnboardingComplete();
    completeOnboarding();
  }

  // For Apple/Google sign-ups: the auth call is an upsert, so it succeeds
  // even if the account already exists. Check for an existing profile first —
  // if found, restore it and go to the app; if not, save onboarding data as normal.
  async function finishNewSignUp(userId) {
    const alreadyHasProfile = await syncProfileFromSupabase(userId);
    if (alreadyHasProfile) {
      syncAllUserData(userId);
      Alert.alert(
        'Welcome Back',
        'You already have an account. We\'ve signed you in.',
        [{ text: 'OK', onPress: async () => { await markOnboardingComplete(); completeOnboarding(); } }]
      );
      return;
    }
    await persistOnboardingData(userId);
    navigation.navigate('OnboardingAllSet', { name: data.name });
  }

  async function handleSignIn() {
    const emailVal = email.trim().toLowerCase();
    if (!emailVal || !password) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { user, error } = await signIn(emailVal, password);
      if (error) {
        Alert.alert('Sign In Failed', error.message);
        return;
      }
      await finishReturningSignIn(user.id);
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    setLoading(true);
    try {
      const { user, error } = await signInWithApple();
      if (error) { Alert.alert('Apple Sign In Failed', error.message); return; }
      if (!user) return; // dismissed
      if (isReturningUser) {
        await finishReturningSignIn(user.id);
      } else {
        await finishNewSignUp(user.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { user, error } = await signInWithGoogle();
      if (error) { Alert.alert('Google Sign In Failed', error.message); return; }
      if (!user) return; // dismissed
      if (isReturningUser) {
        await finishReturningSignIn(user.id);
      } else {
        await finishNewSignUp(user.id);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <ScrollView
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={5} total={6} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={[isReturningUser ? 'Welcome back.' : 'Create your\naccount.']}
              charDelay={30}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={[styles.form, { opacity: contentOpacity }]}>

            {/* Social buttons */}
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={styles.appleBtn}
              onPress={handleApple}
            />

            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} activeOpacity={0.85}>
              <Ionicons name="logo-google" size={18} color="#1B3D2F" style={{ marginRight: 10 }} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or use email</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View>
                {!email && <Text style={styles.inputPlaceholder} pointerEvents="none">you@example.com</Text>}
                <TextInput
                  style={styles.input}
                  placeholder=""
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>
                {isReturningUser ? 'PASSWORD' : 'CREATE A PASSWORD'}
              </Text>
              <View>
                {!password && (
                  <Text style={styles.inputPlaceholder} pointerEvents="none">
                    {isReturningUser ? 'Enter your password' : 'Choose a password (min. 6 characters)'}
                  </Text>
                )}
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder=""
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={isReturningUser ? handleSignIn : handleCreate}
                />
              </View>
            </View>

            {!isReturningUser && (
              <Text style={styles.privacy}>
                Your data is private and never sold.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.btn, (!email || !password) && styles.btnDisabled]}
              onPress={isReturningUser ? handleSignIn : handleCreate}
              activeOpacity={0.85}
              disabled={loading || !email || !password}
            >
              {loading
                ? <ActivityIndicator color="#1B3D2F" />
                : <Text style={styles.btnText}>{isReturningUser ? 'Sign In' : 'Create Account'}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  textWrap: {
    marginBottom: 36,
  },
  question: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  form: {
    flex: 1,
    gap: 20,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.6,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    paddingVertical: 10,
    paddingHorizontal: 2,
    letterSpacing: 0,
  },
  inputPlaceholder: {
    position: 'absolute',
    top: 10,
    left: 2,
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0,
    pointerEvents: 'none',
  },
  appleBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B3D2F',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.2,
  },
  privacy: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '400',
    marginTop: -8,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.3 },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
  },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
