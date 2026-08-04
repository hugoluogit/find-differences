export interface Difference {
  x: number;
  y: number;
  w: number;
  h: number;
  description_en: string;
  description_zh: string;
}

export interface GenerateResponse {
  originalImage: string;
  modifiedImage: string;
  differences: Difference[];
  totalChanges: number;
  remainingPlays?: number;
  newPlayToken?: string | null;
}

export interface GameState {
  originalImage: string;
  modifiedImage: string;
  differences: Difference[];
  foundIndices: number[];
  totalChanges: number;
  status: 'playing' | 'completed';
}

export interface CheckoutResponse {
  url: string;
  sessionId: string;
  plays: number;
}

export interface ConfirmPaymentResponse {
  paid: boolean;
  playToken: string | null;
  plays?: number;
  reason?: string;
}

export interface AppVersionResponse {
  minimumVersion: string;
}

export interface VerifyReceiptResponse {
  jwt: string;
  playsRemaining: number;
}

export type PlanOption = 1 | 5 | 10;

export interface PlanConfig {
  plays: PlanOption;
  price: string;
  label: string;
}
