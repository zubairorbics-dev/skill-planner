import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { usePlannerStore } from '../store/usePlannerStore';
import { updateUserProfileFields } from '../services/firestoreService';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radii, shadows, spacing } from '../theme';

export const ProfileScreen: React.FC = () => {
  const { user, profile, setShowOnboarding } = usePlannerStore();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [education, setEducation] = useState(profile?.education || '');
  const [fieldOfStudy, setFieldOfStudy] = useState(profile?.fieldOfStudy || '');
  const [profession, setProfession] = useState(profile?.profession || '');
  const [targetRole, setTargetRole] = useState(profile?.targetRole || '');
  const [careerGoal, setCareerGoal] = useState(profile?.careerGoal || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateUserProfileFields(user.uid, {
        fullName,
        education,
        fieldOfStudy,
        profession,
        targetRole,
        careerGoal,
      });
      setStatus('Profile saved.');
    } catch {
      setStatus('Could not save profile right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void signOut(auth),
      },
    ]);
  };

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Account"
          title="Profile"
          subtitle={profile?.email || user?.email || ''}
          right={
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(fullName.trim()[0] || 'S').toUpperCase()}
              </Text>
            </View>
          }
        />

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

          <Text style={styles.label}>Education</Text>
          <TextInput style={styles.input} value={education} onChangeText={setEducation} />

          <Text style={styles.label}>Field of Study</Text>
          <TextInput
            style={styles.input}
            value={fieldOfStudy}
            onChangeText={setFieldOfStudy}
          />

          <Text style={styles.label}>Profession</Text>
          <TextInput style={styles.input} value={profession} onChangeText={setProfession} />

          <Text style={styles.label}>Target Job Role</Text>
          <TextInput style={styles.input} value={targetRole} onChangeText={setTargetRole} />

          <Text style={styles.label}>Career Goal</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={careerGoal}
            onChangeText={setCareerGoal}
            multiline
            textAlignVertical="top"
          />

          {status ? <Text style={styles.statusText}>{status}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Save Changes</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setShowOnboarding(true)}
        >
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>Generate New Roadmap</Text>
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: 16,
    ...shadows.soft,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
    marginTop: 12,
  },
  primaryBtn: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutBtnText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
