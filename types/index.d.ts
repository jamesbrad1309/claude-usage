export type RunStatus = 'running' | 'done' | 'aborted' | 'failed'

/** Token counts summed over a loop's model calls. */
export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type AgentRun = {
  id: string
  parentId?: string
  type: string
  description: string
  model: string
  status: RunStatus
  startedAt: number
  endedAt?: number
  calls: number
  tools: number
  tokens: Tokens
}

/** One model's share of a prompt: main loop and subagents together. */
export type ModelUse = {
  model: string
  /** Model calls made on the main loop and inside subagents. */
  mainCalls: number
  agentCalls: number
  /** The subagents that called it. */
  agentIds: string[]
  tokens: Tokens
}

/** One prompt: the main turn it started and every subagent spawned during it. */
export type PromptRun = {
  turnId: string
  text: string
  status: RunStatus
  startedAt: number
  endedAt?: number
  model: string
  calls: number
  tools: number
  tokens: Tokens
  /** The session's cost (USD) when the prompt started and when it ended. */
  costAtStart: number
  costAtEnd?: number
  agents: AgentRun[]
  /** Every model that worked on the prompt, first used first. */
  models: ModelUse[]
}

/** One of your prompts as the conversation keeps it: what a click scrolls to. */
export type PromptRow = {
  /** The transcript row's id (session.append's uuid, or the drawn row's requestId). */
  id: string
  /** The id the transcript draws the row under, once seen drawn. */
  renderId?: string
  text: string
  /** When you sent it ($.clock.now() ms); absent for a prompt sent before the mod loaded. */
  sentAt?: number
}

/** The last click on a prompt record: whether the conversation scrolled to it. */
export type JumpResult = { rowId: string; isDone: boolean; reason?: string }

export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type SessionFigures = {
  costUsd: number
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  rateLimits: RateLimit[]
}

declare module 'claude-code' {
  interface PluginState {
    'usage-panel': {
      prompts: PromptRun[]
      session: SessionFigures
      rows: PromptRow[]
      jump: JumpResult | null
      isListOpen: boolean
      now: number
    }
  }
}
