import { useState } from "react";
import VoiceToText from "../VoiceToText";
import { Asset, Button, Intro, Reassurance } from "../components/UI";
import { categories } from "../data/ripples";
export default function Report({ draft, setDraft, onReview, mode }) {
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");
  const update = (key, value) =>
    setDraft((d) => ({
      ...d,
      [key]: typeof value === "function" ? value(d[key]) : value,
    }));
  return (
    <main className="report-page">
      <Intro eyebrow="Share what you notice" title="Tell us what happened.">
        Choose the way that feels easiest. You can speak or type.
      </Intro>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.title.trim()) {
            setError("Please add a short title for your report.");
            return;
          }
          if (!draft.text.trim()) {
            setError("Please speak or type a little about what happened.");
            return;
          }
          onReview();
        }}
      >
        <div className="report-title-field">
          <label htmlFor="report-title">
            Report title <span>(required)</span>
          </label>
          <input
            id="report-title"
            name="title"
            type="text"
            required
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Example: Route 7 overcrowding"
            aria-describedby="report-title-hint"
          />
          <p id="report-title-hint">
            Give your concern a short, clear name. Add the full details below.
          </p>
        </div>
        <VoiceToText
          value={draft.text}
          onChange={(value) => update("text", value)}
          mode={mode}
        />
        <section className="optional-details">
          <div className="section-heading">
            <h2>Optional details</h2>
            <small>Add only what you know</small>
          </div>
          <div className="optional-grid">
            {[
              ["location", "Location", "Add a place", "imgMapPin"],
              ["photo", "Photo", "Add a photo", "imgCamera"],
              ["category", "Category", "Choose if you know", "imgShapes"],
            ].map(([key, title, hint, icon]) => (
              <button
                type="button"
                className="optional-field"
                key={key}
                aria-expanded={detail === key}
                onClick={() => setDetail(detail === key ? "" : key)}
              >
                <span className="icon-circle">
                  <Asset name={icon} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>
                    {key === "photo"
                      ? draft.photo?.name || hint
                      : draft[key] || hint}
                  </small>
                </span>
                <Asset name="imgPlus" />
              </button>
            ))}
            <div className="helpful-note">
              <Asset name="imgSparkles" />
              <p>
                You do not need to know the correct category—add only what you
                know.
              </p>
            </div>
          </div>
          {detail === "location" && (
            <label className="detail-input">
              Location
              <input
                autoFocus
                value={draft.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Street, route, or nearby place"
              />
            </label>
          )}
          {detail === "category" && (
            <label className="detail-input">
              Category
              <select
                value={draft.category}
                onChange={(e) => update("category", e.target.value)}
              >
                <option value="">Choose a category</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          {detail === "photo" && (
            <label className="detail-input">
              Photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (
                    file &&
                    (!file.type.startsWith("image/") ||
                      file.size > 10 * 1024 * 1024)
                  ) {
                    setError("Please choose an image smaller than 10 MB.");
                    return;
                  }
                  setError("");
                  update("photo", file || null);
                }}
              />
              {draft.photo && (
                <button type="button" onClick={() => update("photo", null)}>
                  Remove photo
                </button>
              )}
            </label>
          )}
        </section>
        <div className="submit-area">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button type="submit">
            <Asset name="imgSend" />
            Send my report
          </Button>
          <Reassurance>
            You can review everything before submitting.
          </Reassurance>
          <p className="demo-note">
            Demo: your report stays in this session and is not sent to a city.
          </p>
        </div>
      </form>
    </main>
  );
}
