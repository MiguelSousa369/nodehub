// ---------------------------------------------------------------------------
// Records the README demo GIFs (docs/media/*.gif) from a running dashboard.
//
// Every /api request is answered with the fictional data in demo-data.cjs (route interception):
// nothing is read from or written to the real database, so it can run against any instance.
//
// Frames come from the browser's screencast (CDP), are resampled to a fixed frame rate and encoded
// with gifenc using one shared palette per GIF (no colour flicker). Each frame only stores the
// pixels that changed since the previous one (the rest is transparent), which keeps files small.
//
//   npm install
//   npm run record                      all scenes, into docs/media
//   npm run record -- dashboard machine only these scenes
//
// Env: NODEHUB_URL (default http://127.0.0.1:8737), BROWSER (path to Chrome or Edge), OUT (folder).
// ---------------------------------------------------------------------------
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const jpeg = require('jpeg-js')
const { GIFEncoder, quantize, applyPalette } = require('gifenc')
const { handle, me } = require('./demo-data.cjs')

const BASE = (process.env.NODEHUB_URL || 'http://127.0.0.1:8737').replace(/\/+$/, '')
const OUT = process.env.OUT || path.join(__dirname, '..', '..', 'docs', 'media')
const WIDTH = 1200, HEIGHT = 700, SCALE = 0.75, FPS = 12
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The browser to drive: $BROWSER, or the first Chrome/Edge found in the usual places. */
function findBrowser() {
  if (process.env.BROWSER) return process.env.BROWSER
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ]
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) throw new Error('No Chrome or Edge found: set BROWSER to its path.')
  return found
}

// A visible cursor (headless browsers draw none), following mouse moves and showing clicks
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.id = '__cursor'
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;z-index:2147483647;pointer-events:none;' +
      'transition:transform .12s;background:url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27><path d=%27M4 2l16 9-7 2-3 7z%27 fill=%27%23111%27 stroke=%27white%27 stroke-width=%271.5%27/></svg>") no-repeat;'
    document.body.appendChild(c)
    addEventListener('mousemove', (e) => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px' }, true)
    addEventListener('mousedown', () => { c.style.transform = 'scale(.8)' }, true)
    addEventListener('mouseup', () => { c.style.transform = '' }, true)
  })`

async function record(browser, name, scene, { theme = 'light', lang = 'en' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: theme, reducedMotion: 'reduce' })
  await ctx.addInitScript(([u, t, l]) => {
    localStorage.setItem('token', 'demo-token'); localStorage.setItem('user', u)
    localStorage.setItem('theme', t); localStorage.setItem('language', l); localStorage.setItem('teamLanguage', 'en')
  }, [JSON.stringify(me), theme, lang])
  await ctx.addInitScript(CURSOR)
  const page = await ctx.newPage()
  await page.route('**/api/**', (route) => {
    const req = route.request()
    let body = null
    try { body = req.postDataJSON() } catch { /* no body */ }
    route.fulfill({ json: handle(req.url(), req.method(), body) })
  })

  // Smooth mouse helpers
  let mx = WIDTH / 2, my = HEIGHT / 2
  const moveTo = async (x, y, steps = 18) => { await page.mouse.move(x, y, { steps }); mx = x; my = y }
  const moveToEl = async (locator) => {
    const b = await locator.boundingBox()
    await moveTo(b.x + b.width / 2, b.y + b.height / 2)
  }
  const clickEl = async (locator) => { await moveToEl(locator); await sleep(150); await page.mouse.down(); await page.mouse.up() }
  const type = async (text) => { for (const ch of text) { await page.keyboard.type(ch); await sleep(90) } }

  // Screencast
  const cdp = await ctx.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data })
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })

  await scene({ page, moveTo, moveToEl, clickEl, type, sleep, start: async () => {
    await page.mouse.move(mx, my)
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: Math.round(WIDTH * SCALE), maxHeight: Math.round(HEIGHT * SCALE), everyNthFrame: 1 })
  } })
  await sleep(300)
  await cdp.send('Page.stopScreencast')
  await ctx.close()

  // Resample to a fixed frame rate (hold the last frame between screencast frames)
  const start = frames[0].t, end = frames[frames.length - 1].t + 1000
  const decoded = frames.map((f) => ({ t: f.t, img: jpeg.decode(Buffer.from(f.data, 'base64'), { useTArray: true }) }))
  const w = decoded[0].img.width, h = decoded[0].img.height
  const timeline = []
  for (let t = start, i = 0; t <= end; t += 1000 / FPS) {
    while (i + 1 < decoded.length && decoded[i + 1].t <= t) i++
    if (decoded[i].img.width === w && decoded[i].img.height === h) timeline.push(decoded[i].img)
  }

  // One palette from a sample of frames; the last slot is reserved for "unchanged" (transparent)
  const n = Math.min(8, timeline.length)
  const sample = new Uint8Array(w * h * 4 * n)
  for (let k = 0; k < n; k++) sample.set(timeline[Math.floor(k * (timeline.length - 1) / Math.max(1, n - 1))].data, k * w * h * 4)
  const palette = quantize(sample, 255)
  while (palette.length < 255) palette.push([0, 0, 0])
  const TRANSPARENT = palette.length
  palette.push([255, 0, 255])

  // Encode: identical consecutive frames become one longer frame; changed frames only carry the
  // pixels that differ from what's on screen (JPEG noise below a small threshold counts as equal).
  const gif = GIFEncoder()
  let shown = null, pending = null, hold = 0, first = true
  const flush = () => {
    if (!pending) return
    gif.writeFrame(pending, w, h, first
      ? { palette, delay: Math.round(hold * 1000 / FPS) }
      : { palette, delay: Math.round(hold * 1000 / FPS), transparent: true, transparentIndex: TRANSPARENT, dispose: 1 })
    first = false
  }
  for (const img of timeline) {
    const idx = applyPalette(img.data, palette)
    if (!shown) { shown = idx; pending = idx; hold = 1; continue }
    const diff = new Uint8Array(idx.length).fill(TRANSPARENT)
    let changed = 0
    for (let p = 0; p < idx.length; p++) {
      if (idx[p] !== shown[p]) { diff[p] = idx[p]; shown[p] = idx[p]; changed++ }
    }
    if (!changed) { hold++; continue }
    flush(); pending = diff; hold = 1
  }
  hold += FPS * 1.2   // pause on the last frame before looping
  flush()
  gif.finish()
  const file = path.join(OUT, `${name}.gif`)
  fs.writeFileSync(file, gif.bytes())
  console.log(`${name}.gif  ${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB  ${timeline.length} frames  ${w}x${h}`)
}

// ---------------------------------------------------------------------------
// Scenes (one GIF each)
// ---------------------------------------------------------------------------

const scenes = {
  // Machines grouped by client: search, status filter
  async dashboard({ page, start, moveTo, clickEl, type, sleep }) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await start()
    await sleep(900)
    await moveTo(600, 420, 25); await sleep(500)
    await clickEl(page.getByRole('searchbox', { name: 'Search machines' })); await sleep(200)
    await type('harbor'); await sleep(1300)
    await page.getByRole('searchbox', { name: 'Search machines' }).fill(''); await sleep(700)
    await clickEl(page.getByRole('radio', { name: 'Offline' })); await sleep(1500)
    await clickEl(page.getByRole('radio', { name: /^All/ })); await sleep(900)
  },

  // Ctrl+K: find a machine and open it in Claude
  async 'quick-search'({ page, start, moveTo, type, sleep }) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await start()
    await moveTo(700, 300, 10); await sleep(700)
    await page.keyboard.press('Control+k'); await sleep(600)
    await type('pedro'); await sleep(900)
    await page.keyboard.press('ArrowDown'); await sleep(500)
    await page.keyboard.press('ArrowUp'); await sleep(1200)
  },

  // A new PC shows up: configure it with a client and a friendly name
  async onboarding({ page, start, clickEl, type, sleep }) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await start()
    await sleep(900)
    await clickEl(page.getByRole('button', { name: 'Configure' })); await sleep(500)
    await type('Northwind Accounts'); await sleep(300)
    await clickEl(page.getByPlaceholder('e.g. PC-PEDRO')); await type('PC-MARIA'); await sleep(300)
    await clickEl(page.getByPlaceholder('e.g. Front desk PC')); await type('New accountant'); await sleep(500)
    await clickEl(page.getByRole('dialog').getByRole('button', { name: 'Save' })); await sleep(1200)
  },

  // A machine's page: profile and sessions
  async machine({ page, start, moveTo, clickEl, sleep }) {
    await page.goto(BASE + '/?q=northwind', { waitUntil: 'networkidle' })
    await start()
    await sleep(700)
    await clickEl(page.getByRole('link', { name: 'PC-PEDRO' })); await sleep(1400)
    await moveTo(600, 500, 20)
    await page.mouse.wheel(0, 260); await sleep(900)
    await clickEl(page.locator('summary').first()); await sleep(1800)
  },

  // History across all clients, filtered
  async history({ page, start, moveTo, clickEl, sleep }) {
    await page.goto(BASE + '/history', { waitUntil: 'networkidle' })
    await start()
    await sleep(900)
    await clickEl(page.locator('summary').nth(1)); await sleep(1500)
    await clickEl(page.locator('summary').nth(1)); await sleep(400)
    await page.locator('select').first().selectOption('UNRESOLVED')
    await moveTo(560, 120, 12); await sleep(1100)
    await page.locator('select').first().selectOption('')
    await sleep(800)
  },

  // Theme and language from the account menu
  async 'theme-language'({ page, start, clickEl, sleep }) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await start()
    await sleep(700)
    await clickEl(page.getByRole('button', { name: /Account menu/ })); await sleep(600)
    await clickEl(page.getByRole('radio', { name: 'Dark' })); await sleep(900)
    await clickEl(page.getByRole('radio', { name: 'Português' })); await sleep(1300)
    await page.keyboard.press('Escape'); await sleep(1200)
  },

  // Admins: team SSH keys (a deactivated account's key is no longer applied)
  async 'ssh-keys'({ page, start, moveTo, moveToEl, sleep }) {
    await page.goto(BASE + '/users', { waitUntil: 'networkidle' })
    const oldKey = page.getByText('· old-laptop', { exact: true }).first()
    await oldKey.scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 120)
    await start()
    await sleep(800)
    await moveToEl(oldKey); await sleep(1400)
    await moveToEl(page.getByRole('link', { name: 'Sync keys' }).first()); await sleep(1600)
  },
}

;(async () => {
  const only = process.argv.slice(2)
  const unknown = only.filter((s) => !(s in scenes))
  if (unknown.length) throw new Error(`Unknown scene(s): ${unknown.join(', ')}. Scenes: ${Object.keys(scenes).join(', ')}`)
  const browser = await chromium.launch({ executablePath: findBrowser() })
  for (const [name, scene] of Object.entries(scenes)) {
    if (only.length && !only.includes(name)) continue
    await record(browser, name, scene)
  }
  await browser.close()
})().catch((e) => { console.error(e.message || e); process.exit(1) })
