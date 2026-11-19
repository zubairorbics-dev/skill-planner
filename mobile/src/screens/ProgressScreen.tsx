import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlannerStore } from '../store/usePlannerStore';
import { colors } from '../theme';

export const ProgressScreen: React.FC = () => {
  const { roadmap, tasks } = usePlannerStore();

  const totalCount = tasks.length || roadmap?.totalTasks || 0;
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const remainingCount = Math.max(0, totalCount - completedCount);
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>
          {roadmap ? roadmap.targetRole : 'Generate a roadmap to track progress'}
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Overall Completion</Text>
          <Text style={styles.heroPct}>{pct}%</Text>
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
              <Text style={styles.metricLabel}>Total Tasks</Text>
            </View>
          </View>
        </View>

        {roadmap ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Phase Breakdown</Text>
            {roadmap.phases.map((phase) => {
              const pTasks = tasks.filter((t) => t.phaseId === phase.id);
              const pDone = pTasks.filter((t) => t.isCompleted).length;
              const pPct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
              return (
                <View key={phase.id} style={styles.phaseRow}>
                  <View style={styles.phaseTop}>
                    <Text style={styles.phaseName} numberOfLines={1}>
                      {phase.title}
                    </Text>
                    <Text style={styles.phaseStat}>
                      {pDone}/{pTasks.length} ({pPct}%)
                    </Text>
                  </View>
                  <View style={styles.smallTrack}>
                    <View style={[styles.fill, { width: `${pPct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 18 },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  heroPct: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 10,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginVertical: 16,
  },
  smallTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: 6,
  },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 99 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metricBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 },
  phaseRow: { marginBottom: 14 },
  phaseTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  phaseName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  phaseStat: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
