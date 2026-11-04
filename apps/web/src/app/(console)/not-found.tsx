import { CONSOLE_ROUTES } from '@/components/console/routes'
import { AreaNotFound } from '@/components/ui/AreaNotFound'

export default function ConsoleNotFound() {
  return <AreaNotFound home={CONSOLE_ROUTES.today} label="Kembali ke konsol" />
}
