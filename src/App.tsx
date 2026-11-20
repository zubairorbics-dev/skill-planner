import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  BarChart3,
  CheckSquare,
  Home,
  Map as MapIcon,
  User as UserIcon,
} from 'lucide-react';
import { adminClientAuth, auth, isAdminFirestoreUser } from './lib/firebase';
import {
  AdminSessionInfo,
  logoutAdminSession,
  verifyStoredAdminSession,
} from './lib/adminAuth';
import {
  ensureUserProfile,
  subscribeActiveRoadmap,
  subscribeRoadmapTasks,
  subscribeUserProfile,
  toggleTaskCompletion,
} from './lib/firestoreService';
import {
  INACTIVE_ACCOUNT_MESSAGE,
  isProfileActive,
  Roadmap,
  TaskItem,
  UserProfile,
} from './types/planner';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingWizard } from './components/OnboardingWizard';
import { DashboardView } from './components/DashboardView';
import { RoadmapView } from './components/RoadmapView';
import { TasksView } from './components/TasksView';
import { ProgressView } from './components/ProgressView';
import { ProfileView } from './components/ProfileView';
import { AdminConsole } from './components/AdminConsole';
import { AdminLoginScreen } from './components/AdminLoginScreen';

type LearnerTab = 'dashboard' | 'roadmap' | 'tasks' | 'progress' | 'profile';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export default function App() {
  const [routePath, setRoutePath] = useState<string>(() => window.location.pathname);

  // Admin password session + isolated Firebase Auth (auto-connects Firestore)
  const [adminSession, setAdminSession] = useState<AdminSessionInfo | null>(null);
  const [adminChecking, setAdminChecking] = useState<boolean>(true);
  const [adminFsReady, setAdminFsReady] = useState(false);
  const [adminFsUserOk, setAdminFsUserOk] = useState(false);

  // Learner Firebase Auth & Firestore State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<LearnerTab>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoutePath(path);
  }, []);

  useEffect(() => {
    const onPopState = () => setRoutePath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Isolated Admin Firebase Auth (password login signs in here — no Google)
  useEffect(() => {
    const unsub = onAuthStateChanged(adminClientAuth, (firebaseUser) => {
      setAdminFsUserOk(isAdminFirestoreUser(firebaseUser));
      setAdminFsReady(true);
    });
    return unsub;
  }, []);

  // Verify existing Admin session token on boot; drop it if Firestore auth is gone
  useEffect(() => {
    if (!adminFsReady) return;
    let active = true;
    verifyStoredAdminSession()
      .then(async (session) => {
        if (!active) return;
        if (session && !isAdminFirestoreUser(adminClientAuth.currentUser)) {
          await logoutAdminSession();
          setAdminSession(null);
          return;
        }
        setAdminSession(session);
      })
      .finally(() => {
        if (active) setAdminChecking(false);
      });
    return () => {
      active = false;
    };
  }, [adminFsReady]);

  // 1a. Learner Firebase Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setRoadmap(null);
        setTasks([]);
        setProfileLoading(false);
        setShowOnboarding(false);
      }
    });
    return unsub;
  }, []);

  // 2. Ensure learner profile exists and subscribe in realtime
  useEffect(() => {
    if (!user) return;
    let active = true;
    let unsubProfile: (() => void) | null = null;

    setProfileLoading(true);
    ensureUserProfile(user)
      .then(async (initialProfile) => {
        if (!active) return;
        if (!isProfileActive(initialProfile)) {
          setAuthBannerError(INACTIVE_ACCOUNT_MESSAGE);
          setProfileLoading(false);
          await signOut(auth);
          return;
        }
        setProfile(initialProfile);
        setProfileLoading(false);
        unsubProfile = subscribeUserProfile(user.uid, (nextProfile) => {
          if (!nextProfile) return;
          if (!isProfileActive(nextProfile)) {
            setAuthBannerError(INACTIVE_ACCOUNT_MESSAGE);
            void signOut(auth);
            return;
          }
          setProfile(nextProfile);
        });
      })
      .catch((err) => {
        console.error('Failed to load user profile:', err);
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
      unsubProfile?.();
    };
  }, [user]);

  // 3. Subscribe to user's active roadmap (only after active profile is ready)
  useEffect(() => {
    if (!user || !profile || !isProfileActive(profile)) return;
    return subscribeActiveRoadmap(
      user.uid,
      (rm) => {
        setRoadmap(rm);
        if (!rm) setTasks([]);
      },
      (err) => console.warn('Roadmap subscription error:', err.message)
    );
  }, [user, profile?.uid, profile?.accountStatus]);

  // 4. Subscribe to tasks for the active roadmap
  useEffect(() => {
    if (!user || !profile || !isProfileActive(profile) || !roadmap) return;
    return subscribeRoadmapTasks(
      user.uid,
      roadmap.id,
      (items) => {
        setTasks(items);
      },
      (err) => console.warn('Tasks subscription error:', err.message)
    );
  }, [user, profile?.uid, profile?.accountStatus, roadmap?.id]);

  const handleLearnerSignOut = async () => {
    await signOut(auth);
    showToast('Signed out.');
  };

  const handleAdminLogout = async () => {
    await logoutAdminSession();
    setAdminSession(null);
  };

  const handleToggleTask = async (task: TaskItem) => {
    if (!roadmap || togglingTaskId) return;
    const currentDay = (() => {
      const createdMs = roadmap.createdAt?.toMillis?.() ?? Date.now();
      const elapsed = Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000));
      return Math.max(1, elapsed + 1);
    })();
    if (!task.isCompleted && task.dayOffset > currentDay) {
      showToast('Upcoming tasks stay locked until their day.');
      return;
    }
    setTogglingTaskId(task.id);
    try {
      const nextState = await toggleTaskCompletion(task, roadmap, tasks);
      showToast(nextState ? 'Task marked complete.' : 'Task moved back to active.');
    } catch {
      showToast('Could not update task right now.');
    } finally {
      setTogglingTaskId(null);
    }
  };

  // ==========================================================================
  // SEPARATE ADMIN ROUTE (/admin) — Independent Login & Credentials
  // ==========================================================================
  if (isAdminPath(routePath)) {
    if (adminChecking || !adminFsReady) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Checking admin session...</p>
          </div>
        </div>
      );
    }

    if (!adminSession || !adminFsUserOk) {
      return (
        <AdminLoginScreen
          onSuccess={(admin) => {
            setAdminSession(admin);
            setAdminFsUserOk(isAdminFirestoreUser(adminClientAuth.currentUser));
          }}
          onBackToApp={() => navigate('/')}
        />
      );
    }

    return (
      <AdminConsole
        adminEmail={adminSession.email}
        onExitAdmin={() => navigate('/')}
        onAdminLogout={handleAdminLogout}
      />
    );
  }

  // ==========================================================================
  // LEARNER APPLICATION (/)
  // ==========================================================================
  if (!authReady || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-11 h-11 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading Smart Skill Planner...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <AuthScreen
        onOpenAdminLogin={() => navigate('/admin')}
        initialError={authBannerError}
        onConsumeInitialError={() => setAuthBannerError(null)}
      />
    );
  }

  const needsOnboarding = showOnboarding || !profile.onboardingCompleted;

  const navItems: {
    key: LearnerTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { key: 'dashboard', label: 'Home', icon: Home },
    { key: 'roadmap', label: 'Roadmap', icon: MapIcon },
    { key: 'tasks', label: 'Tasks', icon: CheckSquare },
    { key: 'progress', label: 'Progress', icon: BarChart3 },
    { key: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Strict 3-Zone Top Bar (Learner Only) */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Title */}
          <button
            type="button"
            onClick={() => {
              setShowOnboarding(false);
              setActiveTab('dashboard');
            }}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Smart Skill Planner
          </button>

          {/* Zone 2: Clean Desktop Navigation Links */}
          {!needsOnboarding && (
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                      active
                        ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Roadmap
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {needsOnboarding ? (
          <OnboardingWizard
            user={user}
            profile={profile}
            previousActiveRoadmapId={roadmap?.id ?? null}
            onComplete={() => {
              setShowOnboarding(false);
              setActiveTab('dashboard');
            }}
            onCancel={
              profile.onboardingCompleted ? () => setShowOnboarding(false) : undefined
            }
            onToast={showToast}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                profile={profile}
                roadmap={roadmap}
                tasks={tasks}
                togglingTaskId={togglingTaskId}
                onToggleTask={handleToggleTask}
                onNavigate={(tab) => setActiveTab(tab)}
                onStartOnboarding={() => setShowOnboarding(true)}
              />
            )}
            {activeTab === 'roadmap' && (
              <RoadmapView
                roadmap={roadmap}
                tasks={tasks}
                togglingTaskId={togglingTaskId}
                onToggleTask={handleToggleTask}
                onStartOnboarding={() => setShowOnboarding(true)}
              />
            )}
            {activeTab === 'tasks' && (
              <TasksView
                roadmap={roadmap}
                tasks={tasks}
                togglingTaskId={togglingTaskId}
                onToggleTask={handleToggleTask}
                onStartOnboarding={() => setShowOnboarding(true)}
              />
            )}
            {activeTab === 'progress' && (
              <ProgressView
                profile={profile}
                roadmap={roadmap}
                tasks={tasks}
                onStartOnboarding={() => setShowOnboarding(true)}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileView
                profile={profile}
                hasActiveRoadmap={Boolean(roadmap)}
                onSignOut={handleLearnerSignOut}
                onRegenerateRoadmap={() => setShowOnboarding(true)}
                onToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (5 Tabs) */}
      {!needsOnboarding && (
        <nav
          aria-label="Primary navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center px-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Subtle Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
