import React, { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { usePlannerStore } from '../store/usePlannerStore';
import { toggleTaskCompletion } from '../services/firestoreService';
import { TaskCard } from '../components/TaskCard';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { TaskItem } from '../types/planner';
import { colors, radii, shadows, spacing } from '../theme';

type TabParamList = {
  Home: undefined;
  Roadmap: undefined;
  Tasks: undefined;
  Progress: undefined;
  Profile: undefined;
};

function getCurrentDayOffset(createdAt: { toMillis?: () => number } | null | undefined): number {
  const createdMs = createdAt?.toMillis?.() ?? Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.floor((Date.now() - createdMs) / dayMs);
  return Math.max(1, elapsed + 1);
}

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

  const currentDay = useMemo(
    () => getCurrentDayOffset(roadmap?.createdAt ?? null),
    [roadmap?.createdAt]
  );

  const displayedToday = useMemo(() => {
    const exact = tasks.filter(
      (t) => !t.isCompleted && t.dayOffset === currentDay
    );
    if (exact.length > 0) return exact.slice(0, 4);
    const overdue = tasks.filter(
      (t) => !t.isCompleted && t.dayOffset < currentDay
    );
    return overdue.slice(0, 4);
  }, [tasks, currentDay]);

  const handleToggle = async (task: TaskItem) => {
    if (!roadmap || togglingTaskId) return;
    if (!task.isCompleted && task.dayOffset > currentDay) return;
    setTogglingTaskId(task.id);
    try {
      await toggleTaskCompletion(task, roadmap, tasks);
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleRegenerate = () => {
    if (!roadmap) {
      setShowOnboarding(true);
      return;
    }
    Alert.alert(
      'Generate a new roadmap?',
      'Your current roadmap will be saved in Past roadmaps. A new plan will become active.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => setShowOnboarding(true) },
      ]
    );
  };

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Home"
          title={`Welcome back, ${firstName}`}
          subtitle={
            roadmap
              ? `Day ${currentDay} · ${roadmap.targetRole}`
              : 'Ready to build your learning plan'
          }
        />

        {!roadmap ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="map-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No active roadmap yet</Text>
            <Text style={styles.emptySub}>
              Complete your learning profile to generate a personalized AI roadmap.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setShowOnboarding(true)}
            >
              <Text style={styles.primaryBtnText}>Create Roadmap</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>Overall Progress</Text>
                  <Text style={styles.heroPct}>{progressPct}%</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    {completedCount}/{totalCount}
                  </Text>
                  <Text style={styles.heroBadgeSub}>tasks</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>

              <Text style={styles.goalLabel}>Active goal</Text>
              <Text style={styles.goalText} numberOfLines={3}>
                {roadmap.goalText}
              </Text>

              <View style={styles.heroActions}>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('Roadmap')}
                >
                  <Text style={styles.primaryBtnText}>View Roadmap</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryIconBtn}
                  onPress={handleRegenerate}
                >
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            {(roadmap.gapAnalysis.have.length > 0 ||
              roadmap.gapAnalysis.improve.length > 0 ||
              roadmap.gapAnalysis.new.length > 0) && (
              <View style={styles.gapRow}>
                <View style={[styles.gapPill, { backgroundColor: colors.successSoft }]}>
                  <Text style={[styles.gapPillLabel, { color: colors.success }]}>Have</Text>
                  <Text style={styles.gapPillValue}>
                    {roadmap.gapAnalysis.have.length}
                  </Text>
                </View>
                <View style={[styles.gapPill, { backgroundColor: colors.amberSoft }]}>
                  <Text style={[styles.gapPillLabel, { color: colors.amber }]}>Improve</Text>
                  <Text style={styles.gapPillValue}>
                    {roadmap.gapAnalysis.improve.length}
                  </Text>
                </View>
                <View style={[styles.gapPill, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.gapPillLabel, { color: colors.primary }]}>New</Text>
                  <Text style={styles.gapPillValue}>
                    {roadmap.gapAnalysis.new.length}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today&apos;s focus</Text>
              <Pressable onPress={() => navigation.navigate('Tasks')}>
                <Text style={styles.sectionLink}>See all</Text>
              </Pressable>
            </View>

            {displayedToday.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyInlineText}>
                  You&apos;re caught up for Day {currentDay}.
                </Text>
              </View>
            ) : (
              displayedToday.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  busy={togglingTaskId === task.id}
                  onToggle={(t) => void handleToggle(t)}
                />
              ))
            )}
          </>
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
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroPct: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  heroBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  heroBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  heroBadgeSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 99,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  goalText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryIconBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  gapPill: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  gapPillLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  gapPillValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    ...shadows.soft,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 20,
  },
  emptyInline: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  emptyInlineText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
