import { FAMILY_ROUTES } from '@/components/console/routes'
import { AreaNotFound } from '@/components/ui/AreaNotFound'

export default function PrintNotFound() {
  return <AreaNotFound home={FAMILY_ROUTES.home} label="Ke halaman keluarga" />
}
