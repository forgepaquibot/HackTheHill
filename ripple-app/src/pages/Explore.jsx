import { useEffect, useMemo, useState } from "react";
import { Asset, Button, Intro } from "../components/UI";
import RippleCard from "../components/RippleCard";
import {
  ripples,
  categories,
  categoryIcons,
  filterRipples,
} from "../data/ripples";

const API_BASE_URL = "http://localhost:8000";

export default function Explore({ followed, toggleFollow }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [near, setNear] = useState(false);

  const [databaseRipples, setDatabaseRipples] = useState([]);
  const [loadingDatabaseRipples, setLoadingDatabaseRipples] = useState(true);
  const [databaseError, setDatabaseError] = useState("");

  /*
   * Load real topics from PostgreSQL through the FastAPI backend.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadDatabaseRipples() {
      try {
        setLoadingDatabaseRipples(true);
        setDatabaseError("");

        const response = await fetch(`${API_BASE_URL}/api/topics`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Backend returned an invalid topics response.");
        }

        if (cancelled) return;

        const formattedTopics = data.map((topic) => {
          const topicCategory = topic.category || "Other";

          /*
           * Use the SAME category/icon mapping as the existing
           * placeholder Ripple cards.
           */
          const categoryIndex = categories.indexOf(topicCategory);

          const icon =
            categoryIndex >= 0
              ? categoryIcons[categoryIndex]
              : categoryIcons[0];

          const voiceCount = Number(topic.voices);

          return {
            id: topic.id,

            title: topic.title || "Community Ripple",

            category: topicCategory,

            /*
             * RippleCard expects an icon.
             */
            icon,

            /*
             * These are used by other parts of the UI.
             */
            description:
              topic.alignment_rationale ||
              "A community concern reported by local residents.",

            summary:
              topic.alignment_rationale ||
              "A community concern reported by local residents.",

            voices:
              Number.isFinite(voiceCount) && voiceCount >= 0
                ? voiceCount
                : 0,

            createdAt: topic.created_at,

            isDatabaseTopic: true,

            alignment_score: topic.alignment_score,

            alignment_rationale: topic.alignment_rationale,

            /*
             * Temporary/default card values for fields that
             * aren't currently stored on the topics table.
             */
            location: "Community",

            status: "Under review",

            tone: "progress",

            updated: topic.created_at
              ? new Date(topic.created_at).toLocaleDateString()
              : "Recently",
          };
        });

        setDatabaseRipples(formattedTopics);
      } catch (error) {
        console.error("Failed to load database Ripples:", error);

        if (!cancelled) {
          setDatabaseError(
            "We couldn't load community Ripples from the database."
          );
          setDatabaseRipples([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingDatabaseRipples(false);
        }
      }
    }

    loadDatabaseRipples();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Put real database Ripples together with the existing
   * placeholder/test Ripples.
   */
  const allRipples = useMemo(() => {
    return [...databaseRipples, ...ripples];
  }, [databaseRipples]);

  /*
   * Apply the existing search/category filtering to BOTH
   * database and placeholder Ripples.
   */
  const results = useMemo(() => {
    return filterRipples(allRipples, query, category);
  }, [allRipples, query, category]);

  const handleNearMe = () => {
    setNear((current) => !current);

    /*
     * Location filtering isn't connected to the database yet,
     * so this currently acts as the UI toggle.
     */
    setNotice(
      !near
        ? "Showing Ripples near your area."
        : "Showing Ripples from all areas."
    );

    setTimeout(() => {
      setNotice("");
    }, 3000);
  };

  const handleCategoryChange = (event) => {
    setCategory(event.target.value);
  };

  const handleSearchChange = (event) => {
    setQuery(event.target.value);
  };

  return (
    <main className="explore-page">
      <Intro
        eyebrow="Explore"
        title="See what your community is talking about."
      >
        Discover Ripples that people in your community have reported,
        support the issues that matter to you, and follow their progress.
      </Intro>

      <section className="explore-controls">
        <div className="search-wrapper">
          <label htmlFor="ripple-search" className="sr-only">
            Search Ripples
          </label>

          <input
            id="ripple-search"
            type="search"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search community Ripples..."
            className="search-input"
          />
        </div>

        <div className="filter-row">
          <label htmlFor="ripple-category" className="sr-only">
            Filter by category
          </label>

          <select
            id="ripple-category"
            value={category}
            onChange={handleCategoryChange}
            className="category-select"
          >
            <option value="">All categories</option>

            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <Button
            secondary
            className={near ? "active" : ""}
            onClick={handleNearMe}
            aria-pressed={near}
          >
            <Asset
              screen="5:10114"
              name="imgMapPin"
            />
            Near me
          </Button>
        </div>
      </section>

      {notice && (
        <p className="explore-notice" role="status">
          {notice}
        </p>
      )}

      {loadingDatabaseRipples && (
        <p className="explore-loading" role="status">
          Loading community Ripples...
        </p>
      )}

      {databaseError && (
        <p className="explore-error" role="alert">
          {databaseError}
        </p>
      )}

      {!loadingDatabaseRipples && results.length === 0 && (
        <section className="empty-state">
          <h2>No Ripples found</h2>
          <p>
            Try changing your search or selecting a different category.
          </p>
        </section>
      )}

      {results.length > 0 && (
        <div className="ripple-grid">
          {results.map((ripple) => (
            <RippleCard
              key={ripple.id}
              ripple={ripple}
              followed={followed.includes(ripple.id)}
              onFollow={() => toggleFollow(ripple.id)}
            />
          ))}
        </div>
      )}

      <p className="demo-note">
        Community Ripples are combined with example data for demonstration.
        Followed Ripples are saved on this device.
      </p>
    </main>
  );
}