// Exercise the real archive API. No network interception or generated report data.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const origin = process.argv[2] ?? 'http://127.0.0.1:5211'
const out = process.argv[3] ?? 'docs/brief-v08'
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
      if (geometry.page > width)
        console.log(
          await p.evaluate(() =>
            [...document.querySelectorAll('body *')]
              .filter(
                (e) =>
                  !e.closest('.matrix-scroll,.sr-only') &&
                  e.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
              )
              .map((e) => [e.tagName, e.className, e.textContent.slice(0, 40)])
              .slice(0, 30),
          ),
        )
      assert.equal(geometry.page, width, JSON.stringify(geometry))
      await p.screenshot({ path: `${out}/${name}-${section}.png` })
    }
    await p.goto(origin, { waitUntil: 'networkidle2' })
    await shot('landing')
    if(name==='mobile') await shot('sample','.sample')
    const sample = await p.$eval('.sample-quote:last-of-type', el=>({url:el.querySelector('a').href,headline:el.querySelector('p').textContent,prices:[...el.querySelectorAll('strong')].map(x=>x.textContent)}))
    const pending = p.waitForResponse((r) => r.url().includes('/api/timeline?'), {
      timeout: 120000,
    })
    await p.click('button[type=submit]')
    const api = await (await pending).json()
    await p.waitForSelector('#brief')
    await p.waitForSelector('[data-testid="sources-board"]')
    await p.waitForNetworkIdle({ timeout: 60000 })
    const sampleCapture=api.captures.find(c=>c.url===sample.url)
    assert.ok(sampleCapture && sample.headline.includes(sampleCapture.h1) && sample.prices.length===2 && sample.prices.every(price=>sampleCapture.prices.includes(price)))
    const rows = await p.$$eval('#brief dd', (els) => els.map((e) => e.innerText))
    for (const [i, field] of ['headline', 'title'].entries()) {
      const change = api.changes.filter((c) => c.field === field).at(-1)
      assert.ok(rows[i].includes(change.before) && rows[i].includes(change.after))
    }
    const last = api.captures.at(-1)
    const monthly = (c) =>
      c.prices.filter((s) => /^\$[\d.]+\/mo$/.test(s)).map((s) => Number(s.slice(1, -3)))
    const first = api.captures.find((c) => monthly(c).length > 1)
    for (const capture of [first, last]) {
      const amounts = monthly(capture)
      assert.ok(rows[2].includes(`$${Math.min(...amounts)}–$${Math.max(...amounts)}/mo`))
    }
    const heading = await p.$eval('.report-heading', (e) => e.innerText)
    assert.ok(
      heading.includes(
        `${api.coverage.sampled} of ${api.coverage.available} listed captures read · ${api.coverage.months} months`,
      ),
    )
    assert.equal(rows.length, 3)
    assert.ok((await p.$eval('.brief-context', (e) => e.innerText)).includes(last.label))
    const take = await p.$eval('#brief header p', (e) => e.innerText)
    assert.ok(take.includes(api.changes.filter((c) => c.field === 'headline').at(-1).after))
    assert.ok(
      (await p.$eval('#compare', (e) => e.innerText)).includes(
        `Comparing ${api.captures[0].label} with ${last.label}`,
      ),
    )
    const links = await p.$$eval('#brief a', (els) => els.map((e) => e.href))
    assert.ok(links.every((href) => api.captures.some((c) => c.url === href)))
    await p.bringToFront()
    await p.click('button::-p-text(Copy brief)')
    await p.waitForSelector('[data-sonner-toast]')
    const md = await p.evaluate(() => navigator.clipboard.readText())
    assert.ok(
      md.includes(api.checkedAt) && links.every((link) => md.includes(link)),
      JSON.stringify({ md, links, checked: api.checkedAt }),
    )
    await p.waitForFunction(() => !document.querySelector('[data-sonner-toast]'))
    await shot('report')
    await shot('brief', '#brief')
    await shot('charts', '#evidence')
    await shot('matrix', '.matrix')
    await shot('evidence', '[data-testid="sources-board"]')
    await shot('changes', '#changes')
    await shot('compare', '#compare')
    await shot('stories','.story-link')
    assert.ok(await p.$eval('.story-link',e=>e.href.startsWith('https://news.ycombinator.com/item?id=') && e.getBoundingClientRect().height>=44))
    assert.equal(await p.$eval('a[href^="https://hn.algolia.com/?"]',e=>new URL(e.href).searchParams.get('query')),api.domain)
    await p.select('#compare select', '1')
    assert.ok((await p.$eval('#compare',e=>e.innerText)).includes(`Comparing ${api.captures[1].label} with ${last.label}`))
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
    console.log(name, api.coverage, rows, 'copy verified')
    await p.close()
  }
} finally {
  await browser.close()
}
