/**
 * AIProvider soyutlaması (madde 25).
 * Frontend hiçbir zaman bir AI sağlayıcıya doğrudan bağlanmaz — her istek bu
 * arayüzün arkasından, server tarafında (API route içinde) geçer. API
 * anahtarları sadece burada, env variable olarak okunur.
 */

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionResult {
  text: string;
  model: string;
}

export interface AIProvider {
  complete(messages: AIMessage[], opts?: { maxTokens?: number }): Promise<AICompletionResult>;
}
