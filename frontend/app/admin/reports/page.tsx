"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";

import { API_URL } from "../../lib/api";

type ContentReport = {
  id: number;
  reported_by: number;
  reported_by_username: string;
  content_type: "experience" | "update" | "place";
  experience: number | null;
  experience_title?: string;
  update: number | null;
  update_title?: string;
  place: number | null;
  place_name?: string;
  reason: string;
  comment: string;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
};

type ReportStatusFilter =
  | "all"
  | "pending"
  | "reviewed"
  | "dismissed"
  | "action_taken";

const reasonLabels: Record<string, string> = {
  misleading_information: "Misleading information",
  unsafe_place: "Unsafe place",
  fake_photo: "Fake photo",
  scam_or_fraud: "Scam or fraud",
  harassment: "Harassment",
  suspicious_behavior: "Suspicious behavior",
  other: "Other",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  action_taken: "Action taken",
};

export default function ReportsPage() {

  const router = useRouter();
  const { isStaff, isSuperuser, loading: authLoading, isLoggedIn } = useAuth();

  const canAccessReports = isStaff || isSuperuser;

  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingReportId, setUpdatingReportId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("all");

  const loadReports = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/reports/`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Could not load reports.");
        setReports([]);
        return;
      }

      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Reports fetch error:", err);
      setError("Something went wrong while loading reports.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

    const updateReportStatus = async (
      reportId: number,
      status: "reviewed" | "dismissed" | "action_taken"
    ) => {
      setUpdatingReportId(reportId);
      setError("");
      setActionMessage("");

      try {
        const res = await fetch(`${API_URL}/api/reports/${reportId}/`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.detail || "Could not update report.");
          return;
        }

        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId ? data : report
          )
        );

        setActionMessage("Report status updated.");
      } catch (err) {
        console.error("Report status update error:", err);
        setError("Something went wrong while updating the report.");
      } finally {
        setUpdatingReportId(null);
      }
    };

      useEffect(() => {
      if (authLoading) return;

      if (!isLoggedIn) {
        router.push("/login?next=/admin/reports");
        return;
      }

      if (!canAccessReports) {
        setLoading(false);
        return;
      }

      loadReports();
    }, [authLoading, isLoggedIn, canAccessReports]);

  const getContentTitle = (report: ContentReport) => {
    if (report.content_type === "experience") {
      return report.experience_title || `Experience #${report.experience}`;
    }

    if (report.content_type === "update") {
      return report.update_title || `Update #${report.update}`;
    }

    if (report.content_type === "place") {
      return report.place_name || `Place #${report.place}`;
    }

    return "Reported content";
  };

  const getContentLink = (report: ContentReport) => {
    if (report.content_type === "experience" && report.experience) {
      return `/experiences/${report.experience}`;
    }

    if (report.content_type === "place" && report.place) {
      return `/places/${report.place}`;
    }

    return null;
  };

  const filteredReports =
      statusFilter === "all"
        ? reports
        : reports.filter((report) => report.status === statusFilter);

  const getStatusCount = (status: ReportStatusFilter) => {
      if (status === "all") {
        return reports.length;
      }

      return reports.filter((report) => report.status === status).length;
    };

    if (authLoading || loading) {
      return (
        <main style={page}>
          <p style={mutedText}>Loading reports...</p>
        </main>
      );
    }

    if (!canAccessReports) {
      return (
        <main style={page}>
          <section style={headerCard}>
            <div style={eyebrow}>Trust & Safety</div>

            <h1 style={title}>Access restricted</h1>

            <p style={introText}>
              This moderation area is available only to Trust Travel staff users.
            </p>

            <div style={{ marginTop: "16px" }}>
              <Link href="/" style={primaryLink}>
                Back to home
              </Link>
            </div>
          </section>
        </main>
      );
    }

  return (
    <main style={page}>
      <div style={breadcrumb}>
        <Link href="/" style={breadcrumbLink}>
          Home
        </Link>{" "}
        / <span>Reports</span>
      </div>

      <section style={headerCard}>
        <div style={eyebrow}>Trust & Safety</div>

        <h1 style={title}>Content reports</h1>

        <p style={introText}>
          Review reports submitted by users about misleading, unsafe, abusive or
          suspicious content.
        </p>
      </section>

      <div style={filterBar}>
          {[
            ["all", "All"],
            ["pending", "Pending"],
            ["reviewed", "Reviewed"],
            ["dismissed", "Dismissed"],
            ["action_taken", "Action taken"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value as ReportStatusFilter)}
              style={{
                ...filterButton,
                ...(statusFilter === value ? activeFilterButton : {}),
              }}
            >
              {label} ({getStatusCount(value as ReportStatusFilter)})
            </button>
          ))}
        </div>


      {error && <div style={errorBox}>{error}</div>}

      {actionMessage && (
          <div style={successBox}>
            {actionMessage}
          </div>
        )}

      {!loading && !error && filteredReports.length === 0 && (
          <div style={emptyBox}>
            {statusFilter === "all"
              ? "No reports found."
              : `No ${statusLabels[statusFilter]?.toLowerCase() || statusFilter} reports found.`}
          </div>
        )}

      {!loading && filteredReports.length > 0 && (
          <section style={reportsGrid}>
            {filteredReports.map((report) => {


            const contentLink = getContentLink(report);

            return (
              <article key={report.id} style={reportCard}>
                <div style={reportTopRow}>
                  <span style={statusBadge}>
                    {statusLabels[report.status] || report.status}
                  </span>

                  <span style={dateText}>
                    {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>

                <div style={smallLabel}>Reported content</div>

                <h2 style={reportTitle}>
                  {getContentTitle(report)}
                </h2>

                <div style={metaText}>
                  Type: <strong>{report.content_type}</strong>
                </div>

                <div style={metaText}>
                  Reason:{" "}
                  <strong>{reasonLabels[report.reason] || report.reason}</strong>
                </div>

                <div style={metaText}>
                  Reported by: <strong>{report.reported_by_username}</strong>
                </div>

                {report.comment && (
                  <div style={commentBox}>
                    “{report.comment}”
                  </div>
                )}

                <div style={actions}>
                  {contentLink && (
                    <Link href={contentLink} style={primaryLink}>
                      Open content
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={loadReports}
                    style={secondaryButton}
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    disabled={updatingReportId === report.id}
                    onClick={() => updateReportStatus(report.id, "reviewed")}
                    style={{
                      ...secondaryButton,
                      opacity: updatingReportId === report.id ? 0.5 : 1,
                      cursor: updatingReportId === report.id ? "not-allowed" : "pointer",
                    }}
                  >
                    Mark reviewed
                  </button>

                  <button
                    type="button"
                    disabled={updatingReportId === report.id}
                    onClick={() => updateReportStatus(report.id, "dismissed")}
                    style={{
                      ...secondaryButton,
                      opacity: updatingReportId === report.id ? 0.5 : 1,
                      cursor: updatingReportId === report.id ? "not-allowed" : "pointer",
                    }}
                  >
                    Dismiss
                  </button>

                  <button
                    type="button"
                    disabled={updatingReportId === report.id}
                    onClick={() => updateReportStatus(report.id, "action_taken")}
                    style={{
                      ...dangerActionButton,
                      opacity: updatingReportId === report.id ? 0.5 : 1,
                      cursor: updatingReportId === report.id ? "not-allowed" : "pointer",
                    }}
                  >
                    Action taken
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

const page = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "40px",
};

const breadcrumb = {
  marginBottom: "20px",
  color: "#666",
  fontSize: "14px",
};

const breadcrumbLink = {
  color: "#666",
  textDecoration: "none",
};

const headerCard = {
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  marginBottom: "22px",
};

const eyebrow = {
  fontSize: "13px",
  color: "#777",
  fontWeight: 700,
  marginBottom: "6px",
};

const title = {
  margin: 0,
  fontSize: "28px",
};

const introText = {
  color: "#666",
  lineHeight: 1.5,
  marginBottom: 0,
};

const mutedText = {
  color: "#666",
};

const errorBox = {
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#b91c1c",
};

const emptyBox = {
  padding: "18px",
  borderRadius: "14px",
  border: "1px solid #eee",
  background: "#fafafa",
  color: "#666",
};

const reportsGrid = {
  display: "grid",
  gap: "16px",
};

const reportCard = {
  padding: "18px",
  borderRadius: "16px",
  border: "1px solid #eee",
  background: "white",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const reportTopRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "12px",
};

const statusBadge = {
  display: "inline-block",
  padding: "4px 9px",
  borderRadius: "999px",
  background: "#fff7e6",
  border: "1px solid #ffe3b3",
  color: "#92400e",
  fontSize: "12px",
  fontWeight: 700,
};

const dateText = {
  color: "#777",
  fontSize: "12px",
};

const smallLabel = {
  color: "#777",
  fontSize: "13px",
  marginBottom: "4px",
};

const reportTitle = {
  margin: "0 0 10px 0",
  fontSize: "20px",
};

const metaText = {
  color: "#555",
  fontSize: "14px",
  marginTop: "6px",
};

const commentBox = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  background: "#fafafa",
  border: "1px solid #eee",
  color: "#333",
  lineHeight: 1.5,
};

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginTop: "14px",
};

const primaryLink = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "none",
  background: "black",
  color: "white",
  textDecoration: "none",
};

const secondaryButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  background: "white",
  color: "black",
  cursor: "pointer",
};

const dangerActionButton = {
  display: "inline-block",
  padding: "9px 13px",
  borderRadius: "10px",
  border: "1px solid #f3c2c2",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
};

const successBox = {
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #d7f0df",
  background: "#f2fbf5",
  color: "#166534",
  marginBottom: "16px",
};

const filterBar = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  marginBottom: "22px",
};

const filterButton = {
  padding: "9px 13px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  background: "white",
  color: "#111",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
};

const activeFilterButton = {
  background: "black",
  color: "white",
  border: "1px solid black",
};