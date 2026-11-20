import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Compass } from 'lucide-react';
import { Roadmap, TaskItem } from '../types/planner';
import { getRoadmapCurrentDayOffset } from './DashboardView';
import { TaskRow } from './TaskRow';

interface RoadmapViewProps {
  roadmap: Roadmap | null;
  tasks: TaskItem[];
  togglingTaskId: string | null;
  onToggleTask: (task: TaskItem) => void;
  onStartOnboarding: () => void;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({
  roadmap,
  tasks,
  togglingTaskId,
  onToggleTask,
  onStartOnboarding,
}) => {
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    p1: true,
  });

  const currentDay = getRoadmapCurrentDayOffset(roadmap);

  const totalWeeks = useMemo(
    () => (roadmap ? roadmap.phases.reduce((acc, p) => acc + p.durationWeeks, 0) : 0),
    [roadmap]
  );

  const handleToggle = (task: TaskItem) => {
    if (!task.isCompleted && task.dayOffset > currentDay) {
      window.alert(
        'Upcoming tasks are locked. You can only mark past or today’s tasks as complete.'
      );
      return;
    }
    onToggleTask(task);
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  if (!roadmap) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
          <Compass className="w-8 h-8 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No active roadmap yet</h2>
          <p className="text-sm text-slate-500 mb-6">
            Complete onboarding to generate your personalized multi-phase skill roadmap.
          </p>
          <button
            type="button"
            onClick={onStartOnboarding}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Build Roadmap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-12">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Your Roadmap
        </h1>
        <p className="text-sm text-slate-500 mt-1 tabular-nums">
          {roadmap.targetRole} · {totalWeeks} week{totalWeeks === 1 ? '' : 's'} ·{' '}
          {roadmap.phases.length} phases · {tasks.length} tasks
        </p>
      </div>

      {/* Unboxed Skill Gap Summary Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 mb-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="pt-0">
          <p className="text-xs font-semibold text-emerald-700 mb-1 tabular-nums">
            Have ({roadmap.gapAnalysis.have.length})
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            {roadmap.gapAnalysis.have.length > 0
              ? roadmap.gapAnalysis.have.join(', ')
              : 'None specified'}
          </p>
        </div>
        <div className="pt-3 md:pt-0 md:pl-4">
          <p className="text-xs font-semibold text-amber-700 mb-1 tabular-nums">
            Improve ({roadmap.gapAnalysis.improve.length})
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            {roadmap.gapAnalysis.improve.length > 0
              ? roadmap.gapAnalysis.improve.join(', ')
              : 'Strengthened via practice'}
          </p>
        </div>
        <div className="pt-3 md:pt-0 md:pl-4">
          <p className="text-xs font-semibold text-indigo-700 mb-1 tabular-nums">
            New ({roadmap.gapAnalysis.new.length})
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            {roadmap.gapAnalysis.new.join(', ')}
          </p>
        </div>
      </div>

      {/* Phase Accordions */}
      <div className="space-y-4">
        {roadmap.phases.map((phase) => {
          const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
          const phaseCompleted = phaseTasks.filter((t) => t.isCompleted).length;
          const phasePct =
            phaseTasks.length > 0
              ? Math.round((phaseCompleted / phaseTasks.length) * 100)
              : 0;
          const isOpen = !!expandedPhases[phase.id];
          const isComplete = phaseTasks.length > 0 && phaseCompleted === phaseTasks.length;

          return (
            <section
              key={phase.id}
              className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => togglePhase(phase.id)}
                aria-expanded={isOpen}
                className="w-full text-left p-5 sm:p-6 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isComplete && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {phase.title}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      {phase.durationWeeks} week{phase.durationWeeks === 1 ? '' : 's'} ·{' '}
                      {phase.milestones.length} milestones · {phaseCompleted}/
                      {phaseTasks.length} tasks done
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-slate-700 tabular-nums">
                      {phasePct}%
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      isComplete
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                    }`}
                    style={{ width: `${phasePct}%` }}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-100 space-y-6">
                  {phase.milestones.map((milestone) => {
                    const msTasks = phaseTasks.filter(
                      (t) => t.milestoneId === milestone.id
                    );
                    const msDone = msTasks.filter((t) => t.isCompleted).length;
                    const msComplete = msTasks.length > 0 && msDone === msTasks.length;

                    return (
                      <div key={milestone.id}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            {msComplete && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            <span>{milestone.title}</span>
                          </h3>
                          <span className="text-xs text-slate-500 tabular-nums shrink-0">
                            {msDone}/{msTasks.length}
                          </span>
                        </div>

                        <div className="pl-3 border-l border-slate-200">
                          {msTasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              disabled={togglingTaskId === task.id}
                              locked={!task.isCompleted && task.dayOffset > currentDay}
                              onToggle={handleToggle}
                              showResources
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
