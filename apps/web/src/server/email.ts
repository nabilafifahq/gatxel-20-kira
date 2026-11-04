import { parseAddressList, type EmailIdentity } from '@kira/core/email'
import { legalEnv } from './legal-env'

/** Identitas footer email dari env. Tanpa KIRA_LEGAL_* baris alamat dilewati, dan isian kosong tidak pernah tampil di email. */
export function emailIdentity(): EmailIdentity {
  return {
    origin: legalEnv('KIRA_ORIGIN') ?? 'https://kira.gatxel.com',
    legalName: legalEnv('KIRA_LEGAL_NAME'),
    legalAddress: legalEnv('KIRA_LEGAL_ADDRESS'),
  }
}

/** Alamat tim dukungan: KIRA_SUPPORT_EMAIL (dipisah koma), cadangannya KIRA_LEGAL_EMAIL. */
export function supportAddresses(): string[] {
  const list = parseAddressList(legalEnv('KIRA_SUPPORT_EMAIL'))
  return list.length ? list : parseAddressList(legalEnv('KIRA_LEGAL_EMAIL'))
}
