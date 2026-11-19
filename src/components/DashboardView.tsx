import React, { useMemo } from 'react';
import { ArrowRight, Compass, RefreshCw, Target } from 'lucide-react';
import { Roadmap, TaskItem, UserProfile } from '../types/planner';
import { TaskRow } from './TaskRow';

interface DashboardViewProps {
  profile: UserProfile;
  roadmap: Roadmap | null;
  tasks: TaskItem[];
  togglingTaskId: string | null;
  onToggleTask: (task: TaskItem) => void;
  onNavigate: (tab: 'roadmap' | 'tasks' | 'progress' | 'profile') => void;
  onStartOnboarding: () => void;
}

export function getRoadmapCurrentDayOffset(roadmap: Roadmap | null): number {
  if (!roadmap?.createdAt) return 1;
  const createdMs = roadmap.createdAt.toMillis();
  const diffDays = Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  roadmap,
  tasks,
  togglingTaskId,
  onToggleTask,
  onNavigate,
  onStartOnboarding,
}) => {
  const firstName = (profile.fullName || 'Learner').trim().split(/\s+/)[0];
  const initials = (profile.fullName || 'L')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const totalTasks = tasks.length;
  const completedCount = useMemo(
    () => tasks.filter((t) => t.isCompleted).length,
    [tasks]
  );
  const overallPercent =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const currentDay = getRoadmapCurrentDayOffset(roadmap);

  const todaysTasks = useMemo(() => {
    const exactToday = tasks.filter((t) => t.dayOffset === currentDay);
    if (exactToday.length > 0) return exactToday;
    // If today has no scheduled dayOffset, surface up to 4 next incomplete tasks
    const upcomingIncomplete = tasks.filter((t) => !t.isCompleted).slice(0, 4);
    return upcomingIncomplete;
  }, [tasks, currentDay]);

  if (!roadmap) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-5">
            <Compass className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Hi, {firstName}. Ready to build your roadmap?
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-7">
            Complete a quick 4-step profile so Smart Skill Planner can analyze your
            skill gaps and generate a daily learning plan tailored to your schedule.
          </p>
          <button
            type="button"
            onClick={onStartOnboarding}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 transition-all cursor-pointer"
          >
            <span>Generate My Roadmap</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-12">
      {/* Greeting Header */}
      <div className="flex items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Hi, {firstName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Day {currentDay} of your {roadmap.targetRole} plan
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          aria-label="Open profile"
          className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center hover:bg-indigo-200 transition-colors shrink-0 cursor-pointer"
        >
          {initials}
        </button>
      </div>

      {/* Main Responsive 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Column: Progress + Today's Tasks */}
        <div className="lg:col-span-7 space-y-6">
          {/* Overall Progress Card */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Overall Progress</p>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  {completedCount} of {totalTasks} tasks completed
                </p>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {overallPercent}
                <span className="text-base font-semibold text-slate-400 ml-0.5">%</span>
              </div>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </section>

          {/* Today's Tasks */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Today's Tasks</h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {todaysTasks.length} scheduled ·{' '}
                  {todaysTasks.filter((t) => t.isCompleted).length} done
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap cursor-pointer"
              >
                All tasks →
              </button>
            </div>

            {todaysTasks.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  All tasks in this roadmap are completed.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Ready for your next career milestone? Generate a fresh roadmap.
                </p>
              </div>
            ) : (
              <div className="mt-1">
                {todaysTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    disabled={togglingTaskId === task.id}
                    onToggle={onToggleTask}
                    showResources
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Secondary Column: Active Goal + Skill Gap Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Goal Card */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-2">
              <Target className="w-4 h-4 shrink-0" />
              <span>Current Goal</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5">
              {roadmap.targetRole}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {roadmap.goalText}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('roadmap')}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold shadow-sm shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>View Roadmap</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onStartOnboarding}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New Plan</span>
              </button>
            </div>
          </section>

          {/* Skill Gap Summary */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Skill Gap Analysis</h3>

            <div className="space-y-3 text-sm">
              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 mb-1.5">
                  <span>Skills You Have</span>
                  <span className="tabular-nums">{roadmap.gapAnalysis.have.length}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {roadmap.gapAnalysis.have.length > 0
                    ? roadmap.gapAnalysis.have.join(' · ')
                    : 'Foundation built from onboarding'}
                </p>
              </div>

              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-700 mb-1.5">
                  <span>Skills to Improve</span>
                  <span className="tabular-nums">{roadmap.gapAnalysis.improve.length}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {roadmap.gapAnalysis.improve.length > 0
                    ? roadmap.gapAnalysis.improve.join(' · ')
                    : 'Core workflows reinforced through practice'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 mb-1.5">
                  <span>New Skills to Learn</span>
                  <span className="tabular-nums">{roadmap.gapAnalysis.new.length}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {roadmap.gapAnalysis.new.join(' · ')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
