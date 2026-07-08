import { test, expect } from '@playwright/test'
import { writeFileSync, readFileSync, appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const openDoc = async (request: any, text: string) => {
  const p = join(mkdtempSync(join(tmpdir(), 'compose-e2e-')), 'doc.md')
  writeFileSync(p, text)
  const r = await request.post('/api/open', { data: { path: p } })
  return { p, id: (await r.json()).id }
}

test('external agent write appears with highlight', async ({ page, request }) => {
  const { p, id } = await openDoc(request, '# Doc\n\nhuman paragraph\n')
  await page.goto(`/doc/${id}`)
  await expect(page.locator('.editor-host')).toContainText('human paragraph')
  appendFileSync(p, '\nagent paragraph\n')
  await expect(page.locator('.editor-host')).toContainText('agent paragraph')
  await expect(page.locator('.agent-highlight')).toBeVisible()
})

test('typing lands in the file after debounce', async ({ page, request }) => {
  const { p, id } = await openDoc(request, '# Doc\n\nstart\n')
  await page.goto(`/doc/${id}`)
  await page.locator('.editor-host .ProseMirror').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' typed-by-human')
  await expect.poll(() => readFileSync(p, 'utf8')).toContain('typed-by-human')
})

test('simultaneous edits both survive', async ({ page, request }) => {
  const { p, id } = await openDoc(request, '# Doc\n\nfirst para\n\nlast para\n')
  await page.goto(`/doc/${id}`)
  await page.locator('.editor-host .ProseMirror').click()
  await page.keyboard.type('HUMAN-')
  appendFileSync(p, '\nAGENT-LINE\n')
  await expect(page.locator('.editor-host')).toContainText('AGENT-LINE')
  await expect.poll(() => readFileSync(p, 'utf8')).toContain('HUMAN-')
  await expect.poll(() => readFileSync(p, 'utf8')).toContain('AGENT-LINE')
})
