export function decodePasetoPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 3) return null; // no es un token válido

    const payloadBase64 = parts[2]; // 👈 Paseto guarda el payload aquí
    const padded = payloadBase64!.padEnd(
      payloadBase64!.length + ((4 - (payloadBase64!.length % 4)) % 4),
      "="
    );
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(json);
  } catch (err) {
    console.error("Error decoding Paseto:", err);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodePasetoPayload(token);
    if (!payload || !payload.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (err) {
    console.error("Error checking token expiration:", err);
    return true;
  }
}

export function getTimeUntilExpiry(token: string): number {
  try {
    const payload = decodePasetoPayload(token);
    if (!payload || !payload.exp) return 0;

    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - currentTime);
  } catch (err) {
    console.error("Error calculating time until expiry:", err);
    return 0;
  }
}
