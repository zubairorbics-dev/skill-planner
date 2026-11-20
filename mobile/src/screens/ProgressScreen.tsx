import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlannerStore } from '../store/usePlannerStore';
import { AppScreen } from '../components/AppScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radii, shadows, spacing } from '../theme';

export const ProgressScreen: React.FC = () => {
  const { roadmap, tasks, setShowOnboarding } = usePlannerStore();

  const totalCount = tasks.length || roadmap?.totalTasks || 0;
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const remainingCount = Math.max(0, totalCount - completedCount);
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const studyMinutesDone = useMemo(
    () =>
      tasks
        .filter((t) => t.isCompleted)
        .reduce((sum, t) => sum + (t.estMinutes || 0), 0),
    [tasks]
  );

  const phasesDone = useMemo(() => {
    if (!roadmap) return 0;
    return roadmap.phases.filter((phase) => {
      const pTasks = tasks.filter((t) => t.phaseId === phase.id);
      return pTasks.length > 0 && pTasks.every((t) => t.isCompleted);
    }).length;
  }, [roadmap, tasks]);

  return (
    <AppScreen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Insights"
          title="Progress"
          subtitle={
            roadmap
              ? roadmap.targetRole
              : 'Generate a roadmap to track your momentum'
          }
        />

        {!roadmap ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="stats-chart-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No progress yet</Text>
            <Text style={styles.emptySub}>
              Create your AI learning plan to unlock completion metrics and phase tracking.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => setShowOnboarding(true)}
            >
              <Text style={styles.primaryBtnText}>Generate Roadmap</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.ringWrap}>
                <View style={styles.ringOuter}>
                  <View style={styles.ringInner}>
                    <Text style={styles.ringPct}>{pct}%</Text>
                    <Text style={styles.ringLabel}>done</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.heroTitle}>Overall completion</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricNum}>{completedCount}</Text>
                  <Text style={styles.metricLabel}>Completed</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricNum}>{remainingCount}</Text>
                  <Text style={styles.metricLabel}>Remaining</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricNum}>{totalCount}</Text>
                  <Text style={styles.metricLabel}>Total</Text>
                </View>
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.statValue}>
                  {Math.round(studyMinutesDone / 60)}h {studyMinutesDone % 60}m
                </Text>
                <Text style={styles.statLabel}>Study completed</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flag-outline" size={18} color={colors.primary} />
                <Text style={styles.statValue}>
                  {phasesDone}/{roadmap.phases.length}
                </Text>
                <Text style={styles.statLabel}>Phases done</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Phase breakdown</Text>
              {roadmap.phases.map((phase) => {
                const pTasks = tasks.filter((t) => t.phaseId === phase.id);
                const pDone = pTasks.filter((t) => t.isCompleted).length;
                const pPct =
                  pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
                return (
                  <View key={phase.id} style={styles.phaseRow}>
                    <View style={styles.phaseTop}>
                      <Text style={styles.phaseName} numberOfLines={1}>
                        {phase.title}
                      </Text>
                      <Text style={styles.phaseStat}>
                        {pDone}/{pTasks.length} · {pPct}%
                      </Text>
                    </View>
                    <View style={styles.smallTrack}>
                      <View style={[styles.fill, { width: `${pPct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
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
    alignItems: 'center',
    ...shadows.soft,
  },
  ringWrap: {
    marginBottom: 14,
  },
  ringOuter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 10,
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  ringInner: {
    alignItems: 'center',
  },
  ringPct: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  heroTitle: {
    alignSelf: 'stretch',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  track: {
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: 16,
  },
  smallTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 99,
  },
  metricsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  metricNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.soft,
  },
  statValue: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.soft,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  phaseRow: {
    marginBottom: 14,
  },
  phaseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  phaseName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  phaseStat: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
  primaryBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
