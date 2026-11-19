import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin ONLY for ID token verification (requires no IAM roles)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

// ============================================================================
// Separate Admin Credentials & Signed Session Tokens
// ============================================================================
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@smartskillplanner.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const revokedAdminTokens = new Set<string>();
const adminLoginFailures = new Map<string, number[]>();
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 10;

function safeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signAdminToken(email: string): string {
  const payloadObj = {
    email,
    role: 'admin',
    jti: crypto.randomBytes(12).toString('hex'),
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyAdminToken(token: string): { email: string; role: 'admin'; jti: string } | null {
  if (!token || revokedAdminTokens.has(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (!safeStringEqual(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (
      !parsed ||
      parsed.role !== 'admin' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return { email: parsed.email, role: 'admin', jti: String(parsed.jti ?? '') };
  } catch {
    return null;
  }
}

const adminLoginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(200),
});

// Initialize Gemini API server-side client with bounded timeout and no silent 60s retry loops
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 25000,
      retryOptions: {
        attempts: 1,
      },
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// Zod Schemas & Sanitization
// ============================================================================
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(input: unknown): string {
  if (typeof input !== 'string') return 'https://developer.mozilla.org/';
  const trimmed = input.trim();
  if (!trimmed) return 'https://developer.mozilla.org/';
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const generateRequestSchema = z.object({
  fullName: z.string().min(1).max(100),
  education: z.string().min(1).max(80),
  fieldOfStudy: z.string().min(1).max(100),
  profession: z.string().min(1).max(100),
  experienceLevel: z.enum(['student', 'junior', 'mid', 'senior']),
  currentSkills: z.array(z.string().min(1).max(60)).max(25),
  careerGoal: z.string().min(5).max(600),
  targetRole: z.string().min(2).max(120),
  availableHoursPerDay: z.number().min(0.5).max(6),
  preferredDays: z
    .array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']))
    .min(1)
    .max(7),
});

const resourceOutputSchema = z.object({
  title: z.string().min(2).max(160).transform(stripHtml),
  url: z.preprocess(
    normalizeUrl,
    z
      .string()
      .url()
      .refine(
        (u) => u.startsWith('https://') || u.startsWith('http://'),
        'Resource URL must use http or https protocol'
      )
      .catch('https://developer.mozilla.org/')
  ),
  type: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : 'article'),
    z.enum(['article', 'video', 'course']).catch('article')
  ),
});

const taskOutputSchema = z.object({
  title: z.string().min(2).max(200).transform(stripHtml),
  type: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : 'practice'),
    z.enum(['theory', 'practice', 'project']).catch('practice')
  ),
  est_minutes: z.coerce.number().int().min(10).max(480).catch(45),
  day_offset: z.coerce.number().int().min(1).max(365).catch(1),
  resources: z
    .array(resourceOutputSchema)
    .min(1)
    .max(4)
    .catch([
      {
        title: 'Official Documentation Guide',
        url: 'https://roadmap.sh/',
        type: 'article',
      },
    ]),
});

const milestoneOutputSchema = z.object({
  title: z.string().min(2).max(160).transform(stripHtml),
  tasks: z.array(taskOutputSchema).min(1).max(6),
});

const phaseOutputSchema = z.object({
  title: z.string().min(2).max(160).transform(stripHtml),
  duration_weeks: z.coerce.number().int().min(1).max(6).catch(2),
  milestones: z.array(milestoneOutputSchema).min(1).max(5),
});

const roadmapOutputSchema = z.object({
  gap_analysis: z.object({
    have: z.array(z.string().min(1).max(80).transform(stripHtml)).max(20).catch([]),
    improve: z.array(z.string().min(1).max(80).transform(stripHtml)).max(20).catch([]),
    new: z.array(z.string().min(1).max(80).transform(stripHtml)).min(1).max(20),
  }),
  phases: z.array(phaseOutputSchema).min(2).max(6),
});

function buildRoadmapPrompt(profile: z.infer<typeof generateRequestSchema>): string {
  const skillsList =
    profile.currentSkills.length > 0 ? profile.currentSkills.join(', ') : 'None listed yet';
  return `You are an expert career and learning advisor. Based on this user profile, generate a personalized learning roadmap as STRICT JSON matching the exact schema below. Do NOT include markdown, code fences, or explanations. Return ONLY valid JSON.

USER PROFILE:
- Education: ${stripHtml(profile.education)} (${stripHtml(profile.fieldOfStudy)})
- Profession: ${stripHtml(profile.profession)}
- Experience: ${profile.experienceLevel}
- Current skills: ${skillsList}
- Career goal: ${stripHtml(profile.careerGoal)}
- Target role: ${stripHtml(profile.targetRole)}
- Available learning time: ${profile.availableHoursPerDay} hours/day
- Preferred days: ${profile.preferredDays.join(', ')}

REQUIREMENTS:
- Exactly 3 phases, each 2-3 weeks
- Exactly 2 milestones per phase
- 2-3 tasks per milestone (12-16 tasks total)
- Start day_offset at 1 for the first 2-3 tasks (Today), then increment sequentially (2, 3, 4...)
- Mix of theory (30%), practice (50%), project (20%) using exact lowercase: "theory", "practice", "project"
- 1-2 real working HTTPS resource URLs per task (official docs, MDN, AWS/GCP docs, freeCodeCamp, Coursera, YouTube, roadmap.sh) with type "article", "video", or "course"
- Prioritize skill gaps first and keep titles concise and free of HTML

JSON SCHEMA (return EXACTLY this shape):
{
  "gap_analysis": {
    "have": ["skill1"],
    "improve": ["skill2"],
    "new": ["skill3"]
  },
  "phases": [
    {
      "title": "Phase 1: Foundations",
      "duration_weeks": 2,
      "milestones": [
        {
          "title": "Milestone 1.1: Core Concepts",
          "tasks": [
            {
              "title": "Task title",
              "type": "theory",
              "est_minutes": 45,
              "day_offset": 1,
              "resources": [
                { "title": "Resource name", "url": "https://developer.mozilla.org/", "type": "article" }
              ]
            }
          ]
        }
      ]
    }
  ]
}`;
}

// ============================================================================
// Auth Middleware & Per-User Rate Limiter (3 requests / user / hour)
// ============================================================================
interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Firebase token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const userGenerationTimestamps = new Map<string, number[]>();

function checkRoadmapRateLimit(uid: string): { allowed: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const existing = (userGenerationTimestamps.get(uid) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (existing.length >= RATE_LIMIT_MAX) {
    const oldest = existing[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    return { allowed: false, retryAfterMinutes: Math.max(1, Math.ceil(retryAfterMs / 60000)) };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

function recordRoadmapGeneration(uid: string): void {
  const now = Date.now();
  const existing = (userGenerationTimestamps.get(uid) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  existing.push(now);
  userGenerationTimestamps.set(uid, existing);
}

// ============================================================================
// Express App Setup
// ============================================================================
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      frameguard: false,
    })
  );
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==========================================================================
  // Separate Admin Authentication Routes
  // ==========================================================================
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();
    const recentFailures = (adminLoginFailures.get(clientIp) ?? []).filter(
      (ts) => now - ts < ADMIN_LOGIN_WINDOW_MS
    );

    if (recentFailures.length >= ADMIN_LOGIN_MAX_FAILURES) {
      res.status(429).json({
        error: 'Too many failed admin sign-in attempts. Please wait 15 minutes and try again.',
      });
      return;
    }

    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter a valid admin email and password.' });
      return;
    }

    const submittedEmail = parsed.data.email.trim().toLowerCase();
    const submittedPassword = parsed.data.password;

    const emailMatch = safeStringEqual(submittedEmail, ADMIN_EMAIL);
    const passwordMatch = safeStringEqual(submittedPassword, ADMIN_PASSWORD);

    if (!emailMatch || !passwordMatch) {
      recentFailures.push(now);
      adminLoginFailures.set(clientIp, recentFailures);
      res.status(401).json({ error: 'Invalid admin email or password.' });
      return;
    }

    adminLoginFailures.delete(clientIp);
    const token = signAdminToken(ADMIN_EMAIL);
    res.json({
      token,
      admin: {
        email: ADMIN_EMAIL,
        role: 'admin',
      },
    });
  });

  app.get('/api/admin/session', (req: Request, res: Response) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ authenticated: false });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    const verified = verifyAdminToken(token);
    if (!verified) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      admin: {
        email: verified.email,
        role: verified.role,
      },
    });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      revokedAdminTokens.add(token);
    }
    res.json({ ok: true });
  });

  // ==========================================================================
  // POST /api/roadmaps/generate — Authenticated, Rate-Limited, Server-Side Gemini + Zod
  // ==========================================================================
  app.post('/api/roadmaps/generate', requireAuth, async (req: AuthRequest, res: Response) => {
    const uid = req.user!.uid;
    const startedAt = Date.now();

    const parsedInput = generateRequestSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({
        error: 'Invalid profile fields submitted.',
        details: parsedInput.error.flatten(),
      });
      return;
    }

    const rateCheck = checkRoadmapRateLimit(uid);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `You have reached the limit of 3 roadmap generations per hour. Please try again in ${rateCheck.retryAfterMinutes} minute(s).`,
      });
      return;
    }

    const profile = parsedInput.data;
    const prompt = buildRoadmapPrompt(profile);
    const promptSummary = `Generate roadmap for ${stripHtml(profile.targetRole)} (${profile.experienceLevel}, ${profile.availableHoursPerDay}h/day)`.slice(
      0,
      240
    );

    let ai: GoogleGenAI;
    try {
      ai = getGeminiClient();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service unavailable';
      res.status(503).json({ error: msg, prompt, promptSummary });
      return;
    }

    const attempts: { model: string; thinkingLevel: ThinkingLevel }[] = [
      { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    ];

    let lastError = 'Unknown generation error';
    for (let idx = 0; idx < attempts.length; idx++) {
      const { model, thinkingLevel } = attempts[idx];
      const attemptNum = idx + 1;
      try {
        const contents =
          attemptNum === 1
            ? prompt
            : `${prompt}\n\nYour last response was not valid JSON matching the required schema (${lastError}). Return ONLY valid JSON.`;

        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel },
            abortSignal: AbortSignal.timeout(25000),
          },
        });

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          lastError = 'Gemini returned an empty response.';
          continue;
        }

        const cleaned = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(cleaned);
        } catch {
          lastError = 'Gemini returned malformed JSON.';
          continue;
        }

        const validated = roadmapOutputSchema.safeParse(parsedJson);
        if (!validated.success) {
          lastError = validated.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          console.warn(`Roadmap Zod validation failed (${model}):`, lastError);
          continue;
        }

        recordRoadmapGeneration(uid);
        console.log(
          `Generated roadmap for ${uid} (${profile.targetRole}) using ${model} in ${Date.now() - startedAt}ms`
        );
        res.json({
          promptSummary,
          prompt,
          roadmap: validated.data,
        });
        return;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Gemini generation attempt ${attemptNum} (${model}) failed:`, errMsg);
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          res.status(429).json({
            error: 'AI generation is temporarily busy due to rate limits. Please wait a moment and try again.',
            prompt,
            promptSummary,
          });
          return;
        }
        if (
          errMsg.includes('403') ||
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('PERMISSION_DENIED')
        ) {
          res.status(502).json({
            error: 'AI service key configuration error. Please check your Gemini API key in Settings > Secrets.',
            prompt,
            promptSummary,
          });
          return;
        }
        lastError = errMsg;
      }
    }

    res.status(502).json({
      error: `We could not build a valid roadmap right now (${lastError}). Please retry.`,
      prompt,
      promptSummary,
    });
  });

  // Catch-all for unknown /api routes so they never fall through to Vite HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Vite middleware for dev or static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Skill Planner running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
