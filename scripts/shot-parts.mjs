import puppeteer from 'puppeteer-core'

const url = process.argv[2] ?? 'http://127.0.0.1:5191/?skin=day&url=basecamp.com/pricing'
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 1600 },
})
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle2', timeout: 90_000 })
await page.waitForSelector('[data-testid=price-trail]', { timeout: 30_000 })
await new Promise((resolve) => setTimeout(resolve, 1200))

const shot = async (selector, path) => {
  const element = await page.$(selector)
  if (!element) {
    console.log('MISSING', selector)
    return
  }
  await element.screenshot({ path })
  console.log('shot', selector, path)
}

await shot('[data-testid=price-trail]', '/tmp/gd-v060-chart.png')
await shot('[data-testid=ad-libraries]', '/tmp/gd-v060-ads.png')
await shot('[data-testid=archive-preview]', '/tmp/gd-v060-archive-empty.png')

const load = await page.$('[data-testid=archive-preview] button')
if (load) {
  await load.click()
  await new Promise((resolve) => setTimeout(resolve, 22_000))
  await shot('[data-testid=archive-preview]', '/tmp/gd-v060-archive-loaded.png')
}

await browser.close()
