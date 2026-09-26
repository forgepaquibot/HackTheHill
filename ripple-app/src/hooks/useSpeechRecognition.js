import { useEffect, useRef, useState } from "react";
export default function useSpeechRecognition(onTranscript) {
  const [listening, setListening] = useState(false),
    [error, setError] = useState("");
  const recognition = useRef(null),
    callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);
  const supported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  useEffect(() => {
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) return;
    const instance = new API();
    instance.continuous = true;
    instance.interimResults = false;
    instance.lang = "en-CA";
    instance.onstart = () => setListening(true);
    instance.onend = () => setListening(false);
    instance.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) text += e.results[i][0].transcript + " ";
      if (text.trim()) callback.current(text.trim());
    };
    instance.onerror = (e) => {
      setListening(false);
      setError(
        e.error === "not-allowed"
          ? "Microphone access was denied. You can allow it in your browser or type below."
          : "Speech recognition stopped. Please try again or type your report.",
      );
    };
    recognition.current = instance;
    return () => {
      instance.onresult = null;
      instance.onend = null;
      instance.onerror = null;
      instance.onstart = null;
      instance.abort();
      recognition.current = null;
    };
  }, []);
  function toggle() {
    setError("");
    if (!recognition.current) {
      setError(
        "Speech recognition is unavailable in this browser. You can type your report.",
      );
      return;
    }
    try {
      if (listening) recognition.current.stop();
      else recognition.current.start();
    } catch {
      setError("The microphone could not start. Please try again.");
    }
  }
  return {
    listening,
    error,
    supported,
    toggle,
    stop: () => recognition.current?.stop(),
  };
}
