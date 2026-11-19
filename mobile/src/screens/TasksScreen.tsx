import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePlannerStore } from '../store/usePlannerStore';
import { toggleTaskCompletion } from '../services/firestoreService';
import { TaskCard } from '../components/TaskCard';
import { TaskItem } from '../types/planner';
import { colors } from '../theme';

export const TasksScreen: React.FC = () => {
  const { roadmap, tasks, togglingTaskId, setTogglingTaskId } = usePlannerStore();

  const todayTasks = tasks.filter((t) => !t.isCompleted && t.dayOffset === 1);
  const upcomingTasks = tasks.filter((t) => !t.isCompleted && t.dayOffset > 1);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  const handleToggle = async (task: TaskItem) => {
    if (!roadmap || togglingTaskId) return;
    setTogglingTaskId(task.id);
    try {
      await toggleTaskCompletion(task, roadmap, tasks);
    } finally {
      setTogglingTaskId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.subtitle}>
          Tap any task checkbox to track your daily progress.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today ({todayTasks.length})</Text>
          {todayTasks.length === 0 ? (
            <Text style={styles.emptyText}>All tasks for today are complete.</Text>
          ) : (
            todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showResources
                busy={togglingTaskId === task.id}
                onToggle={(t) => void handleToggle(t)}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming ({upcomingTasks.length})</Text>
          {upcomingTasks.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming tasks remaining.</Text>
          ) : (
            upcomingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showResources
                busy={togglingTaskId === task.id}
                onToggle={(t) => void handleToggle(t)}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed ({completedTasks.length})</Text>
          {completedTasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks completed yet.</Text>
          ) : (
            completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={togglingTaskId === task.id}
                onToggle={(t) => void handleToggle(t)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 18 },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: 10,
  },
});
