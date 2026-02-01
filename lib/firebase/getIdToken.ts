"use client";

import { auth } from "@/lib/firebase/client";

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function getAuthHeader(): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}
