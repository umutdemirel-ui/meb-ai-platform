import { prisma } from "@/lib/prisma";

export interface CurriculumContextItem {
  outcomeCode: string;
  description: string;
  gradeLabel: string;
  subjectName: string;
  unitName: string;
  topicName: string;
  subtopicName: string | null;
}

/**
 * Verilen konu (topicId) için müfredat bağlamını çeker: o konunun ve
 * alt konularının tüm kazanımlarını, kaynak künyesiyle birlikte döner.
 *
 * Bu fonksiyon SADECE veritabanında gerçekten kayıtlı olan veriyi döner —
 * AI bu context dışına çıkarak "müfredat bilgisi" uyduramaz (madde 1, 15).
 */
export async function retrieveCurriculumContext(topicId: string): Promise<CurriculumContextItem[]> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      learningOutcomes: true,
      subtopics: { include: { learningOutcomes: true } },
      unit: {
        include: {
          subject: {
            include: { grade: true },
          },
        },
      },
    },
  });

  if (!topic) return [];

  const { unit } = topic;
  const { subject } = unit;
  const { grade } = subject;

  const items: CurriculumContextItem[] = topic.learningOutcomes.map((lo) => ({
    outcomeCode: lo.code,
    description: lo.description,
    gradeLabel: grade.label,
    subjectName: subject.name,
    unitName: unit.name,
    topicName: topic.name,
    subtopicName: null,
  }));

  for (const sub of topic.subtopics) {
    for (const lo of sub.learningOutcomes) {
      items.push({
        outcomeCode: lo.code,
        description: lo.description,
        gradeLabel: grade.label,
        subjectName: subject.name,
        unitName: unit.name,
        topicName: topic.name,
        subtopicName: sub.name,
      });
    }
  }

  return items;
}

/** Context'i AI'ya verilecek okunabilir bir bloğa dönüştürür. */
export function formatContextForPrompt(items: CurriculumContextItem[]): string {
  if (items.length === 0) {
    return "(Bu konu için sistemde kayıtlı doğrulanmış müfredat verisi bulunamadı.)";
  }

  return items
    .map(
      (item) =>
        `[${item.outcomeCode}] ${item.gradeLabel} > ${item.subjectName} > ${item.unitName} > ${item.topicName}` +
        (item.subtopicName ? ` > ${item.subtopicName}` : "") +
        `\nKazanım: ${item.description}`
    )
    .join("\n\n");
}
