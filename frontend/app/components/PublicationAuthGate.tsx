"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "../providers/AuthProvider";

type PublicationAuthGateProps = {
  children: ReactNode;
  returnTo: string;
  onContinueExploring?: () => void;
};

export default function PublicationAuthGate({
  children,
  returnTo,
  onContinueExploring,
}: PublicationAuthGateProps) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <p role="status" style={{ color: "#666" }}>
        Checking your session...
      </p>
    );
  }

  if (isLoggedIn) {
    return <>{children}</>;
  }

  const safeReturnTo =
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !/[\\\x00-\x1f\x7f]/.test(returnTo)
      ? returnTo
      : "/destinations";

  const encodedReturnTo = encodeURIComponent(safeReturnTo);

  return (
    <section
      aria-label="Sign in to share"
      style={{
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "14px",
        backgroundColor: "#fafafa",
        maxWidth: "620px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Sign in to share</h3>

      <p style={{ color: "#555", lineHeight: 1.6 }}>
        You can explore Trust Travel without an account. To share an
        experience, event, alert or useful information, please sign in
        or create an account.
      </p>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <Link href={`/login?next=${encodedReturnTo}`}>
          Sign in
        </Link>

        <Link href={`/register?next=${encodedReturnTo}`}>
          Create account
        </Link>

        {onContinueExploring ? (
          <button type="button" onClick={onContinueExploring}>
            Continue exploring
          </button>
        ) : (
          <Link href="/destinations">Continue exploring</Link>
        )}
      </div>
    </section>
  );
}
