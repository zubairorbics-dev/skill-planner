import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  getActiveAdminDb,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AiLogEntry,
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
  const path = `profiles/${user.uid}`;
  try {
    const ref = doc(db, 'profiles', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const email = clampString(user.email ?? 'learner@example.com', 160);
    const isAdminUser = email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
    const initialFullName = clampString(
      user.displayName || email.split('@')[0] || 'Learner',
      100
    );

    const newProfilePayload = {
      uid: user.uid,
      email,
      role: isAdminUser ? ('admin' as const) : ('user' as const),
      fullName: initialFullName,
      education: "Bachelor's Degree",
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, newProfilePayload);
    const createdSnap = await getDoc(ref);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `profiles/${uid}`;
  const ref = doc(db, 'profiles', uid);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export interface ProfileUpdateFields {
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
  onboardingCompleted?: boolean;
}

export async function updateUserProfile(
  uid: string,
  fields: ProfileUpdateFields
): Promise<void> {
  const path = `profiles/${uid}`;
  try {
    const ref = doc(db, 'profiles', uid);
    const hours = Math.min(6, Math.max(0.5, Number(fields.availableHoursPerDay) || 1));
    await updateDoc(ref, {
      fullName: clampString(fields.fullName, 100) || 'Learner',
      education: clampString(fields.education, 80),
      fieldOfStudy: clampString(fields.fieldOfStudy, 100),
      profession: clampString(fields.profession, 100),
      experienceLevel: fields.experienceLevel,
      currentSkills: sanitizeSkills(fields.currentSkills),
      careerGoal: clampString(fields.careerGoal, 600),
      targetRole: clampString(fields.targetRole, 120),
      availableHoursPerDay: hours,
      preferredDays: sanitizeDays(fields.preferredDays),
      ...(fields.onboardingCompleted !== undefined
        ? { onboardingCompleted: fields.onboardingCompleted }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveGeneratedRoadmapAndLog(params: {
  user: User;
  profile: UserProfile;
  updatedFields: ProfileUpdateFields;
  generation: GenerateRoadmapResponse;
  previousActiveRoadmapId?: string | null;
}): Promise<string> {
  const { user, profile, updatedFields, generation, previousActiveRoadmapId } = params;

  if (
    !generation?.roadmap ||
    !Array.isArray(generation.roadmap.phases) ||
    generation.roadmap.phases.length < 2
  ) {
    throw new Error('Received an invalid roadmap payload. Please try generating again.');
  }

  const roadmapId = generateSafeId('rm');
  const logId = generateSafeId('log');
  const path = `roadmaps/${roadmapId}`;

  try {
    // 1. Transform Gemini roadmap into normalized phases + task documents
    const rawPhases = generation.roadmap.phases.slice(0, 8);
    const phases: RoadmapPhase[] = [];
    const taskDocs: { id: string; data: Record<string, unknown> }[] = [];

    rawPhases.forEach((phase, pIdx) => {
      const phaseId = `p${pIdx + 1}`;
      const milestones = (phase.milestones ?? []).slice(0, 6).map((ms, mIdx) => {
        const milestoneId = `p${pIdx + 1}_m${mIdx + 1}`;
        (ms.tasks ?? []).slice(0, 8).forEach((t, tIdx) => {
          if (taskDocs.length >= 180) return;
          const taskId = generateSafeId(`t${pIdx + 1}_${mIdx + 1}_${tIdx + 1}`);
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

        return {
          id: milestoneId,
          orderIndex: mIdx + 1,
          title: clampString(ms.title, 160) || `Milestone ${mIdx + 1}`,
        };
      });

      phases.push({
        id: phaseId,
        orderIndex: pIdx + 1,
        title: clampString(phase.title, 160) || `Phase ${pIdx + 1}`,
        durationWeeks: Math.min(6, Math.max(1, Math.round(phase.duration_weeks || 2))),
        milestones,
      });
    });

    // 2. Batch 1: Archive prior roadmap + create new roadmap + update profile + create AI audit log
    const coreBatch = writeBatch(db);

    if (previousActiveRoadmapId) {
      const prevRef = doc(db, 'roadmaps', previousActiveRoadmapId);
      coreBatch.update(prevRef, {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
    }

    const totalTasks = Math.max(1, taskDocs.length);
    const roadmapRef = doc(db, 'roadmaps', roadmapId);
    coreBatch.set(roadmapRef, {
      id: roadmapId,
      userId: user.uid,
      goalText: clampString(updatedFields.careerGoal, 600) || 'Career Roadmap',
      targetRole: clampString(updatedFields.targetRole, 120) || 'Specialist',
      gapAnalysis: {
        have: (generation.roadmap.gap_analysis?.have ?? [])
          .slice(0, 25)
          .map((s) => clampString(s, 80)),
        improve: (generation.roadmap.gap_analysis?.improve ?? [])
          .slice(0, 25)
          .map((s) => clampString(s, 80)),
        new: (generation.roadmap.gap_analysis?.new ?? [])
          .slice(0, 25)
          .map((s) => clampString(s, 80)),
      },
      phases,
      totalTasks,
      completedTasks: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const hours = Math.min(6, Math.max(0.5, Number(updatedFields.availableHoursPerDay) || 2));
    const profileRef = doc(db, 'profiles', user.uid);
    coreBatch.update(profileRef, {
      fullName: clampString(updatedFields.fullName, 100) || profile.fullName,
      education: clampString(updatedFields.education, 80),
      fieldOfStudy: clampString(updatedFields.fieldOfStudy, 100),
      profession: clampString(updatedFields.profession, 100),
      experienceLevel: updatedFields.experienceLevel,
      currentSkills: sanitizeSkills(updatedFields.currentSkills),
      careerGoal: clampString(updatedFields.careerGoal, 600),
      targetRole: clampString(updatedFields.targetRole, 120),
      availableHoursPerDay: hours,
      preferredDays: sanitizeDays(updatedFields.preferredDays),
      onboardingCompleted: true,
      roadmapCount: Math.min(500, (profile.roadmapCount ?? 0) + 1),
      updatedAt: serverTimestamp(),
    });

    const responseJsonStr = JSON.stringify(generation.roadmap, null, 2).slice(0, 11800);
    const logRef = doc(db, 'ai_logs', logId);
    coreBatch.set(logRef, {
      id: logId,
      userId: user.uid,
      userName: clampString(updatedFields.fullName || profile.fullName, 100),
      userEmail: clampString(profile.email || user.email || 'user@example.com', 160),
      promptSummary: clampString(generation.promptSummary, 240),
      prompt: clampString(generation.prompt, 5900),
      responseSummary: responseJsonStr,
      status: 'success',
      errorMessage: '',
      createdAt: serverTimestamp(),
    });

    await coreBatch.commit();

    // 3. Batch 2+: Commit tasks in safe chunks of 8 (keeps security rule existsAfter/getAfter calls well under 20/batch)
    const TASK_CHUNK_SIZE = 8;
    for (let i = 0; i < taskDocs.length; i += TASK_CHUNK_SIZE) {
      const chunk = taskDocs.slice(i, i + TASK_CHUNK_SIZE);
      const taskBatch = writeBatch(db);
      for (const taskDoc of chunk) {
        taskBatch.set(doc(db, 'tasks', taskDoc.id), taskDoc.data);
      }
      await taskBatch.commit();
    }

    return roadmapId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function logAiGenerationFailure(params: {
  user: User;
  profile: UserProfile;
  promptSummary: string;
  prompt: string;
  errorMessage: string;
}): Promise<void> {
  const logId = generateSafeId('log_err');
  const path = `ai_logs/${logId}`;
  try {
    await setDoc(doc(db, 'ai_logs', logId), {
      id: logId,
      userId: params.user.uid,
      userName: clampString(params.profile.fullName || params.user.displayName || 'Learner', 100),
      userEmail: clampString(params.profile.email || params.user.email || 'user@example.com', 160),
      promptSummary: clampString(params.promptSummary || 'Roadmap generation request', 240),
      prompt: clampString(params.prompt || 'Roadmap generation failed before prompt creation.', 5900),
      responseSummary: '',
      status: 'error',
      errorMessage: clampString(params.errorMessage, 950),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Log silently if audit write fails so original UI error still displays cleanly
    console.error('Failed to record AI error log:', error);
  }
}

export function subscribeActiveRoadmap(
  uid: string,
  onData: (roadmap: Roadmap | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'roadmaps';
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
      docs.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      });
      onData(docs[0]);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export function subscribeRoadmapTasks(
  uid: string,
  roadmapId: string,
  onData: (tasks: TaskItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'tasks';
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
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function toggleTaskCompletion(
  task: TaskItem,
  roadmap: Roadmap,
  allTasks: TaskItem[]
): Promise<boolean> {
  const nextCompleted = !task.isCompleted;
  const path = `tasks/${task.id}`;
  try {
    const batch = writeBatch(db);
    const taskRef = doc(db, 'tasks', task.id);
    batch.update(taskRef, {
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    const currentCompleted = allTasks.filter((t) => t.isCompleted).length;
    const nextCompletedCount = Math.min(
      roadmap.totalTasks,
      Math.max(0, currentCompleted + (nextCompleted ? 1 : -1))
    );
    const roadmapRef = doc(db, 'roadmaps', roadmap.id);
    batch.update(roadmapRef, {
      completedTasks: nextCompletedCount,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return nextCompleted;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Admin Console Queries (Enforced by Firestore Security Rules)
// ============================================================================
export async function fetchAllProfilesAdmin(): Promise<UserProfile[]> {
  const path = 'profiles';
  const { targetDb, targetAuth } = getActiveAdminDb();
  try {
    const snap = await getDocs(collection(targetDb, 'profiles'));
    const list = snap.docs.map((d) => d.data() as UserProfile);
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, targetAuth);
  }
}

export async function fetchAllRoadmapsAdmin(): Promise<Roadmap[]> {
  const path = 'roadmaps';
  const { targetDb, targetAuth } = getActiveAdminDb();
  try {
    const snap = await getDocs(collection(targetDb, 'roadmaps'));
    const list = snap.docs.map((d) => d.data() as Roadmap);
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, targetAuth);
  }
}

export async function fetchAllAiLogsAdmin(): Promise<AiLogEntry[]> {
  const path = 'ai_logs';
  const { targetDb, targetAuth } = getActiveAdminDb();
  try {
    const q = query(collection(targetDb, 'ai_logs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AiLogEntry);
  } catch (error) {
    // Fallback without orderBy if index/ordering fails on empty collection
    try {
      const snap = await getDocs(collection(targetDb, 'ai_logs'));
      const list = snap.docs.map((d) => d.data() as AiLogEntry);
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      return list;
    } catch (fallbackErr) {
      handleFirestoreError(fallbackErr, OperationType.LIST, path, targetAuth);
    }
  }
}
