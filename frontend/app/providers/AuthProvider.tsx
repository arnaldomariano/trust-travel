"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../lib/api";

/* ===================== Types ===================== */
type AuthContextType = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isStaff: boolean;
  isSuperuser: boolean;
  isLoggedIn: boolean;
  loading: boolean;
  refreshUser: () => Promise<boolean>;
  logout: () => void;
};

/* ===================== Context ===================== */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ===================== Provider ===================== */
export function AuthProvider({ children }: { children: React.ReactNode }) {

    const [username, setUsername] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isStaff, setIsStaff] = useState(false);
    const [isSuperuser, setIsSuperuser] = useState(false);
    const [loading, setLoading] = useState(true);

  /* ===================== Load Current User ===================== */
    const refreshUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/me/`, {
          credentials: "include",
        });

        if (!res.ok) {
          setUsername(null);
          setDisplayName(null);
          setAvatarUrl(null);
          setIsStaff(false);
          setIsSuperuser(false);
          return false;
        }

        const data = await res.json();

        setUsername(data.username);
        setDisplayName(data.display_name || data.username);
        setAvatarUrl(data.avatar_url || null);
        setIsStaff(Boolean(data.is_staff));
        setIsSuperuser(Boolean(data.is_superuser));

        return true;
      } catch (error) {
        console.error("Error loading current user:", error);
        setUsername(null);
        setDisplayName(null);
        setAvatarUrl(null);
        setIsStaff(false);
        setIsSuperuser(false);
        return false;
      } finally {
        // 🔥 ESSA LINHA É O QUE FALTA
        setLoading(false);
      }
    };

  /* ===================== Initial Load ===================== */
    useEffect(() => {
      const init = async () => {
        await refreshUser();
      };

      init();
    }, []);
  /* ===================== Logout ===================== */
    const logout = async () => {
      try {
        await fetch(`${API_URL}/api/logout/`, {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("Logout failed:", error);
      }

      setUsername(null);
      setDisplayName(null);
      setAvatarUrl(null);
      setIsStaff(false);
      setIsSuperuser(false);
      // force full reset
      window.location.href = "/login";
    };
  return (
    <AuthContext.Provider
    value={{
      username,
      displayName,
      avatarUrl,
      isStaff,
      isSuperuser,
      isLoggedIn: !!username,
      loading,
      refreshUser,
      logout,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ===================== Custom Hook ===================== */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}