/* eslint-disable react-refresh/only-export-components */
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./config";
import { fetchProfile, createDefaultProfile, updateLastLogin, UserProfile } from "./useProfile";
function toastDisabledMessage() {
  // Lazily import to avoid a hard dependency if sonner isn't set up yet
  import("sonner").then(({ toast }) => {
    toast.error("Your account has been disabled. Contact your admin.");
  }).catch(() => {});
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        let p = await fetchProfile(u.uid);
        if (!p && u.email) {
          try {
            p = await createDefaultProfile(u.uid, u.email);
          } catch (e) {
            // Failed to create default profile
          }
        }

        // Enforce disabled accounts: sign them out immediately, don't let
        // a disabled TC/admin stay logged in just because their session was
        // already active before an admin disabled them.
        if (p?.status === "disabled") {
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setLoading(false);
          toastDisabledMessage();
          return;
        }

        setUser(u);
        setProfile(p);
        updateLastLogin(u.uid); // fire-and-forget, tracks last active session
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
