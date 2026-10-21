import { Skeleton } from "@/components/ui/skeleton"

/** Genel bakış yüklenirken düzenin iskeleti (DOG-145); sayfa zıplamasın. */
export default function DashboardLoading() {
  return (
    <main aria-busy="true" aria-label="Genel bakış yükleniyor" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:pt-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </main>
  )
}
