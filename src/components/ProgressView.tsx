import React, { useMemo } from 'react';
import { Roadmap, TaskItem, UserProfile } from '../types/planner';

interface ProgressViewProps {
  profile: UserProfile;
  roadmap: Roadmap | null;
  tasks: TaskItem[];
  onStartOnboarding: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  profile,
  roadmap,
  tasks,
  onStartOnboarding,
}) => {
  const firstName = (profile.fullName || 'Learner').trim().split(/\s+/)[0];

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.isCompleted).length;
    const remaining = Math.max(0, total - completed);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const completedMinutes = tasks
      .filter((t) => t.isCompleted)
      .reduce((acc, t) => acc + t.estMinutes, 0);
    const completedHours = (completedMinutes / 60).toFixed(1);

    const phasesCompleted = roadmap
      ? roadmap.phases.filter((p) => {
          const pTasks = tasks.filter((t) => t.phaseId === p.id);
          return pTasks.length > 0 && pTasks.every((t) => t.isCompleted);
        }).length
      : 0;

    return { total, completed, remaining, pct, completedHours, phasesCompleted };
  }, [tasks, roadmap]);

  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (stats.pct / 100) * circumference;

  if (!roadmap) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-2">No progress tracked yet</h2>
          <p className="text-sm text-slate-500 mb-6">
            Create your personalized roadmap to begin tracking completed tasks and study hours.
          </p>
          <button
            type="button"
            onClick={onStartOnboarding}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Generate Roadmap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-12">
      <div className="mb-7">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Your Progress
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Steady momentum, {firstName}. Here is your current completion summary.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Progress Ring Card */}
        <section className="md:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center">
          <div className="relative w-[200px] h-[200px]">
            <svg width="200" height="200" className="-rotate-90">
              <defs>
                <linearGradient id="progressRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
              <circle
                cx="100"
                cy="100"
                r={radius}
                stroke="#E2E8F0"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="100"
                cy="100"
                r={radius}
                stroke="url(#progressRingGrad)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold text-indigo-600 tabular-nums">
                {stats.pct}%
              </span>
              <span className="text-xs font-semibold text-slate-500 mt-1">Completed</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-5 text-center tabular-nums">
            {stats.completed} of {stats.total} roadmap tasks finished
          </p>
        </section>

        {/* 4 Summary Metrics + Phase Breakdown */}
        <div className="md:col-span-7 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Tasks Completed</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1.5 tabular-nums">
                {stats.completed}
              </p>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Tasks Remaining</p>
              <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
                {stats.remaining}
              </p>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Completed Study Time</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1.5 tabular-nums">
                {stats.completedHours}h
              </p>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Phases Completed</p>
              <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
                {stats.phasesCompleted} / {roadmap.phases.length}
              </p>
            </div>
          </div>

          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex-1">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Phase Breakdown</h2>
            <div className="space-y-4">
              {roadmap.phases.map((phase) => {
                const pTasks = tasks.filter((t) => t.phaseId === phase.id);
                const pDone = pTasks.filter((t) => t.isCompleted).length;
                const pPct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
                return (
                  <div key={phase.id}>
                    <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                      <span className="font-medium text-slate-700 truncate">
                        {phase.title}
                      </span>
                      <span className="text-slate-500 tabular-nums shrink-0">
                        {pDone}/{pTasks.length} ({pPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pPct === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${pPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
