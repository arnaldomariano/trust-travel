"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AlertPage() {
  const { id } = useParams();
  const router = useRouter();
  const [alert, setAlert] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("access");

    fetch("http://127.0.0.1:8000/api/updates/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const all = [...(data.network || []), ...(data.others || [])];
        const found = all.find((item: any) => String(item.id) === String(id));
        setAlert(found);
      });
  }, [id]);

  if (!alert) {
    return <p>Loading alert...</p>;
  }

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px" }}>

      <button onClick={() => router.push("/")}>
        ← Back
      </button>

      <h1 style={{ marginTop: "20px" }}>⚠️ Alert</h1>

      <div style={{ marginTop: "20px" }}>
        <p><strong>From:</strong> {alert.user}</p>
        <p><strong>Created:</strong> {new Date(alert.created_at).toLocaleString()}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <p>{alert.text}</p>
      </div>

    </main>
  );
}