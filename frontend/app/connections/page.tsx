"use client";

import { useEffect, useState } from "react";
import { getInitials, getColorFromName } from "../lib/avatar";
import { API_URL } from "../lib/api";

export default function ConnectionsPage() {
  const [friends, setFriends] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [searchCode, setSearchCode] = useState("");

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
  };

  // =========================
  // Reject request
  // =========================
  const rejectRequest = async (id: number) => {
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
  };

  // =========================
  // Cancel sent request
  // =========================
  const cancelRequest = async (id: number) => {
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
  };

  // =========================
  // Remove friend
  // =========================
  const removeFriend = async (userId: number) => {
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
  };

  return (
    <main style={page}>
      <h1 style={title}>Connections</h1>

      {/* Add friend */}
      <section style={addFriendBox}>
        <input
          placeholder="Enter user code"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          style={input}
        />

        <button
          onClick={() => sendFriendRequest(searchCode)}
          style={primaryButton}
        >
          Add Friend
        </button>
      </section>

      {/* Trusted friends */}
      <ConnectionSection title="Trusted Friends">
        {friends.length === 0 ? (
          <p style={emptyText}>No friends yet</p>
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
                  onClick={() => removeFriend(friend.id)}
                >
                  Remove
                </button>
              }
            />
          ))
        )}
      </ConnectionSection>

      {/* Pending received */}
      <ConnectionSection title="Pending Received">
        {received.length === 0 ? (
          <p style={emptyText}>None</p>
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
                    onClick={() => acceptRequest(request.request_id)}
                  >
                    Accept
                  </button>

                  <button
                    style={secondaryButton}
                    onClick={() => rejectRequest(request.request_id)}
                  >
                    Reject
                  </button>
                </div>
              }
            />
          ))
        )}
      </ConnectionSection>

      {/* Pending sent */}
      <ConnectionSection title="Pending Sent">
        {sent.length === 0 ? (
          <p style={emptyText}>None</p>
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
                  onClick={() => cancelRequest(request.request_id)}
                >
                  Cancel
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
  marginBottom: "28px",
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