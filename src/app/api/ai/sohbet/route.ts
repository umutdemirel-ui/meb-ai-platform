import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/anthropic-provider";
import { retrieveCurriculumContext, formatContextForPrompt } from "@/lib/ai/retrieval";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { validateAIResponse } from "@/lib/ai/validation";
import type { AIMessage } from "@/lib/ai/provider";

const requestSchema = z.object({
  topicId: z.string().min(1),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .default([]),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { topicId, message, history } = parsed.data;

  try {
    const context = await retrieveCurriculumContext(topicId);
    const systemPrompt = buildSystemPrompt(formatContextForPrompt(context));

    const provider = getAIProvider();
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content }) as AIMessage),
      { role: "user", content: message },
    ];

    let result = await provider.complete(messages);
    let issues = validateAIResponse(result.text, context);

    // Madde 14: doğrulama başarısızsa cevap kullanıcıya gitmeden ÖNCE bir kez
    // düzeltme denemesi yapılır.
    if (issues.length > 0) {
      const correctionNote = issues.map((i) => `- ${i.detail}`).join("\n");
      const retryMessages: AIMessage[] = [
        ...messages,
        { role: "assistant", content: result.text },
        {
          role: "user",
          content: `Cevabında şu sorunlar tespit edildi, lütfen düzelterek yeniden yaz:\n${correctionNote}`,
        },
      ];

      result = await provider.complete(retryMessages);
      issues = validateAIResponse(result.text, context);
    }

    return NextResponse.json({
      text: result.text,
      hasUnresolvedIssues: issues.length > 0,
      sources: context.map((c) => ({ code: c.outcomeCode, topic: c.topicName })),
    });
  } catch (err) {
    console.error("AI sohbet hatası:", err);
    return NextResponse.json(
      { error: "AI öğretmen şu anda geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin." },
      { status: 503 }
    );
  }
}
