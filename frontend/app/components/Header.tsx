"use client";

/* ===================== Imports ===================== */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
/* ===================== End Imports ===================== */


export default function Header() {
  /* ===================== Hooks ===================== */
  const router = useRouter();
  const { username, isLoggedIn, loading, logout } = useAuth();
  /* ===================== End Hooks ===================== */


  /* ===================== Handle Logout ===================== */
    const handleLogout = () => {
      logout();
    };
  /* ===================== End Handle Logout ===================== */


  /* ===================== Render ===================== */
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        borderBottom: "1px solid #e5e5e5",
        marginBottom: "20px",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: "20px",
          fontWeight: "700",
          textDecoration: "none",
          color: "black",
        }}
      >
        Trust Travel
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {loading ? (
          <span style={{ color: "#666" }}>Loading...</span>
        ) : isLoggedIn ? (
        <>
          <span style={{ color: "#444" }}>
            👤 <strong>{username}</strong>
          </span>

          <Link
            href="/profile"
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              textDecoration: "none",
              border: "1px solid #ddd",
              color: "black",
              background: "white",
            }}
          >
            Profile
          </Link>

          <button
            onClick={handleLogout}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: "black",
              color: "white",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </>
        ) : (
          <Link
            href="/login"
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              textDecoration: "none",
              background: "black",
              color: "white",
            }}
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
  /* ===================== End Render ===================== */
}