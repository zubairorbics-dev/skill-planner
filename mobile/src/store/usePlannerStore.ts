import { create } from 'zustand';
import { User } from 'firebase/auth';
import { Roadmap, TaskItem, UserProfile } from '../types/planner';

interface PlannerState {
  user: User | null;
  authReady: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  roadmap: Roadmap | null;
  tasks: TaskItem[];
  togglingTaskId: string | null;
  showOnboarding: boolean;

  setUser: (user: User | null) => void;
  setAuthReady: (ready: boolean) => void;
  setProfile: (profile: UserProfile | null) => void;
  setProfileLoading: (loading: boolean) => void;
  setRoadmap: (roadmap: Roadmap | null) => void;
  setTasks: (tasks: TaskItem[]) => void;
  setTogglingTaskId: (id: string | null) => void;
  setShowOnboarding: (show: boolean) => void;
  resetUserData: () => void;
}

export const usePlannerStore = create<PlannerState>((set) => ({
  user: null,
  authReady: false,
  profile: null,
  profileLoading: true,
  roadmap: null,
  tasks: [],
  togglingTaskId: null,
  showOnboarding: false,

  setUser: (user) => set({ user }),
  setAuthReady: (authReady) => set({ authReady }),
  setProfile: (profile) => set({ profile }),
  setProfileLoading: (profileLoading) => set({ profileLoading }),
  setRoadmap: (roadmap) => set({ roadmap }),
  setTasks: (tasks) => set({ tasks }),
  setTogglingTaskId: (togglingTaskId) => set({ togglingTaskId }),
  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),
  resetUserData: () =>
    set({
      profile: null,
      roadmap: null,
      tasks: [],
      profileLoading: false,
      showOnboarding: false,
      togglingTaskId: null,
    }),
}));
