import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Capacitor } from '@capacitor/core';

export const nativeSecureStorage = {
  getItem(key: string): string | null | Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return localStorage.getItem(key);
    return SecureStoragePlugin.get({ key })
      .then(({ value }) => value)
      .catch(() => null);
  },
  setItem(key: string, value: string): void | Promise<void> {
    if (!Capacitor.isNativePlatform()) { localStorage.setItem(key, value); return; }
    return SecureStoragePlugin.set({ key, value }).then(() => {});
  },
  removeItem(key: string): void | Promise<void> {
    if (!Capacitor.isNativePlatform()) { localStorage.removeItem(key); return; }
    return SecureStoragePlugin.remove({ key }).catch(() => {});
  },
};
