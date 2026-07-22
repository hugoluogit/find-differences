import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { GenerateResponse, CheckoutResponse, ConfirmPaymentResponse, AppVersionResponse } from './types';

// Set EXPO_PUBLIC_API_URL to override, e.g. for local development
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://find-differences-m5tr.vercel.app';
const CHECKOUT_URL = `${API_URL}/api/checkout`;
const GENERATE_URL = `${API_URL}/api/generate`;
const CONFIRM_URL = `${API_URL}/api/confirm-payment`;
const APP_VERSION_URL = `${API_URL}/api/app-version`;

export async function startCheckout(paymentRef: string): Promise<CheckoutResponse> {
  const body: Record<string, string> = { paymentRef };
  if (Platform.OS === 'web') {
    body.returnUrl = window.location.origin + window.location.pathname;
  }
  const res = await fetch(CHECKOUT_URL, {
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

export function openPaymentUrl(url: string) {
  if (Platform.OS === 'web') {
    window.location.href = url;
  } else {
    // Import Linking dynamically to avoid web issues
    const { Linking } = require('react-native');
    Linking.openURL(url);
  }
}

export async function confirmPayment(sessionId: string): Promise<ConfirmPaymentResponse> {
  const res = await fetch(CONFIRM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  return res.json();
}

async function readImageAsBase64(imageUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Browser: fetch blob → FileReader → base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/jpeg;base64,... → strip prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
  }
  // Native: convert HEIC to JPEG (Vercel's Sharp doesn't support HEIC)
  const converted = await manipulateAsync(imageUri, [], { format: SaveFormat.JPEG, compress: 0.85 });
  return FileSystem.readAsStringAsync(converted.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function generateGame(imageUri: string, sessionId?: string): Promise<GenerateResponse> {
  const base64 = await readImageAsBase64(imageUri);

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

export async function checkAppVersion(): Promise<AppVersionResponse> {
  const res = await fetch(APP_VERSION_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}
