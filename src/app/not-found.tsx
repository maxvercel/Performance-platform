import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-orange-500 text-7xl font-black mb-4">404</p>
        <h1 className="text-white text-2xl font-bold mb-2">Pagina niet gevonden</h1>
        <p className="text-zinc-500 text-sm mb-8">
          Deze pagina bestaat niet of is verplaatst.
        </p>
        <Link
          href="/portal/dashboard"
          className="inline-block bg-orange-500 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-orange-600 transition"
        >
          Terug naar dashboard
        </Link>
      </div>
    </div>
  )
}
