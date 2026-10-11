import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = { plugin: 'usage-panel', component: 'Pane', requestId: 'usage-panel' } as const
const paneProps = { title: 'Usage', isFocused: false, bodyColumns: 100, placement: 'dock' } as never
const BAND = { plugin: 'usage-panel', component: 'AbovePrompt', requestId: 'above-prompt' } as const
const bandProps = { hasSurvey: false, isWorking: true, maxRows: 3, bodyColumns: 120 } as never
const COMPOSER = { kind: 'composer' } as const

// The engine's answers beneath the plugin: a main loop on Opus, subagents on Haiku.
function engine(on: On) {
  mock.clock(on)
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async () => ({ text: '' }))
  on('agent.spawn', async (_$, e) => ({ model: 'claude-haiku-5-5', agentId: e.description === 'Find files' ? 'a1' : 'a2' }))
  on('turn.step', async function* (_$, e) {
    const isAgent = Boolean(e.agentId)
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        model: isAgent ? 'claude-haiku-5-5' : 'claude-opus-5-5',
        input_tokens: isAgent ? 100 : 1000,
        output_tokens: isAgent ? 50 : 500,
        cache_read_input_tokens: isAgent ? 0 : 20000,
        cache_creation_input_tokens: 0,
      },
    } as never
  })
}

type Found = { key?: string; props: Record<string, unknown> }
// An Svg carries no key: it is found by what its alt text says.
const svgProps = async (ui: { findAll: (q: object) => Promise<Found[]> }, alt: RegExp) =>
  (await ui.findAll({ type: 'Svg' })).map(x => x.props as { alt: string; source: string }).find(p => alt.test(p.alt))

test('a prompt lists the subagents it started, nested, with their status', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'Plan the AWS deploy', turnId: 't1' })
  await $.agent.spawn({ tool_use_id: 'u1', prompt: 'p', description: 'Find files', subagentType: 'Explore' } as never)
  await $.agent.spawn({ tool_use_id: 'u2', prompt: 'p', description: 'Check prices', subagentType: 'general-purpose', parentAgentId: 'a1' } as never)
  await $.turn.complete({ turnId: 'r1', agentId: 'a2', reason: 'answer', isAborted: false, answer: '' } as never)

  const term = await $.ui.mount({ ...PANE, surface: 'terminal', props: paneProps })
  expect(await term.find({ type: 'Text', text: /Plan the AWS deploy/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /Subagents · 2/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /Find files/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /Check prices/ })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ ...PANE, surface: 'desktop', props: paneProps })
  expect(await desk.find({ type: 'Text', text: /Subagents · 2 \(1 running\)/ })).toBeDefined()
  expect(await svgProps(desk, /^Find files: Explore, Haiku 5\.5, running/)).toBeDefined()
  expect(await svgProps(desk, /^Check prices: general-purpose, Haiku 5\.5, done/)).toBeDefined()
  expect(await svgProps(desk, /^Working on: Plan the AWS deploy/)).toBeDefined()
  await desk.unmount()
})

test('the prompt totals tokens over the main loop and its subagents, by model', async ($, on) => {
  engine(on)
  const step = async (e: object) => {
    for await (const _ of $.turn.step({ messageCount: 1, ...e } as never)) void _
  }
  await $.session.append({ uuid: 'u1', door: 'prompt', origin: COMPOSER, message: { type: 'user', role: 'user', content: [{ type: 'text', text: 'Count my tokens' }] } } as never)
  await $.turn.start({ text: 'Count my tokens', turnId: 't1' })
  await step({ turnId: 't1', index: 0, model: 'claude-opus-5-5' })
  await $.agent.spawn({ tool_use_id: 'u1', prompt: 'p', description: 'Find files', subagentType: 'Explore' } as never)
  await step({ turnId: 'r1', index: 0, model: 'claude-haiku-5-5', agentId: 'a1' })
  await step({ turnId: 'r1', index: 1, model: 'claude-haiku-5-5', agentId: 'a1' })

  // 21,500 on main + 2 × 150 in the subagent
  const term = await $.ui.mount({ ...PANE, surface: 'terminal', props: paneProps })
  expect(await term.find({ type: 'Text', text: /Tokens 22k/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /Opus 5\.5 claude-opus-5-5 · main · 1 calls · 22k tok/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /Haiku 5\.5 claude-haiku-5-5 · 1 subagent · 2 calls · 300 tok/ })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ ...PANE, surface: 'desktop', props: paneProps })
  const card = await svgProps(desk, /^Working on: Count my tokens/)
  expect(card?.alt).toMatch(/22k tokens \(in 1k, out 600, cache read 20k, cache write 0\)/)
  expect(card?.alt).toMatch(/Opus 5\.5 \(claude-opus-5-5\) main 22k; Haiku 5\.5 \(claude-haiku-5-5\) 1 subagent 300/)
  expect(card?.source).toMatch(/^<svg /)
  // The count and its label share one <text>, so a wide number never runs into "tokens".
  expect(card?.source).toMatch(/<text [^>]*><tspan [^>]*>22k<\/tspan><tspan dx="7"[^>]*>tokens<\/tspan><\/text>/)
  // Its record's last line: status, each model, the prompt's tokens.
  const record = await desk.find({ type: 'Button', key: 'jump:u1' })
  expect(record?.text).toMatch(/\nCount my tokens\nRunning 0s  ·  ● Opus 5\.5  ·  ● Haiku 5\.5  ·  22k tokens$/)
  await desk.unmount()
})

test('the band above the prompt shows the prompt’s tokens and model id', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'Count my tokens', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 } as never)) void _

  const term = await $.ui.mount({ ...BAND, surface: 'terminal', props: bandProps })
  expect(await term.find({ type: 'Text', text: /claude-opus-5-5/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /22k tokens/ })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop', props: bandProps })
  const band = await svgProps(desk, /claude-opus-5-5/)
  expect(band?.alt).toMatch(/^claude-opus-5-5: 22k tokens \(500 out\)/)
  expect(band?.source).toMatch(/claude-opus-5-5/)
  expect(band?.source).toMatch(/<text [^>]*text-anchor="end"><tspan [^>]*>22k<\/tspan><tspan dx="5"[^>]*>tokens<\/tspan>/)
  expect(await desk.find({ type: 'Button', key: 'usage-open' })).toBeDefined()
  await desk.unmount()
})

test('every prompt of the session is listed once, newest first, with when it was sent and done', async ($, on) => {
  const clock = mock.clock(on)
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async () => ({ text: '' }))
  // The engine's own drawing of a conversation row.
  on('ui.render', { component: 'UserMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, {}, e.props.text)
  })
  const append = (uuid: string, text: string, origin: object = COMPOSER) =>
    $.session.append({ uuid, door: 'prompt', origin, message: { type: 'user', role: 'user', content: [{ type: 'text', text }] } } as never)

  await append('u1', 'First prompt')
  await $.turn.start({ text: 'First prompt', turnId: 't1' })
  await clock.advance(65_000)
  await $.turn.complete({ turnId: 't1', reason: 'answer', isAborted: false, answer: '' } as never)
  await append('u2', 'Second prompt')
  // A notification is not one of your prompts.
  await append('n1', 'agent done', { kind: 'task-notification' })

  // Your prompt's row is drawn inside a Box of the mod's, unchanged, so the list can scroll to it.
  const row = await $.ui.mount({
    plugin: 'usage-panel',
    surface: 'desktop',
    component: 'UserMessage',
    requestId: 'u1',
    props: { text: 'First prompt', origin: COMPOSER, isExpanded: false } as never,
  })
  const drawnRow = (await row.drawn()) as { type: string; props: { key?: string }; children: { type: string }[] }
  expect(drawnRow.type).toBe('Box')
  expect(drawnRow.props.key).toBe('usage-panel:prompt:u1')
  expect(drawnRow.children[0]?.type).toBe('Text')
  await row.unmount()
  // A prompt from before the mod loaded: known only from its drawn row.
  const old = await $.ui.mount({
    plugin: 'usage-panel',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: 'm0',
    props: { text: 'Prompt from before', origin: COMPOSER, isExpanded: false } as never,
  })
  await old.unmount()
  // Drawn rows are saved on the next event (or the ticker): here, the next prompt's turn.
  await $.turn.start({ text: 'Second prompt', turnId: 't2' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: paneProps })
  expect(await ui.find({ type: 'Button', text: /Prompts in this session · 3/ })).toBeDefined()
  const records = (await ui.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('jump:'))
  // Newest first, three lines each: index and sent time; the prompt; done time, models, tokens.
  expect(records.map(b => b.key)).toEqual(['jump:u2', 'jump:u1', 'jump:m0'])
  expect(records[0]?.text).toMatch(/^#3  ·  Sent \d\d:\d\d:\d\d\nSecond prompt\nRunning 0s  ·  no tokens yet$/)
  expect(records[1]?.text).toMatch(/^#2  ·  Sent \d\d:\d\d:\d\d\nFirst prompt\nDone \d\d:\d\d:\d\d \(1m 05s\)  ·  no tokens yet$/)
  expect(records[2]?.text).toBe('#1  ·  Sent before the panel was watching\nPrompt from before\nNo figures: sent before the panel was watching')
  // A timeline: each record beside a rail, a status-coloured dot on its first line and a line
  // down to the next record; the oldest is its dot alone.
  const rails = (await ui.findAll({ type: 'Box' })).filter(b => b.key?.startsWith('rail:'))
  expect(rails.map(r => r.key)).toEqual(['rail:u2', 'rail:u1', 'rail:m0'])
  expect(rails.map(r => r.text)).toEqual(['◉│││', '●│││', '●'])
  // Dots by status: running, done, and no figures.
  const dots = (await ui.findAll({ type: 'Text' })).filter(x => x.text === '◉' || x.text === '●')
  expect(dots.map(d => d.props.color)).toEqual(['suggestion', 'success', 'inactive'])
  // The test kit has no conversation to scroll: the pane says so instead of doing nothing.
  await ui.press({ key: 'jump:u1' })
  expect(await ui.find({ type: 'Text', text: /^Couldn't scroll to that prompt: / })).toBeDefined()
  await ui.unmount()
})
