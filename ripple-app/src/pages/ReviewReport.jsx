import { useState } from "react";
import { Asset, Button, Intro, Reassurance } from "../components/UI";
import { categories } from "../data/ripples";

export default function ReviewReport({
  review,
  setReview,
  onConfirm,
  photoName,
}) {
  const [editing, setEditing] = useState([]);

  const fields = [
    ["title", "Title", "imgMessageCircle", true],
    ["description", "Description", "imgMessageCircle", true],
    ["location", "Location", "imgMapPin", false],
    ["time", "Time", "imgClock3", false],
    ["category", "Category", "imgBusFront", true],
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (review?.title?.trim() && review?.description?.trim()) {
      onConfirm();
    }
  };

  return (
    <main className="review-page">
      <ol className="progress-steps" aria-label="Report progress">
        <li aria-label="Report completed">
          <Asset screen="5:9757" name="imgCheck" />
        </li>
        <li aria-current="step">2</li>
        <li>3</li>
      </ol>

      <Intro
        eyebrow="One quick check"
        title="We understood your report like this:"
      >
        Please check the details below. You can easily edit anything that is
        incorrect.
      </Intro>

      <form onSubmit={handleSubmit}>
        <section className="summary-card">
          <div className="summary-heading">
            <div>
              <h2>Your report</h2>
              <p>Review each item before continuing</p>
            </div>
            <Button
              secondary
              type="button"
              onClick={() => setEditing(fields.map((f) => f[0]))}
            >
              <Asset screen="5:9757" name="imgPencil" />
              Edit all
            </Button>
          </div>

          <div className="summary-fields">
            {fields.map(([key, label, icon, isRequired]) => (
              <div className="summary-field" key={key}>
                <span className="icon-circle">
                  <Asset screen="5:9757" name={icon} />
                </span>

                <div className="field-copy">
                  <span className="field-label" id={`label-${key}`}>
                    {label}{" "}
                    {!isRequired && (
                      <small style={{ color: "#6c757d", fontWeight: "normal" }}>
                        (optional)
                      </small>
                    )}
                  </span>

                  {editing.includes(key) ? (
                    key === "category" ? (
                      <select
                        id={`review-${key}`}
                        aria-labelledby={`label-${key}`}
                        value={review[key] || ""}
                        onChange={(e) =>
                          setReview({ ...review, [key]: e.target.value })
                        }
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : key === "description" ? (
                      <textarea
                        id={`review-${key}`}
                        aria-labelledby={`label-${key}`}
                        required={isRequired}
                        rows={4}
                        maxLength={5000}
                        value={review[key] || ""}
                        onChange={(e) =>
                          setReview({ ...review, [key]: e.target.value })
                        }
                      />
                    ) : (
                      <input
                        id={`review-${key}`}
                        aria-labelledby={`label-${key}`}
                        required={isRequired}
                        maxLength={5000}
                        value={review[key] || ""}
                        onChange={(e) =>
                          setReview({ ...review, [key]: e.target.value })
                        }
                      />
                    )
                  ) : (
                    <p>
                      {review[key] || (
                        <em style={{ color: "#888" }}>Not specified</em>
                      )}
                    </p>
                  )}
                </div>

                <button
                  className="edit-action"
                  type="button"
                  aria-label={`${
                    editing.includes(key) ? "Done editing" : "Edit"
                  } ${label}`}
                  onClick={() =>
                    setEditing(
                      editing.includes(key)
                        ? editing.filter((k) => k !== key)
                        : [...editing, key]
                    )
                  }
                >
                  <Asset screen="5:9757" name="imgPencil1" />
                  {editing.includes(key) ? "Done" : "Edit"}
                </button>
              </div>
            ))}
          </div>

          {photoName && (
            <p className="attachment-note">Photo attached: {photoName}</p>
          )}
        </section>

        <div className="submit-area">
          <Button
            type="submit"
            disabled={!review?.title?.trim() || !review?.description?.trim()}
          >
            <Asset screen="5:9757" name="imgCheck1" />
            Looks right
          </Button>

          <Reassurance>Nothing is submitted until you confirm.</Reassurance>

          <p className="demo-note">
            Local preview — review your own words before confirming.
          </p>

          <a href="#/report">Back to your report</a>
        </div>
      </form>
    </main>
  );
}