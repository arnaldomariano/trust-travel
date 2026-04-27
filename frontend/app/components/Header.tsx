"use client";

/* ===================== Imports ===================== */
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import { getInitials, getColorFromName } from "../lib/avatar";
/* ===================== End Imports ===================== */


export default function Header() {

  /* ===================== Hooks ===================== */
const { username, displayName, avatarUrl, isLoggedIn, loading, logout } = useAuth();

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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <HeaderAvatar
                name={displayName || username || "User"}
                avatarUrl={avatarUrl}
              />

              <strong style={{ color: "#444" }}>
                {displayName || username}
              </strong>
            </div>

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

function HeaderAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid #eee",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: getColorFromName(name),
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: "12px",
      }}
    >
      {getInitials(name)}
    </div>
  );
}