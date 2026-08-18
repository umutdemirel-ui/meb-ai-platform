/**
 * Kullanım:
 *   npx tsx scripts/import-curriculum.ts 2025-2026
 *   npx tsx scripts/import-curriculum.ts 2025-2026 --dry-run
 *   npx tsx scripts/import-curriculum.ts 2025-2026 --activate
 *
 * Bu script data/curriculum/<versiyon>/ altındaki her *.json dosyasını:
 *   1. Zod şemasına karşı doğrular (format).
 *   2. Dosya içi kazanım kodu tekrarlarını kontrol eder.
 *   3. Sorun yoksa CurriculumVersion → Grade → Subject → Unit → Topic →
 *      Subtopic → LearningOutcome hiyerarşisini idempotent (upsert) şekilde
 *      veritabanına yazar.
 *
 * --dry-run: hiçbir şey yazmaz, sadece doğrulama sonuçlarını raporlar.
 * --activate: import başarılıysa bu versiyonu aktif versiyon yapar
 *             (diğer tüm versiyonları pasifleştirir).
 *
 * Script, TEK BİR dosyada hata varsa TÜM importu durdurur — kısmi/bozuk
 * veri veritabanına yazılmaz (madde 37, "tahmin ederek veya rastgele
 * kopyalayarak oluşturma" ilkesiyle tutarlı: ya tamamen doğrulanmış veri
 * girer, ya da hiç girmez).
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  curriculumDatasetSchema,
  validateUniqueOutcomeCodes,
  type CurriculumDataset,
} from "../src/lib/curriculum/schema";

const prisma = new PrismaClient();

type FileResult =
  | { file: string; ok: true; dataset: CurriculumDataset }
  | { file: string; ok: false; errors: string[] };

function loadAndValidate(version: string): FileResult[] {
  const dir = join(process.cwd(), "data", "curriculum", version);
  let files: string[];

  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`Dizin bulunamadı: ${dir}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`${dir} içinde hiç .json dosyası yok.`);
    process.exit(1);
  }

  return files.map((file) => {
    const raw = readFileSync(join(dir, file), "utf-8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { file, ok: false, errors: [`Geçersiz JSON: ${(e as Error).message}`] };
    }

    const result = curriculumDatasetSchema.safeParse(parsed);
    if (!result.success) {
      return {
        file,
        ok: false,
        errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      };
    }

    if (result.data.curriculumVersion !== version) {
      return {
        file,
        ok: false,
        errors: [
          `Dosyadaki curriculumVersion ("${result.data.curriculumVersion}") ile klasör adı ("${version}") uyuşmuyor.`,
        ],
      };
    }

    const dupes = validateUniqueOutcomeCodes(result.data);
    if (dupes.length > 0) {
      return { file, ok: false, errors: [`Tekrarlanan kazanım kodları: ${dupes.join(", ")}`] };
    }

    return { file, ok: true, dataset: result.data };
  });
}

async function importDataset(dataset: CurriculumDataset) {
  const version = await prisma.curriculumVersion.upsert({
    where: { label: dataset.curriculumVersion },
    update: {},
    create: { label: dataset.curriculumVersion },
  });

  const grade = await prisma.grade.upsert({
    where: {
      level_curriculumVersionId: {
        level: dataset.gradeLevel,
        curriculumVersionId: version.id,
      },
    },
    update: { label: dataset.gradeLabel },
    create: {
      level: dataset.gradeLevel,
      label: dataset.gradeLabel,
      curriculumVersionId: version.id,
    },
  });

  const subject = await prisma.subject.upsert({
    where: { gradeId_slug: { gradeId: grade.id, slug: dataset.subjectSlug } },
    update: { name: dataset.subjectName },
    create: { name: dataset.subjectName, slug: dataset.subjectSlug, gradeId: grade.id },
  });

  for (const unitData of dataset.units) {
    const unit = await prisma.unit.upsert({
      where: { subjectId_name: { subjectId: subject.id, name: unitData.name } },
      update: { order: unitData.order },
      create: { name: unitData.name, order: unitData.order, subjectId: subject.id },
    });

    for (const topicData of unitData.topics) {
      const topic = await prisma.topic.upsert({
        where: { unitId_name: { unitId: unit.id, name: topicData.name } },
        update: { order: topicData.order },
        create: { name: topicData.name, order: topicData.order, unitId: unit.id },
      });

      for (const lo of topicData.learningOutcomes) {
        await prisma.learningOutcome.upsert({
          where: { code: lo.code },
          update: { description: lo.description, topicId: topic.id, subtopicId: null },
          create: { code: lo.code, description: lo.description, topicId: topic.id },
        });
      }

      for (const subData of topicData.subtopics) {
        const subtopic = await prisma.subtopic.upsert({
          where: { topicId_name: { topicId: topic.id, name: subData.name } },
          update: { order: subData.order },
          create: { name: subData.name, order: subData.order, topicId: topic.id },
        });

        for (const lo of subData.learningOutcomes) {
          await prisma.learningOutcome.upsert({
            where: { code: lo.code },
            update: { description: lo.description, subtopicId: subtopic.id, topicId: null },
            create: { code: lo.code, description: lo.description, subtopicId: subtopic.id },
          });
        }
      }
    }
  }
}

async function main() {
  const version = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const activate = process.argv.includes("--activate");

  if (!version) {
    console.error("Kullanım: npx tsx scripts/import-curriculum.ts <versiyon> [--dry-run] [--activate]");
    process.exit(1);
  }

  console.log(`\n📂 ${version} müfredat verisi doğrulanıyor...\n`);
  const results = loadAndValidate(version);

  const failed = results.filter((r): r is Extract<FileResult, { ok: false }> => !r.ok);
  const passed = results.filter((r): r is Extract<FileResult, { ok: true }> => r.ok);

  for (const r of passed) console.log(`✅ ${r.file}`);
  for (const r of failed) {
    console.log(`❌ ${r.file}`);
    r.errors.forEach((e) => console.log(`   - ${e}`));
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} dosyada hata var. Import DURDURULDU — hiçbir şey yazılmadı.`);
    process.exit(1);
  }

  console.log(`\n${passed.length} dosya doğrulandı.`);

  if (dryRun) {
    console.log("--dry-run modu: veritabanına yazılmadı.");
    return;
  }

  console.log("\n💾 Veritabanına yazılıyor...");
  for (const r of passed) {
    await importDataset(r.dataset);
    console.log(`   → ${r.file} yazıldı.`);
  }

  if (activate) {
    await prisma.curriculumVersion.updateMany({ data: { isActive: false }, where: {} });
    await prisma.curriculumVersion.update({
      where: { label: version },
      data: { isActive: true },
    });
    console.log(`\n🟢 ${version} artık aktif müfredat versiyonu.`);
  }

  console.log("\nImport tamamlandı.");
}

main()
  .catch((e) => {
    console.error("Import sırasında beklenmeyen hata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
