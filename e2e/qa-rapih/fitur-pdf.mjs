// Gambar sertifikat PDF ke PNG dengan pdf.js supaya tataletaknya bisa dilihat. Pakai: node qa-rapih/fitur-pdf.mjs <file.pdf> <file.png>
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [input, output] = process.argv.slice(2)
const data = readFileSync(input).toString('base64')
const b = await chromium.launch({ headless: true })
const page = await b.newPage({ viewport: { width: 1000, height: 720 } })
await page.setContent('<!doctype html><body style="margin:0;background:#888"><canvas id="c"></canvas></body>')
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js' })
const info = await page.evaluate(async (b64) => {
  const lib = window.pdfjsLib
  lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const doc = await lib.getDocument({ data: bytes, standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/' }).promise
  const p = await doc.getPage(1)
  const v = p.getViewport({ scale: 1.15 })
  const c = document.getElementById('c')
  c.width = v.width
  c.height = v.height
  await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise
  const text = await p.getTextContent()
  return { pages: doc.numPages, w: v.width, h: v.height, text: text.items.map((i) => i.str) }
}, data)
console.log(JSON.stringify(info))
await page.screenshot({ path: output, fullPage: true })
await b.close()
