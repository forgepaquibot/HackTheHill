import { Asset, Reassurance } from "../components/UI";
export default function Home() {
  return (
    <main>
      <section className="home-hero">
        <div className="hero-copy">
          <div className="promise">
            <Asset screen="5:1224" name="imgWaves" />
            Every voice can start a ripple
          </div>
          <h1 tabIndex="-1">What could be better in your community?</h1>
          <p className="hero-description">
            Tell us what’s affecting your day. Your voice can join others and
            help create change.
          </p>
          <div className="home-actions">
            {[
              ["Speak", "Tell us what happened", "imgMic", "speak"],
              ["Type", "Write about it", "imgPencil", "type"],
            ].map(([title, description, icon, mode], i) => (
              <a
                href={`#/report?mode=${mode}`}
                className={`action-card ${i === 0 ? "primary" : ""}`}
                key={title}
              >
                <span className="action-icon">
                  <Asset screen="5:1224" name={icon} />
                </span>
                <span className="action-copy">
                  <span>{title}</span>
                  <small>{description}</small>
                </span>
                <Asset
                  screen="5:1224"
                  name={i === 0 ? "imgArrowRight" : "imgArrowRight1"}
                />
              </a>
            ))}
          </div>
          <Reassurance>
            No forms to figure out. Start in your own words.
          </Reassurance>
        </div>
        <div className="community-story">
          <Asset
            screen="5:1224"
            name="imgOuterRipple"
            className="outer-ripple"
          />
          <Asset
            screen="5:1224"
            name="imgMiddleRipple"
            className="middle-ripple"
          />
          <Asset
            screen="5:1224"
            name="imgNeighbors"
            className="neighbors"
            alt="Neighbors sharing a conversation on a tree-lined street"
          />
          <Asset screen="5:1224" name="imgRippleDot" className="dot-one" />
          <Asset screen="5:1224" name="imgRippleDot1" className="dot-two" />
          <div className="community-message">
            <span className="icon-circle">
              <Asset screen="5:1224" name="imgUsers" />
            </span>
            You may not be the only one noticing it.
          </div>
        </div>
      </section>
      <section id="how-it-works" className="how-it-works">
        <div>
          <p className="eyebrow">Simple from the start</p>
          <h2>Your concern, carried forward.</h2>
        </div>
        {[
          [
            "imgMessageCircle",
            "Share what you notice",
            "Speak or type in everyday language.",
          ],
          [
            "imgUsers1",
            "Find shared concerns",
            "See when neighbors feel the same.",
          ],
          [
            "imgWaves1",
            "Follow the ripple",
            "Stay connected as progress is made.",
          ],
        ].map(([icon, title, copy]) => (
          <div className="how-step" key={title}>
            <span className="icon-circle">
              <Asset screen="5:1224" name={icon} />
            </span>
            <div>
              <h3>
                <span className="desktop-step-title">{title}</span>
                <span className="mobile-step-title">
                  {title === "Find shared concerns"
                    ? "Connect with shared concerns"
                    : title === "Follow the ripple"
                      ? "Follow progress together"
                      : title}
                </span>
              </h3>
              <p>{copy}</p>
            </div>
            <Asset
              screen="5:1302"
              name="imgChevronRight"
              className="step-chevron"
            />
          </div>
        ))}
      </section>
    </main>
  );
}
