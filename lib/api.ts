import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { GenerateResponse, CheckoutResponse, ConfirmPaymentResponse } from './types';

// Set EXPO_PUBLIC_API_URL to override, e.g. for local development
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://find-differences-m5tr.vercel.app';
const CHECKOUT_URL = `${API_URL}/api/checkout`;
const GENERATE_URL = `${API_URL}/api/generate`;
const CONFIRM_URL = `${API_URL}/api/confirm-payment`;

export async function startCheckout(paymentRef: string): Promise<CheckoutResponse> {
  const res = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentRef }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function confirmPayment(paymentRef: string): Promise<ConfirmPaymentResponse> {
  const res = await fetch(CONFIRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentRef }),
  });
  return res.json();
}

export async function generateGame(imageUri: string, sessionId?: string): Promise<GenerateResponse> {
  // Convert HEIC to JPEG (Vercel's Sharp doesn't support HEIC)
  const converted = await manipulateAsync(imageUri, [], { format: SaveFormat.JPEG, compress: 0.85 });
  const base64 = await FileSystem.readAsStringAsync(converted.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const body: Record<string, string> = { image: base64 };
  if (sessionId) body.sessionId = sessionId;

  const res = await fetch(GENERATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}
