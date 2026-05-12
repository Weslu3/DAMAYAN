import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "./types";

const SESSION_KEY = "damayan.mobile.session";

export async function saveSession(session: AuthSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Failed to save session:", error);
    throw error;
  }
}

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const stored = await AsyncStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AuthSession;
  } catch (error) {
    console.error("Failed to load session:", error);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error("Failed to clear session:", error);
    throw error;
  }
}

export function hasRole(session: AuthSession | null, requiredRole: string): boolean {
  if (!session) return false;
  return session.user.role === requiredRole;
}
