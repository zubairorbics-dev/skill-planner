import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePlannerStore } from '../store/usePlannerStore';
import { toggleTaskCompletion } from '../services/firestoreService';
import { TaskCard } from '../components/TaskCard';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { TaskItem } from '../types/planner';
import { colors, radii, spacing } from '../theme';

type TaskTab = 'past' | 'today' | 'upcoming' | 'completed';

function getCurrentDayOffset(createdAt: { toMillis?: () => number } | null | undefined): number {
  const createdMs = createdAt?.toMillis?.() ?? Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.floor((Date.now() - createdMs) / dayMs);
  return Math.max(1, elapsed + 1);
}

export const TasksScreen: React.FC = () => {
  const { roadmap, tasks, togglingTaskId, setTogglingTaskId } = usePlannerStore();
  const [tab, setTab] = useState<TaskTab>('today');

  const currentDay = useMemo(
    () => getCurrentDayOffset(roadmap?.createdAt ?? null),
    [roadmap?.createdAt]
  );

  const pastTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.isCompleted && t.dayOffset < currentDay)
        .sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title)),
    [tasks, currentDay]
  );

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.isCompleted && t.dayOffset === currentDay)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [tasks, currentDay]
  );

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.isCompleted && t.dayOffset > currentDay)
        .sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title)),
    [tasks, currentDay]
  );

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.isCompleted),
    [tasks]
  );

  const visible =
    tab === 'past'
      ? pastTasks
      : tab === 'today'
        ? todayTasks
        : tab === 'upcoming'
          ? upcomingTasks
          : completedTasks;

  const handleToggle = async (task: TaskItem) => {
    if (!roadmap || togglingTaskId) return;

    if (!task.isCompleted && task.dayOffset > currentDay) {
      Alert.alert(
        'Upcoming task',
        'You can only mark past or today’s tasks as complete. Upcoming tasks stay locked until their day.'
      );
      return;
    }

    setTogglingTaskId(task.id);
    try {
      await toggleTaskCompletion(task, roadmap, tasks);
    } finally {
      setTogglingTaskId(null);
    }
  };

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Daily work"
          title="Tasks"
          subtitle={
            roadmap
              ? `Day ${currentDay} of your ${roadmap.targetRole} plan`
              : 'Tap a checkbox to track daily progress'
          }
        />

        <View style={styles.tabs}>
          {(
            [
              { key: 'past', label: `Past (${pastTasks.length})` },
              { key: 'today', label: `Today (${todayTasks.length})` },
              { key: 'upcoming', label: `Next (${upcomingTasks.length})` },
              { key: 'completed', label: `Done (${completedTasks.length})` },
            ] as const
          ).map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(item.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'upcoming' ? (
          <Text style={styles.lockHint}>
            Upcoming tasks are locked — complete them when their day arrives.
          </Text>
        ) : null}

        {visible.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {tab === 'past'
                ? 'No overdue past tasks.'
                : tab === 'today'
                  ? `All caught up for Day ${currentDay}.`
                  : tab === 'upcoming'
                    ? 'No upcoming tasks remaining.'
                    : 'No completed tasks yet.'}
            </Text>
          </View>
        ) : (
          visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showResources={tab !== 'completed'}
              busy={togglingTaskId === task.id}
              locked={!task.isCompleted && task.dayOffset > currentDay}
              onToggle={(t) => void handleToggle(t)}
            />
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 36,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.md,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.primary,
  },
  lockHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.md,
    lineHeight: 17,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
