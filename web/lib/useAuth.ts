"use client";

import { useCallback, useEffect, useState } from "react";
import {
  firebaseEnabled,
  signInWithGoogle,
  signOutUser,
  watchUser,
  type User,
} from "./firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    // `loading` already starts at `firebaseEnabled`, so when Firebase is off
    // it's already false — just skip the auth subscription.
    if (!firebaseEnabled) return;
    return watchUser((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const getToken = useCallback(
    async () => (user ? await user.getIdToken() : null),
    [user],
  );

  return {
    user,
    loading,
    enabled: firebaseEnabled,
    signIn: signInWithGoogle,
    signOut: signOutUser,
    getToken,
  };
}
