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

test('typing emits a human-edit event the agent can poll', async ({ page, request }) => {
  const { id } = await openDoc(request, '# Doc\n\nevent test\n')
  await page.goto(`/doc/${id}`)
  await page.locator('.editor-host .ProseMirror').click()
  await page.keyboard.type('NOTIFY-ME ')
  await expect
    .poll(async () => {
      const r = await request.get(`/api/docs/${id}/events?since=0&waitMs=0`)
      const { events } = await r.json()
      return events.map((e: any) => e.kind).join(',')
    })
    .toContain('human-edit')
  const r = await request.get(`/api/docs/${id}/events?since=0&waitMs=0`)
  const { events } = await r.json()
  expect(events.find((e: any) => e.kind === 'human-edit').summary).toContain('NOTIFY-ME')
})

test('selection comment flows to api and agent reply appears in rail', async ({ page, request }) => {
  const { id } = await openDoc(request, '# Doc\n\nselect this phrase please\n')
  await page.goto(`/doc/${id}`)
  const para = page.locator('.editor-host .ProseMirror p', { hasText: 'select this phrase' })
  await para.dblclick() // selects a word
  await expect(page.locator('.comment-bubble')).toBeVisible()
  await page.locator('.comment-bubble').click()
  await page.locator('.comment-compose textarea').fill('make this clearer')
  await page.locator('.compose-actions .restore').click()
  await expect(page.locator('.comment-list li')).toContainText('make this clearer')
  const comments = await (await request.get(`/api/docs/${id}/comments`)).json()
  expect(comments).toHaveLength(1)
  await request.post(`/api/docs/${id}/comments/${comments[0].id}/replies`, {
    data: { body: 'clarified it', author: 'agent' },
  })
  await expect(page.locator('.comment-list li')).toContainText('clarified it')
  await page.locator('.comment-actions .rail-toggle').click() // resolve
  await expect
    .poll(async () => (await (await request.get(`/api/docs/${id}/comments`)).json())[0].resolved)
    .toBe(true)
})

test('agent comment appears in the rail, distinct and answerable', async ({ page, request }) => {
  const { id } = await openDoc(request, '# Doc\n\na paragraph to question\n')
  await request.post(`/api/docs/${id}/comments`, {
    data: { anchorText: 'a paragraph to question', body: 'should this mention pricing?', author: 'agent' },
  })
  await page.goto(`/doc/${id}`)
  const item = page.locator('.comment-list li.from-agent')
  await expect(item).toContainText('should this mention pricing?')
  await item.locator('.comment-actions input').fill('yes, add a pricing line')
  await item.locator('.comment-actions input').press('Enter')
  await expect(item).toContainText('yes, add a pricing line')
  const events = await (await request.get(`/api/docs/${id}/events?since=0&waitMs=0`)).json()
  expect(events.events.map((e: any) => e.kind)).toContain('comment-replied')
})
