"use client";

import React, { useState } from "react";

interface VoiceAgentProps {
  customerName: string;
  amount: number;
  invoiceId: string;
}

export const VoiceRecoveryAgent: React.FC<VoiceAgentProps> = ({ customerName, amount, invoiceId }) => {
  const [isCalling, setIsCalling] = useState(false);
  const [agentResponse, setAgentResponse] = useState("");

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    setAgentResponse(text);
  };

  const startCall = () => {
    setIsCalling(true);
    const greeting = `Namaste ${customerName}. I am calling from RecoverAI regarding invoice ${invoiceId} for Rupees ${amount}. Would you like me to send a payment link over WhatsApp?`;
    speak(greeting);
  };

  const endCall = () => {
    setIsCalling(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          Hinglish Voice Recovery Agent
        </h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">100% Free WebSpeech</span>
      </div>

      <p className="text-sm text-slate-300 mb-3">
        Invoice: <span className="font-mono text-cyan-400">{invoiceId}</span> | Amount: <span className="font-bold text-emerald-400">₹{amount}</span>
      </p>

      {agentResponse && (
        <div className="p-3 bg-slate-800/80 rounded-lg text-xs text-slate-200 mb-4 border border-slate-700">
          <strong>AI Agent:</strong> &quot;{agentResponse}&quot;
        </div>
      )}

      <div className="flex gap-2">
        {!isCalling ? (
          <button
            onClick={startCall}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-medium rounded-lg text-sm transition"
          >
            Start AI Voice Call
          </button>
        ) : (
          <button
            onClick={endCall}
            className="w-full py-2 bg-rose-600 hover:bg-rose-500 font-medium rounded-lg text-sm transition"
          >
            End Call
          </button>
        )}
      </div>
    </div>
  );
};
