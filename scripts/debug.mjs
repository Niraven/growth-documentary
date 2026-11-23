import puppeteer from 'puppeteer-core'

const url = process.argv[2]
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 1200 },
})
const page = await browser.newPage()
page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text().slice(0, 200)))
page.on('pageerror', (err) => console.log('PAGEERROR', err.message.slice(0, 300)))
page.on('response', async (res) => {
  if (res.url().includes('/api/timeline')) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 200)
    } catch {}
    console.log('API', res.status(), body)
  }
})
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await new Promise((resolve) => setTimeout(resolve, 35_000))
const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 700))
console.log('TEXT', text)
await browser.close()
