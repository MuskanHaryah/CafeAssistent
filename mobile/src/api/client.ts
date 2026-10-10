import Constants from 'expo-constants';
import type { ChatRequest, ChatResponse, MenuResponse } from '../types';

// Resolution order:
// 1. EXPO_PUBLIC_API_URL env var (explicit override)
// 2. On web served from a non-localhost host (e.g. phone opening http://192.168.1.x:8081),
//    use that same hostname for the backend.
// 3. Inferred LAN IP from Expo Go hostUri (Expo Go on physical device).
// 4. Fallback to localhost:3000 (iOS sim, Android emulator with reverse, desktop web).
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3000`;
    }
  }

  const hostUri =
    (Constants.expoConfig as any)?.hostUri ??
    (Constants as any)?.manifest2?.extra?.expoGo?.developer?.hostUri;
  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3000`;
    }
  }
  return 'http://localhost:3000';
}

export const API_BASE = resolveBaseUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  getMenu: () => request<MenuResponse>('/api/menu'),
  chat: (body: ChatRequest) =>
    request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
