import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  fetchUserArchivedRoadmaps,
  updateUserProfileFields,
} from '../services/firestoreService';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { ArchivedRoadmapScreen } from './ArchivedRoadmapScreen';
import { Roadmap } from '../types/planner';
import { colors, radii, shadows, spacing } from '../theme';

function formatDate(createdAt: Roadmap['createdAt']): string {
  const ms = createdAt?.toMillis?.();
  if (!ms) return 'Unknown date';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const ProfileScreen: React.FC = () => {
  const { user, profile, roadmap, setShowOnboarding } = usePlannerStore();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [education, setEducation] = useState(profile?.education || '');
  const [fieldOfStudy, setFieldOfStudy] = useState(profile?.fieldOfStudy || '');
  const [profession, setProfession] = useState(profile?.profession || '');
  const [targetRole, setTargetRole] = useState(profile?.targetRole || '');
  const [careerGoal, setCareerGoal] = useState(profile?.careerGoal || '');
  const [skills, setSkills] = useState<string[]>(profile?.currentSkills || []);
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [archived, setArchived] = useState<Roadmap[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [selectedArchived, setSelectedArchived] = useState<Roadmap | null>(null);

  const loadArchived = useCallback(async () => {
    if (!user?.uid) return;
    setArchivedLoading(true);
    setArchivedError(null);
    try {
      const list = await fetchUserArchivedRoadmaps(user.uid);
      setArchived(list);
    } catch {
      setArchivedError('Could not load past roadmaps.');
    } finally {
      setArchivedLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadArchived();
  }, [loadArchived, roadmap?.id]);

  // Keep local fields in sync when profile updates from Firestore
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName || '');
    setEducation(profile.education || '');
    setFieldOfStudy(profile.fieldOfStudy || '');
    setProfession(profile.profession || '');
    setTargetRole(profile.targetRole || '');
    setCareerGoal(profile.careerGoal || '');
    setSkills(profile.currentSkills || []);
  }, [profile]);

  // Leaving Profile tab (or returning later) should always show Profile, not past-roadmap detail
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedArchived(null);
      };
    }, [])
  );

  const addSkill = () => {
    const clean = skillInput.trim().slice(0, 60);
    if (!clean) return;
    if (!skills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSkills((prev) => [...prev, clean].slice(0, 25));
    }
    setSkillInput('');
  };

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
        currentSkills: skills,
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

  const handleRegenerate = () => {
    if (roadmap) {
      Alert.alert(
        'Generate a new roadmap?',
        'Your current roadmap will be saved in Past roadmaps. A new plan will become active.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => setShowOnboarding(true),
          },
        ]
      );
      return;
    }
    setShowOnboarding(true);
  };

  if (selectedArchived && user?.uid) {
    return (
      <ArchivedRoadmapScreen
        roadmap={selectedArchived}
        uid={user.uid}
        onBack={() => setSelectedArchived(null)}
      />
    );
  }

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

          <Text style={styles.label}>Skills</Text>
          <View style={styles.skillInputRow}>
            <TextInput
              style={[styles.input, styles.skillInput]}
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={addSkill}
              placeholder="Add a skill"
              placeholderTextColor="#94A3B8"
              returnKeyType="done"
            />
            <Pressable style={styles.addSkillBtn} onPress={addSkill}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          {skills.length > 0 ? (
            <View style={styles.skillsWrap}>
              {skills.map((s) => (
                <Pressable
                  key={s}
                  style={styles.skillTag}
                  onPress={() => setSkills((prev) => prev.filter((item) => item !== s))}
                >
                  <Text style={styles.skillTagText}>{s}</Text>
                  <Ionicons name="close" size={14} color={colors.primary} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.skillsEmpty}>No skills added yet.</Text>
          )}

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

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Past roadmaps</Text>
            <Pressable onPress={() => void loadArchived()} hitSlop={8}>
              <Ionicons name="refresh" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.historySub}>
            Archived plans from earlier regenerations. View only — no edits.
          </Text>

          {archivedLoading ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : archivedError ? (
            <Text style={styles.historyError}>{archivedError}</Text>
          ) : archived.length === 0 ? (
            <Text style={styles.historyEmpty}>No past roadmaps yet.</Text>
          ) : (
            archived.map((rm) => {
              const total = rm.totalTasks || 0;
              const done = rm.completedTasks || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Pressable
                  key={rm.id}
                  style={styles.historyItem}
                  onPress={() => setSelectedArchived(rm)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyItemTitle}>{rm.targetRole}</Text>
                    <Text style={styles.historyItemMeta}>
                      {formatDate(rm.createdAt)} · {done}/{total} · {pct}%
                    </Text>
                  </View>
                  <View style={styles.archivedBadge}>
                    <Text style={styles.archivedBadgeText}>Archived</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })
          )}
        </View>

        <Pressable style={styles.secondaryBtn} onPress={handleRegenerate}>
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
  skillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skillInput: {
    flex: 1,
  },
  addSkillBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  skillTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  skillsEmpty: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
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
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: 16,
    ...shadows.soft,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  historySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 17,
  },
  historyLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  historyError: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
  historyEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  historyItemMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  archivedBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archivedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
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
