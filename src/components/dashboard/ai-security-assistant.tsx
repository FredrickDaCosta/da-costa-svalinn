'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { X, Send, Loader2, Bot, ChevronDown, ShieldCheck, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { reportAiMessage, ReportReason } from '@/lib/report-ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED = [
  'Is my perimeter secure right now?',
  'How do I spot a phishing SMS?',
  'What threats target Nigeria most?',
  'Explain my security posture score.',
  'What is a deepfake audio attack?',
];

export function AISecurityAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const { toast } = useToast();
  const [reportingIndex, setReportingIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !greeted) {
      setMessages([{
        role: 'assistant',
        content: `Hello${user.displayName ? ' ' + user.displayName.split(' ')[0] : ''}! I am the Da-Costa AI Assistant, powered by Gemini. I can help you understand threats, analyse suspicious messages or links, explain your security status, and protect you from scams. What would you like to know?`,
      }]);
      setGreeted(true);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, greeted, user.displayName]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    
    // Add user message to display
    const newUserMessage: Message = { role: 'user', content: msg };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setLoading(true);
    
    try {
      // Only send user messages to avoid Gemini requiring user-first constraint
      // Include previous exchange for context (last 6 messages max)
      const contextMessages = updatedMessages
        .slice(-6)
        .filter((m, i, arr) => {
          // Ensure first message is always from user
          if (i === 0 && m.role === 'assistant') return false;
          return true;
        });

      const res = await fetch('/api/dacosta-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages,
          userContext: {
            displayName: user.displayName || undefined,
            streakDays: 14,
            postureScore: 94,
            sentryActive: user.sentryMode === 'full',
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      console.error('Da-Costa AI error:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an error. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Da-Costa AI Assistant"
        style={{
          position: 'fixed', bottom: 76, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00e5c8, #00b4d8)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,229,200,0.4), 0 0 0 3px rgba(0,229,200,0.15)',
          zIndex: 1000, transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? <ChevronDown size={22} color="#fff" /> : <Bot size={22} color="#fff" />}
        {!open && <span style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: '2px solid #00e5c8', opacity: 0,
          animation: 'dcAIPulse 2s ease-out infinite',
        }}/>}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 136, right: 16,
          width: 'min(380px, calc(100vw - 32px))',
          height: 'min(520px, calc(100vh - 160px))',
          background: '#0a1520',
          border: '1px solid #00e5c833',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          zIndex: 999, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #0d2035, #081828)',
            borderBottom: '1px solid #00e5c822',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00e5c8, #00b4d8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldCheck size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Da-Costa AI Assistant</div>
              <div style={{ fontSize: 9, color: '#00e5c8' }}>● Gemini-powered · Stateless · Zero data retained</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a5568', padding: 4, flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                position: 'relative',
                group: 'true', // Simple identifier for CSS hover logic if needed, but we use JS
              }}
              onMouseEnter={() => m.role === 'assistant' && (window as any)[`setHover${i}`]?.(true)}
              onMouseLeave={() => m.role === 'assistant' && (window as any)[`setHover${i}`]?.(false)}
              >
                <div style={{
                  maxWidth: '85%', padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? 'linear-gradient(135deg,#00e5c8,#00b4d8)' : '#0d2035',
                  border: m.role === 'assistant' ? '1px solid #00e5c822' : 'none',
                  color: m.role === 'user' ? '#000' : '#e2e8f0',
                  fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  position: 'relative',
                }}
                className={m.role === 'assistant' ? 'assistant-bubble' : ''}
                >
                  {m.content}
                  
                  {m.role === 'assistant' && (
                    <button
                      className="report-flag"
                      onClick={() => setReportingIndex(reportingIndex === i ? null : i)}
                      style={{
                        position: 'absolute',
                        right: -18,
                        top: 4,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        opacity: 0,
                        transition: 'opacity 0.2s, color 0.2s',
                        color: '#2a5568',
                      }}
                    >
                      <Flag size={10} />
                    </button>
                  )}

                  {reportingIndex === i && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '100%',
                      marginTop: 4,
                      background: '#0d2035',
                      border: '1px solid #00e5c822',
                      borderRadius: 8,
                      padding: '4px 0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      zIndex: 10,
                      minWidth: 160,
                    }}>
                      {[
                        { label: '🚨 Harmful content', value: 'harmful' },
                        { label: '❌ Inaccurate information', value: 'inaccurate' },
                        { label: '⚠️ Inappropriate response', value: 'inappropriate' },
                        { label: '📝 Other', value: 'other' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={async () => {
                            try {
                              await reportAiMessage(user.uid, m.content, opt.value as ReportReason);
                              toast({ title: "Thank you for your feedback", description: "Your report has been submitted." });
                            } catch (error) {
                              console.error('Report error:', error);
                              toast({ title: "Error submitting report", variant: "destructive" });
                            } finally {
                              setReportingIndex(null);
                            }
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '6px 12px',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            color: '#e2e8f0',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#00e5c811')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2a5568', fontSize: 11 }}>
                <Loader2 size={14} style={{ animation: 'dcSpin 1s linear infinite' }} />
                Da-Costa AI is analysing...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => send(q)} style={{
                  padding: '4px 10px', borderRadius: 20,
                  border: '1px solid #00e5c833', background: 'transparent',
                  color: '#00e5c8', fontSize: 10, cursor: 'pointer', fontWeight: 600,
                }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #00e5c822',
            display: 'flex', gap: 8, alignItems: 'center',
            flexShrink: 0, background: '#060e18',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about threats, scams, security..."
              style={{
                flex: 1, background: '#0d1f2e',
                border: '1px solid #1a3545', borderRadius: 20,
                padding: '8px 14px', fontSize: 12, color: '#fff', outline: 'none',
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: input.trim() ? 'linear-gradient(135deg,#00e5c8,#00b4d8)' : '#1a3545',
                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Send size={14} color={input.trim() ? '#000' : '#2a5568'} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dcAIPulse { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.7);opacity:0} }
        @keyframes dcSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .assistant-bubble:hover .report-flag { opacity: 1 !important; }
        .report-flag:hover { color: #ff6b6b !important; }
      `}</style>
    </>
  );
}
