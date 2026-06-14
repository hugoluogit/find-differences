import * as FileSystem from 'expo-file-system/legacy';
import type { GenerateResponse } from './types';

// Default to localhost for development — set EXPO_PUBLIC_API_URL for production
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/generate';

export async function generateGame(imageUri: string): Promise<GenerateResponse> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}
