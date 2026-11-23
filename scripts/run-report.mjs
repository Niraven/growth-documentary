import puppeteer from 'puppeteer-core'

const base = process.argv[2] ?? 'http://127.0.0.1:5190/?skin=day'
const domain = process.argv[3] ?? 'basecamp.com/pricing'
const out = process.argv[4] ?? 'shot-live.png'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 1400 },
})
const page = await browser.newPage()
page.on('response', async (res) => {
  if (res.url().includes('/api/timeline')) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 160)
    } catch {}
    console.log('API', res.status(), body)
  }
})
page.on('pageerror', (err) => console.log('PAGEERROR', err.message.slice(0, 200)))

await page.goto(base, { waitUntil: 'networkidle2', timeout: 60_000 })
await page.click('#domain')
await page.type('#domain', domain, { delay: 10 })
await page.evaluate(() => {
  const form = document.querySelector('form')
  const button = form?.querySelector('button[type=submit]')
  if (button instanceof HTMLButtonElement) button.click()
})

const started = Date.now()
let result = 'timeout'
while (Date.now() - started < 100_000) {
  const state = await page.evaluate(() => {
    if (document.querySelector('#live')) return 'live'
    const alert = document.querySelector('[role=alert]')
    if (alert) return `error: ${alert.textContent?.slice(0, 200)}`
    if (document.body.innerText.includes('Reading the archive')) return 'loading'
    return 'idle'
  })
  if (state !== 'loading' && state !== 'idle') {
    result = state
    break
  }
  await new Promise((resolve) => setTimeout(resolve, 1500))
}

await new Promise((resolve) => setTimeout(resolve, 800))
await page.screenshot({ path: out, fullPage: true })
console.log(JSON.stringify({ result, seconds: Math.round((Date.now() - started) / 1000), out }))
await browser.close()
