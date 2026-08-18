import Anthropic from "@anthropic-ai/sdk";
import type { AICompletionResult, AIMessage, AIProvider } from "./provider";

const MODEL = "claude-sonnet-4-6";

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY tanımlı değil.");
    }
    this.client = new Anthropic({ apiKey });
  }

  async complete(messages: AIMessage[], opts?: { maxTokens?: number }): Promise<AICompletionResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: opts?.maxTokens ?? 1024,
      system,
      messages: rest,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { text, model: MODEL };
  }
}

let cached: AnthropicProvider | null = null;

/** Server-only factory — env variable burada okunur, frontend'e asla gönderilmez. */
export function getAIProvider(): AIProvider {
  if (!cached) {
    cached = new AnthropicProvider(process.env.ANTHROPIC_API_KEY ?? "");
  }
  return cached;
}
