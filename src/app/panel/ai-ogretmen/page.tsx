import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AiChat } from "@/components/ai-chat";

export default async function AiOgretmenSayfasi({
  searchParams,
}: {
  searchParams: { konu?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/giris");

  const topics = await prisma.topic.findMany({
    include: { unit: { include: { subject: { include: { grade: true } } } } },
    orderBy: { name: "asc" },
    take: 50,
  });

  const selectedTopicId = searchParams.konu ?? topics[0]?.id;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl gap-6 px-6 py-10">
      <aside className="w-64 shrink-0">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">KONULAR</h2>
        <ul className="space-y-1">
          {topics.map((t) => (
            <li key={t.id}>
              <a
                href={`/panel/ai-ogretmen?konu=${t.id}`}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  t.id === selectedTopicId
                    ? "bg-indigo-100 font-medium text-indigo-800"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t.unit.subject.grade.label} · {t.unit.subject.name}
                <br />
                <span className="text-xs text-slate-500">{t.name}</span>
              </a>
            </li>
          ))}
          {topics.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              Henüz müfredat verisi yok. Önce{" "}
              <code className="rounded bg-slate-100 px-1">curriculum:import</code> çalıştırın.
            </li>
          )}
        </ul>
      </aside>

      <section className="flex-1">
        {selectedTopicId ? (
          <AiChat topicId={selectedTopicId} />
        ) : (
          <p className="text-slate-500">Sohbet başlatmak için soldan bir konu seçin.</p>
        )}
      </section>
    </main>
  );
}
