"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

type AppUserProfile = {
  name: string;
  email: string;
  displayName: string;
  credits: number;
  isPremium: boolean;
  role: string;
  sentryMode: "full" | "limited";
  uid: string;
};

const initialUser: AppUserProfile = {
  name: "User",
  email: "",
  displayName: "",
  credits: 0,
  isPremium: false,
  role: "guest",
  sentryMode: "limited",
  uid: "",
};

type AuthContextType = {
  user: AppUserProfile;
  isLoading: boolean;
  upgradeToPremium: () => void;
  addCredits: (amount: number) => void;
  decrementCredits: () => void;
  setSentryMode: (mode: "full" | "limited") => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<AppUserProfile>(initialUser);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !firebaseUser) return null;
    return doc(firestore, 'users', firebaseUser.uid);
  }, [firestore, firebaseUser]);

  const { data: firestoreProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  useEffect(() => {
    if (isAuthLoading || (firebaseUser && isProfileLoading)) {
      return;
    }
    if (firebaseUser && firestoreProfile) {
      setProfile({
        name: firestoreProfile.displayName || firebaseUser.displayName || 'User',
        email: firestoreProfile.email || firebaseUser.email || '',
        displayName: firestoreProfile.displayName || firebaseUser.displayName || '',
        credits: firestoreProfile.creditBalance ?? 5,
        isPremium: firestoreProfile.subscriptionStatus === 'premium',
        role: firestoreProfile.role || 'user',
        sentryMode: firestoreProfile.sentryMode || 'limited',
        uid: firebaseUser.uid,
      });
    } else if (firebaseUser) {
      setProfile(currentProfile => ({
        ...currentProfile,
        name: firebaseUser.displayName || 'User',
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        uid: firebaseUser.uid,
      }));
    } else {
      setProfile(initialUser);
    }
  }, [firestoreProfile, firebaseUser, isProfileLoading, isAuthLoading]);

  const updateFirestoreProfile = async (data: { [key: string]: any }) => {
    if (!userProfileRef) return;
    await setDoc(userProfileRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const upgradeToPremium = () => updateFirestoreProfile({ subscriptionStatus: 'premium' });

  const addCredits = (amount: number) => {
    updateFirestoreProfile({ creditBalance: profile.credits + amount });
  };

  const decrementCredits = () => {
    if (profile.credits > 0) {
      updateFirestoreProfile({ creditBalance: profile.credits - 1 });
    }
  };

  const setSentryMode = (mode: "full" | "limited") => updateFirestoreProfile({ sentryMode: mode });

  const logout = () => {
    setProfile(initialUser);
    localStorage.removeItem("da-costa-consent-given");
  };

  const value = {
    user: profile,
    isLoading: isAuthLoading || (!!firebaseUser && isProfileLoading),
    upgradeToPremium,
    addCredits,
    decrementCredits,
    setSentryMode,
    logout,
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
