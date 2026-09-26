import { Asset, Button } from "./UI";
export default function RippleCard({ ripple, followed, onFollow }) {
  return (
    <article className="ripple-card">
      <div className="card-top">
        <span className="category-icon">
          <Asset screen="5:10114" name={ripple.icon} />
        </span>
        <div className="voice-count">
          <Asset screen="5:10114" name="imgMiddleRing" />
          <Asset
            screen="5:10114"
            name={
              ripple.voices > 100
                ? "imgOuterRing"
                : ripple.voices > 60
                  ? "imgOuterRing1"
                  : "imgOuterRing2"
            }
          />
          <strong>{ripple.voices}</strong>
        </div>
      </div>
      <div className="issue-details">
        <h2>{ripple.title}</h2>
        <p className="location">
          <Asset screen="5:10114" name="imgMapPin" />
          {ripple.location}
        </p>
        <p className="metadata">
          <strong>{ripple.voices} voices</strong>
          <span>·</span>
          {ripple.category}
        </p>
      </div>
      <div className="card-progress">
        <span className={`status-badge ${ripple.tone}`}>
          <span aria-hidden="true">●</span>
          {ripple.status}
        </span>
        <small>Updated {ripple.updated}</small>
      </div>
      <div className="card-actions">
        <a className="button" href={`#/ripple/${ripple.id}`}>
          View Ripple
          <Asset screen="5:10114" name="imgArrowRight" />
        </a>
        <Button
          secondary
          className={`follow-button ${followed ? "following" : ""}`}
          aria-label={`${followed ? "Unfollow" : "Follow"} ${ripple.title}`}
          aria-pressed={followed}
          onClick={onFollow}
        >
          <Asset screen="5:10114" name="imgBell" />
        </Button>
      </div>
    </article>
  );
}
