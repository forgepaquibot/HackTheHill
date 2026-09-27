import {
  Asset,
  Button,
  Intro,
  Reassurance,
  StatusTimeline,
} from "../components/UI";

function downloadReport(ripple) {
  const text = `# Ripple report\n${ripple.title}\n\nLocation: ${
    ripple.location || "N/A"
  }\nTime: ${ripple.time || "Just now"}\nCategory: ${ripple.category}\n\n${
    ripple.text || ripple.description
  }\n`;

  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = "ripple-report.txt";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Determines which point in the Ripple timeline should be active.
function getTimelineStatus(status = "", isSimilar = false) {
  const lower = String(status).toLowerCase();

  if (
    lower.includes("repair") ||
    lower.includes("plan") ||
    lower.includes("scheduled") ||
    lower.includes("announce")
  ) {
    return "Action planned";
  }

  if (
    lower.includes("review") ||
    lower.includes("progress")
  ) {
    return "Under review";
  }

  if (
    lower.includes("resolve") ||
    lower.includes("done") ||
    lower.includes("complete")
  ) {
    return "Resolved";
  }

  if (isSimilar) {
    return "Under review";
  }

  return "Reported";
}

export default function RippleCreated({
  ripple,
  followed,
  onFollow,
  isReport = false,
}) {
  /*
   * DEBUG:
   * Check exactly what the frontend receives from the API.
   */
  console.log("=== RIPPLE CREATED ===");
  console.log("Full ripple object:", ripple);
  console.log("Backend voices received:", ripple?.voices);
  console.log("Backend status received:", ripple?.status);
  console.log("Backend isSimilar received:", ripple?.isSimilar);

  const isSimilarMatch = ripple?.isSimilar === true;

  const parsedVoiceCount = Number(ripple?.voices);

  const voiceCount =
    Number.isFinite(parsedVoiceCount) && parsedVoiceCount >= 0
      ? parsedVoiceCount
      : 0;

  console.log("Parsed voice count:", parsedVoiceCount);
  console.log("Final voice count displayed:", voiceCount);

  const activeStatus = getTimelineStatus(
    ripple?.status,
    isSimilarMatch
  );

  console.log("Timeline status:", activeStatus);

  return (
    <main className="created-page">
      <section className="celebration">
        <div className="promise">
          <Asset
            screen="5:9927"
            name="imgWaves"
          />

          {isSimilarMatch
            ? "Similar Community Ripple Found"
            : isReport
            ? "Your voice can make a difference"
            : "Your voice made a connection"}
        </div>

        <Intro
          title={
            isSimilarMatch
              ? "Your voice joined an existing Ripple."
              : isReport
              ? "Your Ripple starts here."
              : "Your voice joined a Ripple."
          }
        >
          {isSimilarMatch
            ? `We matched your complaint with an existing topic in your area. You are now voice #${voiceCount} supporting this cause!`
            : isReport
            ? "Your report has been confirmed and logged."
            : `${voiceCount} ${
                voiceCount === 1 ? "voice" : "voices"
              } in your community ${
                voiceCount === 1 ? "has" : "have"
              } reported similar experiences.`}
        </Intro>

        <div className="connected-ripple">
          {[
            "imgSharedVoice",
            "imgSharedVoice1",
            "imgWavesArrowDown",
            "imgYourVoice",
            "imgJoiningRipple",
            "imgCommunityRipple",
            "imgExpandingRipple",
            "imgOuterRipple",
          ].map((name) => (
            <Asset
              key={name}
              screen="5:9927"
              name={name}
              className={name}
            />
          ))}

          <div className="people-count">
            <strong>
              {voiceCount}{" "}
              {voiceCount === 1 ? "voice" : "voices"}
            </strong>

            <small>
              {isSimilarMatch
                ? "voices united on this issue"
                : "voices connected"}
            </small>
          </div>
        </div>
      </section>

      <section className="ripple-details">
        <p className="eyebrow">
          {isSimilarMatch
            ? "Matched Community Topic"
            : "Your Ripple"}
        </p>

        <h2>
          {ripple?.topic_title || ripple?.title}
        </h2>

        {isSimilarMatch && ripple?.similarity != null && (
          <p
            style={{
              color: "#007bff",
              fontWeight: "bold",
              fontSize: "0.9rem",
              margin: "0.25rem 0",
            }}
          >
            {(Number(ripple.similarity) * 100).toFixed(1)}
            {"% Match with existing topic"}
          </p>
        )}

        <span className="category-badge">
          {ripple?.category === "Transportation" && (
            <Asset
              screen="5:9927"
              name="imgBusFront"
            />
          )}

          {ripple?.category === "Transportation"
            ? "Public Transportation"
            : ripple?.category || "General"}
        </span>

        <hr />

        <StatusTimeline status={activeStatus} />

        <Button
          aria-pressed={followed}
          onClick={onFollow}
        >
          <Asset
            screen="5:9927"
            name="imgBell"
          />

          {followed
            ? "Following this Ripple"
            : "Follow this Ripple"}
        </Button>

        <Reassurance>
          {followed
            ? "Saved to your followed Ripples on this device."
            : "Stay connected as progress is made."}
        </Reassurance>

        {isReport && (
          <button
            className="text-link"
            onClick={() => downloadReport(ripple)}
          >
            Download my report
          </button>
        )}

        <a
          className="text-link"
          href="#/explore"
        >
          Explore community Ripples
        </a>
      </section>
    </main>
  );
}