import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchRoadmapTasks } from '../services/firestoreService';
import { Roadmap, TaskItem } from '../types/planner';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radii, shadows, spacing } from '../theme';

interface ArchivedRoadmapScreenProps {
  roadmap: Roadmap;
  uid: string;
  onBack: () => void;
}

function formatDate(createdAt: Roadmap['createdAt']): string {
  const ms = createdAt?.toMillis?.();
  if (!ms) return 'Unknown date';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const ArchivedRoadmapScreen: React.FC<ArchivedRoadmapScreenProps> = ({
  roadmap,
  uid,
  onBack,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(
    roadmap.phases?.[0]?.id ?? null
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchRoadmapTasks(uid, roadmap.id)
      .then((items) => {
        if (!active) return;
        setTasks(items);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load tasks for this past roadmap.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid, roadmap.id]);

  const progressPct = useMemo(() => {
    const total = tasks.length || roadmap.totalTasks || 0;
    const done = tasks.filter((t) => t.isCompleted).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [tasks, roadmap.totalTasks]);

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Past roadmap"
          title={roadmap.targetRole}
          subtitle={roadmap.goalText}
          right={
            <Pressable style={styles.backChip} onPress={onBack} hitSlop={10}>
              <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
            </Pressable>
          }
        />

        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Archived</Text>
          </View>
          <Text style={styles.metaText}>{formatDate(roadmap.createdAt)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{progressPct}% complete</Text>
        </View>

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

        <Text style={styles.readOnlyHint}>
          This plan is read-only. Task completion cannot be changed.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading phases...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          roadmap.phases.map((phase) => {
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
                      {phase.durationWeeks} weeks · {doneCount}/{phaseTasks.length} ·{' '}
                      {pct}%
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
                          {msTasks.length === 0 ? (
                            <Text style={styles.emptyTasks}>No tasks in this milestone.</Text>
                          ) : (
                            msTasks.map((task) => (
                              <View
                                key={task.id}
                                style={[
                                  styles.taskRow,
                                  task.isCompleted && styles.taskRowDone,
                                ]}
                              >
                                <Ionicons
                                  name={
                                    task.isCompleted
                                      ? 'checkmark-circle'
                                      : 'ellipse-outline'
                                  }
                                  size={18}
                                  color={
                                    task.isCompleted ? colors.success : colors.textMuted
                                  }
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.taskTitle,
                                      task.isCompleted && styles.taskTitleDone,
                                    ]}
                                  >
                                    {task.title}
                                  </Text>
                                  <Text style={styles.taskMeta}>
                                    Day {task.dayOffset} · {task.estMinutes} min ·{' '}
                                    {task.type}
                                  </Text>
                                </View>
                              </View>
                            ))
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Back to Profile</Text>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  backChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  gapCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  gapHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  gapLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  gapLabel: {
    fontWeight: '700',
  },
  readOnlyHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  phaseCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.soft,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.lg,
  },
  phaseTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  phaseMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  phaseBody: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  milestoneBlock: {
    marginTop: 14,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyTasks: {
    fontSize: 12,
    color: colors.textMuted,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  taskRowDone: {
    opacity: 0.75,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  taskMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },
  backBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
