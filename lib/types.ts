export interface Difference {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GenerateResponse {
  originalImage: string;
  modifiedImage: string;
  differences: Difference[];
  totalChanges: number;
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
}

export interface ConfirmPaymentResponse {
  paid: boolean;
  sessionId: string | null;
}

export interface AppVersionResponse {
  minimumVersion: string;
}
