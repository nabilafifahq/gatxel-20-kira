// Pengukuran luapan tata letak yang berjalan di dalam halaman. Dipakai oleh sweep-lessons.mjs dan sweep-screens.mjs.
/* global document, window, NodeFilter, getComputedStyle */

/** Fungsi ini diserialkan ke browser, jadi tidak boleh memakai variabel dari luar. */
export function measureInPage(rootSelector) {
  const TOL = 2
  const root = (rootSelector && document.querySelector(rootSelector)) || document.body
  const vw = document.documentElement.clientWidth
  const out = []
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION', 'DATALIST', 'BR', 'LINK', 'META'])
  const NO_SCROLL = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'IFRAME'])
  const sig = (el) => {
    const mark = [...el.attributes].find((a) => a.name.startsWith('data-') && !a.name.startsWith('data-jenjang') && !a.name.startsWith('data-state') && !a.name.startsWith('data-next'))
    if (mark) return `${el.tagName.toLowerCase()}[${mark.name}]`
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 7).join('.') : ''
    return `${el.tagName.toLowerCase()}.${cls}`
  }
  const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)
  const hiddenStyle = (cs) => cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse'
  const isSrOnly = (cs, r) => (cs.position === 'absolute' && r.width <= 2 && r.height <= 2) || cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)'
  const isDecor = (el) => !!el.closest('[aria-hidden="true"]')
  const scrollable = (v) => v === 'auto' || v === 'scroll'
  const add = (kind, el, detail) => out.push({ kind, sig: sig(el), text: text(el), detail })

  const all = [...root.querySelectorAll('*')].filter((el) => !SKIP.has(el.tagName) && !(el instanceof window.SVGElement && el.tagName.toLowerCase() !== 'svg'))
  const info = new Map()
  for (const el of all) {
    const cs = getComputedStyle(el)
    if (hiddenStyle(cs)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1 || isSrOnly(cs, r)) continue
    info.set(el, { cs, r })
  }

  // Nenek moyang terdekat yang boleh menggulung sendiri: isi di dalamnya dibandingkan dengan kotak itu.
  const scrollerOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (scrollable(getComputedStyle(p).overflowX)) return p
    }
    return null
  }
  const cardOf = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const c = getComputedStyle(p)
      if (c.borderTopLeftRadius !== '0px' && (c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.borderTopWidth !== '0px' || c.boxShadow !== 'none')) return p
    }
    return null
  }

  const overflowed = { x: [], y: [] }
  for (const [el, { cs, r }] of info) {
    if (el instanceof window.SVGElement) {
      for (const t of el.querySelectorAll('text')) {
        const b = t.getBoundingClientRect()
        if (b.width < 1 || !(t.textContent || '').trim()) continue
        if (b.left < r.left - TOL || b.right > r.right + TOL || b.top < r.top - TOL || b.bottom > r.bottom + TOL) {
          add('svg-text-out', el, `"${t.textContent.trim().slice(0, 30)}" ${Math.round(Math.max(r.left - b.left, b.right - r.right, r.top - b.top, b.bottom - r.bottom))}px`)
        }
      }
    } else if (!NO_SCROLL.has(el.tagName) && el.clientWidth > 0 && cs.display !== 'inline') {
      if (el.scrollWidth > el.clientWidth + TOL) overflowed.x.push(el)
      if (el.scrollHeight > el.clientHeight + TOL) overflowed.y.push(el)
    }
    if (isDecor(el)) continue
    // Keluar dari layar: abaikan bila ada wadah gulir di atasnya, wadah itu yang diperiksa.
    const scr = scrollerOf(el)
    if (!scr && (r.right > vw + TOL || r.left < -TOL)) add('out-of-viewport', el, `left ${Math.round(r.left)} right ${Math.round(r.right)} vw ${vw}`)
    // Keluar dari kartu induk.
    const card = cardOf(el)
    const cr = card && info.get(card)?.r
    if (cr && (r.left < cr.left - TOL || r.right > cr.right + TOL || r.top < cr.top - TOL || r.bottom > cr.bottom + TOL) && (!scr || !card.contains(scr))) {
      add('out-of-card', el, `by ${Math.round(Math.max(cr.left - r.left, r.right - cr.right, cr.top - r.top, r.bottom - cr.bottom))}px in ${sig(card)}`)
    }
  }
  for (const axis of ['x', 'y']) {
    const list = overflowed[axis]
    for (const el of list) {
      const { cs } = info.get(el)
      const ov = axis === 'x' ? cs.overflowX : cs.overflowY
      // Induk overflow visible yang hanya menampung luapan anaknya tidak dihitung dua kali.
      if (ov === 'visible' && list.some((o) => o !== el && el.contains(o))) continue
      const by = axis === 'x' ? `${el.scrollWidth}>${el.clientWidth}` : `${el.scrollHeight}>${el.clientHeight}`
      add(scrollable(ov) ? `scrollable-${axis}` : ov === 'visible' ? `overflow-${axis}` : `clipped-${axis}`, el, by)
    }
  }

  // Teks: kotak huruf sebenarnya dibanding wadah dan layar.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue
    const p = n.parentElement
    if (!p || SKIP.has(p.tagName) || p instanceof window.SVGElement || p.closest('[aria-hidden="true"]')) continue
    let host = p
    while (host && !info.has(host)) host = host.parentElement
    if (!host || (!info.has(p) && !['inline', 'contents'].includes(getComputedStyle(p).display))) continue
    range.selectNodeContents(n)
    const b = range.getBoundingClientRect()
    if (b.width < 1 || b.height < 1) continue
    let block = host
    while (block.parentElement && info.has(block.parentElement) && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement
    const br = info.get(block)?.r
    if (br && (b.left < br.left - TOL || b.right > br.right + TOL || b.top < br.top - TOL - 2 || b.bottom > br.bottom + TOL + 2)) {
      add('text-out', block, `"${n.nodeValue.trim().slice(0, 30)}" by ${Math.round(Math.max(br.left - b.left, b.right - br.right, br.top - b.top, b.bottom - br.bottom))}px`)
    }
    if (!scrollerOf(p) && (b.right > vw + TOL || b.left < -TOL)) add('text-off-screen', block, `"${n.nodeValue.trim().slice(0, 30)}" right ${Math.round(b.right)} vw ${vw}`)
  }

  // Tumpang tindih antar saudara kandung.
  const parents = new Set()
  for (const el of info.keys()) if (el.parentElement && info.has(el.parentElement)) parents.add(el.parentElement)
  for (const p of parents) {
    if (p instanceof window.SVGElement) continue
    // Elemen inline yang membungkus beberapa baris punya kotak gabungan yang terlalu besar, jadi tidak ikut dibandingkan.
    const kids = [...p.children].filter((k) => info.has(k) && !isDecor(k) && info.get(k).cs.display !== 'inline')
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = info.get(kids[i]).r
        const b = info.get(kids[j]).r
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (w > 3 && h > 3) add('overlap', kids[j], `${Math.round(w)}x${Math.round(h)} with ${sig(kids[i])} in ${sig(p)}`)
      }
    }
  }

  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    out.push({ kind: 'page-scroll-x', sig: 'html', text: '', detail: `${document.documentElement.scrollWidth}>${window.innerWidth}` })
  }

  const seen = new Set()
  return out.filter((f) => {
    const k = `${f.kind}|${f.sig}|${f.detail}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Tombol dan tautan yang tertutup elemen tetap (bilah bawah, sheet) setelah digulir ke dalam layar.
 * Mengembalikan daftar kontrol yang pusatnya tidak bisa diketuk.
 */
export function coveredControlsInPage() {
  const out = []
  const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
  for (const el of controls) {
    const cs = getComputedStyle(el)
    const r0 = el.getBoundingClientRect()
    if (cs.display === 'none' || cs.visibility === 'hidden' || r0.width < 4 || r0.height < 4) continue
    if (el.closest('[aria-hidden="true"]') || el.disabled) continue
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)
    if (cx < 0 || cx >= window.innerWidth || cy < 0 || cy >= window.innerHeight) {
      out.push({ what: 'off-screen', label })
      continue
    }
    const hit = document.elementFromPoint(cx, cy)
    if (hit && !el.contains(hit) && !hit.contains(el)) {
      const lab = el.closest('label')
      if (lab && lab.contains(hit)) continue
      out.push({ what: 'covered', label, by: `${hit.tagName.toLowerCase()}.${String(hit.className).split(/\s+/).slice(0, 4).join('.')}` })
    }
  }
  window.scrollTo(0, 0)
  return out
}

/** Satukan temuan per komponen. */
export function groupFindings(rows) {
  const by = new Map()
  for (const r of rows) {
    const key = `${r.kind} ${r.sig}`
    const g = by.get(key) ?? { kind: r.kind, sig: r.sig, count: 0, widths: new Set(), examples: [] }
    g.count++
    if (r.width) g.widths.add(r.width)
    if (g.examples.length < 4) g.examples.push({ where: r.where, width: r.width, text: r.text, detail: r.detail })
    by.set(key, g)
  }
  return [...by.values()].sort((a, b) => b.count - a.count).map((g) => ({ ...g, widths: [...g.widths] }))
}
