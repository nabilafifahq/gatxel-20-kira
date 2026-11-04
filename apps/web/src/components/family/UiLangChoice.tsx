'use client'

import { RadioGroup } from '@/components/console/Field'
import type { UiLang } from '@/lib/i18n/lang'

const LEGEND = 'Bahasa tampilan anak'
const HINT = 'Berlaku untuk tombol, petunjuk, dan pesan di layar anak. Soal dan pelajaran tetap memakai bahasa aslinya, kebanyakan bahasa Inggris.'

/** Pilihan bahasa tampilan anak, dipakai di onboarding, tambah anak, dan pengaturan anak. */
export function UiLangChoice({ name, value, onChange, disabled }: { name: string; value: UiLang; onChange: (v: UiLang) => void; disabled?: boolean }) {
  return (
    <RadioGroup
      name={name}
      legend={LEGEND}
      hint={HINT}
      value={value}
      onChange={onChange}
      layout="row"
      options={[
        { value: 'id', label: 'Bahasa Indonesia', disabled },
        { value: 'en', label: 'English', disabled },
      ]}
    />
  )
}
