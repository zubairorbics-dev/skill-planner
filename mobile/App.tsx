import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { auth } from './src/services/firebase';
import {
  ensureUserProfile,
  subscribeActiveRoadmap,
  subscribeRoadmapTasks,
  subscribeUserProfile,
} from './src/services/firestoreService';
import { usePlannerStore } from './src/store/usePlannerStore';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { RoadmapScreen } from './src/screens/RoadmapScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AppScreen } from './src/components/AppScreen';
import {
  INACTIVE_ACCOUNT_MESSAGE,
  isProfileActive,
} from './src/types/planner';
import { colors, radii, shadows } from './src/theme';

const Tab = createBottomTabNavigator();

function AppContent() {
  const insets = useSafeAreaInsets();
  const {
    user,
    authReady,
    profile,
    profileLoading,
    roadmap,
    showOnboarding,
    setUser,
    setAuthReady,
    setProfile,
    setProfileLoading,
    setRoadmap,
    setTasks,
    resetUserData,
  } = usePlannerStore();

  const [checkingVerify, setCheckingVerify] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRetryKey, setProfileRetryKey] = useState(0);
  const [inactiveNotice, setInactiveNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        resetUserData();
        setProfileError(null);
      }
    });
    return unsub;
  }, [resetUserData, setAuthReady, setUser]);

  useEffect(() => {
    if (!user || !user.emailVerified) return;
    let active = true;
    let unsubProfile: (() => void) | null = null;

    setProfileLoading(true);
    setProfileError(null);

    (async () => {
      try {
        // Critical: rules use token.email_verified, not the client User flag alone
        await user.getIdToken(true);
        const initialProfile = await ensureUserProfile(user);
        if (!active) return;
        if (!isProfileActive(initialProfile)) {
          setInactiveNotice(INACTIVE_ACCOUNT_MESSAGE);
          setProfileLoading(false);
          await signOut(auth);
          return;
        }
        setProfile(initialProfile);
        setProfileLoading(false);
        unsubProfile = subscribeUserProfile(user.uid, (nextProfile) => {
          if (!nextProfile) return;
          if (!isProfileActive(nextProfile)) {
            setInactiveNotice(INACTIVE_ACCOUNT_MESSAGE);
            void signOut(auth);
            return;
          }
          setProfile(nextProfile);
        });
      } catch (err: unknown) {
        console.error('Failed to load user profile:', err);
        if (!active) return;
        setProfileLoading(false);
        setProfileError(
          err instanceof Error
            ? err.message
            : 'Missing or insufficient permissions while loading your profile.'
        );
      }
    })();

    return () => {
      active = false;
      unsubProfile?.();
    };
  }, [user, user?.emailVerified, profileRetryKey, setProfile, setProfileLoading]);

  useEffect(() => {
    if (!user || !user.emailVerified || !profile || !isProfileActive(profile)) return;
    return subscribeActiveRoadmap(
      user.uid,
      (rm) => {
        setRoadmap(rm);
        if (!rm) setTasks([]);
      },
      (err) => console.warn('Roadmap subscription error:', err.message)
    );
  }, [user, user?.emailVerified, profile?.uid, profile?.accountStatus, setRoadmap, setTasks]);

  useEffect(() => {
    if (!user || !user.emailVerified || !profile || !isProfileActive(profile) || !roadmap)
      return;
    return subscribeRoadmapTasks(
      user.uid,
      roadmap.id,
      (items) => {
        setTasks(items);
      },
      (err) => console.warn('Tasks subscription error:', err.message)
    );
  }, [
    user,
    user?.emailVerified,
    profile?.uid,
    profile?.accountStatus,
    roadmap?.id,
    setTasks,
  ]);

  if (!authReady || (user && user.emailVerified && profileLoading)) {
    return (
      <AppScreen style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Smart Skill Planner...</Text>
      </AppScreen>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen
          initialError={inactiveNotice}
          onConsumeInitialError={() => setInactiveNotice(null)}
        />
      </>
    );
  }

  if (!user.emailVerified) {
    return (
      <AppScreen style={styles.center}>
        <StatusBar style="dark" />
        <View style={styles.verifyCard}>
          <View style={styles.verifyIcon}>
            <Ionicons name="mail-unread-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.verifyTitle}>Verify your email</Text>
          <Text style={styles.verifyText}>
            We sent a verification link to {user.email}. Open it, then continue below.
          </Text>
          {verifyNotice ? <Text style={styles.verifyNotice}>{verifyNotice}</Text> : null}
          <Pressable
            style={styles.primaryBtn}
            disabled={checkingVerify}
            onPress={async () => {
              setCheckingVerify(true);
              setVerifyNotice(null);
              try {
                await reload(user);
                const fresh = auth.currentUser;
                if (fresh?.emailVerified) {
                  // Force a new ID token so Firestore sees email_verified=true
                  await fresh.getIdToken(true);
                  setUser(fresh);
                  setProfileRetryKey((k) => k + 1);
                } else {
                  setVerifyNotice('Email not verified yet. Please check your inbox.');
                }
              } finally {
                setCheckingVerify(false);
              }
            }}
          >
            <Text style={styles.primaryBtnText}>
              {checkingVerify ? 'Checking...' : 'I Verified My Email'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={async () => {
              await sendEmailVerification(user);
              setVerifyNotice('Verification email resent.');
            }}
          >
            <Text style={styles.secondaryBtnText}>Resend Verification Link</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  if (user.emailVerified && !profile && !profileLoading) {
    return (
      <AppScreen style={styles.center}>
        <StatusBar style="dark" />
        <View style={styles.verifyCard}>
          <View style={styles.verifyIcon}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
          </View>
          <Text style={styles.verifyTitle}>Profile sync failed</Text>
          <Text style={styles.verifyText}>
            {profileError ||
              'We could not create your learner profile. Check your connection and try again.'}
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setProfileError(null);
              setProfileRetryKey((k) => k + 1);
            }}
          >
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  if (!profile || showOnboarding || !profile.onboardingCompleted) {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingScreen />
      </>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 58 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Home: 'home-outline',
              Roadmap: 'map-outline',
              Tasks: 'checkbox-outline',
              Progress: 'stats-chart-outline',
              Profile: 'person-outline',
            };
            return (
              <Ionicons
                name={icons[route.name] || 'ellipse-outline'}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={DashboardScreen} />
        <Tab.Screen name="Roadmap" component={RoadmapScreen} />
        <Tab.Screen name="Tasks" component={TasksScreen} />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  verifyCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    ...shadows.soft,
  },
  verifyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  verifyTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  verifyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 18,
  },
  verifyNotice: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
});
