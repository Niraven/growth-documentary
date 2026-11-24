import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const url = process.argv[2] ?? 'http://127.0.0.1:5191/?skin=day'
const axeSource = readFileSync(
  new URL('../node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8',
)

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 1000 },
})
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
if (new URL(url).searchParams.has('url') || new URL(url).hash.startsWith('#report/')) {
  await page.waitForSelector('#brief', { timeout: 120_000 })
  await page.waitForSelector('[data-testid="sources-board"]')
  await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="sources-board"] [data-slot="badge"]')].some(el => el.textContent === 'reading'))
}
await page.evaluate(axeSource)
const results = await page.evaluate(async () => {
  // @ts-expect-error injected at runtime
  return await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
})
await browser.close()

const violations = results.violations.map((v) => ({
  id: v.id,
  impact: v.impact,
  nodes: v.nodes.length,
  help: v.help,
}))
const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

console.log(JSON.stringify({ url, total: violations.length, serious: serious.length, violations }, null, 2))
process.exit(violations.length > 0 ? 1 : 0)
