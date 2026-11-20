import { auth } from './firebase';
import { DayOfWeek, ExperienceLevel, GenerateRoadmapResponse } from '../types/planner';

export interface GenerateRoadmapInput {
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
}

export interface GenerateRoadmapError extends Error {
  status?: number;
  prompt?: string;
  promptSummary?: string;
}

const GENERATION_TIMEOUT_MS = 60000;

export async function requestRoadmapGeneration(
  input: GenerateRoadmapInput,
  externalSignal?: AbortSignal
): Promise<GenerateRoadmapResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to generate a roadmap.');
  }

  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  try {
    response = await fetch('/api/roadmaps/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        externalSignal?.aborted
          ? 'Roadmap generation was cancelled.'
          : 'Roadmap generation timed out. Please try again.'
      );
    }
    throw new Error('Network error while contacting the server. Please try again.');
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Unexpected server response (HTTP ${response.status}). Please refresh and try again.`
    );
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    let message =
      typeof data?.error === 'string' && data.error.trim()
        ? data.error.trim()
        : `Failed to generate roadmap (HTTP ${response.status}). Please try again.`;
    if (
      message.startsWith('{') ||
      message.includes('{{code') ||
      message.length > 220
    ) {
      const lower = message.toLowerCase();
      message =
        lower.includes('503') ||
        lower.includes('high demand') ||
        lower.includes('overloaded')
          ? 'The AI model is busy right now. Please try again in a moment.'
          : 'We could not build a valid roadmap right now. Please try again.';
    }
    const err = new Error(message) as GenerateRoadmapError;
    err.status = response.status;
    err.prompt = data?.prompt;
    err.promptSummary = data?.promptSummary;
    throw err;
  }

  if (
    !data ||
    !data.roadmap ||
    !Array.isArray(data.roadmap.phases) ||
    data.roadmap.phases.length < 2
  ) {
    throw new Error('Received an incomplete roadmap from the server. Please try again.');
  }

  return data as GenerateRoadmapResponse;
}
