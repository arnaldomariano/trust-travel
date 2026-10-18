"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "../lib/api";

type UpdatePlaceReference =
  | {
      placeId: number | string;
      externalSource?: never;
      externalId?: never;
    }
  | {
      placeId?: never;
      externalSource: string;
      externalId: string;
    };

type UpdateFormProps = UpdatePlaceReference & {
  placeName: string;
  onSuccess: (update: Record<string, unknown>) => void;
};

export default function UpdateForm(props: UpdateFormProps) {
  const [updateType, setUpdateType] = useState<"event" | "alert" | "info">("info");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [updateCategory, setUpdateCategory] = useState("general");
  const [updateEventDate, setUpdateEventDate] = useState("");
  const [updateExternalLink, setUpdateExternalLink] = useState("");
  const [updateSourceName, setUpdateSourceName] = useState("");
  const [updateSourceUrl, setUpdateSourceUrl] = useState("");
  const [updatePriority, setUpdatePriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");

  const [updateFormError, setUpdateFormError] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const handleSubmitUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!updateText.trim()) {
      setUpdateFormError("Please write the event or information.");
      return;
    }

    const placeReference =
      props.placeId !== undefined
        ? { place: props.placeId }
        : {
            external_source: props.externalSource,
            external_id: props.externalId,
          };

    setUpdateFormError("");
    setSubmittingUpdate(true);

    try {
      const res = await fetch(`${API_URL}/api/updates/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...placeReference,
          type: updateType,
          category: updateCategory,
          title: updateTitle.trim(),
          text: updateText.trim(),
          event_date: updateEventDate || null,
          external_link: updateExternalLink.trim(),
          source_name: updateSourceName.trim(),
          source_url: updateSourceUrl.trim(),
          priority: updatePriority,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUpdateFormError(
          data.detail || "Could not share this event or info."
        );
        return;
      }

      props.onSuccess(data);

      setUpdateTitle("");
      setUpdateText("");
      setUpdateType("info");
      setUpdateCategory("general");
      setUpdateEventDate("");
      setUpdateExternalLink("");
      setUpdateSourceName("");
      setUpdateSourceUrl("");
      setUpdatePriority("normal");
    } catch (error) {
      console.error("Create update failed:", error);
      setUpdateFormError("Could not share this event or info.");
    } finally {
      setSubmittingUpdate(false);
    }
  };

  return (
    <form onSubmit={handleSubmitUpdate} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Type</label>

                <select
                  value={updateType}
                  onChange={(e) =>
                    setUpdateType(e.target.value as "event" | "alert" | "info")
                  }
                  style={input}
                >
                  <option value="info">Useful info</option>
                  <option value="event">Event</option>
                  <option value="alert">Alert</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Short title</label>

                <input
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder={
                    updateType === "event"
                      ? "Example: Carnival week in Brazil"
                      : updateType === "alert"
                      ? "Example: Beach access closed today"
                      : "Example: Parking near Palm Beach"
                  }
                  style={input}
                />

                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "13px",
                    lineHeight: 1.4,
                  }}
                >
                  Keep the title short and specific. Use the details field for the full explanation.
                </p>
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                <label style={label}>Details</label>

                <textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Add the full context, practical advice, source summary or explanation here."
                  rows={4}
                  style={input}
                />

                <p
                  style={{
                    margin: 0,
                    color: "#777",
                    fontSize: "13px",
                    lineHeight: 1.4,
                  }}
                >
                  This is where longer information belongs. The title should work as a quick summary.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                }}
              >
                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Category</label>

                  <select
                    value={updateCategory}
                    onChange={(e) => setUpdateCategory(e.target.value)}
                    style={input}
                  >
                    <option value="general">General</option>
                    <option value="tourism">Tourism</option>
                    <option value="music">Music</option>
                    <option value="religious">Religious</option>
                    <option value="social">Social</option>
                    <option value="transport">Transport</option>
                    <option value="safety">Safety</option>
                    <option value="weather">Weather</option>
                    <option value="food">Food</option>
                    <option value="culture">Culture</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>
                    {updateType === "event"
                      ? "Event date and time"
                      : updateType === "alert"
                      ? "Alert related date/time"
                      : "Info related date/time"}
                  </label>

                  <input
                    type="datetime-local"
                    value={updateEventDate}
                    onChange={(e) => setUpdateEventDate(e.target.value)}
                    style={input}
                  />

                  <div style={dateTimeHelperBox}>
                    <strong>
                      {updateType === "event"
                        ? "When does this event happen?"
                        : updateType === "alert"
                        ? "When is this alert relevant?"
                        : "When is this information relevant?"}
                    </strong>

                    <span>
                      Use this field when the information has a specific date or time. Avoid
                      repeating the date only inside the text.
                    </span>
                  </div>
                </div>
              </div>

              {updateType === "alert" && (
                <div style={{ display: "grid", gap: "6px" }}>
                  <label style={label}>Alert priority</label>

                  <select
                    value={updatePriority}
                    onChange={(e) =>
                      setUpdatePriority(
                        e.target.value as "low" | "normal" | "high" | "urgent"
                      )
                    }
                    style={input}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              )}

              <div
                style={{
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  backgroundColor: "#fafafa",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px" }}>Optional source and links</strong>

                  <p
                    style={{
                      margin: "6px 0 0 0",
                      color: "#666",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    Add a source or official link when the information should be verified.
                  </p>
                </div>

                <input
                  value={updateSourceName}
                  onChange={(e) => setUpdateSourceName(e.target.value)}
                  placeholder="Source name, e.g. official website, venue page, local authority"
                  style={input}
                />

                <input
                  value={updateSourceUrl}
                  onChange={(e) => setUpdateSourceUrl(e.target.value)}
                  placeholder="Source URL, e.g. https://..."
                  style={input}
                />

                <input
                  value={updateExternalLink}
                  onChange={(e) => setUpdateExternalLink(e.target.value)}
                  placeholder="Related link, e.g. ticket page, event page, article..."
                  style={input}
                />
              </div>

              {updateFormError && (
                <div style={updateFormErrorBox}>
                  {updateFormError}
                </div>
              )}

              <button
                  type="submit"
                  disabled={submittingUpdate}
                  style={{
                    ...primaryButton,
                    opacity: submittingUpdate ? 0.5 : 1,
                    cursor: submittingUpdate ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingUpdate
                    ? "Sharing..."
                    : `Share about ${props.placeName || "this place"}`}
                </button>
            </form>
  );
}


const primaryButton = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#111",
  color: "white",
  cursor: "pointer",
  fontSize: "14px",
};

const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "14px",
};

const label = {
  fontSize: "13px",
  color: "#666",
  fontWeight: 600,
};

const dateTimeHelperBox = {
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #eee",
  backgroundColor: "#fafafa",
  color: "#555",
  fontSize: "12px",
  lineHeight: 1.45,
};

const updateFormErrorBox = {
  padding: "10px",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  backgroundColor: "#fef2f2",
  color: "#b91c1c",
  fontSize: "13px",
  lineHeight: 1.4,
};
