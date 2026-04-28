"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "../lib/api";

type MyPost = {
  id: number;
  type: string;
  category: string;
  text: string;
  place: string;
  place_id: number;
  created_at: string;
};

export default function MyPostsPage() {
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/my-updates/`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to load my posts:", res.status, errorText);
        return;
      }

      const data = await res.json();
      setPosts(data || []);
    } catch (error) {
      console.error("My posts fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  if (loading) {
    return (
      <main style={page}>
        <p>Loading your posts...</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <h1>My Posts</h1>

      {posts.length === 0 ? (
        <section style={emptyBox}>
          <p>You have not created any posts yet.</p>
          <Link href="/create" style={primaryLink}>
            Create your first post
          </Link>
        </section>
      ) : (
        <section style={list}>
          {posts.map((post) => (
            <article key={post.id} style={card}>
              <div style={metaRow}>
                <strong>
                  {post.type} — {post.place}
                </strong>

                <span style={dateText}>
                  {new Date(post.created_at).toLocaleString()}
                </span>
              </div>

              <span style={categoryBadge}>{post.category}</span>

              <p style={text}>{post.text}</p>

              <div style={actions}>
                <Link href={`/places/${post.place_id}`} style={secondaryLink}>
                  View place
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

const page = {
  maxWidth: "760px",
  margin: "0 auto",
  padding: "40px",
};

const list = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "16px",
  marginTop: "24px",
};

const card = {
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "20px",
  background: "white",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  marginBottom: "10px",
};

const dateText = {
  fontSize: "12px",
  color: "#666",
};

const categoryBadge = {
  display: "inline-block",
  fontSize: "12px",
  color: "#666",
  border: "1px solid #ddd",
  borderRadius: "999px",
  padding: "4px 8px",
  marginBottom: "12px",
};

const text = {
  lineHeight: 1.5,
  marginBottom: "16px",
};

const actions = {
  display: "flex",
  gap: "10px",
};

const primaryLink = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const secondaryLink = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  color: "black",
  textDecoration: "none",
};

const emptyBox = {
  marginTop: "24px",
  border: "1px solid #eee",
  borderRadius: "16px",
  padding: "24px",
  background: "white",
};