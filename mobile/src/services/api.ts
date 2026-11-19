import axios from 'axios';
import { auth } from './firebase';
import {
  DayOfWeek,
  ExperienceLevel,
  GenerateRoadmapResponse,
} from '../types/planner';

const DEFAULT_API_URL =
  'https://ais-pre-oy5dihwswdppnwg52a74h2-6339083860.asia-southeast1.run.app';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL
).replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 65000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export async function generateRoadmapViaBackend(
  input: GenerateRoadmapInput
): Promise<GenerateRoadmapResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Please sign in before generating a roadmap.');
  }
  const idToken = await currentUser.getIdToken();

  try {
    const response = await apiClient.post<GenerateRoadmapResponse>(
      '/api/roadmaps/generate',
      input,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      }
    );

    const data = response.data;
    if (!data?.roadmap || !Array.isArray(data.roadmap.phases)) {
      throw new Error('Server returned an unexpected roadmap format.');
    }
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const serverMsg = (err.response?.data as { error?: string } | undefined)?.error;
      if (err.code === 'ECONNABORTED') {
        throw new Error('Roadmap generation timed out. Please try again.');
      }
      throw new Error(
        serverMsg || err.message || 'Unable to connect to Smart Skill Planner server.'
      );
    }
    throw err instanceof Error
      ? err
      : new Error('Unable to generate roadmap right now.');
  }
}
