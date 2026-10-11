// SVG drawings for the desktop: the pane's cards and rows, and the band above the prompt.
// Pure functions of the mod's state; each returns markup and its height in CSS pixels.
import type { AgentRun, ConversationTotals, ModelUse, PromptRun, RunStatus, SessionFigures, Tokens } from '../types'

// ---- shared ---------------------------------------------------------------------

export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"

// Theme tokens: light by default, dark under the system's dark scheme.
const CSS = `<style>
.fg{fill:#1c1c1b}.mu{fill:#6b6a66}.su{fill:#9a9994}.card{fill:#f7f6f3;stroke:#e7e5e0}.track{fill:#ebe9e4}.ln{stroke:#e7e5e0}
@media (prefers-color-scheme: dark){.fg{fill:#ededeb}.mu{fill:#a9a8a3}.su{fill:#7c7b77}.card{fill:#222221;stroke:#343432}.track{fill:#30302e}.ln{stroke:#343432}}
.live{animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{50%{opacity:.3}}
.crab .la{animation:step .5s steps(1) infinite}.crab .lb{animation:step .5s steps(1) infinite -.25s}
.crab .bd{animation:bob .5s steps(1) infinite -.125s}.crab .cl{animation:wave 1s steps(1) infinite}.crab .cr{animation:wave 1s steps(1) infinite -.5s}
@keyframes step{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}@keyframes wave{50%{transform:translateY(-2px)}}
@media (prefers-reduced-motion: reduce){.live,.crab *{animation:none!important}}
</style>`

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CSS}${body}</svg>`

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// Rough advance of system UI text, in em: enough to decide what fits. Digits are drawn
// tabular (every digit as wide as a 0), bold runs a little wider. Text that sits beside
// other text is never placed by this estimate: it shares one <text> (see spans).
const charEm = (ch: string): number =>
  /\d/.test(ch) ? 0.62 : /[\s.,:;'|!il()[\]]/.test(ch) ? 0.3 : /[A-ZMW@%mw]/.test(ch) ? 0.76 : 0.57

export const textWidth = (s: string, size: number, isMono = false, isBold = false): number =>
  isMono ? s.length * size * 0.6 : [...s].reduce((w, ch) => w + charEm(ch) * size, 0) * (isBold ? 1.07 : 1)

export const fitText = (s: string, size: number, maxW: number, isMono = false): string => {
  const flat = s.replace(/\s+/g, ' ').trim()
  if (textWidth(flat, size, isMono) <= maxW) return flat
  let out = ''
  for (const ch of flat) {
    if (textWidth(out + ch + '…', size, isMono) > maxW) break
    out += ch
  }
  return out + '…'
}

type TextOpts = { size?: number; cls?: string; weight?: number; anchor?: 'start' | 'end' | 'middle'; fill?: string; isMono?: boolean }

const text = (x: number, y: number, s: string, o: TextOpts = {}): string =>
  `<text x="${x}" y="${y}"${o.fill ? ` fill="${o.fill}"` : ` class="${o.cls ?? 'fg'}"`} font-family="${o.isMono ? MONO : FONT}" font-size="${o.size ?? 12}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''} font-variant-numeric="tabular-nums">${xml(s)}</text>`

type Span = { s: string; size?: number; cls?: string; weight?: number; fill?: string; isMono?: boolean; gap?: number }

/**
 * Several styled runs as one <text>: the renderer lays them out end to end, so a label
 * never overlaps the number before it however wide that number draws. `gap` is the space
 * before a run, in pixels.
 */
const spans = (x: number, y: number, runs: Span[], anchor: 'start' | 'end' = 'start'): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-variant-numeric="tabular-nums"${anchor === 'end' ? ' text-anchor="end"' : ''}>` +
  runs
    .map(
      r =>
        `<tspan${r.gap ? ` dx="${r.gap}"` : ''}${r.fill ? ` fill="${r.fill}"` : ` class="${r.cls ?? 'fg'}"`} font-size="${r.size ?? 12}"` +
        `${r.weight ? ` font-weight="${r.weight}"` : ''}${r.isMono ? ` font-family="${MONO}"` : ''}>${xml(r.s)}</tspan>`,
    )
    .join('') +
  '</text>'

// ---- formatting -----------------------------------------------------------------

export const total = (t: Tokens): number => t.input + t.output + t.cacheRead + t.cacheWrite

export const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

export const fmtUsd = (usd: number): string => `$${usd < 1 ? usd.toFixed(3) : usd.toFixed(2)}`

export const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

export const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  if (!m) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  const [, family = '', major = '', minor] = m
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const FAMILY_COLOR: [RegExp, string][] = [
  [/fable|mythos/i, '#C98A2B'],
  [/opus/i, '#7F77DD'],
  [/sonnet/i, '#378ADD'],
  [/haiku/i, '#1D9E75'],
]
export const modelColor = (id: string): string => FAMILY_COLOR.find(([re]) => re.test(id))?.[1] ?? '#888780'

export const STATUS_COLOR: Record<RunStatus, string> = { running: '#3B82F6', done: '#3B9C5F', aborted: '#C9A227', failed: '#D0453F' }

// The four kinds of token, in the order the stacked bar draws them.
export const PARTS: { key: keyof Tokens; label: string; color: string }[] = [
  { key: 'input', label: 'in', color: '#3B82F6' },
  { key: 'output', label: 'out', color: '#F97316' },
  { key: 'cacheRead', label: 'cache read', color: '#14B8A6' },
  { key: 'cacheWrite', label: 'cache write', color: '#A855F7' },
]

const pctColor = (pct: number): string => (pct >= 90 ? '#D0453F' : pct >= 70 ? '#C9A227' : '#3B9C5F')

const LIMIT_NAME: Record<string, string> = { five_hour: '5-hour limit', seven_day: '7-day limit', spend_limit: 'Spend limit' }

// Claude at work: the pixel crab, 24×16 on its grid, scaled to `w` and centred on (cx, cy).
// Its legs step, its body bobs and its claws wave (CSS, so no redraws).
const CLAY = '#D97757'
const INK = '#1F1E1D'
export const crab = (cx: number, cy: number, w = 16): string => {
  const k = w / 24
  const px = (x: number, y: number, pw: number, ph: number, fill: string, cls = '') =>
    `<rect${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${fill}"/>`
  return (
    `<g transform="translate(${cx - w / 2},${cy - 8 * k}) scale(${k})" shape-rendering="crispEdges"><g class="crab">` +
    `<g class="bd">${px(4, 0, 16, 12, CLAY)}${px(6, 3, 2, 2, INK)}${px(16, 3, 2, 2, INK)}</g>` +
    px(0, 4, 4, 4, CLAY, 'cl') +
    px(20, 4, 4, 4, CLAY, 'cr') +
    px(4, 12, 2, 4, CLAY, 'la') +
    px(14, 12, 2, 4, CLAY, 'la') +
    px(8, 12, 2, 4, CLAY, 'lb') +
    px(18, 12, 2, 4, CLAY, 'lb') +
    '</g></g>'
  )
}

// Claude, done: the crab standing still with both claws raised, cheering. 24×20 on
// its grid, scaled to `w` and centred on (cx, cy).
export const crabDone = (cx: number, cy: number, w = 16): string => {
  const k = w / 24
  const px = (x: number, y: number, pw: number, ph: number, fill = CLAY) => `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" fill="${fill}"/>`
  return (
    `<g transform="translate(${cx - w / 2},${cy - 10 * k}) scale(${k})" shape-rendering="crispEdges">` +
    // claws up, on arms reaching from the body's sides
    px(0, 0, 4, 4) + px(1, 4, 2, 4) + px(20, 0, 4, 4) + px(21, 4, 2, 4) +
    px(3, 7, 1, 2) + px(20, 7, 1, 2) +
    px(4, 4, 16, 12) + px(6, 7, 2, 2, INK) + px(16, 7, 2, 2, INK) +
    px(4, 16, 2, 4) + px(8, 16, 2, 4) + px(14, 16, 2, 4) + px(18, 16, 2, 4) +
    '</g>'
  )
}

/** The done crab alone, for a row drawn with text (the prompt list's mark for a finished prompt). */
export const crabDoneIcon = (w = 16): { source: string; width: number; height: number } => {
  const h = Math.ceil((w * 20) / 24) + 2
  return { source: svg(w, h, crabDone(w / 2, h / 2, w)), width: w, height: h }
}

/** The crab alone, for a row drawn with text (the prompt list's dot while a prompt runs). */
export const crabIcon = (w = 16): { source: string; width: number; height: number } => {
  const h = Math.ceil((w * 16) / 24) + 2
  return { source: svg(w, h, crab(w / 2, h / 2, w)), width: w, height: h }
}

const statusMark = (x: number, y: number, status: RunStatus): string => {
  const c = STATUS_COLOR[status]
  if (status === 'running') return crab(x, y, 16)
  if (status === 'done') return `<path d="M${x - 4.5} ${y}l3 3 6-6.5" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'aborted') return `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1.5" fill="${c}"/>`
  return `<path d="M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`
}

// A track with a fill, rounded.
const meter = (x: number, y: number, w: number, h: number, frac: number, color: string): string =>
  `<rect class="track" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` +
  (frac > 0 ? `<rect x="${x}" y="${y}" width="${Math.max(h, Math.round(w * Math.min(1, frac)))}" height="${h}" rx="${h / 2}" fill="${color}"/>` : '')

// A rounded pill with centred white text; returns markup and width.
const pill = (x: number, y: number, label: string, color: string, size = 11): { markup: string; w: number } => {
  const w = Math.round(textWidth(label, size, false, true) + 14)
  const h = size + 7
  return {
    markup: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}"/>${text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight: 600, anchor: 'middle', fill: '#ffffff' })}`,
    w,
  }
}

// ---- pane: session tiles ------------------------------------------------------------

export function sessionTiles(W: number, s: SessionFigures): { source: string; height: number; alt: string } {
  type Tile = { label: string; value: string; sub?: string; pct?: number }
  const ctxPct = s.contextPercent ?? (s.contextTokens && s.contextWindow ? (s.contextTokens / s.contextWindow) * 100 : undefined)
  const tiles: Tile[] = [{ label: 'Session cost', value: fmtUsd(s.costUsd) }]
  if (ctxPct !== undefined) {
    tiles.push({
      label: 'Context',
      value: `${Math.round(ctxPct)}%`,
      sub: s.contextTokens !== undefined ? `${fmtTokens(s.contextTokens)} / ${fmtTokens(s.contextWindow)}` : undefined,
      pct: ctxPct,
    })
  }
  for (const r of s.rateLimits) {
    const resets = r.resetsAt ? new Date(r.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    tiles.push({ label: LIMIT_NAME[r.kind] ?? r.kind, value: `${Math.round(r.percentUsed)}%`, sub: resets && `resets ${resets}`, pct: r.percentUsed })
  }

  const gap = 8
  const cols = Math.min(tiles.length, W >= 560 ? 4 : 2)
  const tw = (W - gap * (cols - 1)) / cols
  const th = 64
  const rows = Math.ceil(tiles.length / cols)
  const body = tiles
    .map((t, i) => {
      const x = (i % cols) * (tw + gap)
      const y = Math.floor(i / cols) * (th + gap)
      return (
        `<rect class="card" x="${x + 0.5}" y="${y + 0.5}" width="${tw - 1}" height="${th - 1}" rx="10"/>` +
        text(x + 12, y + 20, t.label, { size: 11, cls: 'mu' }) +
        text(x + 12, y + 42, t.value, { size: 19, weight: 650 }) +
        (t.sub ? text(x + tw - 12, y + 42, fitText(t.sub, 10.5, tw - 36 - textWidth(t.value, 19, false, true)), { size: 10.5, cls: 'su', anchor: 'end' }) : '') +
        (t.pct !== undefined ? meter(x + 12, y + th - 14, tw - 24, 4, t.pct / 100, pctColor(t.pct)) : '')
      )
    })
    .join('')
  const height = rows * th + (rows - 1) * gap
  return { source: svg(W, height, body), height, alt: tiles.map(t => `${t.label} ${t.value}`).join(', ') }
}

// ---- pane: the current prompt -----------------------------------------------------

export function promptCard(
  W: number,
  p: PromptRun,
  t: Tokens,
  extra: { costUsd: number; elapsedMs: number; calls: number; tools: number; title?: string },
): { source: string; height: number; alt: string } {
  const pad = 14
  const inner = W - pad * 2
  const sum = total(t)
  let y = 0
  const out: string[] = []

  // Status, elapsed and cost.
  y += 22
  out.push(statusMark(pad + 4, y - 4, p.status))
  const title = extra.title ?? (p.status === 'running' ? 'Working on your prompt' : 'Last prompt')
  out.push(text(pad + 16, y, title, { size: 11, cls: 'mu', weight: 500 }))
  out.push(text(W - pad, y, `${fmtTime(extra.elapsedMs)}  ·  ≈${fmtUsd(extra.costUsd)}`, { size: 11, cls: 'mu', anchor: 'end' }))

  // The prompt itself.
  y += 21
  out.push(text(pad, y, fitText(`“${p.text || '(no text)'}”`, 13, inner), { size: 13, weight: 500 }))

  // Big token count, calls and tools.
  y += 38
  const big = fmtTokens(sum)
  out.push(spans(pad, y, [{ s: big, size: 26, weight: 700 }, { s: 'tokens', size: 12, cls: 'mu', gap: 7 }]))
  out.push(text(W - pad, y, `${extra.calls} model calls  ·  ${extra.tools} tool calls`, { size: 11, cls: 'mu', anchor: 'end' }))

  // Stacked composition bar.
  y += 12
  const barH = 10
  out.push(`<defs><clipPath id="bar"><rect x="${pad}" y="${y}" width="${inner}" height="${barH}" rx="${barH / 2}"/></clipPath></defs>`)
  out.push(`<rect class="track" x="${pad}" y="${y}" width="${inner}" height="${barH}" rx="${barH / 2}"/>`)
  if (sum > 0) {
    let x = pad
    const segs = PARTS.map(part => {
      const w = (t[part.key] / sum) * inner
      const seg = w > 0 ? `<rect x="${x}" y="${y}" width="${w + 0.5}" height="${barH}" fill="${part.color}"/>` : ''
      x += w
      return seg
    })
    out.push(`<g clip-path="url(#bar)">${segs.join('')}</g>`)
  }

  // Legend.
  y += barH + 18
  let lx = pad
  for (const part of PARTS) {
    const label = `${part.label} ${fmtTokens(t[part.key])}`
    const w = 14 + textWidth(label, 11) + 14
    if (lx + w > W - pad + 14) break
    out.push(`<rect x="${lx}" y="${y - 8}" width="8" height="8" rx="2" fill="${part.color}"/>`)
    out.push(text(lx + 13, y, label, { size: 11, cls: 'mu' }))
    lx += w
  }

  // Models.
  y += 16
  out.push(`<line class="ln" x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}"/>`)
  y += 22
  out.push(text(pad, y, 'Models', { size: 11, cls: 'mu', weight: 600 }))
  if (p.models.length === 0) {
    y += 22
    out.push(text(pad, y, 'Waiting for the first model call…', { size: 12, cls: 'su' }))
  }
  for (const m of p.models) {
    y += 12
    out.push(modelRow(pad, y, inner, m, sum))
    y += 34
  }
  y += 14

  const height = y
  const card = `<rect class="card" x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="12"/>`
  const alt =
    `${extra.title ?? (p.status === 'running' ? 'Working on' : 'Last prompt')}: ${p.text}. ${fmtTokens(sum)} tokens ` +
    `(${PARTS.map(part => `${part.label} ${fmtTokens(t[part.key])}`).join(', ')}). ` +
    `Models: ${p.models.map(m => `${modelName(m.model)} (${m.model}) ${whereOf(m)} ${fmtTokens(total(m.tokens))}`).join('; ') || 'none yet'}.`
  return { source: svg(W, height, card + out.join('')), height, alt }
}

export const whereOf = (m: ModelUse): string => {
  const n = m.agentIds.length
  return [m.mainCalls ? 'main' : '', n ? `${n} subagent${n === 1 ? '' : 's'}` : ''].filter(Boolean).join(' + ')
}

// One model: colour chip, name, id, where it ran, its share of the prompt's tokens.
const modelRow = (x: number, y: number, w: number, m: ModelUse, promptTotal: number): string => {
  const color = modelColor(m.model)
  const tokens = total(m.tokens)
  const name = modelName(m.model)
  const right = `${fmtTokens(tokens)}  ·  ${m.mainCalls + m.agentCalls} calls`
  const nameW = textWidth(name, 12.5, false, true) + 8
  const rightW = textWidth(right, 11) + 16
  return (
    `<rect x="${x}" y="${y + 1}" width="10" height="10" rx="3" fill="${color}"/>` +
    spans(x + 16, y + 10.5, [
      { s: name, size: 12.5, weight: 600 },
      { s: fitText(m.model, 10.5, w - 16 - nameW - rightW, true), size: 10.5, cls: 'su', isMono: true, gap: 8 },
    ]) +
    text(x + w, y + 10.5, right, { size: 11, cls: 'mu', anchor: 'end' }) +
    meter(x + 16, y + 17, w - 16 - 120, 4, promptTotal ? tokens / promptTotal : 0, color) +
    text(x + w, y + 22, whereOf(m), { size: 10.5, cls: 'su', anchor: 'end' })
  )
}

// ---- pane: subagent and history rows ------------------------------------------------

export function agentRow(W: number, a: AgentRun, depth: number, elapsedMs: number): { source: string; height: number } {
  const H = 46
  const x0 = 6 + depth * 16
  const tokens = fmtTokens(total(a.tokens))
  const right = textWidth(tokens, 13) + 8
  const color = modelColor(a.model)
  const body =
    (depth ? `<path class="ln" d="M${x0 - 10} 6v14h6" fill="none" stroke-width="1.2"/>` : '') +
    statusMark(x0 + 4, 17, a.status) +
    text(x0 + 16, 21, fitText(a.description || a.type, 13, W - x0 - 16 - right), { size: 13, weight: 600 }) +
    text(W - 4, 21, tokens, { size: 13, weight: 650, anchor: 'end' }) +
    `<rect x="${x0 + 16}" y="${29}" width="7" height="7" rx="2" fill="${color}"/>` +
    text(
      x0 + 28,
      36,
      fitText(`${a.type}  ·  ${modelName(a.model)}  ·  ${fmtTime(elapsedMs)}  ·  ${a.calls} calls  ·  ${a.tools} tools`, 11, W - x0 - 32),
      { size: 11, cls: 'mu' },
    ) +
    `<line class="ln" x1="${x0 + 16}" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}"/>`
  return { source: svg(W, H, body), height: H }
}

// ---- band above the prompt ------------------------------------------------------------

/**
 * One line: status, the main model's id (and other models as chips), the prompt's tokens
 * with output beside them, elapsed time and cost; trimmed from the right as space runs out.
 */
export function bandRow(W: number, p: PromptRun, t: Tokens, elapsedMs: number, costUsd: number): { source: string; height: number } {
  const H = 24
  const mid = H / 2
  const parts: string[] = [statusMark(9, mid, p.status)]
  let x = 22

  const mainModel = p.model || p.models[0]?.model || ''
  if (mainModel) {
    const chip = pill(x, mid - 9, modelName(mainModel), modelColor(mainModel))
    parts.push(chip.markup)
    x += chip.w + 6
    const id = fitText(mainModel, 11, Math.max(0, W * 0.32), true)
    parts.push(text(x, mid + 4, id, { size: 11, cls: 'mu', isMono: true }))
    x += textWidth(id, 11, true) + 10
  }

  // Right side, one <text> anchored at the right edge: tokens, then output, time and cost
  // while they fit. Decided by estimate; laid out by the renderer, so nothing overlaps.
  const tokens = fmtTokens(total(t))
  const right: Span[] = [
    { s: tokens, size: 14, weight: 700 },
    { s: 'tokens', size: 11, cls: 'mu', gap: 5 },
  ]
  let rightW = textWidth(tokens, 14, false, true) + 5 + textWidth('tokens', 11)
  for (const extra of [`·  ${fmtTokens(t.output)} out`, `·  ${fmtTime(elapsedMs)}`, `·  ≈${fmtUsd(costUsd)}`]) {
    const w = 10 + textWidth(extra, 11)
    if (x + rightW + w + 24 > W) break
    right.push({ s: extra, size: 11, cls: 'su', gap: 10 })
    rightW += w
  }

  // Subagents' models, as small chips, while there is room before the right side.
  for (const m of p.models.filter(one => one.model !== mainModel)) {
    const label = `+ ${modelName(m.model)}`
    const w = textWidth(label, 10, false, true) + 14
    if (x + w + 24 > W - rightW) break
    const chip = pill(x, mid - 8, label, modelColor(m.model), 10)
    parts.push(chip.markup)
    x += chip.w + 4
  }
  parts.push(spans(W - 2, mid + 5, right, 'end'))

  return { source: svg(W, H, parts.join('')), height: H }
}

// ---- pane: a prompt record's last line ---------------------------------------------------

/**
 * The third line of a prompt record, in the token counter's style: when it finished (or how
 * long it has run), a pill per model, and the count, bold, at the right. Without a run: a note
 * that it has no figures.
 */
export function recordMeta(W: number, p: PromptRun | undefined, t: Tokens | undefined, done: string): { source: string; height: number; alt: string } {
  const H = 18
  const mid = H / 2
  if (!p || !t) {
    const note = 'No figures: sent before the panel was watching'
    return { source: svg(W, H, text(0, mid + 4, note, { size: 11, cls: 'su' })), height: H, alt: note }
  }
  const sum = total(t)
  const parts: string[] = [text(0, mid + 4, done, { size: 11, fill: STATUS_COLOR[p.status], weight: 500 })]
  let x = textWidth(done, 11, false, true) + 10

  // The count at the right edge, laid out with its label by the renderer.
  const count = sum > 0 ? fmtTokens(sum) : '0'
  const countW = textWidth(count, 12.5, false, true) + 5 + textWidth('tokens', 10.5)
  parts.push(spans(W, mid + 4.5, [{ s: count, size: 12.5, weight: 700 }, { s: 'tokens', size: 10.5, cls: 'mu', gap: 5 }], 'end'))
  const right = W - countW - 10

  for (const m of p.models) {
    const label = modelName(m.model)
    const w = textWidth(label, 10, false, true) + 14
    if (x + w > right) break
    parts.push(pill(x, mid - 8, label, modelColor(m.model), 10).markup)
    x += w + 4
  }

  const alt = `${done} · ${p.models.map(m => modelName(m.model)).join(', ') || 'no model yet'} · ${count} tokens`
  return { source: svg(W, H, parts.join('')), height: H, alt }
}

// ---- pane: the whole conversation -------------------------------------------------------

/**
 * The conversation so far, in the token counter's style: tiles for prompts sent, model calls,
 * tool calls and tokens, then the tokens split by kind in one bar with its legend.
 */
export function conversationCard(W: number, prompts: number, c: ConversationTotals): { source: string; height: number; alt: string } {
  const pad = 14
  const inner = W - pad * 2
  const sum = total(c.tokens)
  const out: string[] = []
  let y = 22
  out.push(text(pad, y, 'This conversation', { size: 11, cls: 'mu', weight: 500 }))

  const tiles = [
    { label: 'Prompts sent', value: String(prompts) },
    { label: 'Model calls', value: String(c.modelCalls) },
    { label: 'Tool calls', value: String(c.toolCalls) },
    { label: 'Tokens', value: fmtTokens(sum) },
  ]
  const gap = 8
  const cols = W >= 480 ? 4 : 2
  const tw = (inner - gap * (cols - 1)) / cols
  const th = 50
  y += 10
  tiles.forEach((t, i) => {
    const x = pad + (i % cols) * (tw + gap)
    const ty = y + Math.floor(i / cols) * (th + gap)
    out.push(`<rect class="track" x="${x}" y="${ty}" width="${tw}" height="${th}" rx="8" opacity="0.55"/>`)
    out.push(text(x + 10, ty + 18, t.label, { size: 10.5, cls: 'mu' }))
    out.push(text(x + 10, ty + 40, t.value, { size: 18, weight: 700 }))
  })
  y += Math.ceil(tiles.length / cols) * (th + gap) + 4

  // Tokens by kind.
  const barH = 8
  out.push(`<defs><clipPath id="conv"><rect x="${pad}" y="${y}" width="${inner}" height="${barH}" rx="${barH / 2}"/></clipPath></defs>`)
  out.push(`<rect class="track" x="${pad}" y="${y}" width="${inner}" height="${barH}" rx="${barH / 2}"/>`)
  if (sum > 0) {
    let x = pad
    const segs = PARTS.map(part => {
      const w = (c.tokens[part.key] / sum) * inner
      const seg = w > 0 ? `<rect x="${x}" y="${y}" width="${w + 0.5}" height="${barH}" fill="${part.color}"/>` : ''
      x += w
      return seg
    })
    out.push(`<g clip-path="url(#conv)">${segs.join('')}</g>`)
  }
  y += barH + 18
  let lx = pad
  for (const part of PARTS) {
    const label = `${part.label} ${fmtTokens(c.tokens[part.key])}`
    const w = 14 + textWidth(label, 11) + 16
    // Out of room: the legend goes on to a second line.
    if (lx > pad && lx + w > W - pad + 16) {
      lx = pad
      y += 18
    }
    out.push(`<rect x="${lx}" y="${y - 8}" width="8" height="8" rx="2" fill="${part.color}"/>`)
    out.push(text(lx + 13, y, label, { size: 11, cls: 'mu' }))
    lx += w
  }
  y += 16

  const height = y
  const card = `<rect class="card" x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="12"/>`
  const alt =
    `This conversation: ${prompts} prompt${prompts === 1 ? '' : 's'} sent, ${c.modelCalls} model call${c.modelCalls === 1 ? '' : 's'}, ` +
    `${c.toolCalls} tool call${c.toolCalls === 1 ? '' : 's'}, ${fmtTokens(sum)} tokens ` +
    `(${PARTS.map(part => `${part.label} ${fmtTokens(c.tokens[part.key])}`).join(', ')})`
  return { source: svg(W, height, card + out.join('')), height, alt }
}
