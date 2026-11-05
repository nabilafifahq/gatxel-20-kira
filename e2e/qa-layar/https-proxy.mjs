// Proxy HTTPS lokal untuk uji WebKit: cookie __Host- hanya diterima di origin aman.
//   node e2e/qa-layar/https-proxy.mjs <key.pem> <cert.pem> [port] [target-port]
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'

const [keyFile, certFile, port = '3202', target = '3201'] = process.argv.slice(2)
const server = https.createServer({ key: readFileSync(keyFile), cert: readFileSync(certFile) }, (req, res) => {
  const up = http.request(
    { host: '127.0.0.1', port: Number(target), path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-host': req.headers.host } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers)
      r.pipe(res)
    },
  )
  up.on('error', () => {
    res.writeHead(502)
    res.end()
  })
  req.pipe(up)
})
server.listen(Number(port), '127.0.0.1', () => console.log(`https://localhost:${port} -> ${target}`))
