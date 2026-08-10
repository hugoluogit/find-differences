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

let _jwt: string | null = null;

export function saveJwt(jwt: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('playToken', jwt);
  }
  _jwt = jwt;
}

export function getJwt(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('playToken');
  }
  return _jwt;
}

export function clearJwt(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('playToken');
  }
  _jwt = null;
}
