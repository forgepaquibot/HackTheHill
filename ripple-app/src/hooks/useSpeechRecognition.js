import { useState } from "react";
import { useScribe } from "@elevenlabs/react";

const MODEL_ID = "scribe_v2_realtime";

export default function useSpeechRecognition(onTranscript, onPartialTranscript) {
  const [requestError, setRequestError] = useState("");
  const scribe = useScribe({
    modelId: MODEL_ID,
    onPartialTranscript: ({ text }) => {
      if (text?.trim()) onPartialTranscript?.(text.trim());
    },
    onCommittedTranscript: ({ text }) => {
      if (text?.trim()) onTranscript(text.trim());
    },
  });

  const toggle = async () => {
    try {
      setRequestError("");
      if (scribe.isConnected) {
        scribe.disconnect();
        return;
      }

      const response = await fetch("/api/scribe-token", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) {
        throw new Error(result.detail || "Could not start voice transcription.");
      }

      await scribe.connect({
        token: result.token,
        modelId: MODEL_ID,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Could not start voice transcription.",
      );
    }
  };

  return {
    listening: scribe.isConnected || scribe.isTranscribing,
    isConnecting: scribe.status === "connecting",
    error: requestError || scribe.error || "",
    supported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    toggle,
    partialText: scribe.partialTranscript,
    stop: scribe.disconnect,
  };
}