import React, { useMemo, useState } from 'react';
import { CheckSquare, Lock } from 'lucide-react';
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

type TaskTab = 'past' | 'today' | 'upcoming' | 'completed';

export const TasksView: React.FC<TasksViewProps> = ({
  roadmap,
  tasks,
  togglingTaskId,
  onToggleTask,
  onStartOnboarding,
}) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('today');
  const currentDay = getRoadmapCurrentDayOffset(roadmap);

  const { pastList, todayList, upcomingGroups, completedList } = useMemo(() => {
    const completed = tasks.filter((t) => t.isCompleted);
    const incomplete = tasks.filter((t) => !t.isCompleted);

    const past = incomplete
      .filter((t) => t.dayOffset < currentDay)
      .sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title));
    const today = incomplete
      .filter((t) => t.dayOffset === currentDay)
      .sort((a, b) => a.title.localeCompare(b.title));
    const upcoming = incomplete.filter((t) => t.dayOffset > currentDay);

    const groupsMap = new Map<number, TaskItem[]>();
    for (const item of upcoming) {
      const arr = groupsMap.get(item.dayOffset) ?? [];
      arr.push(item);
      groupsMap.set(item.dayOffset, arr);
    }

    const sortedGroups = Array.from(groupsMap.entries()).sort((a, b) => a[0] - b[0]);

    return {
      pastList: past,
      todayList: today,
      upcomingGroups: sortedGroups,
      completedList: completed,
    };
  }, [tasks, currentDay]);

  const upcomingCount = useMemo(
    () => upcomingGroups.reduce((acc, [, items]) => acc + items.length, 0),
    [upcomingGroups]
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
          Check off past and today’s tasks. Upcoming stays locked until its day.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
        {(
          [
            { key: 'past', label: 'Past', count: pastList.length },
            { key: 'today', label: 'Today', count: todayList.length },
            { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { key: 'completed', label: 'Done', count: completedList.length },
          ] as { key: TaskTab; label: string; count: number }[]
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-[42px] px-2 sm:px-3 rounded-lg text-[11px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
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

      {activeTab === 'past' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
          {pastList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">No overdue past tasks.</p>
              <p className="text-xs text-slate-500 mt-1">
                Missed days will show up here so you can catch up.
              </p>
            </div>
          ) : (
            pastList.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={togglingTaskId === task.id}
                onToggle={handleToggle}
                showResources
              />
            ))
          )}
        </section>
      )}

      {activeTab === 'today' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
          {todayList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">
                You are all caught up for Day {currentDay}.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Check Past for anything overdue, or Upcoming to preview what’s next.
              </p>
            </div>
          ) : (
            todayList.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={togglingTaskId === task.id}
                onToggle={handleToggle}
                showResources
              />
            ))
          )}
        </section>
      )}

      {activeTab === 'upcoming' && (
        <div className="space-y-5">
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Upcoming tasks are locked until their scheduled day.
          </p>
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
                  {dayOffset === currentDay + 1
                    ? `Tomorrow · Day ${dayOffset}`
                    : `Day ${dayOffset}`}
                </h2>
                <div className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
                  {dayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      disabled={togglingTaskId === task.id}
                      locked
                      onToggle={handleToggle}
                      showResources
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl px-5 sm:px-6 py-2 shadow-sm">
          {completedList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">No completed tasks yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Check off your first task from Today or Past to start building momentum.
              </p>
            </div>
          ) : (
            completedList.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                disabled={togglingTaskId === task.id}
                onToggle={handleToggle}
                showResources={false}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
};
