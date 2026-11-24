// Real growth-timeline acceptance against the running API. No fixture data.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const origin = process.argv[2] ?? 'http://127.0.0.1:5191'
const out = process.argv[3] ?? 'docs/brief-v10'
await mkdir(out, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-gpu'],
})
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 1100],
    ['mobile', 390, 844],
  ]) {
    const page = await browser.newPage()
    await page.setViewport({ width, height, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
    if (name === 'mobile')
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

    const growth = page.waitForResponse((r) => r.url().includes('/api/growth?'), {
      timeout: 120_000,
    })
    await page.goto(`${origin}/?url=basecamp.com/pricing`, {
      waitUntil: 'networkidle2',
      timeout: 120_000,
    })
    const response = await growth
    assert.equal(response.status(), 200)
    const api = await response.json()
    await page.waitForSelector('#growth')
    await page.waitForSelector('[data-testid="growth-events"]')
    await page.waitForNetworkIdle({ timeout: 60_000 })
    await page.evaluate(() => document.fonts.ready)

    const geometry = await page.evaluate(() => ({
      inner: innerWidth,
      page: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    assert.equal(geometry.page, width, JSON.stringify(geometry))

    const heading = await page.$eval('#growth-title', (el) => el.textContent)
    assert.equal(heading, 'Public growth timeline')
    const eventCount = await page.$$eval('[data-testid="growth-events"] li', (els) => els.length)
    assert.equal(eventCount, api.events.length)
    const links = await page.$$eval('[data-testid="growth-events"] a', (els) => els.map((el) => el.href))
    assert.ok(links.length >= api.events.length)
    assert.ok(links.every((href) => href.startsWith('https://')))
    const pageText = await page.$eval('#growth', (el) => el.innerText)
    assert.ok(pageText.includes('Page change') || pageText.includes('Page changes'))
    assert.ok(pageText.includes('not prove'))

    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${out}/${name}-growth.png` })
    await page.$eval('#context', (el) => el.scrollIntoView({ block: 'start' }))
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${out}/${name}-context.png` })
    console.log(
      JSON.stringify({
        name,
        events: api.events.length,
        types: [...new Set(api.events.map((event) => event.type))],
        counts: api.counts,
        links: links.length,
        geometry,
      }),
    )
    await page.close()
  }
} finally {
  await browser.close()
}
