import { useEffect, useRef } from "react";
import { Asset } from "./components/UI";
// Ensure the path below matches exactly where you saved File 1
import useSpeechRecognition from "./hooks/useSpeechRecognition";

export default function VoiceToText({ value, onChange, mode }) {
  const textarea = useRef(null);
  const partialText = useRef("");

  const speech = useSpeechRecognition(
    (text) => {
      const previousPartial = partialText.current;
      partialText.current = "";
      onChange((previous) => {
        const base = previousPartial && previous.endsWith(previousPartial)
          ? previous.slice(0, -previousPartial.length).trimEnd()
          : previous;
        return [base, text].filter(Boolean).join(" ");
      });
    },
    (text) => {
      const previousPartial = partialText.current;
      partialText.current = text;
      onChange((previous) => {
        const base = previousPartial && previous.endsWith(previousPartial)
          ? previous.slice(0, -previousPartial.length).trimEnd()
          : previous;
        return [base, text].filter(Boolean).join(" ");
      });
    },
  );

  useEffect(() => {
    if (!speech.listening && !speech.isConnecting) partialText.current = "";
  }, [speech.isConnecting, speech.listening]);

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

        {/* CSS: .listening for green/pulse effect, .busy for disabled state */}
        <div className={`voice-control ${speech.listening ? "listening" : ""}`}>
          <div className="voice-ring">
            <button
              type="button"
              className={`microphone ${speech.isConnecting ? "busy" : ""}`}
              aria-label={speech.listening ? "Stop" : "Start"}
              onClick={speech.toggle}
              disabled={speech.isConnecting}
            >
              <Asset name="imgMic1" />
            </button>
          </div>
        </div>
        
        <h3>
          {speech.isConnecting 
            ? "Connecting to AI..." 
            : speech.listening 
              ? "Listening…" 
              : "Tap to begin."}
        </h3>
        
        {speech.error && (
          <p className="error" role="alert" style={{ color: 'red', fontWeight: '500' }}>
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
            aria-label="Description"
            placeholder="Tell us what happened..."
            value={value}
            maxLength={5000}
            onChange={(e) => onChange(e.target.value)}
          />
          <small>{value?.length || 0} / 5,000</small>
        </div>
      </section>
    </div>
  );
}