import { PageSkeleton } from '@/components/ui/Skeleton'

/** Kerangka saat layar menunggu data. Hanya di rute tanpa notFound atau redirect, supaya status HTTP tetap benar. */
export default function Loading() {
  return <PageSkeleton />
}
