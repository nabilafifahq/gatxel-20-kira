import { FAMILY_ROUTES } from '@/components/console/routes'
import { AreaNotFound } from '@/components/ui/AreaNotFound'

export default function FamilyNotFound() {
  return <AreaNotFound home={FAMILY_ROUTES.home} label="Kembali ke halaman keluarga" />
}
