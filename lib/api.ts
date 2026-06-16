import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { GenerateResponse } from './types';

// Set EXPO_PUBLIC_API_URL to override, e.g. for local development
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://find-differences-m5tr.vercel.app/api/generate';

export async function generateGame(imageUri: string): Promise<GenerateResponse> {
  // Convert HEIC to JPEG (Vercel's Sharp doesn't support HEIC)
  const converted = await manipulateAsync(imageUri, [], { format: SaveFormat.JPEG, compress: 0.85 });
  const base64 = await FileSystem.readAsStringAsync(converted.uri, {
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
