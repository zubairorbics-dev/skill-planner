import React, { useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { usePlannerStore } from '../store/usePlannerStore';
import {
  generateRoadmapViaBackend,
  RoadmapGenerationCancelledError,
} from '../services/api';
import {
  ensureUserProfile,
  saveGeneratedRoadmapAndLog,
} from '../services/firestoreService';
import { DayOfWeek, ExperienceLevel } from '../types/planner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreen } from '../components/AppScreen';
import { colors, radii, shadows, spacing } from '../theme';

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EXP_LEVELS: { key: ExperienceLevel; label: string; hint: string }[] = [
  { key: 'student', label: 'Student', hint: 'Learning foundations' },
  { key: 'junior', label: 'Junior', hint: '0–2 years' },
  { key: 'mid', label: 'Mid-level', hint: '2–5 years' },
  { key: 'senior', label: 'Senior', hint: '5+ years' },
];
const HOUR_PRESETS = [0.5, 1, 1.5, 2, 3, 4, 6];

const STEP_META = [
  { title: 'Background', subtitle: 'Education & starting point' },
  { title: 'Experience', subtitle: 'Role depth we should target' },
  { title: 'Goals', subtitle: 'Skills and destination role' },
  { title: 'Schedule', subtitle: 'A pace you can sustain' },
] as const;

function shortenError(message: string): string {
  const raw = message.trim();
  // Never show raw API/JSON blobs in the UI
  if (
    raw.startsWith('{') ||
    raw.includes('{{code') ||
    raw.includes('"error"') ||
    raw.includes('status:') ||
    raw.length > 220
  ) {
    const lower = raw.toLowerCase();
    if (
      lower.includes('503') ||
      lower.includes('high demand') ||
      lower.includes('overloaded') ||
      lower.includes('unavailable')
    ) {
      return 'The AI model is busy right now. Please try again in a moment.';
    }
    return 'We could not build a valid roadmap right now. Please try again.';
  }
  if (raw.includes('Backend not found') || raw.includes('ais-pre')) {
    return 'Cannot reach the AI server. Start the web backend and restart Expo with a clean cache.';
  }
  if (raw.includes('Cannot reach the backend')) {
    return 'Cannot reach the AI server. Check that npm run dev is running.';
  }
  if (
    raw.toLowerCase().includes('high demand') ||
    raw.toLowerCase().includes('overloaded') ||
    raw.includes('503')
  ) {
    return 'The AI model is busy right now. Please try again in a moment.';
  }
  return raw;
}

export const OnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, profile, roadmap, setShowOnboarding, setProfile } = usePlannerStore();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  // First-time setup: empty (ignore legacy auto "Bachelor's Degree").
  // After onboarding / regenerate: show the user's saved education.
  const [education, setEducation] = useState(
    profile?.onboardingCompleted ? profile.education || '' : ''
  );
  const [fieldOfStudy, setFieldOfStudy] = useState(profile?.fieldOfStudy || '');

  const [profession, setProfession] = useState(profile?.profession || '');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile?.experienceLevel || 'mid'
  );

  const [skills, setSkills] = useState<string[]>(profile?.currentSkills || []);
  const [skillInput, setSkillInput] = useState('');
  const [targetRole, setTargetRole] = useState(profile?.targetRole || '');
  const [careerGoal, setCareerGoal] = useState(profile?.careerGoal || '');

  const [hoursPerDay, setHoursPerDay] = useState<number>(
    profile?.availableHoursPerDay || 2
  );
  const [preferredDays, setPreferredDays] = useState<DayOfWeek[]>(
    profile?.preferredDays?.length ? profile.preferredDays : ['Mon', 'Wed', 'Fri']
  );

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const meta = STEP_META[step - 1];
  const weeklyHours = useMemo(
    () => (hoursPerDay * preferredDays.length).toFixed(1),
    [hoursPerDay, preferredDays.length]
  );

  const addSkill = () => {
    const clean = skillInput.trim();
    if (!clean) return;
    if (!skills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSkills((prev) => [...prev, clean].slice(0, 25));
    }
    setSkillInput('');
  };

  const toggleDay = (day: DayOfWeek) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const validateStep = (): boolean => {
    setError(null);
    if (step === 1) {
      if (!fullName.trim() || !education.trim() || !fieldOfStudy.trim()) {
        setError('Please complete your name, education level, and field of study.');
        return false;
      }
    } else if (step === 2) {
      if (!profession.trim()) {
        setError('Please enter your current profession or student track.');
        return false;
      }
    } else if (step === 3) {
      if (!targetRole.trim() || careerGoal.trim().length < 5) {
        setError('Please enter your target role and a brief career goal.');
        return false;
      }
    } else if (step === 4) {
      if (preferredDays.length === 0) {
        setError('Select at least one preferred study day.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleClose = () => {
    if (profile?.onboardingCompleted) {
      setShowOnboarding(false);
    }
  };

  const handleCancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setError('Roadmap generation cancelled. You can edit your details and try again.');
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (!user) {
      setError('Please sign in before generating a roadmap.');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setError(null);

    try {
      let activeProfile = profile;
      if (!activeProfile) {
        activeProfile = await ensureUserProfile(user);
        setProfile(activeProfile);
      }

      const payload = {
        fullName: fullName.trim(),
        education: education.trim(),
        fieldOfStudy: fieldOfStudy.trim(),
        profession: profession.trim(),
        experienceLevel,
        currentSkills: skills,
        careerGoal: careerGoal.trim(),
        targetRole: targetRole.trim(),
        availableHoursPerDay: hoursPerDay,
        preferredDays,
      };

      const generated = await generateRoadmapViaBackend(payload, controller.signal);
      if (controller.signal.aborted) return;

      await saveGeneratedRoadmapAndLog({
        user,
        profile: activeProfile,
        previousActiveRoadmapId: roadmap?.id ?? null,
        profileUpdates: payload,
        generated,
      });
      setShowOnboarding(false);
    } catch (err: unknown) {
      if (
        err instanceof RoadmapGenerationCancelledError ||
        controller.signal.aborted
      ) {
        return;
      }
      const raw =
        err instanceof Error ? err.message : 'Unable to generate roadmap right now.';
      if (raw.includes('permission') || raw.includes('Permission')) {
        setError(
          'Profile permission failed. Verify your email, tap Retry on the sync screen, then try again.'
        );
      } else {
        setError(shortenError(raw));
      }
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <AppScreen style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
          <Text style={styles.loadingTitle}>Crafting your roadmap</Text>
          <Text style={styles.loadingSubtitle}>
            Mapping skill gaps for {targetRole || 'your target role'} at {hoursPerDay}h/day.
          </Text>
          <Pressable
            style={styles.cancelBtn}
            onPress={handleCancelGeneration}
            accessibilityRole="button"
            accessibilityLabel="Cancel roadmap generation"
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={['top', 'left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>S</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>Smart Skill Planner</Text>
              <Text style={styles.brandSub}>Personalized learning setup</Text>
            </View>
            {profile?.onboardingCompleted ? (
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close setup"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.stepHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepEyebrow}>Step {step} of 4</Text>
              <Text style={styles.stepTitle}>{meta.title}</Text>
              <Text style={styles.stepSubtitle}>{meta.subtitle}</Text>
            </View>
          </View>

          <View style={styles.dotsRow}>
            {STEP_META.map((_, index) => {
              const active = index + 1 === step;
              const done = index + 1 < step;
              return (
                <Pressable
                  key={STEP_META[index].title}
                  style={[
                    styles.dot,
                    done && styles.dotDone,
                    active && styles.dotActive,
                  ]}
                  onPress={() => {
                    if (index + 1 < step) {
                      setError(null);
                      setStep(index + 1);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.dotText,
                      done && styles.dotTextDone,
                      active && styles.dotTextOnPrimary,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </Pressable>
              );
            })}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.card}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter Name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Education Level</Text>
              <TextInput
                style={styles.input}
                value={education}
                onChangeText={setEducation}
                placeholder="Enter Education Level"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Field of Study</Text>
              <TextInput
                style={styles.input}
                value={fieldOfStudy}
                onChangeText={setFieldOfStudy}
                placeholder="Computer Science"
                placeholderTextColor="#94A3B8"
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.card}>
              <Text style={styles.label}>Current Profession</Text>
              <TextInput
                style={styles.input}
                value={profession}
                onChangeText={setProfession}
                placeholder="Software Engineer"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Experience Level</Text>
              <View style={styles.expGrid}>
                {EXP_LEVELS.map((lvl) => {
                  const active = experienceLevel === lvl.key;
                  return (
                    <Pressable
                      key={lvl.key}
                      onPress={() => setExperienceLevel(lvl.key)}
                      style={[styles.expCard, active && styles.expCardActive]}
                    >
                      <Text
                        style={[styles.expLabel, active && styles.expLabelActive]}
                      >
                        {lvl.label}
                      </Text>
                      <Text
                        style={[styles.expHint, active && styles.expHintActive]}
                      >
                        {lvl.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.card}>
              <Text style={styles.label}>Current Skills</Text>
              <View style={styles.skillInputRow}>
                <TextInput
                  style={[styles.input, styles.skillInput]}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onSubmitEditing={addSkill}
                  placeholder="Type a skill (e.g. Python)"
                  placeholderTextColor="#94A3B8"
                />
                <Pressable style={styles.addBtn} onPress={addSkill}>
                  <Ionicons name="add" size={22} color="#FFFFFF" />
                </Pressable>
              </View>

              {skills.length > 0 ? (
                <View style={styles.skillsWrap}>
                  {skills.map((s) => (
                    <Pressable
                      key={s}
                      style={styles.skillTag}
                      onPress={() =>
                        setSkills((prev) => prev.filter((item) => item !== s))
                      }
                    >
                      <Text style={styles.skillTagText}>{s}</Text>
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.helper}>Optional — add skills you already know.</Text>
              )}

              <Text style={styles.label}>Target Job Role</Text>
              <TextInput
                style={styles.input}
                value={targetRole}
                onChangeText={setTargetRole}
                placeholder="Solutions Architect"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Career Goal</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={careerGoal}
                onChangeText={setCareerGoal}
                placeholder="What do you want to achieve in the next 3–6 months?"
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
              />
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.card}>
              <Text style={styles.label}>Available Hours per Day</Text>
              <Text style={styles.scheduleValue}>{hoursPerDay}h / day</Text>
              <View style={styles.chipGrid}>
                {HOUR_PRESETS.map((h) => {
                  const active = hoursPerDay === h;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => setHoursPerDay(h)}
                      style={[styles.selectChip, active && styles.selectChipActive]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          active && styles.selectChipTextActive,
                        ]}
                      >
                        {h}h
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>Preferred Days</Text>
              <View style={styles.chipGrid}>
                {ALL_DAYS.map((day) => {
                  const active = preferredDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[styles.selectChip, active && styles.selectChipActive]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          active && styles.selectChipTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.summaryBanner}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.summaryBannerText}>
                  About {weeklyHours} hours across {preferredDays.length} day
                  {preferredDays.length === 1 ? '' : 's'} each week.
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable
            style={[styles.secondaryBtn, step === 1 && styles.btnDisabled]}
            onPress={handleBack}
            disabled={step === 1}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={step === 1 ? '#94A3B8' : colors.textSecondary}
            />
            <Text
              style={[
                styles.secondaryBtnText,
                step === 1 && styles.secondaryBtnTextDisabled,
              ]}
            >
              Back
            </Text>
          </Pressable>

          {step < 4 ? (
            <Pressable style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void handleSubmit()}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Generate Roadmap</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  brandSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  stepEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  stepSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotDone: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dotText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dotTextDone: {
    color: colors.primaryDark,
  },
  dotTextOnPrimary: {
    color: '#FFFFFF',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginLeft: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.soft,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    height: 110,
    paddingTop: 14,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
  },
  expGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  expCard: {
    width: '47%',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
  },
  expCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  expLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  expLabelActive: {
    color: colors.primaryDark,
  },
  expHint: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textMuted,
  },
  expHintActive: {
    color: colors.primary,
  },
  skillInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  skillInput: { flex: 1 },
  addBtn: {
    width: 50,
    height: 50,
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
  scheduleValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  selectChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  selectChipTextActive: {
    color: colors.primary,
  },
  summaryBanner: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: 14,
  },
  summaryBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Math.max(spacing.md, 18),
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  secondaryBtnTextDisabled: {
    color: '#94A3B8',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  primaryBtn: {
    flex: 1.55,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  loadingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgAccent,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.soft,
  },
  loadingOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  cancelBtn: {
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
