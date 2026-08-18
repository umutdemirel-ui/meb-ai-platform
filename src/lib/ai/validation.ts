import { evaluate } from "mathjs";
import type { CurriculumContextItem } from "./retrieval";

export interface ValidationIssue {
  type: "unknown_citation" | "arithmetic_mismatch";
  detail: string;
}

/**
 * AI cevabında geçen "TR-MEB-..." kazanım kodlarının, gerçekten retrieval
 * katmanından gelen bağlamda var olup olmadığını kontrol eder (madde 16).
 * Uydurma bir kaynak kodu varsa bunu yakalar.
 */
export function validateCitations(
  responseText: string,
  context: CurriculumContextItem[]
): ValidationIssue[] {
  const knownCodes = new Set(context.map((c) => c.outcomeCode));
  const found = responseText.match(/TR-MEB-\d{1,2}-[A-Z]{2,10}-\d{3,4}/g) ?? [];

  const unknown = [...new Set(found)].filter((code) => !knownCodes.has(code));

  return unknown.map((code) => ({
    type: "unknown_citation",
    detail: `Cevapta bağlamda bulunmayan bir kazanım kodu geçti: ${code}`,
  }));
}

/**
 * Cevaptaki basit aritmetik iddiaları ("... = <sayı>" biçiminde, örn.
 * "2 + 5 = 8" gibi bir eşitlik) deterministik olarak yeniden hesaplar ve
 * AI'nın verdiği sonuçla karşılaştırır (madde 14). Karmaşık/sembolik denklemler
 * (örn. "2x + 5 = 15") bu basit kontrolün kapsamı dışındadır — sadece somut
 * sayısal eşitlikleri yakalar.
 */
export function validateArithmetic(responseText: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Sadece rakam/işlem karakterlerinden oluşan "ifade = sayı" kalıpları
  const pattern = /([\d.,+\-*/^()\s]{3,})=\s*(-?\d+(?:[.,]\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(responseText)) !== null) {
    const [, exprRaw, claimedRaw] = match;
    const expr = exprRaw.trim().replace(/,/g, ".");
    const claimed = parseFloat(claimedRaw.replace(",", "."));

    // Anlamsız/çok kısa ifadeleri atla (örn. tek başına "5 = 5" gibi triviyal eşleşmeler)
    if (!/[+\-*/^]/.test(expr)) continue;

    try {
      const actual = evaluate(expr);
      if (typeof actual === "number" && Math.abs(actual - claimed) > 0.001) {
        issues.push({
          type: "arithmetic_mismatch",
          detail: `"${expr.trim()} = ${claimedRaw}" hatalı — doğru sonuç ${actual}.`,
        });
      }
    } catch {
      // Parse edilemeyen ifadeler sessizce atlanır — bu bir doğrulama hatası değil,
      // sadece regex'in matematik dışı bir metni yakalamış olmasıdır.
    }
  }

  return issues;
}

export function validateAIResponse(
  responseText: string,
  context: CurriculumContextItem[]
): ValidationIssue[] {
  return [...validateCitations(responseText, context), ...validateArithmetic(responseText)];
}
