import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ArrowLeft, ArrowRight, Plus, Sparkles, X } from 'lucide-react';
import {
  DayOfWeek,
  ExperienceLevel,
  UserProfile,
} from '../types/planner';
import {
  GenerateRoadmapError,
  requestRoadmapGeneration,
} from '../lib/api';
import {
  logAiGenerationFailure,
  saveGeneratedRoadmapAndLog,
} from '../lib/firestoreService';

interface OnboardingWizardProps {
  user: User;
  profile: UserProfile;
  previousActiveRoadmapId?: string | null;
  onComplete: () => void;
  onCancel?: () => void;
  onToast: (message: string) => void;
}

const EDUCATION_OPTIONS = [
  'High School',
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Self-Taught / Bootcamp',
  'Other',
];

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
];

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SUGGESTED_SKILLS = ['JavaScript', 'Python', 'SQL', 'React', 'TypeScript', 'Git', 'Node.js', 'Figma'];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  user,
  profile,
  previousActiveRoadmapId,
  onComplete,
  onCancel,
  onToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fullName, setFullName] = useState(profile.fullName || '');
  // First-time setup: empty (ignore legacy auto "Bachelor's Degree").
  // After onboarding / regenerate: show the user's saved education.
  const [education, setEducation] = useState(
    profile.onboardingCompleted ? profile.education || '' : ''
  );
  const [fieldOfStudy, setFieldOfStudy] = useState(profile.fieldOfStudy || '');
  const [profession, setProfession] = useState(profile.profession || '');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile.experienceLevel || 'mid'
  );
  const [currentSkills, setCurrentSkills] = useState<string[]>(
    profile.currentSkills?.length ? profile.currentSkills : ['JavaScript', 'Git']
  );
  const [skillInput, setSkillInput] = useState('');
  const [careerGoal, setCareerGoal] = useState(profile.careerGoal || '');
  const [targetRole, setTargetRole] = useState(profile.targetRole || '');
  const [availableHoursPerDay, setAvailableHoursPerDay] = useState<number>(
    profile.availableHoursPerDay || 2
  );
  const [preferredDays, setPreferredDays] = useState<DayOfWeek[]>(
    profile.preferredDays?.length ? profile.preferredDays : ['Mon', 'Wed', 'Fri']
  );

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const progressPercent = step * 25;

  const addSkill = (raw: string) => {
    const cleaned = raw.trim().slice(0, 60);
    if (!cleaned) return;
    if (currentSkills.length >= 25) {
      onToast('Maximum 25 skills allowed.');
      return;
    }
    if (!currentSkills.some((s) => s.toLowerCase() === cleaned.toLowerCase())) {
      setCurrentSkills((prev) => [...prev, cleaned]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setCurrentSkills((prev) => prev.filter((s) => s !== skill));
  };

  const toggleDay = (day: DayOfWeek) => {
    setPreferredDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // keep at least 1 day
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 1) {
      if (!fullName.trim()) return 'Please enter your full name.';
      if (!fieldOfStudy.trim()) return 'Please enter your field of study.';
    }
    if (currentStep === 2) {
      if (!profession.trim()) return 'Please enter your current profession or student status.';
    }
    if (currentStep === 3) {
      if (careerGoal.trim().length < 5)
        return 'Please describe your career goal (at least 5 characters).';
      if (targetRole.trim().length < 2) return 'Please enter your target job role.';
    }
    if (currentStep === 4) {
      if (preferredDays.length === 0) return 'Select at least one preferred study day.';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  const handleCancelGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  };

  const handleSubmit = async () => {
    const err = validateStep(4);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const payload = {
      fullName: fullName.trim(),
      education: education.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      profession: profession.trim(),
      experienceLevel,
      currentSkills,
      careerGoal: careerGoal.trim(),
      targetRole: targetRole.trim(),
      availableHoursPerDay,
      preferredDays,
    };

    try {
      const generation = await requestRoadmapGeneration(payload, controller.signal);
      await saveGeneratedRoadmapAndLog({
        user,
        profile,
        updatedFields: { ...payload, onboardingCompleted: true },
        generation,
        previousActiveRoadmapId,
      });
      onToast('Roadmap generated successfully.');
      onComplete();
    } catch (e: unknown) {
      const genErr = e as GenerateRoadmapError;
      let errMsg = genErr.message || 'Unable to generate roadmap right now.';
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed?.error && typeof parsed.error === 'string') {
          errMsg = parsed.error;
        }
      } catch {
        // plain text error
      }
      if (
        errMsg.startsWith('{') ||
        errMsg.includes('{{code') ||
        errMsg.length > 220
      ) {
        const lower = errMsg.toLowerCase();
        errMsg =
          lower.includes('503') ||
          lower.includes('high demand') ||
          lower.includes('overloaded')
            ? 'The AI model is busy right now. Please try again in a moment.'
            : 'We could not build a valid roadmap right now. Please try again.';
      }
      if (!controller.signal.aborted) {
        await logAiGenerationFailure({
          user,
          profile,
          promptSummary:
            genErr.promptSummary || `Generate roadmap for ${payload.targetRole}`,
          prompt:
            genErr.prompt ||
            `Target role: ${payload.targetRole}, Goal: ${payload.careerGoal}`,
          errorMessage: errMsg,
        });
      }
      setError(errMsg);
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Crafting your roadmap...
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto mb-6">
            Analyzing your skill gaps for{' '}
            <span className="font-semibold text-slate-700">{targetRole}</span> and
            scheduling daily milestones tailored to {availableHoursPerDay}h/day.
          </p>
          <button
            type="button"
            onClick={handleCancelGeneration}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Progress Header */}
        <div className="mb-7">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-indigo-600">Step {step} of 4</span>
            <span className="text-slate-500 tabular-nums">{progressPercent}% complete</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Background */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tell us about you</h1>
              <p className="text-sm text-slate-500 mt-1">
                Your educational foundation helps calibrate learning depth.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter Name"
                maxLength={100}
                className="w-full h-12 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Education Level
              </label>
              <select
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className="w-full h-12 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              >
                <option value="">Select education level</option>
                {EDUCATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Field of Study
              </label>
              <input
                type="text"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="e.g. Computer Science, Business, Mechanical Engineering"
                maxLength={100}
                className="w-full h-12 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Experience */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Your Profession</h1>
              <p className="text-sm text-slate-500 mt-1">
                We tailor milestones so you skip basics you already know.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Current Profession
              </label>
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="e.g. Software Developer, Data Analyst, CS Student"
                maxLength={100}
                className="w-full h-12 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Experience Level
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {EXPERIENCE_LEVELS.map((lvl) => {
                  const active = experienceLevel === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setExperienceLevel(lvl.value)}
                      className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Skills & Career Goal */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Skills & Career Goal</h1>
              <p className="text-sm text-slate-500 mt-1">
                Add what you know today and define where you want to go.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Current Skills
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
                  placeholder="Type a skill and press Enter"
                  maxLength={60}
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
                <button
                  type="button"
                  onClick={() => addSkill(skillInput)}
                  className="h-11 px-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {currentSkills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {currentSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        className="text-indigo-500 hover:text-indigo-900 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Quick add:</span>
                {SUGGESTED_SKILLS.filter(
                  (s) => !currentSkills.some((c) => c.toLowerCase() === s.toLowerCase())
                )
                  .slice(0, 5)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      + {s}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Target Job Role
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Full-Stack Developer, Machine Learning Engineer"
                maxLength={120}
                className="w-full h-12 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Career Goal
              </label>
              <textarea
                rows={3}
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                placeholder="Describe your concrete goal and timeline, e.g. Transition into a Senior Full-Stack Engineer role at a product company within 6 months."
                maxLength={600}
                className="w-full p-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 resize-none leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Schedule */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Your Learning Schedule</h1>
              <p className="text-sm text-slate-500 mt-1">
                We size daily tasks to fit comfortably inside your weekly hours.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-xs font-medium text-slate-600">
                  Available Hours per Day
                </label>
                <span className="text-2xl font-extrabold text-indigo-600 tabular-nums">
                  {availableHoursPerDay}h
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={6}
                step={0.5}
                value={availableHoursPerDay}
                onChange={(e) => setAvailableHoursPerDay(parseFloat(e.target.value))}
                className="w-full skill-slider"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2 tabular-nums">
                <span>0.5h</span>
                <span>3h</span>
                <span>6h</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Preferred Learning Days
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const selected = preferredDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-3 tabular-nums">
                Weekly commitment: {(availableHoursPerDay * preferredDays.length).toFixed(1)}{' '}
                hours across {preferredDays.length} day{preferredDays.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center gap-3 mt-8 pt-5 border-t border-slate-100">
          {step === 1 ? (
            onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 min-h-[48px] rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
              }}
              className="flex-1 min-h-[48px] rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-500/25 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-500/25 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Roadmap</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
