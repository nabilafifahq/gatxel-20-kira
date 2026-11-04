import { gateFeature } from '@/server/feature-gate'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await gateFeature('olympiad-math','olympiad-english','olympiad-science')
  return children
}
