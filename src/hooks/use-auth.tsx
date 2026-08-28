"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// ─── Rewards Constants ─────────────────────────────────────────
const DAILY_LOGIN_BONUS = 2;        // Credits per daily login
const REWARDED_AD_CREDIT = 1;       // Credits per rewarded ad
const REFERRAL_BONUS = 3;           // Credits for referrer + referred
const MAX_DAILY_BONUS_CLAIMS = 1;   // One daily bonus per day

// ─── Profile Types ─────────────────────────────────────────────
type AppUserProfile = {
  name: string;
  email: string;
  displayName: string;
  credits: number;
  isPremium: boolean;
  role: string;
  sentryMode: "full" | "limited";
  uid: string;
  lastDailyLogin?: string;    // ISO date of last daily bonus
  dailyBonusStreak?: number;  // Consecutive days
  referralCode?: string;      // Unique referral code
  referredBy?: string;        // Who referred this user
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
  // Rewards
  claimDailyBonus: () => Promise<boolean>;
  claimRewardedAd: () => Promise<boolean>;
  applyReferral: (code: string) => Promise<boolean>;
  canClaimDailyBonus: boolean;
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

  // ─── Rewards: Daily Login Bonus ──────────────────────────────
  const canClaimDailyBonus = (() => {
    if (!profile.uid) return false;
    const today = new Date().toISOString().split('T')[0];
    return profile.lastDailyLogin !== today;
  })();

  const claimDailyBonus = useCallback(async (): Promise<boolean> => {
    if (!firestore || !profile.uid || !canClaimDailyBonus) return false;
    const today = new Date().toISOString().split('T')[0];
    const lastDate = profile.lastDailyLogin;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const newStreak = lastDate === yesterday ? (profile.dailyBonusStreak || 0) + 1 : 1;
    const bonus = DAILY_LOGIN_BONUS + Math.min(newStreak - 1, 5); // +1 per streak day, max +5

    await updateFirestoreProfile({
      creditBalance: profile.credits + bonus,
      lastDailyLogin: today,
      dailyBonusStreak: newStreak,
    });

    // Log the reward event
    await addDoc(collection(firestore, 'adminEvents'), {
      type: 'daily_login',
      userId: profile.uid,
      amount: bonus,
      timestamp: new Date().toISOString(),
      metadata: { streak: newStreak, bonus },
    });

    setProfile(prev => ({ ...prev, credits: prev.credits + bonus, lastDailyLogin: today, dailyBonusStreak: newStreak }));
    return true;
  }, [firestore, profile.uid, profile.credits, profile.lastDailyLogin, profile.dailyBonusStreak, canClaimDailyBonus]);

  // ─── Rewards: Rewarded Ad ────────────────────────────────────
  const claimRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!firestore || !profile.uid) return false;

    await updateFirestoreProfile({ creditBalance: profile.credits + REWARDED_AD_CREDIT });

    await addDoc(collection(firestore, 'adminEvents'), {
      type: 'rewarded_ad_completed',
      userId: profile.uid,
      amount: REWARDED_AD_CREDIT,
      timestamp: new Date().toISOString(),
      metadata: { rewardType: 'watched_ad' },
    });

    setProfile(prev => ({ ...prev, credits: prev.credits + REWARDED_AD_CREDIT }));
    return true;
  }, [firestore, profile.uid, profile.credits]);

  // ─── Rewards: Referral ───────────────────────────────────────
  const applyReferral = useCallback(async (code: string): Promise<boolean> => {
    if (!firestore || !profile.uid || !code) return false;

    // Check if user already has a referrer
    if (profile.referredBy) return false;

    // Find the referrer by their referral code
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('referralCode', '==', code));
    const snap = await getDocs(q);
    if (snap.empty) return false;

    const referrerDoc = snap.docs[0];
    if (referrerDoc.id === profile.uid) return false; // Can't refer yourself

    // Award credits to both parties
    await updateFirestoreProfile({
      creditBalance: profile.credits + REFERRAL_BONUS,
      referredBy: code,
    });

    // Award referrer
    const referrerCredits = (referrerDoc.data().creditBalance || 0) + REFERRAL_BONUS;
    await setDoc(doc(firestore, 'users', referrerDoc.id), {
      creditBalance: referrerCredits,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Log the referral event
    await addDoc(collection(firestore, 'adminEvents'), {
      type: 'referral',
      userId: profile.uid,
      amount: REFERRAL_BONUS,
      timestamp: new Date().toISOString(),
      metadata: { referredBy: code, referrerId: referrerDoc.id },
    });

    setProfile(prev => ({ ...prev, credits: prev.credits + REFERRAL_BONUS, referredBy: code }));
    return true;
  }, [firestore, profile.uid, profile.credits, profile.referredBy]);

  const value = {
    user: profile,
    isLoading: isAuthLoading || (!!firebaseUser && isProfileLoading),
    upgradeToPremium,
    addCredits,
    decrementCredits,
    setSentryMode,
    logout,
    claimDailyBonus,
    claimRewardedAd,
    applyReferral,
    canClaimDailyBonus,
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
