import { Timestamp } from 'firebase/firestore';

export type ExperienceLevel = 'student' | 'junior' | 'mid' | 'senior';
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type TaskType = 'theory' | 'practice' | 'project';
export type ResourceType = 'article' | 'video' | 'course';
export type AccountStatus = 'active' | 'inactive';

export const INACTIVE_ACCOUNT_MESSAGE =
  'Your account has been deactivated by an administrator. Please contact support for help.';

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
  /** Missing on legacy profiles is treated as active. */
  accountStatus?: AccountStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function isProfileActive(
  profile: Pick<UserProfile, 'accountStatus'> | null | undefined
): boolean {
  return !profile?.accountStatus || profile.accountStatus === 'active';
}

export interface ResourceLink {
  title: string;
  url: string;
  type: ResourceType;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  durationWeeks: number;
  milestones: RoadmapMilestone[];
}

export interface GapAnalysis {
  have: string[];
  improve: string[];
  new: string[];
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  resources: ResourceLink[];
  isCompleted: boolean;
  completedAt: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GeneratedRoadmapPayload {
  gap_analysis: {
    have: string[];
    improve: string[];
    new: string[];
  };
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
        resources: ResourceLink[];
      }[];
    }[];
  }[];
}

export interface GenerateRoadmapResponse {
  promptSummary: string;
  prompt: string;
  roadmap: GeneratedRoadmapPayload;
}
