import React, { useMemo, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { Roadmap, TaskItem } from '../types/planner';
import { getRoadmapCurrentDayOffset } from './DashboardView';
import { TaskRow } from './TaskRow';

interface TasksViewProps {
  roadmap: Roadmap | null;
  tasks: TaskItem[];
  togglingTaskId: string | null;
  onToggleTask: (task: TaskItem) => void;
  onStartOnboarding: () => void;
}

type TaskTab = 'today' | 'upcoming' | 'completed';

export const TasksView: React.FC<TasksViewProps> = ({
  roadmap,
  tasks,
  togglingTaskId,
  onToggleTask,
  onStartOnboarding,
}) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('today');
  const currentDay = getRoadmapCurrentDayOffset(roadmap);

  const { todayList, upcomingGroups, completedList } = useMemo(() => {
    const completed = tasks.filter((t) => t.isCompleted);
    const incomplete = tasks.filter((t) => !t.isCompleted);

    // Today = incomplete tasks scheduled on or before currentDay (so overdue tasks stay visible)
    let today = incomplete.filter((t) => t.dayOffset <= currentDay);
    let upcoming = incomplete.filter((t) => t.dayOffset > currentDay);

    // If all currentDay tasks are done and there are still upcoming tasks, keep Today clean
    // and show remaining day groups in Upcoming.
    const groupsMap = new Map<number, TaskItem[]>();
    for (const item of upcoming) {
      const arr = groupsMap.get(item.dayOffset) ?? [];
      arr.push(item);
      groupsMap.set(item.dayOffset, arr);
    }

    const sortedGroups = Array.from(groupsMap.entries()).sort((a, b) => a[0] - b[0]);

    return {
      todayList: today,
      upcomingGroups: sortedGroups,
      completedList: completed,
    };
  }, [tasks, currentDay]);

  const upcomingCount = useMemo(
    () => upcomingGroups.reduce((acc, [, items]) => acc + items.length, 0),
    [upcomingGroups]
  );

  if (!roadmap) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
          <CheckSquare className="w-8 h-8 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No tasks scheduled yet</h2>
          <p className="text-sm text-slate-500 mb-6">
            Generate your AI roadmap to populate your daily and upcoming study tasks.
          </p>
          <button
            type="button"
            onClick={onStartOnboarding}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Create Roadmap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-12">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Your Tasks
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Check off tasks as you finish them to keep your roadmap progress current.
        </p>
      </div>

      {/* Segmented Control */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
        {(
          [
            { key: 'today', label: 'Today', count: todayList.length },
            { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { key: 'completed', label: 'Completed', count: completedList.length },
          ] as { key: TaskTab; label: string; count: number }[]
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-[42px] px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs tabular-nums ${
                  active ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TODAY */}
      {activeTab === 'today' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
          {todayList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">
                You are all caught up for Day {currentDay}.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Switch to Upcoming if you want to work ahead on future milestones.
              </p>
            </div>
          ) : (
            todayList.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={togglingTaskId === task.id}
                onToggle={onToggleTask}
                showResources
              />
            ))
          )}
        </section>
      )}

      {/* UPCOMING */}
      {activeTab === 'upcoming' && (
        <div className="space-y-5">
          {upcomingGroups.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-800">No upcoming tasks left.</p>
              <p className="text-xs text-slate-500 mt-1">
                All future tasks are either active today or already completed.
              </p>
            </div>
          ) : (
            upcomingGroups.map(([dayOffset, dayTasks]) => (
              <section key={dayOffset}>
                <h2 className="text-xs font-semibold text-slate-500 mb-2 tabular-nums">
                  {dayOffset === currentDay + 1 ? `Tomorrow · Day ${dayOffset}` : `Day ${dayOffset}`}
                </h2>
                <div className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
                  {dayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      disabled={togglingTaskId === task.id}
                      onToggle={onToggleTask}
                      showResources
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* COMPLETED */}
      {activeTab === 'completed' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
          {completedList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No completed tasks yet.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Check off your first task from Today to start building momentum.
              </p>
            </div>
          ) : (
            completedList.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={togglingTaskId === task.id}
                onToggle={onToggleTask}
                showResources={false}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
};
