"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import app, { db } from '@/firebase/config';

// ─── Profile Types ─────────────────────────────────────────────
type AppUserProfile = {
  name: string;
  email: string;
  displayName: string;
  role: string;
  sentryMode: "full" | "limited";
  uid: string;
};

const initialUser: AppUserProfile = {
  name: "User",
  email: "",
  displayName: "",
  role: "guest",
  sentryMode: "limited",
  uid: "",
};

type AuthContextType = {
  user: AppUserProfile;
  isLoading: boolean;
  setSentryMode: (mode: "full" | "limited") => void;
  logout: () => void;
  setSentryFull: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppUserProfile>(initialUser);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setProfile({
            name: data.displayName || firebaseUser.displayName || 'User',
            email: data.email || firebaseUser.email || '',
            displayName: data.displayName || '',
            role: data.role || 'user',
            sentryMode: data.sentryMode || 'limited',
            uid: firebaseUser.uid,
          });
        } else {
          setProfile({
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            role: 'user',
            sentryMode: 'limited',
            uid: firebaseUser.uid,
          });
        }
      } else {
        setProfile(initialUser);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateFirestoreProfile = async (data: { [key: string]: any }) => {
    if (!profile.uid) return;
    await setDoc(doc(db, 'users', profile.uid), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const setSentryFull = () => updateFirestoreProfile({ sentryMode: 'full' });

  const setSentryMode = (mode: "full" | "limited") => updateFirestoreProfile({ sentryMode: mode });

  const logout = async () => {
    const auth = getAuth(app);
    await signOut(auth);
    setProfile(initialUser);
    localStorage.removeItem("da-costa-consent-given");
  };

  const value = {
    user: profile,
    isLoading,
    setSentryMode,
    logout,
    setSentryFull,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
