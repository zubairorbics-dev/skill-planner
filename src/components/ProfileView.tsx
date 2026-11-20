import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import {
  DayOfWeek,
  ExperienceLevel,
  Roadmap,
  TaskItem,
  UserProfile,
} from '../types/planner';
import {
  fetchRoadmapTasks,
  fetchUserArchivedRoadmaps,
  updateUserProfile,
} from '../lib/firestoreService';

interface ProfileViewProps {
  profile: UserProfile;
  hasActiveRoadmap?: boolean;
  onSignOut: () => Promise<void>;
  onRegenerateRoadmap: () => void;
  onToast: (msg: string) => void;
}

function formatRoadmapDate(createdAt: Roadmap['createdAt']): string {
  const ms = createdAt?.toMillis?.();
  if (!ms) return 'Unknown date';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  student: 'Student',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
};

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  hasActiveRoadmap = false,
  onSignOut,
  onRegenerateRoadmap,
  onToast,
}) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [archived, setArchived] = useState<Roadmap[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [selectedArchived, setSelectedArchived] = useState<Roadmap | null>(null);
  const [detailTasks, setDetailTasks] = useState<TaskItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [fullName, setFullName] = useState(profile.fullName);
  const [education, setEducation] = useState(profile.education);
  const [fieldOfStudy, setFieldOfStudy] = useState(profile.fieldOfStudy);
  const [profession, setProfession] = useState(profile.profession);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile.experienceLevel
  );
  const [currentSkills, setCurrentSkills] = useState<string[]>(profile.currentSkills);
  const [skillInput, setSkillInput] = useState('');
  const [careerGoal, setCareerGoal] = useState(profile.careerGoal);
  const [targetRole, setTargetRole] = useState(profile.targetRole);
  const [availableHoursPerDay, setAvailableHoursPerDay] = useState(
    profile.availableHoursPerDay
  );
  const [preferredDays, setPreferredDays] = useState<DayOfWeek[]>(profile.preferredDays);

  const initials = (profile.fullName || 'L')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const loadArchived = useCallback(async () => {
    setArchivedLoading(true);
    setArchivedError(null);
    try {
      const list = await fetchUserArchivedRoadmaps(profile.uid);
      setArchived(list);
    } catch {
      setArchivedError('Could not load past roadmaps.');
    } finally {
      setArchivedLoading(false);
    }
  }, [profile.uid]);

  useEffect(() => {
    void loadArchived();
  }, [loadArchived]);

  useEffect(() => {
    if (!selectedArchived) {
      setDetailTasks([]);
      return;
    }
    let active = true;
    setDetailLoading(true);
    fetchRoadmapTasks(profile.uid, selectedArchived.id)
      .then((tasks) => {
        if (active) setDetailTasks(tasks);
      })
      .catch(() => {
        if (active) onToast('Could not load tasks for this past roadmap.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedArchived, profile.uid, onToast]);

  const handleRegenerateClick = () => {
    if (hasActiveRoadmap) {
      setShowRegenConfirm(true);
      return;
    }
    onRegenerateRoadmap();
  };

  const startEditing = () => {
    setFullName(profile.fullName);
    setEducation(profile.education);
    setFieldOfStudy(profile.fieldOfStudy);
    setProfession(profile.profession);
    setExperienceLevel(profile.experienceLevel);
    setCurrentSkills(profile.currentSkills);
    setCareerGoal(profile.careerGoal);
    setTargetRole(profile.targetRole);
    setAvailableHoursPerDay(profile.availableHoursPerDay);
    setPreferredDays(profile.preferredDays);
    setEditing(true);
  };

  const addSkill = () => {
    const clean = skillInput.trim().slice(0, 60);
    if (!clean || currentSkills.length >= 25) return;
    if (!currentSkills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setCurrentSkills((prev) => [...prev, clean]);
    }
    setSkillInput('');
  };

  const toggleDay = (day: DayOfWeek) => {
    setPreferredDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day];
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      onToast('Full name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        fullName,
        education,
        fieldOfStudy,
        profession,
        experienceLevel,
        currentSkills,
        careerGoal,
        targetRole,
        availableHoursPerDay,
        preferredDays,
      });
      setEditing(false);
      onToast('Profile updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-12">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your learning background, career goal, and schedule.
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Identity Summary */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xl flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{profile.fullName}</h2>
          <p className="text-sm text-slate-500 truncate">{profile.email}</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {EXPERIENCE_LABELS[profile.experienceLevel]} · {profile.roadmapCount} roadmap
            {profile.roadmapCount === 1 ? '' : 's'} generated
          </p>
        </div>
      </section>

      {!editing ? (
        <div className="space-y-5">
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm divide-y divide-slate-100">
            <div className="flex justify-between gap-4 py-3 first:pt-0 text-sm">
              <span className="text-slate-500">Education</span>
              <span className="font-semibold text-slate-900 text-right">
                {profile.education || '—'}
                {profile.fieldOfStudy ? ` · ${profile.fieldOfStudy}` : ''}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-3 text-sm">
              <span className="text-slate-500">Profession</span>
              <span className="font-semibold text-slate-900 text-right">
                {profile.profession || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-3 text-sm">
              <span className="text-slate-500">Target Role</span>
              <span className="font-semibold text-slate-900 text-right">
                {profile.targetRole || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-3 text-sm">
              <span className="text-slate-500">Study Commitment</span>
              <span className="font-semibold text-slate-900 text-right tabular-nums">
                {profile.availableHoursPerDay}h/day · {profile.preferredDays.join(', ')}
              </span>
            </div>
            <div className="py-3 last:pb-0 text-sm">
              <span className="block text-slate-500 mb-1.5">Career Goal</span>
              <p className="text-slate-800 leading-relaxed">
                {profile.careerGoal || 'Not set yet'}
              </p>
            </div>
          </section>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 mb-3">Current Skills</h3>
            {profile.currentSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.currentSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No skills added yet.</p>
            )}
          </section>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Past roadmaps</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Archived plans from earlier regenerations. View only — no edits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadArchived()}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Refresh past roadmaps"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {archivedLoading ? (
              <p className="text-sm text-slate-500 py-4">Loading past roadmaps...</p>
            ) : archivedError ? (
              <p className="text-sm text-red-600 py-2">{archivedError}</p>
            ) : archived.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No past roadmaps yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {archived.map((rm) => {
                  const total = rm.totalTasks || 0;
                  const done = rm.completedTasks || 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <li key={rm.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedArchived(rm)}
                        className="w-full py-3 flex items-center gap-3 text-left hover:bg-slate-50 rounded-lg px-1 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {rm.targetRole}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatRoadmapDate(rm.createdAt)} · {done}/{total} · {pct}%
                          </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                          Archived
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleRegenerateClick}
              className="flex-1 min-h-[48px] px-5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Generate New Roadmap</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="sm:w-44 min-h-[48px] px-5 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Profession
              </label>
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                maxLength={100}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Education Level
              </label>
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                maxLength={80}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Field of Study
              </label>
              <input
                type="text"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                maxLength={100}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Experience Level
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(['student', 'junior', 'mid', 'senior'] as ExperienceLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setExperienceLevel(lvl)}
                  className={`min-h-[38px] rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                    experienceLevel === lvl
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  {lvl}
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
              maxLength={120}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
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
              maxLength={600}
              className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Skills
            </label>
            <div className="flex gap-2 mb-2.5">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add skill"
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentSkills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => setCurrentSkills((prev) => prev.filter((x) => x !== s))}
                    className="text-indigo-500 hover:text-indigo-900 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-600 mb-2">
              <span>Available Hours per Day</span>
              <span className="font-bold text-indigo-600 tabular-nums">
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
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Preferred Days
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const active = preferredDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`min-h-[40px] rounded-lg border text-xs font-semibold cursor-pointer ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 min-h-[46px] rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[46px] rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Regenerate Confirmation Modal */}
      {showRegenConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowRegenConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              Generate a new roadmap?
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Your current roadmap will be saved in Past roadmaps. A new plan will
              become active.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegenConfirm(false);
                  onRegenerateRoadmap();
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived roadmap detail (read-only) */}
      {selectedArchived && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedArchived(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-indigo-600 mb-1">Past roadmap</p>
                <h3 className="text-xl font-bold text-slate-900 truncate">
                  {selectedArchived.targetRole}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{selectedArchived.goalText}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
                  <span className="px-2 py-1 rounded-md bg-slate-100 font-bold text-slate-600 uppercase tracking-wide">
                    Archived
                  </span>
                  <span>{formatRoadmapDate(selectedArchived.createdAt)}</span>
                  <span>·</span>
                  <span>
                    {selectedArchived.completedTasks}/{selectedArchived.totalTasks} tasks
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArchived(null)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-4">
              This plan is read-only. Task completion cannot be changed.
            </p>

            <div className="rounded-xl border border-slate-200 p-4 mb-4 bg-slate-50">
              <p className="text-xs font-bold text-slate-700 mb-2">Skill gap analysis</p>
              {selectedArchived.gapAnalysis.have.length > 0 ? (
                <p className="text-xs text-slate-600 mb-1">
                  <span className="font-semibold text-emerald-700">Have: </span>
                  {selectedArchived.gapAnalysis.have.join(', ')}
                </p>
              ) : null}
              {selectedArchived.gapAnalysis.improve.length > 0 ? (
                <p className="text-xs text-slate-600 mb-1">
                  <span className="font-semibold text-amber-700">Improve: </span>
                  {selectedArchived.gapAnalysis.improve.join(', ')}
                </p>
              ) : null}
              {selectedArchived.gapAnalysis.new.length > 0 ? (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-indigo-700">New: </span>
                  {selectedArchived.gapAnalysis.new.join(', ')}
                </p>
              ) : null}
            </div>

            {detailLoading ? (
              <p className="text-sm text-slate-500 py-6 text-center">Loading phases...</p>
            ) : (
              <div className="space-y-4">
                {selectedArchived.phases.map((phase) => {
                  const phaseTasks = detailTasks.filter((t) => t.phaseId === phase.id);
                  const done = phaseTasks.filter((t) => t.isCompleted).length;
                  return (
                    <section
                      key={phase.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h4 className="text-sm font-bold text-slate-900">{phase.title}</h4>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {done}/{phaseTasks.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {phase.durationWeeks} week{phase.durationWeeks === 1 ? '' : 's'}
                      </p>
                      <ul className="space-y-2">
                        {phaseTasks.map((task) => (
                          <li
                            key={task.id}
                            className={`text-sm ${
                              task.isCompleted
                                ? 'text-slate-400 line-through'
                                : 'text-slate-800'
                            }`}
                          >
                            {task.title}
                            <span className="block text-[11px] text-slate-400 no-underline font-normal">
                              Day {task.dayOffset} · {task.estMinutes} min · {task.type}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Sign out?</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Your roadmap and task progress remain saved securely to your account.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutModal(false);
                  await onSignOut();
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
