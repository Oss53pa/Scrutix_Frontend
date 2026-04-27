export interface AtlasStudioClaims {
  userId: string;
  email: string;
  fullName: string;
  appId: string;
  plan: string;
  iat: number;
  exp: number;
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifyAtlasJWT(token: string, secret: string): Promise<AtlasStudioClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Format JWT invalide");

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecode(signatureB64), data);
  if (!valid) throw new Error("Signature JWT invalide");

  const claims: AtlasStudioClaims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expiré");
  if (!claims.email || !claims.userId) throw new Error("Claims obligatoires manquants");
  if (claims.appId !== "scrutix") throw new Error(`Token destiné à "${claims.appId}", attendu "scrutix"`);

  return claims;
}
