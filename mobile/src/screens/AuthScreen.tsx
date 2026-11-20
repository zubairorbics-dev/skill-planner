import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  getPasswordStrength,
  PASSWORD_RULES_HINT,
  validateStrongPassword,
} from '../utils/password';
import { AppScreen } from '../components/AppScreen';
import {
  INACTIVE_ACCOUNT_MESSAGE,
  isProfileActive,
  UserProfile,
} from '../types/planner';
import { colors, radii, shadows } from '../theme';

type AuthMode = 'login' | 'register' | 'forgot';

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Authentication failed.';
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled in Firebase Console. Enable Authentication > Sign-in method > Email/Password.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('auth/user-not-found')) {
    return 'No account found with that email.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (msg.includes('auth/weak-password')) {
    return PASSWORD_RULES_HINT;
  }
  return msg;
}

interface AuthScreenProps {
  initialError?: string | null;
  onConsumeInitialError?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialError = null,
  onConsumeInitialError,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  React.useEffect(() => {
    if (initialError) {
      setError(initialError);
      onConsumeInitialError?.();
    }
  }, [initialError, onConsumeInitialError]);

  const handleSubmit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (mode === 'register') {
      const passwordError = validateStrongPassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
      if (!confirmPassword) {
        setError('Please confirm your password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Password and confirm password do not match.');
        return;
      }
    } else if (mode === 'login' && !password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        // Block deactivated accounts immediately at login
        try {
          const snap = await getDocFromServer(doc(db, 'profiles', cred.user.uid));
          if (snap.exists()) {
            const profile = snap.data() as UserProfile;
            if (!isProfileActive(profile)) {
              await signOut(auth);
              setError(INACTIVE_ACCOUNT_MESSAGE);
              return;
            }
          }
        } catch {
          // If profile cannot be read yet (e.g. unverified), App gate still enforces later
        }
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: fullName.trim() });
        await sendEmailVerification(cred.user);
        setNotice(
          'Account created! Check your inbox and verify your email, then tap "I verified my email" to continue.'
        );
      } else {
        await sendPasswordResetEmail(auth, cleanEmail);
        setNotice('Password reset link sent. Please check your email inbox.');
        setMode('login');
      }
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBox}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.appTitle}>Smart Skill Planner</Text>
            <Text style={styles.appSubtitle}>
              AI-powered personalized career learning roadmaps
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.modeTabs}>
              <Pressable
                style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
                onPress={() => {
                  setMode('login');
                  setError(null);
                  setNotice(null);
                  setConfirmPassword('');
                }}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === 'login' && styles.modeTabTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
                onPress={() => {
                  setMode('register');
                  setError(null);
                  setNotice(null);
                  setConfirmPassword('');
                }}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === 'register' && styles.modeTabTextActive,
                  ]}
                >
                  Create Account
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {notice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {mode === 'register' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter Name"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter Email Address"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {mode !== 'forgot' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                />
                {mode === 'register' ? (
                  <>
                    <Text style={styles.hint}>{PASSWORD_RULES_HINT}</Text>
                    {password.length > 0 ? (
                      <View style={styles.strengthRow}>
                        <View style={styles.strengthTrack}>
                          <View
                            style={[
                              styles.strengthFill,
                              {
                                width: `${Math.min(100, (strength.score / 5) * 100)}%`,
                                backgroundColor:
                                  strength.label === 'Weak'
                                    ? colors.danger
                                    : strength.label === 'Fair'
                                      ? colors.amber
                                      : colors.success,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.strengthLabel,
                            {
                              color:
                                strength.label === 'Weak'
                                  ? colors.danger
                                  : strength.label === 'Fair'
                                    ? colors.amber
                                    : colors.success,
                            },
                          ]}
                        >
                          {strength.label}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            {mode === 'register' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                />
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={() => void handleSubmit()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'login'
                    ? 'Sign In'
                    : mode === 'register'
                      ? 'Create Account'
                      : 'Send Reset Link'}
                </Text>
              )}
            </Pressable>

            {mode === 'login' ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setMode('forgot');
                  setError(null);
                  setNotice(null);
                }}
              >
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            ) : mode === 'forgot' ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                <Text style={styles.linkText}>Back to Sign In</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 32,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  appSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...shadows.soft,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.surface,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: colors.primary,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  strengthTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 99,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'right',
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  linkBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeBox: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 18,
  },
});
