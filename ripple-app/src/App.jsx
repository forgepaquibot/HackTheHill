import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import AppHeader from "./components/AppHeader";
import Organization from "./pages/Organization";
import Home from "./pages/Home";
import Report from "./pages/Report";
import ReviewReport from "./pages/ReviewReport";
import RippleCreated from "./pages/RippleCreated";
import Explore from "./pages/Explore";
import Login from "./pages/Login";

import { prepareReview, ripples } from "./data/ripples";
import { createAuth0Actions } from "./auth/auth0Actions";

import "./App.css";


const API_BASE_URL = "http://localhost:8000";


function route() {
  return window.location.hash.slice(1) || "/";
}


function readFollows() {
  try {
    const value = JSON.parse(
      localStorage.getItem("ripple-follows") || "[]"
    );

    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}


export default function App() {

  // ============================================================
  // Auth0
  // ============================================================

  const {
    isAuthenticated,
    isLoading: authLoading,
    user,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();


  // Connect the existing Login component to Auth0.
  const authActions = createAuth0Actions(
    loginWithRedirect
  );


  // ============================================================
  // Application state
  // ============================================================

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

  const [followed, setFollowed] =
    useState(readFollows);

  const [storageError, setStorageError] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);


  // ============================================================
  // Sync authenticated Auth0 user with FastAPI / PostgreSQL
  // ============================================================

  useEffect(() => {

    if (authLoading || !isAuthenticated || !user) {
      return;
    }


    const syncUserWithBackend = async () => {

      try {

        // ------------------------------------------------------
        // Get a REAL Auth0 access token.
        // ------------------------------------------------------

        const token =
          await getAccessTokenSilently();


        // ------------------------------------------------------
        // Send Auth0 identity to FastAPI.
        //
        // user.sub is the real Auth0 identity.
        // ------------------------------------------------------

        const response = await fetch(
          `${API_BASE_URL}/api/users/register`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              id: user.sub,

              name:
                user.name ||
                user.nickname ||
                user.email?.split("@")[0] ||
                "Verified Citizen",

              email:
                user.email || "",

              email_verified:
                user.email_verified === true,
            }),
          }
        );


        if (!response.ok) {

          const errorData =
            await response.json().catch(
              () => ({})
            );

          throw new Error(
            errorData.detail ||
            "Unable to synchronize Auth0 user."
          );
        }


        const data =
          await response.json();


        console.log(
          "Auth0 user synchronized:",
          data
        );

      } catch (err) {

        console.error(
          "Failed to sync Auth0 user with backend:",
          err
        );

        setStorageError(
          `Authentication sync error: ${err.message}`
        );
      }
    };


    syncUserWithBackend();

  }, [
    authLoading,
    isAuthenticated,
    user,
    getAccessTokenSilently,
  ]);


  // ============================================================
  // Listen to hash changes in URL
  // ============================================================

  useEffect(() => {

    const change = () =>
      setPath(route());


    window.addEventListener(
      "hashchange",
      change
    );


    return () => {

      window.removeEventListener(
        "hashchange",
        change
      );

    };

  }, []);


  // ============================================================
  // Page titles and scroll management
  // ============================================================

  useEffect(() => {

    document.title =
      path.startsWith("/organization")
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


      const focusTarget =
        path.includes("mode=type")
          ? document.querySelector("textarea")
          : document.querySelector("h1");


      focusTarget?.focus({
        preventScroll: true,
      });

    }

  }, [path]);


  // ============================================================
  // Follow / like a Ripple
  // ============================================================

  async function toggleFollow(id) {

    // ----------------------------------------------------------
    // A follow is an authenticated action.
    // ----------------------------------------------------------

    if (!isAuthenticated) {

      setStorageError(
        "Please sign in before following a Ripple."
      );

      await loginWithRedirect({
        appState: {
          returnTo: window.location.hash || "#/explore",
        },
      });

      return;
    }


    const isFollowing =
      followed.includes(id);


    const next =
      isFollowing
        ? followed.filter(
            (x) => x !== id
          )
        : [
            ...followed,
            id,
          ];


    setFollowed(next);


    // ----------------------------------------------------------
    // Save local UI state.
    // ----------------------------------------------------------

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


    // ----------------------------------------------------------
    // Only create a backend like when following.
    // ----------------------------------------------------------

    if (!isFollowing) {

      try {

        const token =
          await getAccessTokenSilently();


        const response =
          await fetch(
            `${API_BASE_URL}/api/complaints/${id}/like`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );


        if (!response.ok) {

          const errorData =
            await response
              .json()
              .catch(() => ({}));


          throw new Error(
            errorData.detail ||
            "Unable to follow Ripple."
          );
        }


      } catch (err) {

        console.error(
          "Could not sync like with backend:",
          err
        );


        setStorageError(
          `Could not sync follow: ${err.message}`
        );

      }

    }

  }


  // ============================================================
  // Submit Complaint to FastAPI
  // ============================================================

  async function handleConfirmReport() {

    // ----------------------------------------------------------
    // Authentication check
    // ----------------------------------------------------------

    if (!isAuthenticated) {

      setStorageError(
        "Please sign in before submitting a report."
      );

      await loginWithRedirect({
        appState: {
          returnTo:
            window.location.hash ||
            "#/review",
        },
      });

      return;
    }


    setIsSubmitting(true);
    setStorageError("");


    try {

      // --------------------------------------------------------
      // Get REAL Auth0 access token.
      // --------------------------------------------------------

      const token =
        await getAccessTokenSilently();


      const payload = {

        title:
          review?.issue ||
          draft.title ||
          draft.text.slice(0, 60) ||
          "Public Grievance",


        description:
          draft.text,


        category:
          draft.category ||
          review?.category ||
          "General",

      };


      console.log(
        "=== SUBMITTING COMPLAINT ==="
      );

      console.log(
        "Payload:",
        payload
      );


      const res =
        await fetch(
          `${API_BASE_URL}/api/complaints`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              // ------------------------------------------------
              // THIS IS NOW A REAL AUTH0 JWT.
              // ------------------------------------------------

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(payload),
          }
        );


      if (!res.ok) {

        const errData =
          await res
            .json()
            .catch(() => ({}));


        throw new Error(
          errData.detail ||
          "Submission failed"
        );
      }


      const data =
        await res.json();


      console.log(
        "=== BACKEND RESPONSE ==="
      );

      console.log(
        "Complaint result:",
        data
      );

      console.log(
        "Voices:",
        data.voices
      );

      console.log(
        "Status:",
        data.status
      );

      console.log(
        "isSimilar:",
        data.isSimilar
      );

      console.log(
        "Topic:",
        data.topic_title
      );


      // ========================================================
      // Preserve the actual values returned by the backend.
      // ========================================================

      const confirmedRipple = {

        id:
          data.complaint_id,


        topic_id:
          data.topic_id,


        title:
          data.topic_title ||
          review?.issue ||
          payload.title,


        topic_title:
          data.topic_title,


        category:
          data.category ||
          payload.category,


        location:
          review?.location ||
          draft.location,


        time:
          "Just now",


        text:
          draft.text,


        description:
          draft.text,


        photoName:
          draft.photo?.name,


        voices:
          Number.isFinite(
            Number(data.voices)
          )
            ? Number(data.voices)
            : 1,


        status:
          data.status ||
          "created",


        isSimilar:
          data.isSimilar === true,


        similarity:
          data.similarity,


        message:
          data.message,


        apiMessage:
          data.message,

      };


      console.log(
        "=== RIPPLE OBJECT FOR FRONTEND ==="
      );

      console.log(
        confirmedRipple
      );


      // --------------------------------------------------------
      // Store the COMPLETE backend result.
      // --------------------------------------------------------

      setConfirmed(
        confirmedRipple
      );


      // --------------------------------------------------------
      // Navigate to Ripple-created page.
      // --------------------------------------------------------

      window.location.hash =
        "/created";


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
  // Authentication loading
  // ============================================================

  if (authLoading) {

    return (
      <main
        className="empty-state"
        aria-live="polite"
      >
        <h1>
          Loading Ripple...
        </h1>
      </main>
    );

  }


  // ============================================================
  // Determine active view
  // ============================================================

  const basePath =
    path.split("?")[0];


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


  const sample =
    ripples.find(
      (r) =>
        r.id ===
        path.split("/")[2]
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
            .getElementById(
              "main-content"
            )
            ?.focus();

        }}
      >
        Skip to content
      </a>


      {!path.startsWith(
        "/organization"
      ) && (
        <AppHeader
          page={page}
        />
      )}


      <div
        id="main-content"
        tabIndex="-1"
      >

        {/* ==================================================
            Organization
           ================================================== */}

        {path.startsWith(
          "/organization"
        ) ? (

          <Organization
            path={path}
          />

        ) : (

          page === "home" && (
            <Home />
          )

        )}


        {/* ==================================================
            Login
           ================================================== */}

        {page === "login" && (

          <Login
            authActions={
              authActions
            }
          />

        )}


        {/* ==================================================
            Report
           ================================================== */}

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
                prepareReview(
                  draft
                )
              );

              window.location.hash =
                "/review";

            }}
          />

        )}


        {/* ==================================================
            Review
           ================================================== */}

        {page === "review" && (

          review ? (

            <ReviewReport
              photoName={
                draft.photo?.name
              }

              review={review}

              setReview={
                setReview
              }

              isSubmitting={
                isSubmitting
              }

              onConfirm={
                handleConfirmReport
              }
            />

          ) : (

            <main
              className="empty-state"
            >

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

          )

        )}


        {/* ==================================================
            Ripple created / Ripple detail
           ================================================== */}

        {page === "created" && (

          result ? (

            <RippleCreated
              ripple={result}

              isReport={
                path === "/created"
              }

              followed={
                followed.includes(
                  result.id
                )
              }

              onFollow={() =>
                toggleFollow(
                  result.id
                )
              }
            />

          ) : (

            <main
              className="empty-state"
            >

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

          )

        )}


        {/* ==================================================
            Explore
           ================================================== */}

        {page === "explore" && (

          <Explore
            followed={followed}
            toggleFollow={
              toggleFollow
            }
          />

        )}

      </div>


      {/* ======================================================
          Error / status notification
         ====================================================== */}

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