import React from 'react';
import { BookOpen, Check, ExternalLink, PlayCircle, GraduationCap } from 'lucide-react';
import { TaskItem, TaskType } from '../types/planner';

interface TaskRowProps {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
  disabled?: boolean;
  showResources?: boolean;
}

const TYPE_STYLES: Record<TaskType, { label: string; textClass: string }> = {
  theory: { label: 'Theory', textClass: 'text-blue-700 font-semibold' },
  practice: { label: 'Practice', textClass: 'text-violet-700 font-semibold' },
  project: { label: 'Project', textClass: 'text-emerald-700 font-semibold' },
};

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggle,
  disabled = false,
  showResources = false,
}) => {
  const typeMeta = TYPE_STYLES[task.type] ?? TYPE_STYLES.theory;

  const getResourceIcon = (type: string) => {
    if (type === 'video') return <PlayCircle className="w-3.5 h-3.5 shrink-0" />;
    if (type === 'course') return <GraduationCap className="w-3.5 h-3.5 shrink-0" />;
    return <BookOpen className="w-3.5 h-3.5 shrink-0" />;
  };

  return (
    <div
      className={`group flex items-start gap-3.5 py-3.5 border-b border-slate-100 last:border-b-0 transition-colors ${
        task.isCompleted ? 'opacity-85' : ''
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(task)}
        aria-label={task.isCompleted ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
        className="min-w-[44px] min-h-[44px] -m-2.5 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
      >
        <span
          className={`w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
            task.isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white scale-100'
              : 'bg-white border-slate-300 group-hover:border-indigo-400'
          }`}
        >
          {task.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(task)}
          className="text-left w-full cursor-pointer disabled:cursor-default"
        >
          <p
            className={`text-sm leading-snug transition-colors ${
              task.isCompleted
                ? 'line-through text-slate-400'
                : 'text-slate-900 font-medium group-hover:text-indigo-700'
            }`}
          >
            {task.title}
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-500 tabular-nums">
          <span className={typeMeta.textClass}>{typeMeta.label}</span>
          <span aria-hidden="true">·</span>
          <span>{task.estMinutes} min</span>
          <span aria-hidden="true">·</span>
          <span>Day {task.dayOffset}</span>
        </div>

        {showResources && task.resources && task.resources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {task.resources.map((res, idx) => (
              <a
                key={`${res.url}-${idx}`}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors max-w-full"
              >
                {getResourceIcon(res.type)}
                <span className="truncate max-w-[210px]">{res.title}</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
