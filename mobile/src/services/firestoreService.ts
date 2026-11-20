import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import {
  DayOfWeek,
  ExperienceLevel,
  GenerateRoadmapResponse,
  Roadmap,
  RoadmapPhase,
  TaskItem,
  UserProfile,
} from '../types/planner';

const VALID_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function clampString(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function sanitizeSkills(skills: string[]): string[] {
  const unique = new Set<string>();
  for (const s of skills) {
    const clean = clampString(s, 60);
    if (clean) unique.add(clean);
    if (unique.size >= 25) break;
  }
  return Array.from(unique);
}

function sanitizeDays(days: DayOfWeek[]): DayOfWeek[] {
  const filtered = days.filter((d) => VALID_DAYS.includes(d));
  return filtered.length > 0 ? Array.from(new Set(filtered)).slice(0, 7) : ['Mon', 'Wed', 'Fri'];
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  // Firestore rules read email_verified from the ID token — refresh so create is allowed
  // after the user verifies their email (user.emailVerified can be true while token is stale).
  await user.getIdToken(true);

  const ref = doc(db, 'profiles', user.uid);
  // Prefer server so admin deactivate is not masked by a stale cache
  let snap;
  try {
    snap = await getDocFromServer(ref);
  } catch {
    snap = await getDoc(ref);
  }
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const email = clampString(user.email ?? 'learner@example.com', 160);
  const initialFullName = clampString(
    user.displayName || email.split('@')[0] || 'Learner',
    100
  );

  const payload = {
    uid: user.uid,
    email,
    role: 'user' as const,
    fullName: initialFullName,
    education: '',
    fieldOfStudy: '',
    profession: '',
    experienceLevel: 'mid' as ExperienceLevel,
    currentSkills: [] as string[],
    careerGoal: '',
    targetRole: '',
    availableHoursPerDay: 2,
    preferredDays: ['Mon', 'Wed', 'Fri'] as DayOfWeek[],
    onboardingCompleted: false,
    roadmapCount: 0,
    accountStatus: 'active' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
  } catch (err: unknown) {
    // One retry after another token refresh (handles race right after email verify)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('permission') || msg.includes('Permission')) {
      await user.getIdToken(true);
      await setDoc(ref, payload);
    } else {
      throw err;
    }
  }

  const createdSnap = await getDoc(ref);
  if (!createdSnap.exists()) {
    throw new Error('Profile was created but could not be read back. Please try again.');
  }
  return createdSnap.data() as UserProfile;
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = doc(db, 'profiles', uid);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn('Profile subscription error:', error.message);
    }
  );
}

export async function updateUserProfileFields(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'fullName'
      | 'education'
      | 'fieldOfStudy'
      | 'profession'
      | 'experienceLevel'
      | 'currentSkills'
      | 'careerGoal'
      | 'targetRole'
      | 'availableHoursPerDay'
      | 'preferredDays'
      | 'onboardingCompleted'
    >
  >
): Promise<void> {
  const ref = doc(db, 'profiles', uid);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (updates.fullName !== undefined) payload.fullName = clampString(updates.fullName, 100);
  if (updates.education !== undefined) payload.education = clampString(updates.education, 80);
  if (updates.fieldOfStudy !== undefined)
    payload.fieldOfStudy = clampString(updates.fieldOfStudy, 100);
  if (updates.profession !== undefined) payload.profession = clampString(updates.profession, 100);
  if (updates.experienceLevel !== undefined) payload.experienceLevel = updates.experienceLevel;
  if (updates.currentSkills !== undefined)
    payload.currentSkills = sanitizeSkills(updates.currentSkills);
  if (updates.careerGoal !== undefined) payload.careerGoal = clampString(updates.careerGoal, 600);
  if (updates.targetRole !== undefined) payload.targetRole = clampString(updates.targetRole, 120);
  if (updates.availableHoursPerDay !== undefined) {
    payload.availableHoursPerDay = Math.min(6, Math.max(0.5, Number(updates.availableHoursPerDay)));
  }
  if (updates.preferredDays !== undefined)
    payload.preferredDays = sanitizeDays(updates.preferredDays);
  if (updates.onboardingCompleted !== undefined) {
    payload.onboardingCompleted = Boolean(updates.onboardingCompleted);
  }

  // Firestore UpdateData typing is stricter than our dynamic payload builder
  await updateDoc(ref, payload as never);
}

export async function saveGeneratedRoadmapAndLog(params: {
  user: User;
  profile: UserProfile;
  previousActiveRoadmapId?: string | null;
  profileUpdates: {
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
  };
  generated: GenerateRoadmapResponse;
}): Promise<string> {
  const { user, profile, previousActiveRoadmapId, profileUpdates, generated } = params;
  if (!generated?.roadmap || !Array.isArray(generated.roadmap.phases)) {
    throw new Error('Invalid roadmap payload received from server.');
  }

  const roadmapId = generateSafeId('rm');
  const logId = generateSafeId('log');

  const phases: RoadmapPhase[] = [];
  const taskDocs: { id: string; data: Record<string, unknown> }[] = [];

  generated.roadmap.phases.forEach((p, pIdx) => {
    const phaseId = `phase_${pIdx + 1}`;
    const milestones = p.milestones.map((m, mIdx) => {
      const milestoneId = `ms_${pIdx + 1}_${mIdx + 1}`;
      m.tasks.forEach((t, tIdx) => {
        const taskId = generateSafeId(`t_${pIdx + 1}_${mIdx + 1}_${tIdx + 1}`);
        taskDocs.push({
          id: taskId,
          data: {
            id: taskId,
            roadmapId,
            phaseId,
            milestoneId,
            userId: user.uid,
            title: clampString(t.title, 200) || 'Learning task',
            type: t.type,
            estMinutes: Math.min(600, Math.max(5, Math.round(t.est_minutes || 30))),
            dayOffset: Math.min(365, Math.max(1, Math.round(t.day_offset || 1))),
            resources: (t.resources ?? []).slice(0, 5).map((r) => ({
              title: clampString(r.title, 160) || 'Resource',
              url: r.url,
              type: r.type,
            })),
            isCompleted: false,
            completedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      });

      return { id: milestoneId, title: clampString(m.title, 160) };
    });

    phases.push({
      id: phaseId,
      title: clampString(p.title, 160),
      durationWeeks: Math.min(12, Math.max(1, Math.round(p.duration_weeks))),
      milestones,
    });
  });

  // Batch 1: Core roadmap, profile update, and AI audit log
  const coreBatch = writeBatch(db);

  if (previousActiveRoadmapId) {
    coreBatch.update(doc(db, 'roadmaps', previousActiveRoadmapId), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  }

  coreBatch.set(doc(db, 'roadmaps', roadmapId), {
    id: roadmapId,
    userId: user.uid,
    goalText: clampString(profileUpdates.careerGoal, 600),
    targetRole: clampString(profileUpdates.targetRole, 120),
    gapAnalysis: {
      have: generated.roadmap.gap_analysis.have.slice(0, 25),
      improve: generated.roadmap.gap_analysis.improve.slice(0, 25),
      new: generated.roadmap.gap_analysis.new.slice(0, 25),
    },
    phases,
    totalTasks: Math.max(1, taskDocs.length),
    completedTasks: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  coreBatch.update(doc(db, 'profiles', user.uid), {
    fullName: clampString(profileUpdates.fullName, 100),
    education: clampString(profileUpdates.education, 80),
    fieldOfStudy: clampString(profileUpdates.fieldOfStudy, 100),
    profession: clampString(profileUpdates.profession, 100),
    experienceLevel: profileUpdates.experienceLevel,
    currentSkills: sanitizeSkills(profileUpdates.currentSkills),
    careerGoal: clampString(profileUpdates.careerGoal, 600),
    targetRole: clampString(profileUpdates.targetRole, 120),
    availableHoursPerDay: Math.min(6, Math.max(0.5, Number(profileUpdates.availableHoursPerDay))),
    preferredDays: sanitizeDays(profileUpdates.preferredDays),
    onboardingCompleted: true,
    roadmapCount: Math.min(500, (profile.roadmapCount ?? 0) + 1),
    updatedAt: serverTimestamp(),
  });

  coreBatch.set(doc(db, 'ai_logs', logId), {
    id: logId,
    userId: user.uid,
    userName: clampString(profileUpdates.fullName || profile.fullName, 100),
    userEmail: clampString(profile.email || user.email || 'user@example.com', 160),
    promptSummary: clampString(generated.promptSummary, 240),
    prompt: clampString(generated.prompt, 5900),
    responseSummary: clampString(JSON.stringify(generated.roadmap, null, 2), 11500),
    status: 'success',
    errorMessage: '',
    createdAt: serverTimestamp(),
  });

  await coreBatch.commit();

  // Batch 2+: Commit tasks in safe chunks of 8 to respect Firestore rule batch limits
  const CHUNK_SIZE = 8;
  for (let i = 0; i < taskDocs.length; i += CHUNK_SIZE) {
    const chunk = taskDocs.slice(i, i + CHUNK_SIZE);
    const taskBatch = writeBatch(db);
    for (const taskDoc of chunk) {
      taskBatch.set(doc(db, 'tasks', taskDoc.id), taskDoc.data);
    }
    await taskBatch.commit();
  }

  return roadmapId;
}

export async function fetchUserArchivedRoadmaps(uid: string): Promise<Roadmap[]> {
  // Single-field query avoids a composite index deploy (CLI named-DB index API is flaky).
  const q = query(collection(db, 'roadmaps'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const list = snap.docs
    .map((d) => d.data() as Roadmap)
    .filter((rm) => rm.status === 'archived');
  list.sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );
  return list;
}

export async function fetchRoadmapTasks(
  uid: string,
  roadmapId: string
): Promise<TaskItem[]> {
  const q = query(
    collection(db, 'tasks'),
    where('userId', '==', uid),
    where('roadmapId', '==', roadmapId)
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => d.data() as TaskItem);
  items.sort(
    (a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title)
  );
  return items;
}

export function subscribeActiveRoadmap(
  uid: string,
  onData: (roadmap: Roadmap | null) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'roadmaps'),
    where('userId', '==', uid),
    where('status', '==', 'active')
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(null);
        return;
      }
      const docs = snap.docs.map((d) => d.data() as Roadmap);
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      onData(docs[0]);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn('Roadmap subscription error:', error.message);
    }
  );
}

export function subscribeRoadmapTasks(
  uid: string,
  roadmapId: string,
  onData: (tasks: TaskItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'tasks'),
    where('userId', '==', uid),
    where('roadmapId', '==', roadmapId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as TaskItem);
      items.sort((a, b) => a.dayOffset - b.dayOffset || a.title.localeCompare(b.title));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      else console.warn('Tasks subscription error:', error.message);
    }
  );
}

export async function toggleTaskCompletion(
  task: TaskItem,
  roadmap: Roadmap,
  allTasks: TaskItem[]
): Promise<boolean> {
  const nextCompleted = !task.isCompleted;
  const batch = writeBatch(db);

  batch.update(doc(db, 'tasks', task.id), {
    isCompleted: nextCompleted,
    completedAt: nextCompleted ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });

  const currentCompleted = allTasks.filter((t) => t.isCompleted).length;
  const nextCompletedCount = Math.min(
    roadmap.totalTasks,
    Math.max(0, currentCompleted + (nextCompleted ? 1 : -1))
  );

  batch.update(doc(db, 'roadmaps', roadmap.id), {
    completedTasks: nextCompletedCount,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return nextCompleted;
}
