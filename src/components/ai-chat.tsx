"use client";

import { useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  hasUnresolvedIssues?: boolean;
  sources?: { code: string; topic: string }[];
}

export function AiChat({ topicId }: { topicId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim()) return;
    setError(null);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/sohbet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          message: text,
          history: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "AI öğretmen şu anda geçici olarak kullanılamıyor.");
        return;
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.text,
          hasUnresolvedIssues: data.hasUnresolvedIssues,
          sources: data.sources,
        },
      ]);
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const quickActions = ["Basit Anlat", "Detaylı Anlat", "Örnek Ver", "Bana Soru Sor", "Mini Test Oluştur"];

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Bu konu hakkında bir soru sor, ya da aşağıdaki butonlardan birini kullan.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-xl px-4 py-2 text-sm ${
                m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>

            {m.role === "assistant" && m.hasUnresolvedIssues && (
              <p className="mt-1 text-xs text-amber-600">
                ⚠️ Bu cevaptaki bazı bilgiler otomatik doğrulamadan tam geçemedi, dikkatli değerlendirin.
              </p>
            )}
          </div>
        ))}

        {loading && <p className="text-sm text-slate-400">AI öğretmen yazıyor...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => send(action)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {action}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bir soru yaz..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Gönder
          </button>
        </form>
      </div>
    </div>
  );
}
