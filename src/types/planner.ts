import { Timestamp } from 'firebase/firestore';

export type ExperienceLevel = 'student' | 'junior' | 'mid' | 'senior';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type TaskType = 'theory' | 'practice' | 'project';
export type ResourceType = 'article' | 'video' | 'course';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'user' | 'admin';
  fullName: string;
  education: string;
  fieldOfStudy: string;
  profession: string;
  experienceLevel: ExperienceLevel;
  currentSkills: string[];
  careerGoal: string;
  targetRole: string;
  availableHoursPerDay: number;
  preferredDays: DayOfWeek[];
  onboardingCompleted: boolean;
  roadmapCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface GapAnalysis {
  have: string[];
  improve: string[];
  new: string[];
}

export interface RoadmapMilestone {
  id: string;
  orderIndex: number;
  title: string;
}

export interface RoadmapPhase {
  id: string;
  orderIndex: number;
  title: string;
  durationWeeks: number;
  milestones: RoadmapMilestone[];
}

export interface Roadmap {
  id: string;
  userId: string;
  goalText: string;
  targetRole: string;
  gapAnalysis: GapAnalysis;
  phases: RoadmapPhase[];
  totalTasks: number;
  completedTasks: number;
  status: 'active' | 'archived';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TaskResource {
  title: string;
  url: string;
  type: ResourceType;
}

export interface TaskItem {
  id: string;
  roadmapId: string;
  phaseId: string;
  milestoneId: string;
  userId: string;
  title: string;
  type: TaskType;
  estMinutes: number;
  dayOffset: number;
  resources: TaskResource[];
  isCompleted: boolean;
  completedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AiLogEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  promptSummary: string;
  prompt: string;
  responseSummary: string;
  status: 'success' | 'error';
  errorMessage: string;
  createdAt: Timestamp | null;
}

// Raw payload returned by POST /api/roadmaps/generate
export interface GeneratedRoadmapPayload {
  gap_analysis: GapAnalysis;
  phases: {
    title: string;
    duration_weeks: number;
    milestones: {
      title: string;
      tasks: {
        title: string;
        type: TaskType;
        est_minutes: number;
        day_offset: number;
        resources: TaskResource[];
      }[];
    }[];
  }[];
}

export interface GenerateRoadmapResponse {
  promptSummary: string;
  prompt: string;
  roadmap: GeneratedRoadmapPayload;
}
