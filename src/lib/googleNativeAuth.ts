import { registerPlugin } from "@capacitor/core";

export interface GoogleAuthSignInResult {
  idToken: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  grantedScopes: string[];
  email: string;
  name: string;
}

export interface GoogleAuthPlugin {
  signIn(): Promise<GoogleAuthSignInResult>;
  signOut(): Promise<void>;
}

export const GoogleAuth = registerPlugin<GoogleAuthPlugin>("GoogleAuth");
