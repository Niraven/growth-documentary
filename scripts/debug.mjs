import puppeteer from 'puppeteer-core'

const url = process.argv[2]
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 1200 },
})
const page = await browser.newPage()
page.on('pageerror', (err) => console.log('PAGEERROR', err.message.slice(0, 200)))
page.on('response', async (res) => {
  if (res.url().includes('/api/')) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 120)
    } catch {}
    console.log('API', res.status(), res.url().slice(-60), body)
  }
})
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
await new Promise((resolve) => setTimeout(resolve, 25_000))

const state = await page.evaluate(() => {
  const alert = document.querySelector('[role=alert]')
  const input = document.querySelector('#domain')
  return {
    input: input instanceof HTMLInputElement ? input.value : null,
    alert: alert ? alert.textContent?.slice(0, 200) : null,
    live: Boolean(document.querySelector('#live')),
    apiResources: performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name.includes('/api/'))
      .map((entry) => `${entry.name.split('/api/')[1]} ${Math.round(entry.duration)}ms`),
  }
})
console.log('STATE', JSON.stringify(state))
await browser.close()
