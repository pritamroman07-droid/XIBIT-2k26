import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Activity } from 'lucide-react';
import { createLiveSession, LiveSessionController } from '../services/geminiService';
import { FunctionDeclaration } from '@google/genai';

interface LiveAssistantProps {
  systemInstruction: string;
  initialMessage?: string;
  onTranscription?: (text: string) => void;
  tools?: FunctionDeclaration[];
  onToolCall?: (name: string, args: any) => Promise<any>;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ systemInstruction, initialMessage, onTranscription, tools, onToolCall }) => {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState('');
  const sessionRef = useRef<LiveSessionController | null>(null);

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, []);

  const toggleSession = async () => {
    if (isActive) {
      sessionRef.current?.disconnect();
      setIsActive(false);
      setTranscription('');
    } else {
      setIsActive(true);
      sessionRef.current = createLiveSession(
        (playing) => setIsPlaying(playing),
        (text, isFinal) => {
          setTranscription(prev => isFinal ? "" : text); // Clear on final to simulate "listening" buffer
          if (isFinal && text && onTranscription) {
            onTranscription(text);
          }
        },
        systemInstruction,
        tools,
        onToolCall
      );
      await sessionRef.current.connect();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Caption Bubble */}
      {isActive && transcription && (
        <div className="bg-black/80 text-white p-3 rounded-lg mb-4 max-w-xs backdrop-blur-sm animate-fade-in-up pointer-events-auto glass-dark">
          <p className="text-sm">{transcription}</p>
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={toggleSession}
        className={`
          pointer-events-auto
          h-16 w-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 animate-bounce-in
          ${isActive ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-emerald-600 hover:bg-emerald-700 hover-glow'}
        `}
      >
        {isActive ? (
          <div className="relative">
            {isPlaying && (
              <span className="absolute -inset-2 rounded-full border-2 border-white animate-ping opacity-75"></span>
            )}
            <X className="w-8 h-8 text-white" />
          </div>
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>

      {/* Label when inactive */}
      {!isActive && (
        <div className="mt-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-3 py-1 rounded-full shadow-sm text-xs font-semibold text-emerald-800 dark:text-emerald-400 pointer-events-auto animate-fade-in-up">
          {initialMessage || "Tap to speak"}
        </div>
      )}
    </div>
  );
};

export default LiveAssistant;