import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { usePlannerStore } from '../store/usePlannerStore';
import { toggleTaskCompletion } from '../services/firestoreService';
import { TaskCard } from '../components/TaskCard';
import { TaskItem } from '../types/planner';
import { colors } from '../theme';

type TabParamList = {
  Home: undefined;
  Roadmap: undefined;
  Tasks: undefined;
  Progress: undefined;
  Profile: undefined;
};

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const {
    profile,
    roadmap,
    tasks,
    togglingTaskId,
    setTogglingTaskId,
    setShowOnboarding,
  } = usePlannerStore();

  const firstName = (profile?.fullName || 'Learner').trim().split(/\s+/)[0];
  const totalCount = tasks.length || roadmap?.totalTasks || 0;
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayTasks = tasks.filter((t) => t.dayOffset === 1);
  const displayedToday = todayTasks.length > 0 ? todayTasks : tasks.slice(0, 4);

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
        <Text style={styles.welcome}>Welcome back, {firstName}</Text>
        <Text style={styles.subtitle}>
          {roadmap ? roadmap.targetRole : 'Ready to build your learning plan'}
        </Text>

        {!roadmap ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active roadmap yet</Text>
            <Text style={styles.emptySub}>
              Complete your learning profile to generate a personalized AI roadmap.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setShowOnboarding(true)}
            >
              <Text style={styles.primaryBtnText}>Create Roadmap</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Overall Progress</Text>
                  <Text style={styles.summaryPct}>{progressPct}%</Text>
                </View>
                <Text style={styles.summaryCount}>
                  {completedCount} / {totalCount} tasks
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>

              <Text style={styles.goalLabel}>Active Goal</Text>
              <Text style={styles.goalText}>{roadmap.goalText}</Text>

              <Pressable
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('Roadmap')}
              >
                <Text style={styles.primaryBtnText}>View Roadmap</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
              <Pressable onPress={() => navigation.navigate('Tasks')}>
                <Text style={styles.sectionLink}>See all</Text>
              </Pressable>
            </View>

            {displayedToday.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={togglingTaskId === task.id}
                onToggle={(t) => void handleToggle(t)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 32 },
  welcome: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2, marginBottom: 18 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 22,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  summaryPct: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  summaryCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 16,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 99 },
  goalLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  goalText: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4, marginBottom: 16 },
  primaryBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sectionLink: { fontSize: 13, fontWeight: '600', color: colors.primary },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: 18, lineHeight: 20 },
});
