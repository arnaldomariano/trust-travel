"use client";

/* ===================== Imports ===================== */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import { getInitials, getColorFromName } from "../lib/avatar";
/* ===================== End Imports ===================== */


export default function Header() {

  /* ===================== Hooks ===================== */
const { username, displayName, avatarUrl, isLoggedIn, loading, logout } = useAuth();
const [menuOpen, setMenuOpen] = useState(false);
const menuRef = useRef<HTMLDivElement | null>(null);

  /* ===================== End Hooks ===================== */


  /* ===================== Handle Logout ===================== */
    const handleLogout = () => {
      setMenuOpen(false);
      logout();
    };
  /* ===================== End Handle Logout ===================== */
useEffect(() => {
  if (!menuOpen) return;

  const handleClickOutside = (event: MouseEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(event.target as Node)
    ) {
      setMenuOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [menuOpen]);

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
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "6px 8px",
                  borderRadius: "999px",
                }}
              >
                <HeaderAvatar
                  name={displayName || username || "User"}
                  avatarUrl={avatarUrl}
                />

                <strong style={{ color: "#444" }}>
                  {displayName || username}
                </strong>

                <span style={{ color: "#666", fontSize: "12px" }}>▾</span>
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "48px",
                    width: "240px",
                    padding: "10px",
                    border: "1px solid #eee",
                    borderRadius: "16px",
                    background: "white",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 10px 12px 10px",
                      borderBottom: "1px solid #eee",
                      marginBottom: "8px",
                    }}
                  >
                    <strong style={{ display: "block" }}>
                      {displayName || username}
                    </strong>

                    <span style={{ color: "#666", fontSize: "13px" }}>
                      Trust Travel account
                    </span>
                  </div>

                  <MenuLink href="/destinations" onClick={() => setMenuOpen(false)}>
                      Create / Share
                    </MenuLink>

                    <MenuLink href="/trip-plans" onClick={() => setMenuOpen(false)}>
                      Build my trip
                    </MenuLink>

                    <MenuLink href="/analytics" onClick={() => setMenuOpen(false)}>
                      Insights
                    </MenuLink>

                    <MenuLink href="/my-posts" onClick={() => setMenuOpen(false)}>
                      My Posts
                    </MenuLink>

                  <MenuLink href="/profile" onClick={() => setMenuOpen(false)}>
                    Profile
                  </MenuLink>

                  <MenuLink href="/connections" onClick={() => setMenuOpen(false)}>
                    Connections
                  </MenuLink>

                  <button
                      onClick={handleLogout}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        borderRadius: "10px",
                        background: "white",
                        color: "black",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "14px",
                        marginTop: "8px",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      Logout
                    </button>
                </div>
              )}
            </div>
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

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: "10px",
        textDecoration: "none",
        color: "black",
        fontSize: "14px",
      }}
    >
      {children}
    </Link>
  );
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