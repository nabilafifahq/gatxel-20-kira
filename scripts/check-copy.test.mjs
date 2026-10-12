// Tes untuk scripts/check-copy.mjs. Jalankan: node --test scripts/check-copy.test.mjs
// Setiap tes menulis berkas contoh ke folder sementara lalu menjalankan pemeriksa di sana.
// Tanda pisah ditulis sebagai escape (\u2014, \u2013) supaya berkas ini sendiri lolos aturan dash.
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkRepo } from './check-copy.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECKER = join(REPO, 'scripts', 'check-copy.mjs')
const EM = '\u2014'
const EN = '\u2013'

const DESIGN = [
  '# DESIGN.md',
  '',
  '## 4. Color',
  '',
  '| Token | Value | Used for |',
  '|---|---|---|',
  '| `--bg` | #F5F8FC | Kanvas |',
  '| `--surface` | #FFFFFF | Kartu |',
  '| `--fg` | #14202E | Teks |',
  '',
  '## 5. Shape and space',
  '',
  '| `--danger-50` | #ABCDEF | bukan bagian tabel warna |',
  '',
].join('\n')

function makeRoot(files, { vale = true, design = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kira-check-copy-'))
  if (vale) {
    mkdirSync(join(root, '.vale/styles/Gatxel'), { recursive: true })
    copyFileSync(join(REPO, '.vale/styles/Gatxel/Antithesis.yml'), join(root, '.vale/styles/Gatxel/Antithesis.yml'))
  }
  if (design) writeFileSync(join(root, 'DESIGN.md'), DESIGN)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

function check(files, opts) {
  const root = makeRoot(files, opts)
  try {
    return checkRepo(root).findings
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/** Temuan untuk satu berkas sebagai daftar `aturan@baris`. */
function hits(findings, file) {
  return findings.filter((f) => f.file === file).map((f) => `${f.rule}@${f.line}`)
}

describe('dash', () => {
  it('menandai em dash dan en dash di kode, dokumen, dan konten', () => {
    const f = check({
      'apps/web/src/screens/A.tsx': `export const A = () => (\n  <p>Ready ${EM} go</p>\n)\n`,
      'docs/guide.md': `# Panduan\n\nSatu ${EN} dua.\n`,
      'content/items/math/g1/x.json': `{\n  "prompt": "Count ${EM} then add"\n}\n`,
      'scripts/tool.mjs': `// catatan ${EM} di skrip\n`,
      'DESIGN.md': `${DESIGN}\nCatatan ${EM} akhir.\n`,
    })
    assert.deepEqual(hits(f, 'apps/web/src/screens/A.tsx'), ['dash@2'])
    assert.deepEqual(hits(f, 'docs/guide.md'), ['dash@3'])
    assert.deepEqual(hits(f, 'content/items/math/g1/x.json'), ['dash@2'])
    assert.deepEqual(hits(f, 'scripts/tool.mjs'), ['dash@1'])
    assert.deepEqual(hits(f, 'DESIGN.md'), ['dash@15'])
  })

  it('menandai escape dan entitas HTML yang tampil sebagai tanda pisah di teks UI', () => {
    const f = check({
      'apps/web/src/screens/B.tsx': 'export const s = "Ready \\u2014 go"\nexport const B = () => <p>Ready &mdash; go</p>\n',
      'apps/web/src/server/mail.ts': "export const html = '<p>Laporan &mdash; minggu ini</p>'\n",
      'packages/content/src/math/g9.ts': "export const p = 'Count \\u2013 then add'\n",
    })
    assert.deepEqual(hits(f, 'apps/web/src/screens/B.tsx'), ['dash@1', 'dash@2'])
    assert.deepEqual(hits(f, 'apps/web/src/server/mail.ts'), ['dash@1'])
    assert.deepEqual(hits(f, 'packages/content/src/math/g9.ts'), ['dash@1'])
  })

  it('tidak menandai dokumen standar, escape di regex, atau kode di luar cakupan', () => {
    const f = check({
      'docs/standards/gtx/x.md': `Salinan dokumen luar ${EM} dibiarkan.\n`,
      'apps/worker/src/check.ts': 'export const BANNED = /[\\u2014\\u2013]/\n',
      'apps/web/src/screens/C.tsx': 'export const C = () => <p>Ready, go (now).</p>\n',
      '.github/workflows/x.yml': `name: ci ${EM} x\n`,
    })
    assert.deepEqual(f, [])
  })
})

describe('vocabulary', () => {
  it('menandai kosakata terlarang di teks JSX, string, dan prosa docs', () => {
    const f = check({
      'apps/web/src/screens/V.tsx': [
        'export const V = () => (',
        '  <div title="A seamless start">',
        '    <p>Unlock your next level</p>',
        '  </div>',
        ')',
        "export const label = 'Hasil dijamin naik setiap minggu'",
        "export const note = 'Data disimpan guna menjaga akun'",
        "export const tag = 'Unlock: tap the card'",
      ].join('\n'),
      'apps/worker/src/handlers/mail.ts': "export const subject = 'A comprehensive weekly report'\n",
      'docs/notes.md': '# Catatan\n\nWe leverage the cache for speed.\n',
    })
    assert.deepEqual(hits(f, 'apps/web/src/screens/V.tsx'), ['vocabulary@2', 'vocabulary@3', 'vocabulary@6', 'vocabulary@7', 'vocabulary@8'])
    assert.deepEqual(hits(f, 'apps/worker/src/handlers/mail.ts'), ['vocabulary@1'])
    assert.deepEqual(hits(f, 'docs/notes.md'), ['vocabulary@3'])
  })

  it('tidak menandai kelas, pengenal, path, log, kode Markdown, kata turunan, dan konten belajar', () => {
    const f = check({
      'apps/web/src/screens/W.tsx': [
        "import { unlock } from './unlock'",
        "const q = window.matchMedia('(orientation: landscape)')",
        "const kind = 'unlock'",
        "const cls = cx('landscape:grid-cols-2', 'p-4')",
        "log.info('navigate to the robust page')",
        "const event = 'learner.unlock'",
        "const headers = { 'WWW-Authenticate': 'Bearer realm=\"kira\"' }",
        "res.headers.set('www-authenticate', 'Basic realm=\"konsol\"')",
        'export const W = () => (',
        '  <div className="landscape:flex portrait:block">',
        '    <p>Pengguna berguna, kegunaan, menggunakan.</p>',
        '  </div>',
        ')',
        'void q; void kind; void cls; void event; void unlock; void headers',
      ].join('\n'),
      'apps/web/src/dev/fixtures/x.ts': "export const s = 'A seamless fixture'\n",
      'docs/style.md': '# Gaya\n\nHindari kata `leverage` dan `robust`.\n\n```\nleverage robust\n```\n',
      'content/items/science/g3/x.json': '{\n  "prompt": "Draw a landscape with a river."\n}\n',
      'apps/worker/src/handlers/prompts.ts': "export const RULE = 'Never use these words: leverage, seamless, robust.'\n",
    })
    assert.deepEqual(f, [])
  })
})

describe('antithesis', () => {
  it('menandai bingkai antitesis bahasa Inggris dan Indonesia', () => {
    const f = check({
      'apps/web/src/screens/T.tsx': [
        'export const T = () => (',
        '  <div>',
        "    <p>It's not just a quiz, it's a habit.</p>",
        "    <p>This isn’t a test. It’s a quiz.</p>",
        '    <p>Ini bukan sekadar latihan, tapi kebiasaan.</p>',
        '  </div>',
        ')',
        "export const pitch = 'Kira is more than just a game'",
      ].join('\n'),
      'content/items/science/g2/x.json': '{\n  "explanation": "It is not a toy. It is a tool."\n}\n',
      'docs/why.md': '# Kenapa\n\nThe real question isn\'t speed, it\'s care.\n',
    })
    assert.deepEqual(hits(f, 'apps/web/src/screens/T.tsx'), ['antithesis@3', 'antithesis@4', 'antithesis@5', 'antithesis@8'])
    assert.deepEqual(hits(f, 'content/items/science/g2/x.json'), ['antithesis@2'])
    assert.deepEqual(hits(f, 'docs/why.md'), ['antithesis@3'])
  })

  it('melaporkan baris dan kolom yang tepat di template dan JSX berekspresi', () => {
    const src = [
      'export const a = 1',
      'export const T = (name: string) =>',
      "  `${name} is not just a learner, it's a habit`",
      'export const P = ({ n }: { n: number }) => (',
      '  <p>',
      "    {n} isn't just a number, it's a streak.",
      '  </p>',
      ')',
    ].join('\n')
    const f = check({ 'apps/web/src/screens/P.tsx': src })
    const lines = src.split('\n')
    assert.deepEqual(
      f.map((x) => [x.rule, x.line, lines[x.line - 1].slice(x.col - 1, x.col + 5)]),
      [
        ['antithesis', 3, 'is not'],
        ['antithesis', 6, "isn't "],
      ],
    )
  })

  it('menangkap bingkai yang terpecah di beberapa elemen JSX', () => {
    const f = check({
      'apps/web/src/screens/J.tsx': [
        'export const J = () => (',
        '  <p>',
        "    This isn't a test. <strong>It's a quiz.</strong>",
        '  </p>',
        ')',
      ].join('\n'),
    })
    assert.deepEqual(hits(f, 'apps/web/src/screens/J.tsx'), ['antithesis@3'])
  })

  it('tidak menandai kalimat matematika dan sains biasa', () => {
    const f = check({
      'content/items/math/g1/y.json': '{\n  "explanation": "Each jump is 1 more than the one before."\n}\n',
      'content/items/science/g4/y.json':
        '{\n  "explanation": "Graphite conducts electricity, even though it is not a metal. Graphite is a weak conductor."\n}\n',
      'packages/content/src/math/g9.ts': 'export const p = (n: number) => `The bigger number is ${n} more than the smaller one.`\n',
      'apps/web/src/screens/K.tsx': 'export const K = () => <p>Not yet. Try the next one.</p>\n',
    })
    assert.deepEqual(f, [])
  })
})

describe('hex', () => {
  it('menandai hex di luar file token', () => {
    const f = check({
      'apps/web/src/components/X.tsx': 'export const X = () => <svg><path fill="#1F6FB2" /></svg>\n',
      'packages/figures/src/render/y.tsx': "export const C = '#123456'\n",
      'apps/web/src/components/z.css': '.z {\n  color: #fff;\n}\n',
    })
    assert.deepEqual(hits(f, 'apps/web/src/components/X.tsx'), ['hex@1'])
    assert.deepEqual(hits(f, 'packages/figures/src/render/y.tsx'), ['hex@1'])
    assert.deepEqual(hits(f, 'apps/web/src/components/z.css'), ['hex@2'])
  })

  it('file token, layout, dan email bertanda hanya boleh memakai warna DESIGN.md', () => {
    const f = check({
      'apps/web/src/app/globals.css': '@theme {\n  --color-bg: #f5f8fc;\n  --color-white: #fff;\n  --color-x: #123456;\n}\n',
      'packages/figures/src/palette.ts': "export const INK = '#14202E'\nexport const ODD = '#ABCDEF'\n",
      'apps/web/src/app/(learner)/layout.tsx': "export const viewport = { themeColor: '#f5f8fc' }\n",
      'apps/web/src/app/(public)/layout.tsx': "export const viewport = { themeColor: '#000000' }\n",
      'apps/web/src/server/mail.ts': "// gtx-allow-hex: email\nexport const a = 'color:#14202E'\nexport const b = 'color:#00FF00'\n",
    })
    assert.deepEqual(hits(f, 'apps/web/src/app/globals.css'), ['hex@4'])
    // #ABCDEF ada di DESIGN.md, tetapi di luar bagian Color.
    assert.deepEqual(hits(f, 'packages/figures/src/palette.ts'), ['hex@2'])
    assert.deepEqual(hits(f, 'apps/web/src/app/(learner)/layout.tsx'), [])
    assert.deepEqual(hits(f, 'apps/web/src/app/(public)/layout.tsx'), ['hex@1'])
    assert.deepEqual(hits(f, 'apps/web/src/server/mail.ts'), ['hex@3'])
  })

  it('tidak menandai fragmen, entitas, path, src/dev, dan baris yang dikecualikan', () => {
    const f = check({
      'apps/web/src/components/Y.tsx': [
        'export const Y = () => (',
        '  <nav>',
        '    <a href="#isi">Isi</a>',
        '    <a href="/konsol#bab">Bab</a>',
        '    <span>A&#160;B</span>',
        '    <a href="#add-item">Tambah</a>',
        '    {/* gtx-ignore-next-line hex */}',
        '    <svg><path fill="#14202E" /></svg>',
        '  </nav>',
        ')',
      ].join('\n'),
      'apps/web/src/dev/fixtures/c.ts': "export const C = '#123456'\n",
    })
    assert.deepEqual(f, [])
  })
})

describe('arbitrary-value', () => {
  it('menandai warna dan font arbitrer Tailwind', () => {
    const f = check({
      'apps/web/src/components/A.tsx': [
        'export const A = () => (',
        '  <div className="bg-[#fff] p-4">',
        '    <p className="hover:text-[rgb(0,0,0)] font-[Inter]">a</p>',
        '    <p className="[color:#123456]">b</p>',
        '  </div>',
        ')',
      ].join('\n'),
    })
    assert.deepEqual(hits(f, 'apps/web/src/components/A.tsx'), ['arbitrary-value@2', 'hex@2', 'arbitrary-value@3', 'arbitrary-value@3', 'arbitrary-value@4', 'hex@4'])
  })

  it('membiarkan nilai arbitrer untuk ukuran tata letak', () => {
    const f = check({
      'apps/web/src/components/B.tsx': 'export const B = () => <div className="w-[320px] border-[1.5px] leading-[30px] bg-surface text-fg-muted" />\n',
    })
    assert.deepEqual(f, [])
  })
})

describe('next-public dan raw-sql', () => {
  it('menandai variabel NEXT_PUBLIC_ dan SQL mentah', () => {
    const f = check({
      'apps/web/src/server/env.ts': 'export const url = process.env.NEXT_PUBLIC_API_URL\n',
      'deploy/compose.yml': 'services:\n  web:\n    environment:\n      NEXT_PUBLIC_SENTRY_DSN: x\n',
      'apps/web/src/server/dal/q.ts': [
        "import { sql } from 'drizzle-orm'",
        'export const a = (name: string) => sql.raw(name)',
        'export const b = (db: { unsafe(q: string): void }, q: string) => db.unsafe(q)',
        'export const c = (p: Client, q: string) => p.$queryRawUnsafe(q)',
      ].join('\n'),
    })
    assert.deepEqual(hits(f, 'apps/web/src/server/env.ts'), ['next-public@1'])
    assert.deepEqual(hits(f, 'deploy/compose.yml'), ['next-public@4'])
    assert.deepEqual(hits(f, 'apps/web/src/server/dal/q.ts'), ['raw-sql@2', 'raw-sql@3', 'raw-sql@4'])
  })

  it('membiarkan penyebutan awalan, dokumen, migrator, dan template sql', () => {
    const f = check({
      'apps/web/src/server/env2.ts': '// Tidak ada rahasia dengan awalan NEXT_PUBLIC_.\nexport const x = 1\n',
      'docs/env.md': '# Env\n\nJangan pakai NEXT_PUBLIC_SECRET.\n',
      'packages/db/scripts/migrate.ts': 'export const run = (tx: { unsafe(s: string): void }, st: string) => tx.unsafe(st)\n',
      'apps/web/src/server/dal/ok.ts': "import { sql } from 'drizzle-orm'\nexport const q = (id: string) => sql`select ${id}`\n",
    })
    assert.deepEqual(f, [])
  })
})

describe('seed-marker', () => {
  it('menandai penanda data contoh di kode produksi dan konten', () => {
    const f = check({
      'apps/web/src/server/x.ts': "export const ORG = 'Org __GTX_SEED__'\n",
      'content/items/math/g1/z.json': '{\n  "prompt": "__GTX_SEED__"\n}\n',
    })
    assert.deepEqual(hits(f, 'apps/web/src/server/x.ts'), ['seed-marker@1'])
    assert.deepEqual(hits(f, 'content/items/math/g1/z.json'), ['seed-marker@2'])
  })

  it('membiarkan seed.ts, tes, e2e, src/dev, galeri (dev), dan dokumen', () => {
    const f = check({
      'packages/db/scripts/seed.ts': "export const ORG = 'Keluarga __GTX_SEED__'\n",
      'packages/db/test/rls.test.ts': "export const ORG = 'Org __GTX_SEED__'\n",
      'apps/web/src/dev/fixtures/l.ts': '// __GTX_SEED__\nexport const x = 1\n',
      'apps/web/src/app/(dev)/dev/page.tsx': '// __GTX_SEED__ galeri\nexport default function P() { return null }\n',
      'e2e/login.spec.ts': "export const ORG = '__GTX_SEED__'\n",
      'docs/seed.md': '# Seed\n\nPenanda `__GTX_SEED__`.\n',
    })
    assert.deepEqual(f, [])
  })
})

describe('learner-purity', () => {
  it('menandai iframe, skrip luar, next/script, dan URL keluar di area learner', () => {
    const f = check({
      'apps/web/src/app/(learner)/(in)/x/page.tsx': [
        'export default function P() {',
        '  return (',
        '    <div>',
        '      <iframe src="/embed" title="x" />',
        '      <script src="/s.js" />',
        '    </div>',
        '  )',
        '}',
      ].join('\n'),
      'apps/web/src/screens/learner/S.tsx': "import Script from 'next/script'\nexport const S = Script\n",
      'apps/web/src/components/learner/L.tsx': "export const HELP = 'https://example.com/help'\n",
      'apps/web/src/components/runtime/R.tsx': 'export const R = () => <img src="//cdn.example.com/a.png" alt="" />\n',
      'apps/web/src/components/widgets/w.css': '@import url(https://fonts.googleapis.com/css2?family=Inter);\n',
    })
    assert.deepEqual(hits(f, 'apps/web/src/app/(learner)/(in)/x/page.tsx'), ['learner-purity@4', 'learner-purity@5'])
    assert.deepEqual(hits(f, 'apps/web/src/screens/learner/S.tsx'), ['learner-purity@1'])
    assert.deepEqual(hits(f, 'apps/web/src/components/learner/L.tsx'), ['learner-purity@1'])
    assert.deepEqual(hits(f, 'apps/web/src/components/runtime/R.tsx'), ['learner-purity@1'])
    assert.deepEqual(hits(f, 'apps/web/src/components/widgets/w.css'), ['learner-purity@1'])
  })

  it('membiarkan namespace SVG, komentar, dan area selain learner', () => {
    const f = check({
      'apps/web/src/components/learner/Icon.tsx': [
        '// Bentuk ikon dari https://example.com/catatan-desain',
        'export const Icon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" />',
      ].join('\n'),
      'apps/web/src/screens/console/C.tsx': 'export const C = () => <iframe src="https://example.com" title="x" />\n',
    })
    assert.deepEqual(f, [])
  })
})

describe('pengecualian', () => {
  it('gtx-ignore-next-line hanya berlaku untuk baris berikutnya dan aturan yang disebut', () => {
    const f = check({
      'apps/web/src/screens/I.tsx': [
        '// gtx-ignore-next-line vocabulary',
        "export const a = 'A seamless start'",
        "export const b = 'A seamless finish'",
        '// gtx-ignore-next-line antithesis',
        "export const c = 'A seamless start'",
        'export const I = () => (',
        '  <div>',
        '    {/* gtx-ignore-next-line vocabulary, antithesis */}',
        "    <p>It's not just a seamless quiz, it's a habit.</p>",
        '  </div>',
        ')',
      ].join('\n'),
      'docs/i.md': '# I\n\n<!-- gtx-ignore-next-line vocabulary -->\nWe leverage the cache.\n',
    })
    assert.deepEqual(hits(f, 'apps/web/src/screens/I.tsx'), ['vocabulary@3', 'vocabulary@5'])
    assert.deepEqual(hits(f, 'docs/i.md'), [])
  })

  it('nama aturan yang salah ketik dilaporkan dan tidak mengecualikan apa pun', () => {
    const f = check({
      'apps/web/src/components/H.tsx': "// gtx-ignore-next-line hexx\nexport const C = '#123456'\n",
    })
    assert.deepEqual(hits(f, 'apps/web/src/components/H.tsx'), ['ignore-comment@1', 'hex@2'])
  })
})

describe('CLI', () => {
  // Tanpa GITHUB_ACTIONS supaya temuan contoh tidak jadi anotasi di run CI.
  const run = (root) => spawnSync(process.execPath, [CHECKER, '--root', root], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } })

  it('mencetak berkas:baris:kolom aturan pesan dan keluar dengan kode 1', () => {
    const root = makeRoot({ 'apps/web/src/screens/A.tsx': `export const A = () => <p>Ready ${EM} go</p>\n` })
    try {
      const r = run(root)
      assert.equal(r.status, 1)
      assert.match(r.stdout, /^apps\/web\/src\/screens\/A\.tsx:1:\d+ dash /m)
      assert.match(r.stderr, /1 temuan di 1 berkas/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keluar dengan kode 0 bila bersih', () => {
    const root = makeRoot({ 'apps/web/src/screens/A.tsx': 'export const A = () => <p>Ready, go.</p>\n' })
    try {
      const r = run(root)
      assert.equal(r.status, 0, r.stdout + r.stderr)
      assert.match(r.stdout, /check-copy: bersih/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keluar dengan kode 2 bila aturan antitesis Vale tidak ada', () => {
    const root = makeRoot({ 'apps/web/src/screens/A.tsx': 'export const A = 1\n' }, { vale: false })
    try {
      const r = run(root)
      assert.equal(r.status, 2)
      assert.match(r.stderr, /Antithesis\.yml/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
