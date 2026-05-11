import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Capacitor } from '@capacitor/core';

// In-memory shadow of values written to / read from Keychain. Eliminates
// the ~50 ms-per-call Capacitor bridge round-trip on hot paths like
// supabase-js's _useSession() (called transitively by every supabase.from(...),
// every realtime channel subscribe, and every realtime setAuth() — easily
// 20+ times in the seconds following Google sign-in).
const _cache = new Map<string, string | null>();
const _ready = new Set<string>();

export const nativeSecureStorage = {
  getItem(key: string): string | null | Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return localStorage.getItem(key);
    if (_ready.has(key)) return _cache.get(key) ?? null;
    return SecureStoragePlugin.get({ key })
      .then(({ value }) => {
        _cache.set(key, value);
        _ready.add(key);
        return value;
      })
      .catch(() => {
        _cache.set(key, null);
        _ready.add(key);
        return null;
      });
  },
  setItem(key: string, value: string): void | Promise<void> {
    if (!Capacitor.isNativePlatform()) { localStorage.setItem(key, value); return; }
    _cache.set(key, value);
    _ready.add(key);
    return SecureStoragePlugin.set({ key, value }).then(() => {});
  },
  removeItem(key: string): void | Promise<void> {
    if (!Capacitor.isNativePlatform()) { localStorage.removeItem(key); return; }
    _cache.set(key, null);
    _ready.add(key);
    return SecureStoragePlugin.remove({ key }).catch(() => {});
  },
};
