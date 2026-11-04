import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findContentDir } from '../src/load'

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return name.endsWith('.json') ? [path] : []
  })
}

function walk(value: unknown, visit: (node: Record<string, unknown>) => void, onText: (text: string) => void): void {
  if (typeof value === 'string') onText(value)
  else if (Array.isArray(value)) value.forEach((v) => walk(v, visit, onText))
  else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    visit(node)
    Object.values(node).forEach((v) => walk(v, visit, onText))
  }
}

describe('materi tertulis', () => {
  const files = jsonFiles(findContentDir())

  it('tidak memakai notasi mentah untuk pangkat dan kali', () => {
    const raw: string[] = []
    for (const file of files) {
      walk(JSON.parse(readFileSync(file, 'utf8')), () => undefined, (text) => {
        if (/\d\s?\^\s?\d|\d\s?\*\s?\d/.test(text)) raw.push(text.slice(0, 80))
      })
    }
    expect(raw).toEqual([])
  })

  it('contoh jawaban tidak lebih pendek dari minWords', () => {
    const short: string[] = []
    for (const file of files) {
      walk(JSON.parse(readFileSync(file, 'utf8')), (node) => {
        if (typeof node.minWords === 'number' && typeof node.model === 'string' && node.model.trim().split(/\s+/).length < node.minWords) short.push(String(node.id))
      }, () => undefined)
    }
    expect(short).toEqual([])
  })
})
