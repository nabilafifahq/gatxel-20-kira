import type { ReactNode } from 'react'

/**
 * Ubah pohon elemen React sederhana menjadi HTML statis, setara renderToStaticMarkup.
 * Dipakai email laporan mingguan karena Next.js menolak `react-dom/server` di Route Handler
 * dan Server Action. Hanya mendukung elemen HTML, fragment, dan komponen fungsi tanpa hook
 * (cukup untuk email berbasis tabel). Hasilnya diuji sama persis dengan react-dom/server
 * di test/week-summary-email.test.ts.
 */

const ELEMENT_TYPES = new Set([Symbol.for('react.transitional.element'), Symbol.for('react.element')])
const FRAGMENT = Symbol.for('react.fragment')

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

/** Sama dengan daftar angka tanpa satuan di React DOM. */
const UNITLESS = new Set([
  'animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice', 'borderImageWidth', 'boxFlex', 'boxFlexGroup',
  'boxOrdinalGroup', 'columnCount', 'columns', 'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'flexOrder', 'gridArea',
  'gridRow', 'gridRowEnd', 'gridRowSpan', 'gridRowStart', 'gridColumn', 'gridColumnEnd', 'gridColumnSpan', 'gridColumnStart', 'fontWeight',
  'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'scale', 'tabSize', 'widows', 'zIndex', 'zoom', 'fillOpacity', 'floodOpacity',
  'stopOpacity', 'strokeDasharray', 'strokeDashoffset', 'strokeMiterlimit', 'strokeOpacity', 'strokeWidth', 'MozAnimationIterationCount',
  'MozBoxFlex', 'MozBoxFlexGroup', 'MozLineClamp', 'msAnimationIterationCount', 'msFlex', 'msZoom', 'msFlexGrow', 'msFlexNegative',
  'msFlexOrder', 'msFlexPositive', 'msFlexShrink', 'msGridColumn', 'msGridColumnSpan', 'msGridRow', 'msGridRowSpan',
  'WebkitAnimationIterationCount', 'WebkitBoxFlex', 'WebKitBoxFlexGroup', 'WebkitBoxOrdinalGroup', 'WebkitColumnCount', 'WebkitColumns',
  'WebkitFlex', 'WebkitFlexGrow', 'WebkitFlexPositive', 'WebkitFlexShrink', 'WebkitLineClamp',
])

const ATTR_ALIAS: Record<string, string> = { className: 'class', htmlFor: 'for', httpEquiv: 'http-equiv', acceptCharset: 'accept-charset', tabIndex: 'tabindex' }
const BOOLEAN_ATTRS = new Set(['hidden', 'disabled', 'checked', 'selected', 'open', 'required', 'multiple', 'readOnly', 'autoFocus'])
const SKIP_PROPS = new Set(['children', 'dangerouslySetInnerHTML', 'style', 'key', 'ref', 'suppressHydrationWarning', 'suppressContentEditableWarning'])

export function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#x27;'))
}

function hyphenate(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^ms-/, '-ms-')
}

export function styleToCss(style: Record<string, unknown>): string {
  const out: string[] = []
  for (const [name, raw] of Object.entries(style)) {
    if (raw === null || raw === undefined || typeof raw === 'boolean' || raw === '') continue
    const prop = name.startsWith('--') ? name : hyphenate(name)
    const value = typeof raw === 'number' ? (raw !== 0 && !UNITLESS.has(name) && !name.startsWith('--') ? `${raw}px` : `${raw}`) : String(raw).trim()
    out.push(`${prop}:${escapeText(value)}`)
  }
  return out.join(';')
}

/** Atribut dalam urutan prop, termasuk style di posisi aslinya, sama seperti React. */
function attributes(props: Record<string, unknown>): string {
  let out = ''
  for (const [name, value] of Object.entries(props)) {
    if (name === 'style') {
      const css = value && typeof value === 'object' ? styleToCss(value as Record<string, unknown>) : ''
      if (css) out += ` style="${css}"`
      continue
    }
    if (SKIP_PROPS.has(name) || value === null || value === undefined || typeof value === 'function' || typeof value === 'symbol') continue
    const attr = ATTR_ALIAS[name] ?? name
    if (typeof value === 'boolean') {
      if (name.startsWith('aria-') || name.startsWith('data-')) out += ` ${attr}="${value}"`
      else if (value && BOOLEAN_ATTRS.has(name)) out += ` ${attr}=""`
      continue
    }
    out += ` ${attr}="${escapeText(String(value))}"`
  }
  return out
}

type AnyElement = { $$typeof: symbol; type: unknown; props: Record<string, unknown> }

function isElement(node: unknown): node is AnyElement {
  return typeof node === 'object' && node !== null && ELEMENT_TYPES.has((node as { $$typeof?: symbol }).$$typeof as symbol)
}

export function renderStaticMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string') return escapeText(node)
  if (typeof node === 'number' || typeof node === 'bigint') return String(node)
  if (Array.isArray(node)) return node.map((n) => renderStaticMarkup(n as ReactNode)).join('')
  if (!isElement(node)) throw new Error('renderStaticMarkup: jenis node tidak didukung')
  const { type, props } = node
  if (type === FRAGMENT) return renderStaticMarkup(props.children as ReactNode)
  if (typeof type === 'function') return renderStaticMarkup((type as (p: Record<string, unknown>) => ReactNode)(props))
  if (typeof type !== 'string') throw new Error('renderStaticMarkup: komponen ini tidak didukung')
  const attrs = attributes(props)
  if (VOID_TAGS.has(type)) return `<${type}${attrs}/>`
  const inner = props.dangerouslySetInnerHTML && typeof props.dangerouslySetInnerHTML === 'object' ? String((props.dangerouslySetInnerHTML as { __html?: unknown }).__html ?? '') : renderStaticMarkup(props.children as ReactNode)
  return `<${type}${attrs}>${inner}</${type}>`
}
