import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PanelSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/giris");
  }

  const grades = await prisma.grade.findMany({
    where: { curriculumVersion: { isActive: true } },
    orderBy: { level: "asc" },
    include: { subjects: true },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-900">
        Merhaba 👋 {session.user.name}
      </h1>
      <p className="mt-1 text-slate-600">Bugün ne çalışmak istiyorsun?</p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Sınıf Seç</h2>

        {grades.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Henüz aktif müfredat verisi yüklenmemiş. Geliştirme ortamında{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run prisma:seed</code>{" "}
            komutunu çalıştırarak örnek veri ekleyebilirsin.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {grades.map((grade) => (
              <div
                key={grade.id}
                className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-indigo-400 hover:shadow"
              >
                <div className="font-medium text-slate-900">{grade.label}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {grade.subjects.length} ders
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
