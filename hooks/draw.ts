// SVG drawings for the desktop: the pane's cards and rows, and the band above the prompt.
// Pure functions of the mod's state; each returns markup and its height in CSS pixels.
import type { AgentRun, ModelUse, PromptRun, RunStatus, SessionFigures, Tokens } from '../types'

// ---- shared ---------------------------------------------------------------------

export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"

// Theme tokens: light by default, dark under the system's dark scheme.
const CSS = `<style>
.fg{fill:#1c1c1b}.mu{fill:#6b6a66}.su{fill:#9a9994}.card{fill:#f7f6f3;stroke:#e7e5e0}.track{fill:#ebe9e4}.ln{stroke:#e7e5e0}
@media (prefers-color-scheme: dark){.fg{fill:#ededeb}.mu{fill:#a9a8a3}.su{fill:#7c7b77}.card{fill:#222221;stroke:#343432}.track{fill:#30302e}.ln{stroke:#343432}}
.live{animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CSS}${body}</svg>`

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// Rough advance of system UI text, in em: enough to fit and align labels.
const charEm = (ch: string): number =>
  /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZMW@%mw]/.test(ch) ? 0.72 : 0.56

export const textWidth = (s: string, size: number, isMono = false): number =>
  isMono ? s.length * size * 0.6 : [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

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

const statusMark = (x: number, y: number, status: RunStatus): string => {
  const c = STATUS_COLOR[status]
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="4" fill="${c}"/>`
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
  const w = Math.round(textWidth(label, size) + 14)
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
        (t.sub ? text(x + tw - 12, y + 42, fitText(t.sub, 10.5, tw - 24 - textWidth(t.value, 19)), { size: 10.5, cls: 'su', anchor: 'end' }) : '') +
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
  extra: { costUsd: number; elapsedMs: number; calls: number; tools: number },
): { source: string; height: number; alt: string } {
  const pad = 14
  const inner = W - pad * 2
  const sum = total(t)
  let y = 0
  const out: string[] = []

  // Status, elapsed and cost.
  y += 22
  out.push(statusMark(pad + 4, y - 4, p.status))
  out.push(text(pad + 16, y, p.status === 'running' ? 'Working on your prompt' : 'Last prompt', { size: 11, cls: 'mu', weight: 500 }))
  out.push(text(W - pad, y, `${fmtTime(extra.elapsedMs)}  ·  ≈${fmtUsd(extra.costUsd)}`, { size: 11, cls: 'mu', anchor: 'end' }))

  // The prompt itself.
  y += 21
  out.push(text(pad, y, fitText(`“${p.text || '(no text)'}”`, 13, inner), { size: 13, weight: 500 }))

  // Big token count, calls and tools.
  y += 38
  const big = fmtTokens(sum)
  out.push(text(pad, y, big, { size: 26, weight: 700 }))
  out.push(text(pad + textWidth(big, 26) + 6, y, 'tokens', { size: 12, cls: 'mu' }))
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
    `${p.status === 'running' ? 'Working on' : 'Last prompt'}: ${p.text}. ${fmtTokens(sum)} tokens ` +
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
  const nameW = textWidth(name, 12.5) + 8
  const rightW = textWidth(right, 11) + 12
  return (
    `<rect x="${x}" y="${y + 1}" width="10" height="10" rx="3" fill="${color}"/>` +
    text(x + 16, y + 10.5, name, { size: 12.5, weight: 600 }) +
    text(x + 16 + nameW, y + 10.5, fitText(m.model, 10.5, w - 16 - nameW - rightW, true), { size: 10.5, cls: 'su', isMono: true }) +
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
  const parts: string[] = [statusMark(6, mid, p.status)]
  let x = 18

  const mainModel = p.model || p.models[0]?.model || ''
  if (mainModel) {
    const chip = pill(x, mid - 9, modelName(mainModel), modelColor(mainModel))
    parts.push(chip.markup)
    x += chip.w + 6
    const id = fitText(mainModel, 11, Math.max(0, W * 0.32), true)
    parts.push(text(x, mid + 4, id, { size: 11, cls: 'mu', isMono: true }))
    x += textWidth(id, 11, true) + 10
  }

  // Subagents' models, as small chips, while there is room.
  const others = p.models.filter(m => m.model !== mainModel)
  const stats = `${fmtTime(elapsedMs)}  ·  ≈${fmtUsd(costUsd)}`
  const tokens = fmtTokens(total(t))
  const tokensW = textWidth(tokens, 14) + textWidth(' tokens', 11) + 4
  const outText = `${fmtTokens(t.output)} out`
  const reserve = tokensW + textWidth(outText, 11) + 14 + textWidth(stats, 11) + 18
  for (const m of others) {
    const label = `+ ${modelName(m.model)}`
    const w = textWidth(label, 10) + 14
    if (x + w > W - reserve) break
    const chip = pill(x, mid - 8, label, modelColor(m.model), 10)
    parts.push(chip.markup)
    x += chip.w + 4
  }

  // Right side: tokens, output, time and cost.
  let rx = W - 2
  if (W - x > reserve) {
    parts.push(text(rx, mid + 4, stats, { size: 11, cls: 'su', anchor: 'end' }))
    rx -= textWidth(stats, 11) + 14
  }
  if (rx - x > tokensW + textWidth(outText, 11) + 10) {
    parts.push(text(rx, mid + 4, outText, { size: 11, cls: 'mu', anchor: 'end' }))
    rx -= textWidth(outText, 11) + 8
  }
  parts.push(text(rx, mid + 4, 'tokens', { size: 11, cls: 'mu', anchor: 'end' }))
  rx -= textWidth('tokens', 11) + 4
  parts.push(text(rx, mid + 5, tokens, { size: 14, weight: 700, anchor: 'end' }))

  return { source: svg(W, H, parts.join('')), height: H }
}
