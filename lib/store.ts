// Simple in-memory store for passing data between screens
// Avoids issues with passing large URIs through route params

let _pendingImageUri: string | null = null;

export function setPendingImageUri(uri: string) {
  _pendingImageUri = uri;
}

export function popPendingImageUri(): string | null {
  const uri = _pendingImageUri;
  _pendingImageUri = null;
  return uri;
}
