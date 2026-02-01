"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  User,
  browserLocalPersistence,
  onIdTokenChanged,
  setPersistence,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  refreshToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (typeof window !== "undefined") {
      setPersistence(auth, browserLocalPersistence).catch(() => null);
    }

    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
      const nextToken = nextUser ? await nextUser.getIdToken() : null;
      if (!isMounted) return;

      setUser(nextUser);
      setToken(nextToken);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const refreshToken = async () => {
    if (!auth.currentUser) return null;
    const fresh = await auth.currentUser.getIdToken(true);
    setToken(fresh);
    return fresh;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      refreshToken,
      signOut: () => firebaseSignOut(auth),
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
