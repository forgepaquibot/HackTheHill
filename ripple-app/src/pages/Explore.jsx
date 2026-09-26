import { useState } from "react";
import { Asset, Button, Intro } from "../components/UI";
import RippleCard from "../components/RippleCard";
import {
  ripples,
  categories,
  categoryIcons,
  filterRipples,
} from "../data/ripples";
export default function Explore({ followed, toggleFollow }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [notice, setNotice] = useState(""),
    [near, setNear] = useState(false);
  const results = filterRipples(ripples, query, category);
  return (
    <main className="explore-page">
      <div className="explore-heading">
        <Intro
          eyebrow="Explore community Ripples"
          title="What’s affecting your community?"
        >
          See shared concerns, understand what’s happening, and follow progress.
        </Intro>
        <div className="view-toggle" aria-label="View options">
          <button
            onClick={() =>
              setNotice(
                "Map view will be available when live location data is connected. You can explore all example Ripples in the list below.",
              )
            }
          >
            <Asset screen="5:10114" name="imgMap" />
            Map
          </button>
          <button
            className="selected"
            aria-pressed="true"
            onClick={() => setNotice("")}
          >
            <Asset screen="5:10114" name="imgList" />
            List
          </button>
        </div>
      </div>
      <div className="search-row">
        <label className="search">
          <Asset screen="5:10114" name="imgSearch" />
          <input
            aria-label="Search by issue or place"
            placeholder="Search by issue or place"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              ×
            </button>
          )}
        </label>
        <Button secondary onClick={() => setNear(!near)} aria-expanded={near}>
          <Asset screen="5:10114" name="imgNavigation" />
          Near me
        </Button>
      </div>
      {near && (
        <div className="notice">
          <label>
            Search an example neighborhood
            <input
              placeholder="Try Centretown or Riverside"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p>
            Live nearby search is not connected. These are example locations.
          </p>
        </div>
      )}
      <div className="categories" aria-label="Filter by category">
        {categories.map((c, i) => (
          <button
            key={c}
            className={`category-chip ${category === c ? "selected" : ""}`}
            aria-pressed={category === c}
            onClick={() => setCategory(category === c ? "" : c)}
          >
            <Asset
              screen="5:10114"
              name={
                category === c && i === 0
                  ? "imgBusFront"
                  : i === 0
                    ? "imgBusFront1"
                    : categoryIcons[i]
              }
            />
            {c}
          </button>
        ))}
        {category && (
          <button className="clear-filter" onClick={() => setCategory("")}>
            Clear filter
          </button>
        )}
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="section-heading">
        <h2>Community Ripples</h2>
        <small aria-live="polite">
          {results.length} {query || category ? "results" : "nearby"}
        </small>
      </div>
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
      {!results.length && (
        <div className="empty-state">
          <h2>No Ripples found</h2>
          <p>Try another issue, place, or category.</p>
          <Button
            secondary
            onClick={() => {
              setQuery("");
              setCategory("");
            }}
          >
            Clear search and filters
          </Button>
        </div>
      )}
      <p className="demo-note">
        Example community data · Followed Ripples are saved on this device.
      </p>
    </main>
  );
}
