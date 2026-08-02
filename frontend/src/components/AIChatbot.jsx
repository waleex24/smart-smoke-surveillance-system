// 📁 src/components/AIChatbot.jsx
import React, { useState, useRef, useEffect } from "react";
import API from "../api/api.js";
import "./AIChatbot.css";

const AIChatbot = ({ user, myAlerts, regNo }) => {
  const [isOpen, setIsOpen]         = useState(false);
  const [messages, setMessages]     = useState([
    {
      role: "assistant",
      text: `Assalam o Alaikum! 👋 Main 4S AI Assistant hoon.\nApki violations, fines, appeals, ya system ke baare mein kuch bhi poochh saktay hain.`,
    },
  ]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [sessionId, setSessionId]   = useState(null);
  const [hasNew, setHasNew]         = useState(false);
  const bottomRef                   = useRef(null);
  const inputRef                    = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasNew(false);
    }
  }, [isOpen]);

  // Violation context for AI
  const violationContext = {
    violation_count: myAlerts?.length || 0,
    offense_status:
      (myAlerts?.length || 0) >= 3 ? "Critical" :
      (myAlerts?.length || 0) === 2 ? "Escalated" :
      (myAlerts?.length || 0) === 1 ? "Warning" : "Clean",
    total_fine: (myAlerts?.length || 0) * 5000,
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await API.aiChat({
        message: text,
        session_id: sessionId,
        student_email: user?.email,
        student_name: user?.full_name,
        violation_context: violationContext,
      });

      const data = res.data;
      if (data.session_id && !sessionId) setSessionId(data.session_id);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply },
      ]);

      if (!isOpen) setHasNew(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, kuch masla aa gaya. Thodi der baad dobara try karein.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        text: `Naya conversation shuru! Kya poochna chahte hain? 😊`,
      },
    ]);
    setSessionId(null);
  };

  // Quick suggestions
  const suggestions = [
    "Meri violations kitni hain?",
    "Fine kaise pay karoon?",
    "Appeal kaise karte hain?",
    "System kaise kaam karta hai?",
  ];

  return (
    <>
      {/* ── Floating Bubble ── */}
      <button
        className={`chat-bubble ${isOpen ? "bubble-open" : ""} ${hasNew ? "bubble-pulse" : ""}`}
        onClick={() => setIsOpen((p) => !p)}
        aria-label="AI Assistant"
      >
        {isOpen ? (
          <span className="bubble-icon">✕</span>
        ) : (
          <>
            <span className="bubble-icon">🤖</span>
            {hasNew && <span className="bubble-badge" />}
          </>
        )}
      </button>

      {/* ── Chat Window ── */}
      <div className={`chat-window ${isOpen ? "chat-open" : ""}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-avatar">🤖</div>
            <div>
              <div className="chat-name">4S AI Assistant</div>
              <div className="chat-status">
                <span className="status-dot" />
                Online
              </div>
            </div>
          </div>
          <button className="chat-clear" onClick={clearChat} title="Clear chat">
            🗑️
          </button>
        </div>

        {/* Messages */}
        <div className="chat-body">
          {messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="msg-avatar">🤖</div>
              )}
              <div className={`msg-bubble ${msg.role}`}>
                {msg.text.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < msg.text.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant">
              <div className="msg-avatar">🤖</div>
              <div className="msg-bubble assistant typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick Suggestions — only show at start */}
        {messages.length <= 1 && (
          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="suggestion-chip"
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-footer">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Apna sawal likhein..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button
            className={`chat-send ${loading || !input.trim() ? "disabled" : ""}`}
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
};

export default AIChatbot;