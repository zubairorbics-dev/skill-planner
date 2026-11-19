import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlannerStore } from '../store/usePlannerStore';
import { toggleTaskCompletion } from '../services/firestoreService';
import { TaskCard } from '../components/TaskCard';
import { TaskItem } from '../types/planner';
import { colors } from '../theme';

export const RoadmapScreen: React.FC = () => {
  const { roadmap, tasks, togglingTaskId, setTogglingTaskId, setShowOnboarding } =
    usePlannerStore();
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>('phase_1');

  const handleToggle = async (task: TaskItem) => {
    if (!roadmap || togglingTaskId) return;
    setTogglingTaskId(task.id);
    try {
      await toggleTaskCompletion(task, roadmap, tasks);
    } finally {
      setTogglingTaskId(null);
    }
  };

  if (!roadmap) {
    return (
      <SafeAreaView style={styles.emptySafe}>
        <Text style={styles.emptyTitle}>No roadmap generated yet</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => setShowOnboarding(true)}
        >
          <Text style={styles.primaryBtnText}>Generate Roadmap</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{roadmap.targetRole}</Text>
        <Text style={styles.subtitle}>{roadmap.goalText}</Text>

        {/* Skill Gap Summary */}
        <View style={styles.gapCard}>
          <Text style={styles.gapHeading}>Skill Gap Analysis</Text>
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

        {/* Accordion of Phases */}
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
                    {phase.durationWeeks} weeks · {doneCount}/{phaseTasks.length} completed ({pct}%)
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  emptySafe: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  primaryBtn: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  container: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 18, lineHeight: 20 },
  gapCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
    gap: 6,
  },
  gapHeading: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  gapLine: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  gapLabel: { fontWeight: '700' },
  phaseCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  phaseHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
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
  progressFill: { height: '100%', backgroundColor: colors.primary },
  phaseBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  milestoneBlock: { marginTop: 14 },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
});
