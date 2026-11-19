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
import { Ionicons } from '@expo/vector-icons';
import { usePlannerStore } from '../store/usePlannerStore';
import { generateRoadmapViaBackend } from '../services/api';
import { saveGeneratedRoadmapAndLog } from '../services/firestoreService';
import { DayOfWeek, ExperienceLevel } from '../types/planner';
import { colors } from '../theme';

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EXP_LEVELS: { key: ExperienceLevel; label: string }[] = [
  { key: 'student', label: 'Student' },
  { key: 'junior', label: 'Junior' },
  { key: 'mid', label: 'Mid-level' },
  { key: 'senior', label: 'Senior' },
];
const HOUR_PRESETS = [0.5, 1, 1.5, 2, 3, 4, 6];

export const OnboardingScreen: React.FC = () => {
  const { user, profile, roadmap, setShowOnboarding } = usePlannerStore();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [education, setEducation] = useState(profile?.education || "Bachelor's Degree");
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

  const handleSubmit = async () => {
    if (!validateStep() || !user || !profile) return;
    setGenerating(true);
    setError(null);

    try {
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

      const generated = await generateRoadmapViaBackend(payload);
      await saveGeneratedRoadmapAndLog({
        user,
        profile,
        previousActiveRoadmapId: roadmap?.id ?? null,
        profileUpdates: payload,
        generated,
      });
      setShowOnboarding(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate roadmap right now.'
      );
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Crafting your roadmap...</Text>
        <Text style={styles.loadingSubtitle}>
          Analyzing skill gaps for {targetRole || 'your target role'} at {hoursPerDay}h/day.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.stepLabel}>Step {step} of 4</Text>
          {profile?.onboardingCompleted ? (
            <Pressable onPress={() => setShowOnboarding(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Background & Education</Text>
            <Text style={styles.sub}>Tell us where you are starting from.</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Alex Morgan"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Education Level</Text>
            <TextInput
              style={styles.input}
              value={education}
              onChangeText={setEducation}
              placeholder="Bachelor's Degree"
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
            <Text style={styles.heading}>Experience & Role</Text>
            <Text style={styles.sub}>We tailor task depth to your experience level.</Text>

            <Text style={styles.label}>Current Profession</Text>
            <TextInput
              style={styles.input}
              value={profession}
              onChangeText={setProfession}
              placeholder="Software Engineer"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Experience Level</Text>
            <View style={styles.chipGrid}>
              {EXP_LEVELS.map((lvl) => {
                const active = experienceLevel === lvl.key;
                return (
                  <Pressable
                    key={lvl.key}
                    onPress={() => setExperienceLevel(lvl.key)}
                    style={[styles.selectChip, active && styles.selectChipActive]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        active && styles.selectChipTextActive,
                      ]}
                    >
                      {lvl.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Skills & Career Goal</Text>
            <Text style={styles.sub}>List current skills and where you want to go.</Text>

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
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>

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
              placeholder="Describe what you want to achieve in the next 3-6 months..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Weekly Study Schedule</Text>
            <Text style={styles.sub}>Set a realistic daily pace you can sustain.</Text>

            <Text style={styles.label}>Available Hours per Day: {hoursPerDay}h</Text>
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

            <Text style={[styles.label, { marginTop: 16 }]}>Preferred Days</Text>
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
          </View>
        ) : null}

        <View style={styles.footerRow}>
          {step > 1 ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setStep((s) => Math.max(1, s - 1))}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {step < 4 ? (
            <Pressable style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={() => void handleSubmit()}>
              <Text style={styles.primaryBtnText}>Generate Roadmap</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loadingSafe: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 18,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  container: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepLabel: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cancelText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  heading: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 18 },
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
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    height: 96,
    paddingTop: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  selectChipTextActive: { color: colors.primary },
  skillInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  skillInput: { flex: 1 },
  addBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillTagText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  primaryBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: colors.danger, fontSize: 13 },
});
