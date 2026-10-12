#!/usr/bin/env node
// Pemeriksa teks GTX untuk Kira (GTX-ENG-001 tingkat HOUSE; CLAUDE.md aturan 5, 6, 8, 10, 11; DESIGN.md bagian 4).
// Dijalankan oleh `pnpm lint` setelah ESLint, dan oleh CI. Tanpa dependensi selain `typescript`.
//
// Pemakaian: node scripts/check-copy.mjs [--root <folder>]
// Keluaran: satu baris `berkas:baris:kolom aturan pesan` per temuan. Exit 1 bila ada temuan, 2 bila pemeriksa gagal.
//
// Aturan:
//   dash             U+2014 dan U+2013; di teks UI juga escape (\u2014) dan entitas HTML (&mdash;)
//   vocabulary       kosakata terlarang GTX di teks UI (apps/web/src, apps/worker/src) dan prosa docs/
//   antithesis       bingkai antitesis dari .vale/styles/Gatxel/Antithesis.yml, juga di konten soal
//   hex              warna hex di luar file token; file token hanya memakai warna tabel DESIGN.md
//   arbitrary-value  kelas Tailwind arbitrer untuk warna atau font, misalnya bg-[#fff] dan font-[...]
//   next-public      variabel NEXT_PUBLIC_* di apps/, packages/, deploy/, e2e/
//   raw-sql          sql.raw(, .unsafe(, $queryRawUnsafe, $executeRawUnsafe, Prisma.raw
//   seed-marker      penanda data contoh di luar seed.ts, tes, e2e, src/dev, dan dokumen
//   learner-purity   iframe, skrip luar, next/script, dan URL http(s) di area learner
//   ignore-comment   komentar pengecualian yang menyebut aturan yang tidak ada
//
// Pengecualian satu baris, ditulis tepat di atas baris yang dimaksud (beberapa aturan dipisah koma):
//   // gtx-ignore-next-line hex
//   {/* gtx-ignore-next-line vocabulary, antithesis */}
//   <!-- gtx-ignore-next-line vocabulary -->
// File yang membangun HTML email boleh memakai hex bila berisi komentar `gtx-allow-hex: email`,
// dan nilainya tetap harus warna dari tabel DESIGN.md.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// ---------------------------------------------------------------------------
// Aturan dan cakupan

export const RULES = [
  'dash',
  'vocabulary',
  'antithesis',
  'hex',
  'arbitrary-value',
  'next-public',
  'raw-sql',
  'seed-marker',
  'learner-purity',
  'ignore-comment',
]

const DEV = ['apps/web/src/dev/**', 'apps/web/src/app/(dev)/**']
const TESTS = ['**/test/**', '**/tests/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*']

const SCOPES = {
  dash: {
    include: [
      'apps/*/src/**',
      'apps/web/test/**',
      'packages/*/src/**',
      'packages/*/scripts/**',
      'content/**',
      'docs/**',
      'README*',
      'DESIGN.md',
      'CLAUDE.md',
      'AGENTS.md',
      'e2e/**',
      'deploy/**',
      'scripts/**',
    ],
    // Dokumen standar GTX adalah salinan dokumen luar.
    exclude: ['docs/standards/**'],
  },
  // Teks yang dibaca pengguna di kode: kosakata, antitesis, dan escape tanda pisah.
  uiText: { include: ['apps/web/src/**/*.{ts,tsx}', 'apps/worker/src/**/*.{ts,tsx}'], exclude: DEV },
  // Konten belajar (generator soal dan JSON): antitesis saja. Kata seperti landscape sah di soal Science.
  learningCode: { include: ['packages/content/src/math/**/*.ts'], exclude: [] },
  learningJson: { include: ['content/**/*.json'], exclude: [] },
  prose: { include: ['docs/**/*.md'], exclude: ['docs/standards/**'] },
  hex: { include: ['apps/web/src/**', 'packages/*/src/**'], exclude: DEV },
  arbitrary: { include: ['apps/web/src/**/*.{ts,tsx,css}', 'packages/*/src/**/*.{ts,tsx,css}'], exclude: DEV },
  nextPublic: { include: ['apps/**', 'packages/**', 'deploy/**', 'e2e/**', '.env.example'], exclude: ['**/*.md'] },
  rawSql: {
    include: ['{apps,packages,scripts,e2e,deploy}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    exclude: ['packages/db/scripts/migrate.ts'],
  },
  seed: {
    include: ['{apps,packages,scripts,content,deploy}/**'],
    exclude: ['packages/db/scripts/seed.ts', 'e2e/**', '**/*.md', ...TESTS, ...DEV],
  },
  learner: {
    include: [
      'apps/web/src/app/(learner)/**',
      'apps/web/src/screens/learner/**',
      'apps/web/src/components/{learner,widgets,runtime}/**',
    ],
    exclude: [],
  },
}

// File yang sengaja memuat kata atau pola terlarang (instruksi AI, pemeriksa draf, pemuat konten, pemeriksa ini).
const ALL_BUT_DASH = RULES.filter((r) => r !== 'dash')
const FILE_ALLOW = new Map([
  ['apps/worker/src/handlers/prompts.ts', ['vocabulary', 'antithesis']],
  ['apps/worker/src/handlers/draft-checks.ts', ['vocabulary', 'antithesis']],
  ['packages/content/src/load.ts', ['vocabulary', 'antithesis']],
  ['scripts/check-copy.mjs', ALL_BUT_DASH],
  ['scripts/check-copy.test.mjs', ALL_BUT_DASH],
])

// File token: hex boleh, tetapi hanya warna dari tabel DESIGN.md.
const TOKEN_FILES = ['apps/web/src/app/globals.css', 'apps/web/src/app/tokens.css', 'packages/figures/src/palette.ts']
// themeColor di layout Next boleh, asal sama dengan nilai token.
const LAYOUTS = ['apps/web/src/app/**/layout.tsx']
const EMAIL_MARKER = 'gtx-allow-hex: email'

// Folder dan berkas yang juga diabaikan git (.gitignore), ditambah keluaran build.
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'out',
  'build',
  'coverage',
  'data',
  'backups',
  '.turbo',
  '.gradle',
  '.kira-local',
  '.scripts',
  'test-results',
  'playwright-report',
])
// Proyek native Capacitor (Gradle, Java, aset salinan); tidak ada teks Kira yang ditulis tangan di sana.
const SKIP_PATHS = new Set(['apps/android/android'])
const SKIP_FILE = /(^|\/)(\.env(\..*)?|\.DS_Store|next-env\.d\.ts|pnpm-lock\.yaml)$|\.(log|tsbuildinfo|apk|keystore)$/
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|pdf|zip|gz|tgz|br|woff2?|ttf|otf|eot|mp3|mp4|m4a|wav|ogg|oga|webm|mov|jar|so|dylib|node|wasm)$/i
const MAX_BYTES = 4 * 1024 * 1024

// ---------------------------------------------------------------------------
// Pola

const DASH = /[\u2013\u2014]/g
const DASH_ENTITY = /&(?:mdash|ndash);|&#(?:8211|8212|x201[34]);/gi

const VOCAB_EN = [
  'leverag(?:e|es|ed|ing)',
  'harness(?:es|ed|ing)?',
  'navigat(?:e|es|ed|ing)',
  'embark(?:s|ed|ing)?',
  'foster(?:s|ed|ing)?',
  'unleash(?:es|ed|ing)?',
  'streamlin(?:e|es|ed|ing)',
  'empower(?:s|ed|ing|ment)?',
  'supercharg(?:e|es|ed|ing)',
  'elevat(?:e|es|ed|ing)',
  'unlock(?:s|ed|ing)?',
  'delv(?:e|es|ed|ing)',
  'utili[sz](?:e|es|ed|ing|ation)',
  'seamless(?:ly)?',
  'robust(?:ly|ness)?',
  'comprehensive(?:ly)?',
  'pivotal',
  'crucial(?:ly)?',
  'holistic(?:ally)?',
  'cutting[- ]edge',
  'world[- ]class',
  'enterprise[- ]grade',
  'production[- ]ready',
  'realms?',
  'landscapes?',
  'tapestr(?:y|ies)',
  'testaments?',
]
const VOCAB_ID = [
  'terpercaya',
  'gacor',
  'maxwin',
  'dijamin',
  'tanpa ribet',
  '100% aman',
  'garansi uang kembali',
  'dalam rangka',
  'adapun',
  'sehubungan dengan',
  'guna',
]
// Kata yang menempel pada `:`, `-`, `/`, `@` atau `.` adalah bagian kelas Tailwind (landscape:grid-cols-2),
// nama berkas, atau URL, bukan teks. Label seperti "Unlock: ..." (titik dua lalu spasi) tetap diperiksa.
const VOCAB = new RegExp(`(?<![\\w:/.@-])(?:${[...VOCAB_EN, ...VOCAB_ID].join('|')})(?![\\w@/-]|:\\S)`, 'gi')

// Dari daftar GTX agent-rules yang tidak punya token sendiri di Antithesis.yml.
const ANTITHESIS_EXTRA = ['more than just', 'not merely']

const HEX = /(?<![\w&#/\\-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi
const ARBITRARY_COLOUR =
  /(?<![\w-])(?:[\w-]+:)*!?-?(?:bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|fill|stroke|from|via|to|decoration|accent|caret|placeholder|divide|shadow|inset-shadow|drop-shadow)-\[(?:(?:color|paint):)?(?:#|rgba?\(|hsla?\(|hwb\(|oklch\(|oklab\(|lab\(|lch\(|color-mix\(|color\()[^\]\s]*\]/gi
const ARBITRARY_FONT = /(?<![\w-])(?:[\w-]+:)*!?font-\[[^\]\s]+\]/g
const ARBITRARY_PROPERTY =
  /(?<![\w-])\[(?:font-family:[^\]\s]+|(?:color|background|background-color|border-color|outline-color|fill|stroke):(?:#|rgba?\(|hsla?\(|oklch\(|color-mix\()[^\]\s]*)\]/gi
const NEXT_PUBLIC = /\bNEXT_PUBLIC_[A-Z0-9][A-Z0-9_]*/g
const RAW_SQL = /\bsql\.raw\s*\(|\.unsafe\s*\(|\$queryRawUnsafe\b|\$executeRawUnsafe\b|\bPrisma\.raw\b/g
const SEED = /__GTX_SEED__/g
const URL_IN_CODE = /(?:\bhttps?:)?\/\/[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}(?![\w-])[^\s'"`)]*/gi
const XML_NAMESPACE = /^(?:https?:)?\/\/www\.w3\.org\//i
const IGNORE = /gtx-ignore-next-line[ \t]+([a-z][a-z-]*(?:[ \t]*,[ \t]*[a-z][a-z-]*)*)/g

// ---------------------------------------------------------------------------
// Utilitas

function globToRegExp(glob) {
  let re = ''
  let depth = 0
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:[^/]+/)*'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else if (c === '{') {
      re += '(?:'
      depth++
    } else if (c === '}' && depth > 0) {
      re += ')'
      depth--
    } else if (c === ',' && depth > 0) re += '|'
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

function matcher(globs) {
  const res = globs.map(globToRegExp)
  return (path) => res.some((re) => re.test(path))
}

const SCOPE_TEST = Object.fromEntries(
  Object.entries(SCOPES).map(([name, { include, exclude }]) => {
    const inc = matcher(include)
    const exc = matcher(exclude)
    return [name, (path) => inc(path) && !exc(path)]
  }),
)
const isTokenFile = matcher(TOKEN_FILES)
const isLayout = matcher(LAYOUTS)

function listFiles(root) {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const abs = join(dir, e.name)
      if (e.isDirectory()) {
        const rel = relative(root, abs).split(sep).join('/')
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.pgdata') && !SKIP_PATHS.has(rel)) walk(abs)
      } else if (e.isFile()) {
        const rel = relative(root, abs).split(sep).join('/')
        if (!SKIP_FILE.test(rel) || /(^|\/)\.env\.example$/.test(rel)) out.push(rel)
      }
    }
  }
  walk(root)
  return out.sort()
}

class Source {
  constructor(path, text) {
    this.path = path
    this.text = text
    this.starts = [0]
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) this.starts.push(i + 1)
    // Baris (1-based) yang dikecualikan per aturan, dari komentar gtx-ignore-next-line di baris sebelumnya.
    this.ignored = new Map()
    this.ignoreComments = []
    for (const m of text.matchAll(IGNORE)) {
      const { line } = this.lineCol(m.index)
      const names = m[1].split(',').map((s) => s.trim())
      this.ignoreComments.push({ index: m.index, names })
      const set = this.ignored.get(line + 1) ?? new Set()
      for (const n of names) set.add(n)
      this.ignored.set(line + 1, set)
    }
  }

  lineCol(index) {
    let lo = 0
    let hi = this.starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.starts[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, col: index - this.starts[lo] + 1 }
  }
}

// Teks dengan posisi asal setiap karakter di berkas. Bila teks mentah berbeda dari teks jadinya
// (ada escape), semua karakter menunjuk ke awal literal.
function unit(text, start, exact = true) {
  const pos = new Array(text.length)
  for (let i = 0; i < text.length; i++) pos[i] = exact ? start + i : start
  return { text, pos }
}

// Pengganti ekspresi atau batas elemen, tanpa posisi di berkas.
function placeholder(text) {
  return { text, pos: new Array(text.length).fill(-1) }
}

function concat(parts) {
  let text = ''
  const pos = []
  for (const p of parts) {
    text += p.text
    for (const x of p.pos) pos.push(x)
  }
  return { text, pos }
}

// Spasi dirapatkan dan tanda kutip tipografis disamakan, posisi asal tetap terbawa.
function normalize(u) {
  let text = ''
  const pos = []
  for (let i = 0; i < u.text.length; i++) {
    let c = u.text[i]
    if (c === '\u2019' || c === '\u2018' || c === '\u02bc') c = "'"
    if (/\s/.test(c)) {
      if (text === '' || text.endsWith(' ')) continue
      c = ' '
    }
    text += c
    pos.push(u.pos[i])
  }
  return { text, pos }
}

function originOf(u, index) {
  for (let i = index; i < u.pos.length; i++) if (u.pos[i] >= 0) return u.pos[i]
  for (let i = index - 1; i >= 0; i--) if (u.pos[i] >= 0) return u.pos[i]
  return 0
}

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201c',
  rdquo: '\u201d',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
}

// Entitas HTML di teks JSX dan Markdown dibaca sebagai karakter yang ditampilkan.
function decodeEntities(raw, start) {
  let text = ''
  const pos = []
  for (let i = 0; i < raw.length; ) {
    if (raw[i] === '&') {
      const m = /^&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/i.exec(raw.slice(i, i + 12))
      if (m) {
        let ch
        const e = m[1]
        if (e[0] === '#') {
          const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
          if (code > 0 && code <= 0x10ffff) ch = String.fromCodePoint(code)
        } else ch = ENTITIES[e.toLowerCase()]
        if (ch !== undefined) {
          for (let k = 0; k < ch.length; k++) pos.push(start + i)
          text += ch
          i += m[0].length
          continue
        }
      }
    }
    text += raw[i]
    pos.push(start + i)
    i++
  }
  return { text, pos }
}

// ---------------------------------------------------------------------------
// Pola antitesis dari aturan Vale

export function loadAntithesis(root) {
  const file = join(root, '.vale', 'styles', 'Gatxel', 'Antithesis.yml')
  if (!existsSync(file)) throw new Error(`Aturan antitesis tidak ditemukan: ${relative(root, file)}`)
  const tokens = []
  let inTokens = false
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (/^tokens:\s*$/.test(line)) {
      inTokens = true
      continue
    }
    if (!inTokens) continue
    if (/^\S/.test(line)) break
    const m = /^\s*-\s*"((?:[^"\\]|\\.)*)"\s*$/.exec(line)
    if (m) tokens.push(m[1].replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t' })[c] ?? c))
  }
  if (tokens.length === 0) throw new Error(`Tidak ada token di ${relative(root, file)}`)
  // Sama dengan cara Vale menyusun aturan existence: (?i)\b(?:token|token|...)\b
  return new RegExp(`\\b(?:${[...tokens, ...ANTITHESIS_EXTRA].join('|')})\\b`, 'gi')
}

// ---------------------------------------------------------------------------
// Palet DESIGN.md

export function loadPalette(root) {
  const file = join(root, 'DESIGN.md')
  if (!existsSync(file)) return null
  const lines = readFileSync(file, 'utf8').split('\n')
  const start = lines.findIndex((l) => /^##\s+\d+\.\s+Colou?r\b/i.test(l))
  if (start < 0) return null
  const palette = new Set()
  for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    for (const m of lines[i].matchAll(/#[0-9a-f]{6}\b/gi)) palette.add(m[0].toUpperCase())
  }
  return palette.size > 0 ? palette : null
}

function hexKey(hex) {
  const h = hex.slice(1).toUpperCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
}

// ---------------------------------------------------------------------------
// Ekstraksi teks

const CLASS_FUNCS = new Set(['cx', 'clsx', 'cn', 'classNames', 'twMerge', 'twJoin', 'cva', 'tv'])
const LOG_OBJECTS = new Set(['console', 'log', 'logger'])
const NON_TEXT_TAGS = new Set(['sql', 'css', 'html', 'gql', 'graphql', 'raw'])
// Nilai header HTTP adalah sintaks protokol (Bearer realm="kira"), bukan teks untuk pengguna.
const HEADER_KEY =
  /^(?:www-authenticate|authorization|content-[a-z-]+|cache-control|set-cookie|cookie|retry-after|location|link|vary|accept(?:-[a-z]+)?|access-control-[a-z-]+|strict-transport-security|referrer-policy|permissions-policy|cross-origin-[a-z-]+|x-[a-z0-9-]+)$/i

function looksLikeCode(text) {
  const t = text.trim()
  if (t.length < 3) return true
  // URL, path, atau fragmen
  if (/^(?:[a-z][\w+.-]*:\/\/|mailto:|tel:|data:|blob:|\/|\.\.?\/|#)/i.test(t)) return true
  // Satu token tanpa spasi: kata Kapital dianggap label, sisanya pengenal (kunci, id, enum, kelas, path)
  if (!/\s/.test(t)) return !/^[A-Z][a-z'’]+[.!?]?$/.test(t)
  // Media query dan deklarasi CSS
  if (/^\(?\s*(?:min|max|orientation|prefers|hover|pointer|any-|display-mode)[\w-]*\s*:/.test(t)) return true
  if (/^@media\b|[{}]|^[a-z-]+\s*:\s*[^;]+;\s*[a-z-]+\s*:/.test(t)) return true
  return false
}

function propName(name) {
  if (!name) return ''
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)) return name.text
  return ''
}

/**
 * Teks dari berkas TS/TSX: string literal, bagian template, teks JSX, dan string atribut JSX.
 * Dilewati: import, require, tipe literal, kunci objek, className/class/style, data-*,
 * argumen cx()/clsx(), panggilan log, dan template bertag sql/css/html.
 * `blocks` berisi teks JSX satu pohon yang disambung, untuk pola antitesis yang melintasi elemen.
 */
export function extractTs(path, text) {
  const kind = /\.[jt]sx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind)
  const units = []
  const blocks = []
  const tags = []
  const imports = []

  const stringUnit = (node, start) => {
    const raw = text.slice(start, node.end - 1)
    const inJsxAttr = node.parent && ts.isJsxAttribute(node.parent)
    if (inJsxAttr) return decodeEntities(raw, start)
    return unit(node.text, start, raw === node.text)
  }

  const templateUnit = (node) => {
    const parts = []
    const head = node.head
    parts.push(unit(head.text, head.getStart(sf) + 1, head.rawText === head.text))
    for (const span of node.templateSpans) {
      parts.push(placeholder(' x '))
      const lit = span.literal
      parts.push(unit(lit.text, lit.getStart(sf) + 1, lit.rawText === lit.text))
    }
    return concat(parts)
  }

  const jsxSegments = (node, out) => {
    for (const child of node.children) {
      if (ts.isJsxText(child)) out.push(decodeEntities(child.text, child.pos))
      else if (ts.isJsxExpression(child)) {
        const e = child.expression
        if (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))) {
          const start = e.getStart(sf) + 1
          out.push(unit(e.text, start, text.slice(start, e.end - 1) === e.text))
        } else if (e) out.push(placeholder(' x '))
      } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
        out.push(placeholder(' '))
        jsxSegments(child, out)
        out.push(placeholder(' '))
      } else out.push(placeholder(' '))
    }
    return out
  }

  const visit = (node) => {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ExportDeclaration:
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          imports.push({ name: node.moduleSpecifier.text, index: node.moduleSpecifier.getStart(sf) })
        }
        return
      case ts.SyntaxKind.ImportEqualsDeclaration:
      case ts.SyntaxKind.LiteralType:
        return
      case ts.SyntaxKind.CallExpression: {
        const callee = node.expression
        if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require')) {
          const arg = node.arguments[0]
          if (arg && ts.isStringLiteral(arg)) imports.push({ name: arg.text, index: arg.getStart(sf) })
          return
        }
        if (ts.isIdentifier(callee) && CLASS_FUNCS.has(callee.text)) return
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && LOG_OBJECTS.has(callee.expression.text)) return
        // headers.set('WWW-Authenticate', 'Bearer realm="kira"')
        const first = node.arguments[0]
        if (ts.isPropertyAccessExpression(callee) && first && ts.isStringLiteral(first) && HEADER_KEY.test(first.text)) return
        break
      }
      case ts.SyntaxKind.TaggedTemplateExpression: {
        const tag = node.tag
        const name = ts.isIdentifier(tag) ? tag.text : ts.isPropertyAccessExpression(tag) ? tag.name.text : ''
        if (NON_TEXT_TAGS.has(name)) return
        break
      }
      case ts.SyntaxKind.ElementAccessExpression:
        visit(node.expression)
        return
      case ts.SyntaxKind.PropertyAssignment: {
        const key = propName(node.name)
        if (/class(?:name)?(?:es|s)?$/i.test(key) || key === 'style' || HEADER_KEY.test(key)) return
        if (ts.isComputedPropertyName(node.name)) visit(node.name.expression)
        visit(node.initializer)
        return
      }
      case ts.SyntaxKind.JsxAttribute: {
        const name = node.name.getText(sf)
        if (name === 'className' || name === 'class' || name === 'style' || name.startsWith('data-')) return
        break
      }
      case ts.SyntaxKind.JsxOpeningElement:
      case ts.SyntaxKind.JsxSelfClosingElement: {
        const tag = node.tagName.getText(sf)
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText(sf))
        tags.push({ tag, attrs, index: node.getStart(sf) })
        break
      }
      case ts.SyntaxKind.JsxElement:
      case ts.SyntaxKind.JsxFragment: {
        const parent = node.parent
        if (!parent || !(ts.isJsxElement(parent) || ts.isJsxFragment(parent))) {
          const block = concat(jsxSegments(node, []))
          if (block.text.trim()) blocks.push(block)
        }
        break
      }
      case ts.SyntaxKind.JsxText:
        if (node.text.trim()) units.push({ ...decodeEntities(node.text, node.pos), jsx: true })
        return
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
        const parent = node.parent
        // Kunci objek, nama properti tipe, dan direktif ('use client') bukan teks.
        if (parent && 'name' in parent && parent.name === node) return
        if (parent && ts.isExpressionStatement(parent)) return
        units.push(stringUnit(node, node.getStart(sf) + 1))
        return
      }
      case ts.SyntaxKind.TemplateExpression:
        units.push(templateUnit(node))
        for (const span of node.templateSpans) visit(span.expression)
        return
      default:
        break
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { units, blocks, tags, imports }
}

// Prosa Markdown tanpa blok kode, kode inline, komentar HTML, tag HTML, dan alamat tautan.
export function extractMarkdown(text) {
  const units = []
  let current = null
  let fence = null
  let offset = 0
  const flush = () => {
    if (current && current.text.trim()) units.push(current)
    current = null
  }
  for (const line of text.split('\n')) {
    const lineStart = offset
    offset += line.length + 1
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fenceMatch) {
      flush()
      fence = fenceMatch[1]
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    // Judul, butir daftar, baris tabel, dan kutipan memulai satuan baru.
    if (/^\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>)/.test(line)) flush()
    let masked = ''
    const pos = []
    const re = /(`+)[\s\S]*?\1|<!--[\s\S]*?-->|\]\([^)]*\)|<(?:https?:|mailto:)[^>]*>|<\/?[a-z][^>]*>|https?:\/\/\S+/gi
    let last = 0
    const pushText = (from, to) => {
      const d = decodeEntities(line.slice(from, to), lineStart + from)
      masked += d.text
      pos.push(...d.pos)
    }
    for (const m of line.matchAll(re)) {
      pushText(last, m.index)
      // Kode inline jadi kata pengganti supaya struktur kalimat tetap; sisanya dibuang.
      const keep = placeholder(m[0].startsWith('`') ? ' x ' : m[0].startsWith('](') ? ']' : ' ')
      masked += keep.text
      pos.push(...keep.pos)
      last = m.index + m[0].length
    }
    pushText(last, line.length)
    const piece = { text: `${masked} `, pos: [...pos, -1] }
    current = current ? concat([current, piece]) : piece
  }
  flush()
  return units
}

// String nilai di JSON (bukan kunci), dengan posisi setiap karakter.
export function extractJsonStrings(text) {
  const units = []
  const re = /"(?:[^"\\\n]|\\.)*"/g
  for (const m of text.matchAll(re)) {
    const after = text.slice(m.index + m[0].length).match(/^\s*(.)/)
    if (after && after[1] === ':') continue
    const raw = m[0]
    let s = ''
    const pos = []
    for (let i = 1; i < raw.length - 1; i++) {
      const at = m.index + i
      if (raw[i] === '\\') {
        const n = raw[i + 1]
        if (n === 'u') {
          s += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16))
          i += 5
        } else {
          s += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[n] ?? n
          i += 1
        }
      } else s += raw[i]
      pos.push(at)
    }
    units.push({ text: s, pos })
  }
  return units
}

// ---------------------------------------------------------------------------
// Pemeriksaan

function snippet(s, max = 60) {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 3)}...` : t
}

export function checkRepo(root, { files } = {}) {
  root = resolve(root)
  const started = Date.now()
  const antithesis = loadAntithesis(root)
  const palette = loadPalette(root)
  const findings = []
  const seen = new Set()
  const paths = files ?? listFiles(root)
  let scanned = 0

  for (const path of paths) {
    const scope = Object.fromEntries(Object.entries(SCOPE_TEST).map(([k, test]) => [k, test(path)]))
    if (!Object.values(scope).some(Boolean)) continue
    if (BINARY.test(path)) continue
    const abs = join(root, path)
    let buf
    try {
      buf = readFileSync(abs)
    } catch {
      continue
    }
    if (buf.length > MAX_BYTES || buf.subarray(0, 8000).includes(0)) continue
    const text = buf.toString('utf8')
    scanned++
    const src = new Source(path, text)
    const allowed = new Set(FILE_ALLOW.get(path) ?? [])

    const report = (rule, index, message) => {
      if (allowed.has(rule)) return
      const { line, col } = src.lineCol(index)
      if (src.ignored.get(line)?.has(rule)) return
      const key = `${path}:${line}:${col}:${rule}`
      if (seen.has(key)) return
      seen.add(key)
      findings.push({ file: path, line, col, rule, message })
    }
    const reportIn = (u, index, rule, message) => report(rule, originOf(u, index), message)

    for (const c of src.ignoreComments) {
      for (const name of c.names) {
        if (!RULES.includes(name)) report('ignore-comment', c.index, `Aturan "${name}" tidak dikenal. Pilihan: ${RULES.join(', ')}.`)
      }
    }

    // 1. Tanda pisah di teks mentah
    if (scope.dash) {
      for (const m of text.matchAll(DASH)) {
        const name = m[0] === '\u2014' ? 'Em dash (U+2014)' : 'En dash (U+2013)'
        report('dash', m.index, `${name}. Ganti dengan koma, titik dua, titik, atau kurung.`)
      }
      if (/\.(md|mdx|html?|tsx?|jsx)$/.test(path)) {
        for (const m of text.matchAll(DASH_ENTITY)) report('dash', m.index, `Entitas ${m[0]} tampil sebagai tanda pisah. Ganti dengan koma, titik dua, titik, atau kurung.`)
      }
    }

    // 2 dan 3. Kosakata dan antitesis di teks yang dibaca pengguna
    const textChecks = (u, { vocab, dashCooked }) => {
      const n = normalize(u)
      if (vocab) {
        for (const m of n.text.matchAll(VOCAB)) reportIn(n, m.index, 'vocabulary', `Kata terlarang GTX "${m[0]}". Tulis fakta atau kata kerja yang konkret.`)
      }
      for (const m of n.text.matchAll(antithesis)) {
        reportIn(n, m.index, 'antithesis', `Bingkai antitesis (GTX C-03a): "${snippet(m[0])}". Hapus bagian yang disangkal, tulis klaimnya langsung.`)
      }
      if (dashCooked) {
        for (const m of n.text.matchAll(DASH)) reportIn(n, m.index, 'dash', 'Escape atau entitas tanda pisah di teks yang dibaca pengguna. Ganti dengan koma, titik dua, titik, atau kurung.')
      }
    }

    const isTs = /\.(ts|tsx|mts|cts)$/.test(path)
    let parsed = null
    const parse = () => (parsed ??= extractTs(path, text))

    if ((scope.uiText || scope.learningCode) && isTs) {
      const { units, blocks } = parse()
      for (const u of units) {
        if (!u.jsx && looksLikeCode(u.text)) continue
        textChecks(u, { vocab: scope.uiText, dashCooked: true })
      }
      for (const b of blocks) {
        const n = normalize(b)
        for (const m of n.text.matchAll(antithesis)) {
          reportIn(n, m.index, 'antithesis', `Bingkai antitesis (GTX C-03a): "${snippet(m[0])}". Hapus bagian yang disangkal, tulis klaimnya langsung.`)
        }
      }
    }
    if (scope.prose && path.endsWith('.md')) {
      for (const u of extractMarkdown(text)) textChecks(u, { vocab: true, dashCooked: false })
    }
    if (scope.learningJson && path.endsWith('.json')) {
      for (const u of extractJsonStrings(text)) textChecks(u, { vocab: false, dashCooked: false })
    }

    // 4. Warna hex dan nilai arbitrer Tailwind
    if (scope.hex) {
      const tokenOnly = isTokenFile(path) || isLayout(path) || text.includes(EMAIL_MARKER)
      for (const m of text.matchAll(HEX)) {
        if (tokenOnly) {
          if (palette && !palette.has(hexKey(m[0]))) report('hex', m.index, `Warna ${m[0]} tidak ada di tabel warna DESIGN.md. Pakai nilai token yang sama persis.`)
          continue
        }
        report('hex', m.index, `Warna hex ${m[0]} di luar file token. Pakai kelas token DESIGN.md (bg-surface, text-fg-muted) atau konstanta @kira/figures/palette.`)
      }
    }
    if (scope.arbitrary) {
      for (const re of [ARBITRARY_COLOUR, ARBITRARY_FONT, ARBITRARY_PROPERTY]) {
        for (const m of text.matchAll(re)) report('arbitrary-value', m.index, `Nilai arbitrer Tailwind untuk warna atau font: ${m[0]}. Pakai kelas token DESIGN.md.`)
      }
    }

    // 5. Rahasia dan SQL mentah
    if (scope.nextPublic) {
      for (const m of text.matchAll(NEXT_PUBLIC)) report('next-public', m.index, `${m[0]} ditanam ke bundle browser saat build. Baca konfigurasi di server, tanpa awalan NEXT_PUBLIC_.`)
    }
    if (scope.rawSql) {
      for (const m of text.matchAll(RAW_SQL)) report('raw-sql', m.index, `${m[0].replace(/\s*\($/, '(')}: SQL mentah tanpa parameter. Pakai template sql\`...\`; hanya packages/db/scripts/migrate.ts yang boleh.`)
    }

    // 6. Penanda data contoh
    if (scope.seed) {
      for (const m of text.matchAll(SEED)) report('seed-marker', m.index, 'Penanda data contoh di luar seed.ts, tes, e2e, dan src/dev. Data contoh tidak boleh ikut ke produksi.')
    }

    // 7. Area learner tanpa iframe, skrip luar, atau tautan keluar
    if (scope.learner) {
      if (/\.[jt]sx?$/.test(path)) {
        const { units, tags, imports } = parse()
        for (const t of tags) {
          const tag = t.tag.toLowerCase()
          if (tag === 'iframe') report('learner-purity', t.index, 'Area learner tidak boleh memuat <iframe> (CLAUDE.md aturan 5).')
          if (tag === 'script' && t.attrs.includes('src')) report('learner-purity', t.index, 'Area learner tidak boleh memuat skrip dari src (CLAUDE.md aturan 5).')
        }
        for (const i of imports) {
          if (i.name === 'next/script') report('learner-purity', i.index, 'next/script tidak dipakai di area learner (CLAUDE.md aturan 5).')
        }
        for (const u of units) {
          for (const m of u.text.matchAll(URL_IN_CODE)) {
            if (XML_NAMESPACE.test(m[0])) continue
            reportIn(u, m.index, 'learner-purity', `URL keluar ${snippet(m[0], 50)} di area learner (CLAUDE.md aturan 5). Semua aset dan tautan dari origin sendiri.`)
          }
          for (const m of u.text.matchAll(/<\s*(iframe|script\b[^>]*\bsrc\s*=)/gi)) {
            reportIn(u, m.index, 'learner-purity', `HTML ${snippet(m[0], 30)} di area learner (CLAUDE.md aturan 5).`)
          }
        }
      } else {
        for (const m of text.matchAll(URL_IN_CODE)) {
          if (!XML_NAMESPACE.test(m[0])) report('learner-purity', m.index, `URL keluar ${snippet(m[0], 50)} di area learner (CLAUDE.md aturan 5).`)
        }
        for (const m of text.matchAll(/<\s*(?:iframe|script\b[^>]*\bsrc\s*=)/gi)) report('learner-purity', m.index, 'Area learner tidak boleh memuat iframe atau skrip dari src (CLAUDE.md aturan 5).')
      }
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.rule.localeCompare(b.rule))
  return { findings, scanned, ms: Date.now() - started }
}

export function formatFinding(f) {
  return `${f.file}:${f.line}:${f.col} ${f.rule} ${f.message}`
}

function main(argv) {
  const i = argv.indexOf('--root')
  const root = i >= 0 ? argv[i + 1] : join(dirname(fileURLToPath(import.meta.url)), '..')
  if (!root) {
    console.error('Pemakaian: node scripts/check-copy.mjs [--root <folder>]')
    return 2
  }
  let result
  try {
    result = checkRepo(root)
  } catch (e) {
    console.error(`check-copy gagal: ${e instanceof Error ? e.message : String(e)}`)
    return 2
  }
  const { findings, scanned, ms } = result
  for (const f of findings) console.log(formatFinding(f))
  // Di GitHub Actions setiap temuan juga jadi anotasi di diff PR.
  if (process.env.GITHUB_ACTIONS === 'true') {
    const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
    for (const f of findings) console.log(`::error file=${esc(f.file).replace(/,/g, '%2C')},line=${f.line},col=${f.col},title=${f.rule}::${esc(f.message)}`)
  }
  if (findings.length > 0) {
    const files = new Set(findings.map((f) => f.file)).size
    console.error(`\ncheck-copy: ${findings.length} temuan di ${files} berkas (${scanned} berkas diperiksa, ${ms} ms).`)
    console.error('Perbaiki teksnya. Pengecualian yang disengaja: // gtx-ignore-next-line <aturan> di baris sebelumnya.')
    return 1
  }
  console.log(`check-copy: bersih (${scanned} berkas diperiksa, ${ms} ms).`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2))
}
