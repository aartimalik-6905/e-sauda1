import { useState, useRef, useEffect } from 'react'
import { MessageCircleQuestion, X, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { askAssistant, AssistantMessage } from '../lib/chatbot'

// Floating assistant available on every page once logged in — for either a
// buyer ("how do I list this", "is this safe") or a seller ("what am I
// selling", "what should I list next"). Each request re-grounds itself in
// this user's real listings server-side (see chat-assistant Edge
// Function) rather than answering from general knowledge alone.
export default function ChatbotWidget() {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  if (!session) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    const next = [...messages, { role: 'user' as const, content: body }]
    setMessages(next)
    setDraft('')
    setSending(true)
    setError(null)
    try {
      const reply = await askAssistant(next)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err: any) {
      setError(err.message || "Couldn't reach the assistant. Try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-line/10 bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line/5 bg-forest px-4 py-3">
            <p className="text-sm font-semibold text-ink">e-Sauda Assistant</p>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="text-ink/80 hover:text-ink">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-xs text-ink/40">
                Ask about your listings, fees, safety tips, or how e-Sauda works —
                buyer or seller, either way.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl2 px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-forest text-cream' : 'bg-cream-dark text-ink'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-ink/40">Thinking…</p>}
            {error && <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line/5 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask something…"
              className="bg-surface text-ink flex-1 rounded-full border border-line/10 px-3 py-2 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-cream disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-clay text-cream shadow-lg hover:bg-clay-light"
        aria-label="Open assistant"
      >
        <MessageCircleQuestion size={22} />
      </button>
    </div>
  )
}
