import Link from "next/link";

export default function AnaSayfa() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-8 text-2xl font-semibold tracking-tight text-indigo-700">
        MEB AI
      </div>

      <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
        Derslerini daha akıllı çalış.
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        MEB müfredatına uygun kişisel AI öğretmenin.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/kayit"
          className="rounded-xl bg-indigo-600 px-6 py-3 text-white font-medium shadow-sm transition hover:bg-indigo-700"
        >
          Hemen Başla
        </Link>
        <Link
          href="/giris"
          className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Giriş Yap
        </Link>
      </div>
    </main>
  );
}
