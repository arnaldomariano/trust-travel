"use client";

import { useEffect, useState } from "react";
import { getInitials, getColorFromName } from "../lib/avatar";
import { API_URL } from "../lib/api";

export default function ConnectionsPage() {
  const [friends, setFriends] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [searchCode, setSearchCode] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // =========================
  // Load connections
  // =========================
  const loadConnections = async () => {
    try {
      const res = await fetch(`${API_URL}/api/connections/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to load connections:", res.status, errorText);
        return;
      }

      const data = await res.json();

      setFriends(data.friends || []);
      setReceived(data.pending_received || []);
      setSent(data.pending_sent || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  // =========================
  // Send friend request
  // =========================
  const sendFriendRequest = async (code: string) => {
    if (!code.trim()) {
      alert("Please enter a user code.");
      return;
    }

    const res = await fetch(`${API_URL}/api/friends/send/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_code: code }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Error sending request");
      return;
    }

    setSearchCode("");
    await loadConnections();
    window.dispatchEvent(new Event("connectionsUpdated"));
  };

  // =========================
  // Accept request
  // =========================
const acceptRequest = async (id: number) => {
  setActionLoading(id);

  try {
    const res = await fetch(`${API_URL}/api/friends/accept/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request_id: id }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Error accepting request");
      return;
    }

    setReceived((prev) => prev.filter((r) => r.request_id !== id));
    await loadConnections();
    window.dispatchEvent(new Event("connectionsUpdated"));
  } finally {
    setActionLoading(null);
  }
};
  // =========================
  // Reject request
  // =========================
const rejectRequest = async (id: number) => {
  setActionLoading(id);

  try {
    const res = await fetch(`${API_URL}/api/friends/reject/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request_id: id }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Error rejecting request");
      return;
    }

    setReceived((prev) => prev.filter((r) => r.request_id !== id));
    await loadConnections();
    window.dispatchEvent(new Event("connectionsUpdated"));
  } finally {
    setActionLoading(null);
  }
};
  // =========================
  // Cancel sent request
  // =========================
const cancelRequest = async (id: number) => {
  setActionLoading(id);

  try {
    const res = await fetch(`${API_URL}/api/friends/cancel/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request_id: id }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Error canceling request");
      return;
    }

    setSent((prev) => prev.filter((s) => s.request_id !== id));
    await loadConnections();
    window.dispatchEvent(new Event("connectionsUpdated"));
  } finally {
    setActionLoading(null);
  }
};

  // =========================
  // Remove friend
  // =========================
    const removeFriend = async (userId: number) => {
      const confirmed = window.confirm(
        "Remove this person from your trusted network?"
      );

      if (!confirmed) return;

      setActionLoading(userId);

      try {
        const res = await fetch(`${API_URL}/api/friends/remove/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: userId }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.detail || "Error removing friend");
          return;
        }

        setFriends((prev) => prev.filter((f) => f.id !== userId));
        await loadConnections();
        window.dispatchEvent(new Event("connectionsUpdated"));
      } finally {
        setActionLoading(null);
      }
    };


  return (
        <main style={page}>
      <section style={heroCard}>
        <div style={eyebrow}>Trust network</div>

        <h1 style={title}>Connections</h1>

        <p style={heroText}>
          Manage the people whose travel experiences you trust. Accepted connections
          appear in your Trusted Network feed.
        </p>

        <div style={statsGrid}>
          <div style={statCard}>
            <div style={statLabel}>Trusted friends</div>
            <div style={statValue}>{friends.length}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Requests received</div>
            <div style={statValue}>{received.length}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Requests sent</div>
            <div style={statValue}>{sent.length}</div>
          </div>
        </div>
      </section>

      {/* Add trusted contact */}
        <section style={addFriendCard}>
          <div>
            <h2 style={sectionTitle}>Add trusted contact</h2>

            <p style={helperText}>
              Enter the public code of the person you want to add to your trusted network.
            </p>
          </div>

          <div style={addFriendBox}>
            <input
              placeholder="Enter user code, e.g. XXb86q"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              style={input}
            />

            <button
              onClick={() => sendFriendRequest(searchCode)}
              style={{
                ...primaryButton,
                opacity: searchCode.trim() ? 1 : 0.5,
                cursor: searchCode.trim() ? "pointer" : "not-allowed",
              }}
              disabled={!searchCode.trim()}
            >
              Send request
            </button>
          </div>
        </section>
      {/* Trusted friends */}
      <ConnectionSection title="Trusted Network">
        {friends.length === 0 ? (
          <p style={emptyText}>
              No trusted connections yet. Add someone by public code to start building your network.
            </p>
        ) : (
          friends.map((friend) => (
            <ConnectionRow
              key={friend.id}
              avatarName={friend.display_name || friend.username}
              avatarUrl={friend.avatar_url}
              primaryText={friend.display_name || friend.username}
              secondaryText={friend.public_code}
              status="Friend"
              actions={
                <button
                  style={secondaryButton}
                  disabled={actionLoading === friend.id}
                  onClick={() => removeFriend(friend.id)}
                >
                  {actionLoading === friend.id ? "Removing..." : "Remove"}
                </button>
              }
            />
          ))
        )}
      </ConnectionSection>

      {/* Pending received */}
      <ConnectionSection title="Requests received">
        {received.length === 0 ? (
          <p style={emptyText}>No pending requests received.</p>
        ) : (
          received.map((request) => (
            <ConnectionRow
              key={request.request_id}
              avatarName={request.public_code || request.username}
              avatarUrl={request.avatar_url}
              primaryText={request.public_code}
              secondaryText={request.display_name || request.username}
              status="Wants to connect"
              actions={
                <div style={actionGroup}>
                <button
                  style={primaryButton}
                  disabled={actionLoading === request.request_id}
                  onClick={() => acceptRequest(request.request_id)}
                >
                  {actionLoading === request.request_id ? "Accepting..." : "Accept"}
                </button>
                <button
                  style={secondaryButton}
                  disabled={actionLoading === request.request_id}
                  onClick={() => rejectRequest(request.request_id)}
                >
                  {actionLoading === request.request_id ? "Rejecting..." : "Reject"}
                </button>
                </div>
              }
            />
          ))
        )}
      </ConnectionSection>

      {/* Pending sent */}
      <ConnectionSection title="Requests sent">
        {sent.length === 0 ? (
          <p style={emptyText}>No pending requests sent.</p>
        ) : (
          sent.map((request) => (
            <ConnectionRow
              key={request.request_id}
              avatarName={request.public_code || request.username}
              avatarUrl={request.avatar_url}
              primaryText={request.public_code}
              secondaryText={request.display_name || request.username}
              status="Pending"
              actions={
                <button
                  style={secondaryButton}
                  disabled={actionLoading === request.request_id}
                  onClick={() => cancelRequest(request.request_id)}
                >
                  {actionLoading === request.request_id ? "Canceling..." : "Cancel"}
                </button>
              }
            />
          ))
        )}
      </ConnectionSection>
    </main>
  );
}

/* =========================
   Components
========================= */

function ConnectionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={section}>
      <h2 style={sectionTitle}>{title}</h2>
      <div style={list}>{children}</div>
    </section>
  );
}

function ConnectionRow({
  avatarName,
  avatarUrl,
  primaryText,
  secondaryText,
  status,
  actions,
}: {
  avatarName: string;
  avatarUrl?: string | null;
  primaryText: string;
  secondaryText?: string;
  status: string;
  actions: React.ReactNode;
}) {
  return (
    <div style={row}>
      <Avatar name={avatarName} avatarUrl={avatarUrl} />

      <div style={identityBlock}>
        <strong style={primaryTextStyle}>{primaryText}</strong>
        {secondaryText && <span style={secondaryTextStyle}>{secondaryText}</span>}
      </div>

      <div style={statusStyle}>{status}</div>

      <div style={actionsStyle}>{actions}</div>
    </div>
  );
}

const Avatar = ({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid #eee",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "46px",
        height: "46px",
        borderRadius: "50%",
        background: getColorFromName(name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "bold",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
};
/* =========================
   Styles
========================= */

const page = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "40px",
};

const title = {
  marginTop: 0,
  marginBottom: "16px",
};

const addFriendBox = {
  display: "flex",
  gap: "10px",
  marginBottom: "38px",
  flexWrap: "wrap" as const,
};

const section = {
  marginBottom: "44px",
};

const sectionTitle = {
  marginBottom: "16px",
};

const list = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "12px",
};

const row = {
  display: "grid",
  gridTemplateColumns: "56px minmax(180px, 1fr) 150px auto",
  alignItems: "center",
  gap: "14px",
  padding: "14px 16px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
};

const identityBlock = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "2px",
};

const primaryTextStyle = {
  fontSize: "16px",
};

const secondaryTextStyle = {
  fontSize: "13px",
  color: "#666",
};

const statusStyle = {
  fontSize: "13px",
  color: "#666",
};

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
};

const actionGroup = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  minWidth: "220px",
};

const primaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  cursor: "pointer",
};

const secondaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};

const emptyText = {
  color: "#666",
  marginTop: "4px",
};

const heroCard = {
  padding: "24px",
  border: "1px solid #eee",
  borderRadius: "18px",
  background: "white",
  marginBottom: "26px",
};

const eyebrow = {
  fontSize: "13px",
  color: "#777",
  marginBottom: "6px",
};

const heroText = {
  color: "#666",
  lineHeight: 1.5,
  marginTop: "-12px",
  marginBottom: "20px",
  maxWidth: "680px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
};

const statCard = {
  padding: "14px",
  border: "1px solid #eee",
  borderRadius: "14px",
  background: "#fafafa",
};

const statLabel = {
  fontSize: "12px",
  color: "#777",
};

const statValue = {
  marginTop: "6px",
  fontSize: "22px",
  fontWeight: 700,
};

const addFriendCard = {
  padding: "20px",
  border: "1px solid #eee",
  borderRadius: "16px",
  background: "white",
  marginBottom: "38px",
};

const helperText = {
  color: "#666",
  lineHeight: 1.5,
  marginTop: "-8px",
  marginBottom: "16px",
};