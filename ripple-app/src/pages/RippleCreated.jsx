import {
  Asset,
  Button,
  Intro,
  Reassurance,
  StatusTimeline,
} from "../components/UI";
function downloadReport(ripple) {
  const text = `# Ripple report\n${ripple.title}\n\nLocation: ${ripple.location}\nTime: ${ripple.time}\nCategory: ${ripple.category}\n\n${ripple.text}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "ripple-report.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function RippleCreated({
  ripple,
  followed,
  onFollow,
  isReport = false,
}) {
  return (
    <main className="created-page">
      <section className="celebration">
        <div className="promise">
          <Asset screen="5:9927" name="imgWaves" />
          {isReport
            ? "Your voice can make a difference"
            : "Your voice made a connection"}
        </div>
        <Intro
          title={
            isReport
              ? "Your Ripple starts here."
              : "Your voice joined a Ripple."
          }
        >
          {isReport
            ? "Your report has been confirmed in this demo."
            : `${ripple.voices} people in your community have reported similar experiences.`}
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
            <Asset key={name} screen="5:9927" name={name} className={name} />
          ))}
          <div className="people-count">
            <strong>
              {ripple.voices} {ripple.voices === 1 ? "voice" : "people"}
            </strong>
            <small>voices connected</small>
          </div>
        </div>
      </section>
      <section className="ripple-details">
        <p className="eyebrow">Your Ripple</p>
        <h2>{ripple.title}</h2>
        <span className="category-badge">
          {ripple.category === "Transportation" && (
            <Asset screen="5:9927" name="imgBusFront" />
          )}
          {ripple.category === "Transportation"
            ? "Public Transportation"
            : ripple.category}
        </span>
        <hr />
        <StatusTimeline
          status={
            isReport
              ? "Reported"
              : ripple.status === "Repairs scheduled"
                ? "Action planned"
                : ripple.status === "Action announced"
                  ? "Action planned"
                  : ripple.status === "Reports gathering"
                    ? "Reported"
                    : ripple.status === "City reviewing"
                      ? "Under review"
                      : ripple.status
          }
        />
        <Button aria-pressed={followed} onClick={onFollow}>
          <Asset screen="5:9927" name="imgBell" />
          {followed ? "Following this Ripple" : "Follow this Ripple"}
        </Button>
        <Reassurance>
          {followed
            ? "Saved to your followed Ripples on this device."
            : "Stay connected as progress is made."}
        </Reassurance>
        <p className="demo-note">
          {isReport
            ? "Demo report — not submitted to a city."
            : "Example community data."}{" "}
          Following is saved locally; notifications are not connected.
        </p>
        {isReport && (
          <button className="text-link" onClick={() => downloadReport(ripple)}>
            Download my report
          </button>
        )}
        <a className="text-link" href="#/explore">
          Explore community Ripples
        </a>
      </section>
    </main>
  );
}
