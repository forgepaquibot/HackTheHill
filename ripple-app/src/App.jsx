import { useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import Home from "./pages/Home";
import Report from "./pages/Report";
import ReviewReport from "./pages/ReviewReport";
import RippleCreated from "./pages/RippleCreated";
import Explore from "./pages/Explore";
import { prepareReview, ripples } from "./data/ripples";
import "./App.css";
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
export default function App() {
  const [path, setPath] = useState(route),
    [draft, setDraft] = useState({
      text: "",
      location: "",
      category: "",
      photo: null,
    }),
    [review, setReview] = useState(null),
    [confirmed, setConfirmed] = useState(null),
    [followed, setFollowed] = useState(readFollows),
    [storageError, setStorageError] = useState("");
  useEffect(() => {
    const change = () => setPath(route());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = "Ripple — Every voice can start a ripple";
    if (path === "/how-it-works") {
      document.getElementById("how-it-works")?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
      const focusTarget = path.includes("mode=type")
        ? document.querySelector("textarea")
        : document.querySelector("h1");
      focusTarget?.focus({ preventScroll: true });
    }
  }, [path]);
  function toggleFollow(id) {
    const next = followed.includes(id)
      ? followed.filter((x) => x !== id)
      : [...followed, id];
    setFollowed(next);
    try {
      localStorage.setItem("ripple-follows", JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Following is saved for this session only because browser storage is unavailable.",
      );
    }
  }
  const page = path.startsWith("/explore")
    ? "explore"
    : path.startsWith("/report")
      ? "report"
      : path === "/review"
        ? "review"
        : path === "/created" || path.startsWith("/ripple/")
          ? "created"
          : "home";
  const sample = ripples.find((r) => r.id === path.split("/")[2]);
  const result = path === "/created" ? confirmed : sample;
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <AppHeader page={page} />
      <div id="main-content" tabIndex="-1">
        {page === "home" && <Home />}
        {page === "report" && (
          <Report
            draft={draft}
            setDraft={setDraft}
            mode={new URLSearchParams(path.split("?")[1]).get("mode")}
            onReview={() => {
              setReview(prepareReview(draft));
              window.location.hash = "/review";
            }}
          />
        )}
        {page === "review" &&
          (review ? (
            <ReviewReport
              photoName={draft.photo?.name}
              review={review}
              setReview={setReview}
              onConfirm={() => {
                setConfirmed({
                  id: crypto.randomUUID(),
                  title: review.issue,
                  category: review.category,
                  location: review.location,
                  time: review.time,
                  text: draft.text,
                  photoName: draft.photo?.name,
                  voices: 1,
                  status: "Reported",
                });
                window.location.hash = "/created";
              }}
            />
          ) : (
            <main className="empty-state">
              <h1>Start with your experience.</h1>
              <a className="button" href="#/report">
                Tell us what happened
              </a>
            </main>
          ))}
        {page === "created" &&
          (result ? (
            <RippleCreated
              ripple={result}
              isReport={path === "/created"}
              followed={followed.includes(result.id)}
              onFollow={() => toggleFollow(result.id)}
            />
          ) : (
            <main className="empty-state">
              <h1>Find your next Ripple.</h1>
              <a className="button" href="#/explore">
                Explore Ripples
              </a>
            </main>
          ))}
        {page === "explore" && (
          <Explore followed={followed} toggleFollow={toggleFollow} />
        )}
      </div>
      {storageError && (
        <p className="notice" role="status">
          {storageError}
        </p>
      )}
    </>
  );
}
