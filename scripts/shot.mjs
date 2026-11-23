import puppeteer from 'puppeteer-core'

const url = process.argv[2]
const out = process.argv[3] ?? 'shot.png'
const waitFor = process.argv[4]
const width = Number(process.argv[5] ?? 1280)
const height = Number(process.argv[6] ?? 1400)

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width, height, deviceScaleFactor: 1 },
})

const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 })

if (waitFor) {
  await page.waitForSelector(waitFor, { timeout: 120_000 })
  await new Promise((resolve) => setTimeout(resolve, 800))
}

await page.screenshot({ path: out, fullPage: true })
console.log(JSON.stringify({ out, title: await page.title() }))
await browser.close()
