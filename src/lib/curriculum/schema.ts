/**
 * Curriculum dataset dosya formatı.
 *
 * Her dosya TEK BİR (sınıf, ders) çiftini temsil eder:
 *   data/curriculum/<versiyon>/<sinif-seviyesi>-<ders-slug>.json
 *
 * Örnek: data/curriculum/2025-2026/10-matematik.json
 *
 * Bu şema, dosyanın import script'i tarafından kabul edilmeden önce
 * yapısal olarak doğru olduğunu garanti eder. İçeriğin akademik doğruluğu
 * (gerçekten MEB müfredatına uygun olup olmadığı) ayrı bir insan/editör
 * doğrulama sürecinin sorumluluğundadır — bu şema sadece format kontrolü yapar.
 */
import { z } from "zod";

export const learningOutcomeSchema = z.object({
  code: z
    .string()
    .regex(/^TR-MEB-\d{1,2}-[A-Z]{2,10}-\d{3,4}$/, "Kazanım kodu 'TR-MEB-<sınıf>-<DERS>-<no>' formatında olmalı"),
  description: z.string().min(10, "Kazanım açıklaması çok kısa."),
});

export const subtopicSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  learningOutcomes: z.array(learningOutcomeSchema).default([]),
});

export const topicSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  learningOutcomes: z.array(learningOutcomeSchema).default([]),
  subtopics: z.array(subtopicSchema).default([]),
});

export const unitSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  topics: z.array(topicSchema).min(1, "Bir ünitede en az 1 konu olmalı."),
});

export const curriculumDatasetSchema = z.object({
  curriculumVersion: z.string().regex(/^\d{4}-\d{4}$/, "Versiyon 'YYYY-YYYY' formatında olmalı"),
  gradeLevel: z.number().int().min(5).max(12),
  gradeLabel: z.string().min(1),
  subjectName: z.string().min(1),
  subjectSlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "subjectSlug sadece küçük harf, rakam ve tire içerebilir."),
  units: z.array(unitSchema).min(1, "Bir dersde en az 1 ünite olmalı."),
});

export type CurriculumDataset = z.infer<typeof curriculumDatasetSchema>;

/**
 * Bir dataset içindeki tüm kazanım kodlarının benzersiz olduğunu doğrular.
 * Zod şeması tek başına dosya-içi tekrarları yakalayamaz, bu yüzden ayrı bir kontrol.
 */
export function validateUniqueOutcomeCodes(dataset: CurriculumDataset): string[] {
  const seen = new Map<string, number>();
  const walk = (outcomes: { code: string }[]) => {
    for (const o of outcomes) {
      seen.set(o.code, (seen.get(o.code) ?? 0) + 1);
    }
  };

  for (const unit of dataset.units) {
    for (const topic of unit.topics) {
      walk(topic.learningOutcomes);
      for (const sub of topic.subtopics) {
        walk(sub.learningOutcomes);
      }
    }
  }

  return [...seen.entries()].filter(([, count]) => count > 1).map(([code]) => code);
}
