import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlannerStore } from '../store/usePlannerStore';
import { toggleTaskCompletion } from '../services/firestoreService';
import { TaskCard } from '../components/TaskCard';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { TaskItem } from '../types/planner';
import { colors, radii, shadows, spacing } from '../theme';

function getCurrentDayOffset(createdAt: { toMillis?: () => number } | null | undefined): number {
  const createdMs = createdAt?.toMillis?.() ?? Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.floor((Date.now() - createdMs) / dayMs);
  return Math.max(1, elapsed + 1);
}

export const RoadmapScreen: React.FC = () => {
  const { roadmap, tasks, togglingTaskId, setTogglingTaskId, setShowOnboarding } =
    usePlannerStore();
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(
    roadmap?.phases?.[0]?.id ?? 'phase_1'
  );

  const currentDay = useMemo(
    () => getCurrentDayOffset(roadmap?.createdAt ?? null),
    [roadmap?.createdAt]
  );

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

  if (!roadmap) {
    return (
      <AppScreen edges={['top', 'left', 'right']} style={styles.emptySafe}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="map-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No roadmap yet</Text>
          <Text style={styles.emptySub}>
            Generate a personalized plan to unlock phases, milestones, and tasks.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setShowOnboarding(true)}
          >
            <Text style={styles.primaryBtnText}>Generate Roadmap</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Learning path"
          title={roadmap.targetRole}
          subtitle={roadmap.goalText}
        />

        <View style={styles.gapCard}>
          <Text style={styles.gapHeading}>Skill gap analysis</Text>
          {roadmap.gapAnalysis.have.length > 0 ? (
            <Text style={styles.gapLine}>
              <Text style={[styles.gapLabel, { color: colors.success }]}>Have: </Text>
              {roadmap.gapAnalysis.have.join(', ')}
            </Text>
          ) : null}
          {roadmap.gapAnalysis.improve.length > 0 ? (
            <Text style={styles.gapLine}>
              <Text style={[styles.gapLabel, { color: colors.amber }]}>Improve: </Text>
              {roadmap.gapAnalysis.improve.join(', ')}
            </Text>
          ) : null}
          {roadmap.gapAnalysis.new.length > 0 ? (
            <Text style={styles.gapLine}>
              <Text style={[styles.gapLabel, { color: colors.primary }]}>New: </Text>
              {roadmap.gapAnalysis.new.join(', ')}
            </Text>
          ) : null}
        </View>

        {roadmap.phases.map((phase) => {
          const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
          const doneCount = phaseTasks.filter((t) => t.isCompleted).length;
          const pct =
            phaseTasks.length > 0
              ? Math.round((doneCount / phaseTasks.length) * 100)
              : 0;
          const isOpen = expandedPhaseId === phase.id;

          return (
            <View key={phase.id} style={styles.phaseCard}>
              <Pressable
                style={styles.phaseHeader}
                onPress={() => setExpandedPhaseId(isOpen ? null : phase.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                  <Text style={styles.phaseMeta}>
                    {phase.durationWeeks} weeks · {doneCount}/{phaseTasks.length} · {pct}%
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.phaseBody}>
                  {phase.milestones.map((ms) => {
                    const msTasks = phaseTasks.filter((t) => t.milestoneId === ms.id);
                    return (
                      <View key={ms.id} style={styles.milestoneBlock}>
                        <Text style={styles.milestoneTitle}>{ms.title}</Text>
                        {msTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            showResources
                            busy={togglingTaskId === task.id}
                            locked={!task.isCompleted && task.dayOffset > currentDay}
                            onToggle={(t) => void handleToggle(t)}
                          />
                        ))}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
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
  emptySafe: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyCard: {
    width: '100%',
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
  primaryBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  gapCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
    gap: 6,
    ...shadows.soft,
  },
  gapHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  gapLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  gapLabel: {
    fontWeight: '700',
  },
  phaseCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
    ...shadows.soft,
  },
  phaseHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  phaseMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  phaseBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  milestoneBlock: {
    marginTop: 14,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
});
