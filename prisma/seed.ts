/**
 * Örnek/başlangıç müfredat verisi.
 * GERÇEK MEB müfredatı buraya elle doldurulmamalı — madde 37'de belirtildiği gibi
 * doğrulanmış bir veri import pipeline'ı (data/curriculum/ altında) ile beslenmelidir.
 * Bu seed sadece geliştirme ortamında sistemi test edebilmek için 1 sınıf / 1 ders /
 * 1 ünite / 1 konu örneği içerir.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const version = await prisma.curriculumVersion.upsert({
    where: { label: "2025-2026" },
    update: {},
    create: { label: "2025-2026", isActive: true },
  });

  const grade10 = await prisma.grade.upsert({
    where: { level_curriculumVersionId: { level: 10, curriculumVersionId: version.id } },
    update: {},
    create: { level: 10, label: "10. Sınıf", curriculumVersionId: version.id },
  });

  const matematik = await prisma.subject.upsert({
    where: { gradeId_slug: { gradeId: grade10.id, slug: "matematik" } },
    update: {},
    create: { name: "Matematik", slug: "matematik", gradeId: grade10.id },
  });

  const unite = await prisma.unit.create({
    data: { name: "Fonksiyonlar", order: 1, subjectId: matematik.id },
  });

  const konu = await prisma.topic.create({
    data: { name: "Fonksiyon Kavramı", order: 1, unitId: unite.id },
  });

  await prisma.learningOutcome.create({
    data: {
      code: "TR-MEB-10-MAT-001",
      description:
        "Fonksiyon kavramını tanır; tanım ve değer kümesi ile fonksiyonu ilişkilendirir.",
      topicId: konu.id,
    },
  });

  console.log("Seed tamamlandı: 2025-2026 / 10. Sınıf / Matematik / Fonksiyonlar örneği eklendi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
