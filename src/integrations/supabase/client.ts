import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { Capacitor } from '@capacitor/core';
import { nativeSecureStorage } from './secureStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Use iOS Keychain (via SecureStoragePlugin) on native; localStorage on web dev.
    storage: Capacitor.isNativePlatform() ? nativeSecureStorage : localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  }
});