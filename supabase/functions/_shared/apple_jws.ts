// Apple App Store Server Notifications V2 — JWS verifier.
//
// Apple POSTs a JWS where the header carries an x5c certificate chain
// terminating at Apple Root CA - G3. To accept the payload as authentic we
// must:
//   1. Verify each cert in x5c is signed by the next (chain validity).
//   2. Verify the root cert (last in x5c) matches Apple Root CA - G3 by
//      cryptographic fingerprint (this is what proves the chain is Apple's,
//      not just any valid chain).
//   3. Verify the JWS signature using the leaf cert's public key.
//
// Failing any step → return null. Callers MUST NOT trust the payload
// otherwise.

import { X509Certificate } from "https://esm.sh/@peculiar/x509@1.9.7";
import { logError, logWarn, truncate } from "./log.ts";

// SHA-256 fingerprint of Apple Root CA - G3, in lowercase hex with no
// separators. Source: Apple PKI page (https://www.apple.com/certificateauthority/).
// Apple Root CA - G3 is the root that signs App Store Server Notifications V2.
//
// If Apple ever rotates this root, update here and redeploy. Allow override
// via env var so a rotation incident doesn't require a code change.
const APPLE_ROOT_CA_G3_SHA256_DEFAULT =
  "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";

function getPinnedFingerprint(): string {
  return (Deno.env.get("APPLE_ROOT_CA_G3_SHA256") || APPLE_ROOT_CA_G3_SHA256_DEFAULT).toLowerCase();
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

interface JwsHeader {
  alg: string;
  x5c?: string[];
}

interface VerifiedJws<T = unknown> {
  payload: T;
  notificationUUID?: string;
}

// JOSE -> WebCrypto signature shape: ES256 in JWS is r||s (64 bytes for P-256)
// — which is what crypto.subtle.verify already expects, so no conversion needed.

export async function verifyAppleJws<T = unknown>(jws: string): Promise<VerifiedJws<T> | null> {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return null;

    const headerJson = new TextDecoder().decode(b64urlDecode(parts[0]));
    const header = JSON.parse(headerJson) as JwsHeader;
    if (header.alg !== "ES256") {
      logWarn("[apple_jws] unexpected alg", header.alg);
      return null;
    }
    if (!Array.isArray(header.x5c) || header.x5c.length < 2) {
      logWarn("[apple_jws] missing or short x5c chain");
      return null;
    }

    // Parse certs (x5c entries are base64 DER, NOT base64url)
    const certs = header.x5c.map((b64) => {
      const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new X509Certificate(der);
    });

    // 1. Pin: last cert in chain MUST match Apple Root CA G3 by fingerprint.
    const rootDer = new Uint8Array(certs[certs.length - 1].rawData);
    const rootFp = await sha256Hex(rootDer);
    const expected = getPinnedFingerprint();
    if (rootFp !== expected) {
      logWarn("[apple_jws] root cert fingerprint mismatch", { got: rootFp, expected });
      return null;
    }

    // 2. Validate each cert is signed by the next one up.
    for (let i = 0; i < certs.length - 1; i++) {
      const child = certs[i];
      const parent = certs[i + 1];
      const ok = await child.verify({ publicKey: await parent.publicKey.export() });
      if (!ok) {
        logWarn("[apple_jws] cert chain signature invalid at index", i);
        return null;
      }
    }

    // 3. Validate cert validity windows (notBefore/notAfter).
    const now = new Date();
    for (const c of certs) {
      if (now < c.notBefore || now > c.notAfter) {
        logWarn("[apple_jws] cert outside validity window", { notBefore: c.notBefore, notAfter: c.notAfter });
        return null;
      }
    }

    // 4. Verify JWS signature with leaf public key.
    const leafKey = await certs[0].publicKey.export({ name: "ECDSA", namedCurve: "P-256" }, ["verify"]);
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = b64urlDecode(parts[2]);
    const sigOk = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      leafKey,
      sig,
      signingInput,
    );
    if (!sigOk) {
      logWarn("[apple_jws] JWS signature verification failed");
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as T & {
      notificationUUID?: string;
    };
    return { payload, notificationUUID: payload.notificationUUID };
  } catch (e) {
    logError("[apple_jws] verify error:", truncate(e instanceof Error ? e.message : String(e)));
    return null;
  }
}
