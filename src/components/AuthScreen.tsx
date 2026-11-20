import React, { useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, Layers, Target } from 'lucide-react';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import {
  INACTIVE_ACCOUNT_MESSAGE,
  isProfileActive,
  UserProfile,
} from '../types/planner';

interface AuthScreenProps {
  onSignedIn?: () => void;
  onOpenAdminLogin: () => void;
  initialError?: string | null;
  onConsumeInitialError?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSignedIn,
  onOpenAdminLogin,
  initialError = null,
  onConsumeInitialError,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
      onConsumeInitialError?.();
    }
  }, [initialError, onConsumeInitialError]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      try {
        const snap = await getDocFromServer(doc(db, 'profiles', result.user.uid));
        if (snap.exists()) {
          const profile = snap.data() as UserProfile;
          if (!isProfileActive(profile)) {
            await signOut(auth);
            setError(INACTIVE_ACCOUNT_MESSAGE);
            return;
          }
        }
      } catch {
        // App-level gate still enforces after profile sync
      }
      onSignedIn?.();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled before completing.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to sign in right now. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            S
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Smart Skill Planner
          </span>
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        >
          Sign In
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-sm font-semibold text-indigo-600">
              AI-Powered Learning Roadmaps
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
              Turn your career goal into a daily, structured skill plan.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Share your current skills, target role, and weekly study hours. Smart
              Skill Planner maps your exact skill gaps into phased milestones,
              hands-on tasks, and curated resources.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-slate-200/80">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                  <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Skill Gap Analysis</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Separates what you have, what to sharpen, and new skills to learn.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                  <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Phased Milestones</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Balanced theory, practice, and real projects sized to your schedule.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Daily Progress Sync</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Check off tasks each day and watch your completion metrics update live.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl mb-5 shadow-md shadow-indigo-500/20">
                S
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1.5">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 mb-7">
                Sign in with your Google account to create your roadmap or access your
                dashboard.
              </p>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with Google</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="mt-5 text-xs text-slate-400 text-center leading-relaxed">
                New learners start with a 4-step profile setup to generate a tailored
                AI learning roadmap.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Administrator? Sign in to Admin Console →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
