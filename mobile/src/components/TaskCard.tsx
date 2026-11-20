import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskItem, TaskType } from '../types/planner';
import { colors } from '../theme';

interface TaskCardProps {
  task: TaskItem;
  busy?: boolean;
  showResources?: boolean;
  /** Upcoming tasks cannot be marked complete yet */
  locked?: boolean;
  onToggle: (task: TaskItem) => void;
}

const TYPE_STYLES: Record<TaskType, { label: string; color: string; bg: string }> = {
  theory: { label: 'Theory', color: colors.theory, bg: colors.theoryBg },
  practice: { label: 'Practice', color: colors.practice, bg: colors.practiceBg },
  project: { label: 'Project', color: colors.project, bg: colors.projectBg },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  busy = false,
  showResources = false,
  locked = false,
  onToggle,
}) => {
  const badge = TYPE_STYLES[task.type] ?? TYPE_STYLES.practice;

  return (
    <View
      style={[
        styles.card,
        task.isCompleted && styles.cardDone,
        locked && styles.cardLocked,
      ]}
    >
      <Pressable
        onPress={() => onToggle(task)}
        disabled={busy}
        style={styles.row}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.isCompleted, disabled: locked }}
      >
        <View
          style={[
            styles.checkbox,
            task.isCompleted && styles.checkboxChecked,
            locked && styles.checkboxLocked,
          ]}
        >
          {task.isCompleted ? (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          ) : locked ? (
            <Ionicons name="lock-closed" size={12} color="#94A3B8" />
          ) : null}
        </View>

        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              task.isCompleted && styles.titleDone,
            ]}
          >
            {task.title}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
            <Text style={styles.metaText}>{task.estMinutes} min</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>Day {task.dayOffset}</Text>
          </View>
        </View>
      </Pressable>

      {showResources && task.resources.length > 0 ? (
        <View style={styles.resourcesBox}>
          {task.resources.map((res, idx) => (
            <Pressable
              key={`${res.url}-${idx}`}
              onPress={() => void Linking.openURL(res.url)}
              style={styles.resourceRow}
            >
              <Ionicons
                name="open-outline"
                size={14}
                color={colors.primary}
              />
              <Text style={styles.resourceText} numberOfLines={1}>
                {res.title} ({res.type})
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardDone: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.borderLight,
  },
  cardLocked: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxLocked: {
    borderColor: '#CBD5E1',
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  metaDot: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  resourcesBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 6,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  resourceText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },
});
