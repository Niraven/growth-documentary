// Exercise the real archive API and the rendered documentary. No generated report data.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const origin = process.argv[2] ?? 'http://127.0.0.1:5215'
const out = process.argv[3] ?? 'docs/brief-v09'
await mkdir(out, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
try {
  await browser
    .defaultBrowserContext()
    .overridePermissions(origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  for (const [name, width, height] of [
    ['desktop', 1440, 1100],
    ['mobile', 390, 844],
  ]) {
    const p = await browser.newPage()
    await p.setViewport({ width, height, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
    if (name === 'mobile')
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    const shot = async (section, selector) => {
      if (selector) await p.$eval(selector, (e) => e.scrollIntoView({ block: 'start' }))
      else await p.evaluate(() => scrollTo(0, 0))
      await p.evaluate(() => document.fonts.ready)
      const geometry = await p.evaluate(() => ({
        inner: innerWidth,
        page: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      assert.equal(geometry.page, width, JSON.stringify(geometry))
      await p.screenshot({ path: `${out}/${name}-${section}.png` })
    }

    await p.goto(origin, { waitUntil: 'networkidle2' })
    await shot('landing')
    if (name === 'mobile') await shot('sample', '.sample')
    const sample = await p.$eval('.sample-quote:last-of-type', (el) => ({
      url: el.querySelector('a').href,
      headline: el.querySelector('p').textContent,
      prices: [...el.querySelectorAll('strong')].map((x) => x.textContent),
    }))

    const pending = p.waitForResponse((r) => r.url().includes('/api/timeline?'), {
      timeout: 120000,
    })
    await p.click('button[type=submit]')
    const api = await (await pending).json()
    await p.waitForSelector('#documentary')
    await p.waitForSelector('[data-testid="sources-board"]')
    await p.waitForNetworkIdle({ timeout: 60000 })
    await p.evaluate(() => document.fonts.ready)

    const sampleCapture = api.captures.find((c) => c.url === sample.url)
    assert.ok(
      sampleCapture &&
        sample.headline.includes(sampleCapture.h1) &&
        sample.prices.length === 2 &&
        sample.prices.every((price) => sampleCapture.prices.includes(price)),
    )

    const masthead = await p.$eval('.documentary-masthead', (e) => e.innerText)
    assert.ok(masthead.includes(api.coverage.sampled + ' of ' + api.coverage.available))
    const pageHeading = await p.$eval('.report-heading h1', (e) => e.innerText)
    assert.ok(pageHeading.includes(api.domain + api.path))
    assert.ok(masthead.includes('Public growth documentary'))

    const scenes = await p.$$eval('.documentary-scene', (els) => els.map((e) => e.innerText))
    const expected = api.changes.filter((change) => change.field !== 'first capture')
    assert.equal(scenes.length, expected.length)
    for (const [index, change] of expected.entries()) {
      assert.ok(scenes[index].includes(change.before) && scenes[index].includes(change.after))
    }

    const links = await p.$$eval('#documentary a', (els) => els.map((e) => e.href))
    assert.ok(
      links.every(
        (href) => href.startsWith('https://web.archive.org/') || href.endsWith('#evidence'),
      ),
    )

    const opening = await p.$eval('.documentary-act:first-child .documentary-quote', (e) =>
      e.innerText,
    )
    const closing = await p.$eval('.documentary-act:last-child .documentary-quote', (e) =>
      e.innerText,
    )
    assert.ok(opening.includes(api.captures[0].h1))
    assert.ok(closing.includes(api.captures.at(-1).h1))

    await p.bringToFront()
    await p.click('button::-p-text(Copy documentary)')
    await p.waitForSelector('[data-sonner-toast]')
    const md = await p.evaluate(() => navigator.clipboard.readText())
    assert.ok(md.includes('a public growth documentary'))
    assert.ok(md.includes(api.checkedAt))
    assert.ok(md.includes(api.captures[0].url) && md.includes(api.captures.at(-1).url))
    await p.waitForFunction(() => !document.querySelector('[data-sonner-toast]'))

    assert.ok(
      (await p.$eval('#compare', (e) => e.innerText)).includes(
        `Comparing ${api.captures[0].label} with ${api.captures.at(-1).label}`,
      ),
    )
    await p.select('#compare select', '1')
    assert.ok(
      (await p.$eval('#compare', (e) => e.innerText)).includes(
        `Comparing ${api.captures[1].label} with ${api.captures.at(-1).label}`,
      ),
    )

    await shot('documentary')
    await shot('story', '#documentary')
    await shot('evidence', '#evidence')
    await shot('charts', '[data-testid="price-trail"]')
    await shot('matrix', '.matrix')
    await shot('changes', '#changes')
    await shot('compare', '#compare')
    await shot('stories', '.story-link')
    assert.ok(
      await p.$eval(
        '.story-link',
        (e) =>
          e.href.startsWith('https://news.ycombinator.com/item?id=') &&
          e.getBoundingClientRect().height >= 44,
      ),
    )

    if (name === 'mobile') {
      const narrow = await p.evaluate(() =>
        Array.from(document.querySelectorAll('a,button,select,summary,input'))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return (
              r.width > 0 &&
              r.height > 0 &&
              (r.width < 43.9 || r.height < 43.9) &&
              !el.closest('.sr-only') &&
              !el.classList.contains('sr-only')
            )
          })
          .map((e) => [e.textContent.trim().slice(0, 35), e.getBoundingClientRect().height]),
      )
      assert.deepEqual(narrow, [])
      await p.click('.matrix-controls button:last-child')
      assert.ok(await p.$eval('.matrix-scroll', (e) => e.scrollLeft > 0))
    }

    console.log(name, api.coverage, scenes.length, 'documentary verified')
    await p.close()
  }
} finally {
  await browser.close()
}
