import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { bytesToBase64, base64ToBytes } from '@/data/backup';
import { readKv, writeKv } from '@/data/settings';
import { isNative } from './platform';

/**
 * App lock: a PIN stored only as a salted PBKDF2-SHA256 hash, plus optional biometrics
 * (native BiometricPrompt in the APK, WebAuthn platform authenticator in browsers).
 * This is a privacy screen for the device owner, not encryption of the data at rest.
 */

export interface LockConfig {
  enabled: boolean;
  salt: string;
  hash: string;
  iterations: number;
  /** Number of digits, so the pad can check as soon as the PIN is complete. */
  length: number;
  biometric: boolean;
  /** WebAuthn credential id (web only). */
  credentialId: string | null;
  /** Seconds in background before locking again. */
  timeoutSec: number;
}

const LOCK_KEY = 'lock';
const ITERATIONS = 150_000;

export const LOCK_DEFAULTS: LockConfig = { enabled: false, salt: '', hash: '', iterations: ITERATIONS, length: 4, biometric: false, credentialId: null, timeoutSec: 0 };

export const LOCK_TIMEOUTS = [0, 60, 300, 900] as const;

export function getLockConfig(): Promise<LockConfig> {
  return readKv(LOCK_KEY, LOCK_DEFAULTS);
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export async function enableLock(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const current = await getLockConfig();
  await writeKv<LockConfig>(LOCK_KEY, { ...current, enabled: true, salt: bytesToBase64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS, length: pin.length });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const config = await getLockConfig();
  if (!config.enabled) return true;
  const hash = await derive(pin, base64ToBytes(config.salt), config.iterations);
  let diff = hash.length ^ config.hash.length;
  for (let i = 0; i < Math.min(hash.length, config.hash.length); i++) diff |= hash.charCodeAt(i) ^ config.hash.charCodeAt(i);
  return diff === 0;
}

export async function disableLock(): Promise<void> {
  await writeKv<LockConfig>(LOCK_KEY, LOCK_DEFAULTS);
}

export async function updateLock(patch: Partial<Pick<LockConfig, 'timeoutSec' | 'biometric' | 'credentialId'>>): Promise<void> {
  await writeKv<LockConfig>(LOCK_KEY, { ...(await getLockConfig()), ...patch });
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (isNative) return (await BiometricAuth.checkBiometry()).isAvailable;
    return (await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

/** Web: registers a platform credential whose only purpose is a local user-verification check. */
async function registerWebCredential(appName: string): Promise<string | null> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: appName },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: appName, displayName: appName },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  return credential ? bytesToBase64(new Uint8Array(credential.rawId)) : null;
}

export async function enableBiometric(appName: string, reason: string): Promise<boolean> {
  try {
    if (isNative) {
      await BiometricAuth.authenticate({ reason, androidTitle: appName, androidSubtitle: reason, allowDeviceCredential: false });
      await updateLock({ biometric: true });
      return true;
    }
    const credentialId = await registerWebCredential(appName);
    if (!credentialId) return false;
    await updateLock({ biometric: true, credentialId });
    return true;
  } catch {
    return false;
  }
}

export async function verifyBiometric(appName: string, reason: string): Promise<boolean> {
  const config = await getLockConfig();
  if (!config.biometric) return false;
  try {
    if (isNative) {
      await BiometricAuth.authenticate({ reason, androidTitle: appName, androidSubtitle: reason, allowDeviceCredential: false });
      return true;
    }
    if (!config.credentialId) return false;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: base64ToBytes(config.credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
