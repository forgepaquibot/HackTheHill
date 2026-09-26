import assets from "../assets/figma.json";
const mobileScreens = {
  "5:1224": "5:1302",
  "5:9588": "5:9672",
  "5:9757": "5:9845",
  "5:9927": "5:10020",
  "5:10114": "5:10357",
};
export function Asset({ screen = "5:9588", name, className = "", alt = "" }) {
  const mobileName =
    screen === "5:1224" && name === "imgUsers1"
      ? "imgUsers"
      : screen === "5:9757" && name === "imgPencil1"
        ? "imgPencil"
        : name;
  const mobile = assets[mobileScreens[screen]]?.[mobileName];
  return (
    <picture className={`asset ${className}`}>
      {mobile && <source media="(max-width: 900px)" srcSet={mobile} />}
      <img src={assets[screen]?.[name]} alt={alt} />
    </picture>
  );
}
export function Button({
  children,
  secondary = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`button ${secondary ? "secondary" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Intro({ eyebrow, title, children }) {
  return (
    <div className="page-intro">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 tabIndex="-1">{title}</h1>
      {children && <p className="intro-copy">{children}</p>}
    </div>
  );
}
export function Reassurance({ children }) {
  return (
    <p className="reassurance">
      <span>
        <Asset name="imgCheck" />
      </span>
      {children}
    </p>
  );
}
export function StatusTimeline({ status = "Under review" }) {
  const steps = [
    "Reported",
    "Community Ripple detected",
    "Under review",
    "Action planned",
    "Resolved",
  ];
  const current = Math.max(0, steps.indexOf(status));
  return (
    <ol className="timeline">
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? "step" : undefined}
          className={i < current ? "complete" : i === current ? "current" : ""}
        >
          <span className="marker">
            {i < current ? (
              <Asset screen="5:9927" name="imgCheck" />
            ) : (
              <Asset
                screen="5:9927"
                name={i === current ? "imgStatusMarker" : "imgStatusMarker1"}
              />
            )}
          </span>
          <div>
            {step}
            {i === current && <small>Current status</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}
