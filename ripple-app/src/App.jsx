import { useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import Organization from "./pages/Organization";
import Home from "./pages/Home";
import Report from "./pages/Report";
import ReviewReport from "./pages/ReviewReport";
import RippleCreated from "./pages/RippleCreated";
import Explore from "./pages/Explore";
import Login from "./pages/Login";
import { prepareReview, ripples } from "./data/ripples";
import "./App.css";

const API_BASE_URL = "http://localhost:8000";

function route() {
  return window.location.hash.slice(1) || "/";
}

function readFollows() {
  try {
    const value = JSON.parse(localStorage.getItem("ripple-follows") || "[]");

    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

// Retrieves or initializes a local user ID for Auth0 session testing
function getAuthToken() {
  let userId = localStorage.getItem("ripple_user_id");

  if (!userId) {
    userId = `user_${crypto.randomUUID()}`;
    localStorage.setItem("ripple_user_id", userId);
  }

  return userId;
}

export default function App() {
  const [path, setPath] = useState(route);

  const [draft, setDraft] = useState({
    title: "",
    text: "",
    location: "",
    category: "",
    photo: null,
  });

  const [review, setReview] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [followed, setFollowed] = useState(readFollows);
  const [storageError, setStorageError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================
  // Sync user with FastAPI / Auth0 backend on app load
  // ============================================================

  useEffect(() => {
    const syncUserWithBackend = async () => {
      const userId = getAuthToken();

      try {
        await fetch(`${API_BASE_URL}/api/users/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: userId,
            name: "Verified Citizen",
            email: `${userId}@example.com`,
            email_verified: true,
          }),
        });
      } catch (err) {
        console.error(
          "Failed to sync user with backend:",
          err
        );
      }
    };

    syncUserWithBackend();
  }, []);

  // ============================================================
  // Listen to hash changes in URL
  // ============================================================

  useEffect(() => {
    const change = () => setPath(route());

    window.addEventListener("hashchange", change);

    return () => {
      window.removeEventListener("hashchange", change);
    };
  }, []);

  // ============================================================
  // Page titles and scroll management
  // ============================================================

  useEffect(() => {
    document.title = path.startsWith("/organization")
      ? "Community Listening — Ripple"
      : path.startsWith("/login")
      ? "Log in — Ripple"
      : "Ripple — Every voice can start a ripple";

    if (path === "/how-it-works") {
      document
        .getElementById("how-it-works")
        ?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);

      const focusTarget = path.includes("mode=type")
        ? document.querySelector("textarea")
        : document.querySelector("h1");

      focusTarget?.focus({
        preventScroll: true,
      });
    }
  }, [path]);

  // ============================================================
  // Sync likes with backend
  // ============================================================

  async function toggleFollow(id) {
    const isFollowing = followed.includes(id);

    const next = isFollowing
      ? followed.filter((x) => x !== id)
      : [...followed, id];

    setFollowed(next);

    try {
      localStorage.setItem(
        "ripple-follows",
        JSON.stringify(next)
      );

      setStorageError("");
    } catch {
      setStorageError(
        "Following is saved for this session only because browser storage is unavailable."
      );
    }

    if (!isFollowing) {
      try {
        const token = getAuthToken();

        await fetch(
          `${API_BASE_URL}/api/complaints/${id}/like`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } catch (err) {
        console.error(
          "Could not sync like with backend:",
          err
        );
      }
    }
  }

  // ============================================================
  // Submit Complaint to FastAPI backend
  // ============================================================

  async function handleConfirmReport() {
    setIsSubmitting(true);
    setStorageError("");

    try {
      const token = getAuthToken();

      const payload = {
        title:
          review?.issue ||
          draft.title ||
          draft.text.slice(0, 60) ||
          "Public Grievance",

        description: draft.text,

        category:
          draft.category ||
          review?.category ||
          "General",
      };

      console.log("=== SUBMITTING COMPLAINT ===");
      console.log("Payload:", payload);

      const res = await fetch(
        `${API_BASE_URL}/api/complaints`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errData = await res.json();

        throw new Error(
          errData.detail || "Submission failed"
        );
      }

      const data = await res.json();

      console.log("=== BACKEND RESPONSE ===");
      console.log("Complaint result:", data);
      console.log("Voices:", data.voices);
      console.log("Status:", data.status);
      console.log("isSimilar:", data.isSimilar);
      console.log("Topic:", data.topic_title);

      // ========================================================
      // IMPORTANT:
      // Preserve the actual values returned by the backend.
      // ========================================================

      const confirmedRipple = {
        id: data.complaint_id,

        topic_id: data.topic_id,

        // Use the topic title returned by the backend when
        // the complaint matched an existing community topic.
        title:
          data.topic_title ||
          review?.issue ||
          payload.title,

        topic_title: data.topic_title,

        category:
          data.category ||
          payload.category,

        location:
          review?.location ||
          draft.location,

        time: "Just now",

        text: draft.text,

        description: draft.text,

        photoName: draft.photo?.name,

        // ======================================================
        // THESE COME DIRECTLY FROM THE BACKEND
        // ======================================================

        voices:
          Number.isFinite(Number(data.voices))
            ? Number(data.voices)
            : 1,

        status:
          data.status || "created",

        isSimilar:
          data.isSimilar === true,

        similarity:
          data.similarity,

        message:
          data.message,

        apiMessage:
          data.message,
      };

      console.log("=== RIPPLE OBJECT FOR FRONTEND ===");
      console.log(confirmedRipple);

      // Store the COMPLETE backend result in React state.
      setConfirmed(confirmedRipple);

      // Navigate to the Ripple-created page.
      window.location.hash = "/created";
    } catch (err) {
      console.error(
        "Failed to submit report:",
        err
      );

      setStorageError(
        `Backend error: ${err.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ============================================================
  // Determine active view
  // ============================================================

  const basePath = path.split("?")[0];

  const page =
    basePath === "/login"
      ? "login"
      : path.startsWith("/explore")
      ? "explore"
      : path.startsWith("/report")
      ? "report"
      : path === "/review"
      ? "review"
      : path === "/created" ||
        path.startsWith("/ripple/")
      ? "created"
      : "home";

  const sample = ripples.find(
    (r) => r.id === path.split("/")[2]
  );

  const result =
    path === "/created"
      ? confirmed
      : sample;

  // ============================================================
  // Render
  // ============================================================

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();

          document
            .getElementById("main-content")
            ?.focus();
        }}
      >
        Skip to content
      </a>

      {!path.startsWith("/organization") && (
        <AppHeader page={page} />
      )}

      <div
        id="main-content"
        tabIndex="-1"
      >
        {path.startsWith("/organization") ? (
          <Organization path={path} />
        ) : (
          page === "home" && <Home />
        )}

        {page === "login" && <Login />}

        {page === "report" && (
          <Report
            draft={draft}
            setDraft={setDraft}
            mode={
              new URLSearchParams(
                path.split("?")[1]
              ).get("mode")
            }
            onReview={() => {
              setReview(
                prepareReview(draft)
              );

              window.location.hash =
                "/review";
            }}
          />
        )}

        {page === "review" &&
          (review ? (
            <ReviewReport
              photoName={draft.photo?.name}
              review={review}
              setReview={setReview}
              isSubmitting={isSubmitting}
              onConfirm={handleConfirmReport}
            />
          ) : (
            <main className="empty-state">
              <h1>
                Start with your experience.
              </h1>

              <a
                className="button"
                href="#/report"
              >
                Tell us what happened
              </a>
            </main>
          ))}

        {page === "created" &&
          (result ? (
            <RippleCreated
              ripple={result}
              isReport={path === "/created"}
              followed={followed.includes(
                result.id
              )}
              onFollow={() =>
                toggleFollow(result.id)
              }
            />
          ) : (
            <main className="empty-state">
              <h1>
                Find your next Ripple.
              </h1>

              <a
                className="button"
                href="#/explore"
              >
                Explore Ripples
              </a>
            </main>
          ))}

        {page === "explore" && (
          <Explore
            followed={followed}
            toggleFollow={toggleFollow}
          />
        )}
      </div>

      {storageError && (
        <p
          className="notice"
          role="status"
        >
          {storageError}
        </p>
      )}
    </>
  );
}