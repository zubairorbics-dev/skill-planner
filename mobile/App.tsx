import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

export default function App() {
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        resetUserData();
      }
    });
    return unsub;
  }, [resetUserData, setAuthReady, setUser]);

  useEffect(() => {
    if (!user || !user.emailVerified) return;
    let active = true;
    let unsubProfile: (() => void) | null = null;

    setProfileLoading(true);
    ensureUserProfile(user)
      .then((initialProfile) => {
        if (!active) return;
        setProfile(initialProfile);
        setProfileLoading(false);
        unsubProfile = subscribeUserProfile(user.uid, (nextProfile) => {
          if (nextProfile) setProfile(nextProfile);
        });
      })
      .catch(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
      unsubProfile?.();
    };
  }, [user, user?.emailVerified, setProfile, setProfileLoading]);

  useEffect(() => {
    if (!user || !user.emailVerified) return;
    return subscribeActiveRoadmap(user.uid, (rm) => {
      setRoadmap(rm);
      if (!rm) setTasks([]);
    });
  }, [user, user?.emailVerified, setRoadmap, setTasks]);

  useEffect(() => {
    if (!user || !user.emailVerified || !roadmap) return;
    return subscribeRoadmapTasks(user.uid, roadmap.id, (items) => {
      setTasks(items);
    });
  }, [user, user?.emailVerified, roadmap?.id, setTasks]);

  if (!authReady || (user && user.emailVerified && profileLoading)) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Smart Skill Planner...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen />
      </>
    );
  }

  // Firestore security rules require a verified email before writing profile/roadmaps
  if (!user.emailVerified) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="dark" />
        <View style={styles.verifyCard}>
          <Text style={styles.verifyTitle}>Verify your email</Text>
          <Text style={styles.verifyText}>
            We sent a verification link to {user.email}. Click the link in your inbox,
            then tap below to enter Smart Skill Planner.
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
                if (auth.currentUser?.emailVerified) {
                  setUser({ ...auth.currentUser } as typeof user);
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
          <Pressable onPress={() => void signOut(auth)} style={{ marginTop: 12 }}>
            <Text style={styles.signOutLink}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
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
            return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    alignItems: 'center',
  },
  verifyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  verifyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
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
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  signOutLink: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
