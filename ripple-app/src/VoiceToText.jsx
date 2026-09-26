import React, { useState, useEffect, useRef } from 'react';

const VoiceToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isFileConnected, setIsFileConnected] = useState(false);

  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const hasExportedRef = useRef(false);
  
  // File System Handles
  const fileHandleRef = useRef(null);
  const chatCountRef = useRef(1);

  // 1. Request permission to create or select a log file
  const connectLogFile = async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'ripple-chat-log.txt',
        types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }],
      });
      fileHandleRef.current = handle;
      setIsFileConnected(true);
    } catch (error) {
      console.error("File selection cancelled.", error);
    }
  };

  // 2. Append the formatted text directly into the selected file
  const appendToLogFile = async (text) => {
    if (!text.trim() || hasExportedRef.current || !fileHandleRef.current) return;

    try {
      const file = await fileHandleRef.current.getFile();
      const writable = await fileHandleRef.current.createWritable({ keepExistingData: true });

      const logEntry = `#chat ${chatCountRef.current}:\n${text}\n\n`;

      // Write at the very end of the file's current size
      await writable.write({ type: 'write', position: file.size, data: logEntry });
      await writable.close();

      chatCountRef.current += 1;
      hasExportedRef.current = true;

      // Clear the transcript to prepare for the next chat
      setTranscript('');
    } catch (error) {
      console.error("Error writing to file:", error);
    }
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      hasExportedRef.current = false;
    };

    recognition.onresult = (event) => {
      let newTranscriptChunks = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          let chunk = event.results[i][0].transcript.trim();

          if (!/[.,!?]$/.test(chunk)) {
            chunk += '.';
          }

          newTranscriptChunks += chunk + '\n';
        }
      }

      if (newTranscriptChunks !== '') {
        // Reset 10-second inactivity timer on fresh voice input
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        hasExportedRef.current = false;

        setTranscript((prev) => {
          let combined = prev;
          if (combined !== '' && !combined.endsWith('\n')) {
            combined += '\n';
          }
          const updated = combined + newTranscriptChunks;

          // Schedule automatic append 10 seconds after latest input
          timeoutRef.current = setTimeout(() => {
            appendToLogFile(updated);
          }, 10000);

          return updated;
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      hasExportedRef.current = false;
      recognitionRef.current.start();
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 font-sans">
      <div className="text-center mb-12">
        <h2 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3">Share what you notice</h2>
        <h1 className="text-4xl font-medium text-gray-900 mb-3">Tell us what happened.</h1>
        <p className="text-gray-500 text-lg">Choose the way that feels easiest. You can speak or type.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Speak Card */}
        <div className="bg-[#f0f7f8] rounded-3xl p-8 flex flex-col items-center justify-center text-center h-96 shadow-sm">
          <div className="text-teal-800 font-bold mb-8 flex items-center gap-2">
            <svg width="20" height="20" className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            Speak
          </div>

          <div className="relative flex items-center justify-center w-48 h-48 mb-4 cursor-pointer" onClick={toggleListen}>
            <div className={`absolute w-full h-full rounded-full border-2 transition-colors duration-500 ${isListening ? 'border-red-300 scale-110' : 'border-teal-700 opacity-20'}`}></div>
            <div className={`absolute w-36 h-36 rounded-full border-2 transition-colors duration-500 ${isListening ? 'border-red-400 scale-110' : 'border-teal-700 opacity-40'}`}></div>

            <button className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-white transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-[#1e6a73] hover:bg-teal-800'}`}>
               <svg width="32" height="32" className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            </button>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 text-xl">{isListening ? 'Listening...' : 'Tap to start speaking.'}</h3>
            <p className="text-gray-500 text-sm mt-2">{isListening ? 'Speak now. Tap again to stop.' : 'Take your time. Tap again when you’re finished.'}</p>
          </div>
        </div>

        {/* Type Card */}
        <div className="bg-white rounded-3xl p-8 flex flex-col h-96 shadow-sm border border-gray-200">
          <div className="text-teal-800 font-bold mb-4 flex items-center gap-2">
            <svg width="20" height="20" className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            Type
          </div>

          <div className="flex-grow border border-gray-200 rounded-xl p-4 flex flex-col focus-within:border-teal-600 transition-colors">
            <textarea 
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Example: The number 7 bus has been overcrowded every morning this week..."
              className="flex-grow w-full resize-none outline-none text-gray-700 placeholder-gray-400 bg-transparent"
            />
            
            {/* Log Connection UI */}
            <div className="flex justify-between items-center mt-2">
              {!isFileConnected ? (
                <button 
                  onClick={connectLogFile}
                  className="px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg hover:bg-teal-100 transition-colors"
                >
                  Connect Log File
                </button>
              ) : (
                <span className="text-xs text-teal-600 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                  Connected: Auto-appending
                </span>
              )}
              <div className="text-right text-xs text-gray-400 font-medium">
                Auto-saves 10s after speaking
              </div>
            </div>

          </div>
          <div className="text-left text-sm text-gray-500 mt-4">
            Share as much or as little as you'd like.
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceToText;