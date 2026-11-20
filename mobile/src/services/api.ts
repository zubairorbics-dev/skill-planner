import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from './firebase';
import {
  DayOfWeek,
  ExperienceLevel,
  GenerateRoadmapResponse,
} from '../types/planner';

const DEAD_HOST_MARKERS = ['ais-pre-', 'ais-dev-'];

/**
 * Android emulator reaches the host machine via 10.0.2.2, not localhost / LAN IP.
 * Physical devices should use the computer's LAN IP (see mobile/.env).
 */
function defaultDevApiUrl(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000';
}

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fromExtra = (
    Constants.expoConfig?.extra as { apiUrl?: string } | undefined
  )?.apiUrl?.trim();
  const raw = (fromEnv || fromExtra || defaultDevApiUrl()).replace(/\/+$/, '');

  if (DEAD_HOST_MARKERS.some((marker) => raw.includes(marker))) {
    // Stale Expo/Metro bundles may still inline the old AI Studio URL — ignore it.
    return defaultDevApiUrl();
  }

  return raw;
}

function getApiClient(): { baseUrl: string; client: AxiosInstance } {
  const baseUrl = resolveApiBaseUrl();
  return {
    baseUrl,
    client: axios.create({
      baseURL: baseUrl,
      timeout: 65000,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  };
}

/** Resolved at call time so stale Metro env cannot pin a dead host forever. */
export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

export const API_BASE_URL = resolveApiBaseUrl();

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

function extractServerError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== 'string' || !error.trim()) return null;
  const msg = error.trim();
  // Prefer a short human message; never surface nested JSON payloads
  if (msg.startsWith('{') || msg.includes('{{code') || msg.length > 220) {
    const lower = msg.toLowerCase();
    if (
      lower.includes('503') ||
      lower.includes('high demand') ||
      lower.includes('overloaded')
    ) {
      return 'The AI model is busy right now. Please try again in a moment.';
    }
    return 'We could not build a valid roadmap right now. Please try again.';
  }
  return msg;
}

function looksLikeHtml(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  const sample = data.slice(0, 200).toLowerCase();
  return sample.includes('<!doctype') || sample.includes('<html');
}

export class RoadmapGenerationCancelledError extends Error {
  constructor() {
    super('Roadmap generation was cancelled.');
    this.name = 'RoadmapGenerationCancelledError';
  }
}

export async function generateRoadmapViaBackend(
  input: GenerateRoadmapInput,
  signal?: AbortSignal
): Promise<GenerateRoadmapResponse> {
  const { baseUrl, client } = getApiClient();

  if (!baseUrl) {
    throw new Error(
      'API URL is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env (Android emulator: http://10.0.2.2:3000).'
    );
  }

  if (signal?.aborted) {
    throw new RoadmapGenerationCancelledError();
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in before generating a roadmap.');
  }
  const idToken = await currentUser.getIdToken();

  try {
    const response = await client.post<GenerateRoadmapResponse>(
      '/api/roadmaps/generate',
      input,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        signal,
      }
    );

    const data = response.data;
    if (!data?.roadmap || !Array.isArray(data.roadmap.phases)) {
      throw new Error('Server returned an unexpected roadmap format.');
    }
    return data;
  } catch (err: unknown) {
    if (
      signal?.aborted ||
      (axios.isAxiosError(err) &&
        (err.code === 'ERR_CANCELED' || err.message === 'canceled'))
    ) {
      throw new RoadmapGenerationCancelledError();
    }
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        throw new Error('Roadmap generation timed out. Please try again.');
      }
      if (err.code === 'ERR_NETWORK' || !err.response) {
        throw new Error(
          `Cannot reach the backend at ${baseUrl}. Keep "npm run dev" running in the web project. Android emulator must use http://10.0.2.2:3000.`
        );
      }

      const status = err.response.status;
      const data = err.response.data;
      const serverMsg = extractServerError(data);

      if (status === 404 || looksLikeHtml(data)) {
        throw new Error(
          `Backend not found at ${baseUrl} (HTTP ${status}). Restart Expo with cache clear (npx expo start -c) and point EXPO_PUBLIC_API_URL at your local server.`
        );
      }

      throw new Error(
        serverMsg ||
          err.message ||
          `Unable to generate roadmap (HTTP ${status}).`
      );
    }
    throw err instanceof Error
      ? err
      : new Error('Unable to generate roadmap right now.');
  }
}
