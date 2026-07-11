"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewPlacePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/destinations");
  }, [router]);

  return (
    <main style={{ maxWidth: "680px", margin: "0 auto", padding: "40px" }}>
      <h1>Create a place</h1>

      <p style={{ color: "#666", lineHeight: 1.5 }}>
        Place creation has moved to the guided flow. Redirecting you to the
        correct place creation page...
      </p>
    </main>
  );
}
