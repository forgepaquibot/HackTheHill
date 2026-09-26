import { useEffect, useRef } from "react";
import { Asset } from "./components/UI";
import useSpeechRecognition from "./hooks/useSpeechRecognition";
export default function VoiceToText({ value, onChange, mode }) {
  const textarea = useRef(null);
  const speech = useSpeechRecognition((text) =>
    onChange((previous) => [previous, text].filter(Boolean).join(" ")),
  );
  useEffect(() => {
    if (mode === "type") textarea.current?.focus();
  }, [mode]);
  return (
    <div className="report-methods">
      <section className="speak-card">
        <h2>
          <Asset name="imgMic" />
          Speak
        </h2>
        <div className={`voice-control ${speech.listening ? "listening" : ""}`}>
          <div className="voice-ring">
            <button
              type="button"
              className="microphone"
              aria-label={speech.listening ? "Stop speaking" : "Start speaking"}
              aria-pressed={speech.listening}
              onClick={speech.toggle}
            >
              <Asset name="imgMic1" />
            </button>
          </div>
        </div>
        <h3>{speech.listening ? "Listening…" : "Tap to start speaking."}</h3>
        <p aria-live="polite">
          {speech.listening
            ? "Take your time. Tap again when you’re finished."
            : speech.supported
              ? "Take your time. Tap again when you’re finished."
              : "Voice input is unavailable in this browser. You can type your report."}
        </p>
        {speech.error && (
          <p className="error" role="alert">
            {speech.error}
          </p>
        )}
      </section>
      <section className="type-card">
        <h2>
          <Asset name="imgPencil" />
          Type
        </h2>
        <div className="text-box">
          <textarea
            ref={textarea}
            aria-label="Tell us what happened"
            placeholder="Example: The number 7 bus has been overcrowded every morning this week…"
            value={value}
            maxLength={5000}
            onChange={(e) => onChange(e.target.value)}
          />
          <small>
            {value ? `${value.length} / 5,000` : "Use your own words"}
          </small>
        </div>
        <p>Share as much or as little as you’d like.</p>
      </section>
    </div>
  );
}
