import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { usePlannerStore } from '../store/usePlannerStore';
import { updateUserProfileFields } from '../services/firestoreService';
import { colors } from '../theme';

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

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>{profile?.email}</Text>

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
          <Text style={styles.secondaryBtnText}>Generate New Roadmap</Text>
        </Pressable>

        <Pressable
          style={styles.logoutBtn}
          onPress={() => void handleSignOut()}
        >
          <Text style={styles.logoutBtnText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  textArea: { height: 84, paddingTop: 10 },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
    marginTop: 12,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  logoutBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
