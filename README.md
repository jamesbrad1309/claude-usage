# claude-usage

A Claude Code mod (`usage-panel`) that shows, live, what each of your prompts is using.

- **Usage pane** (opens with the session; `/usage-panel` shows or hides it)
  - **Session:** cost, context window fill, and your 5-hour and 7-day rate limits.
  - **This prompt:** total tokens across the main conversation and every subagent, split into input, output, cache reads and cache writes; each model that worked on it (name and id), with its calls, tokens and whether it ran the main conversation or subagents.
  - **Subagents:** every subagent the prompt started, nested under the one that started it, with model, status, time, calls, tools and tokens.
  - **Prompts in this session:** every prompt you typed, newest first, with its tokens and models. Click one to scroll the conversation to it.
- **Band above the prompt input:** the current prompt's model id, other models used, tokens, elapsed time and cost.

On the desktop app the pane and band are drawn as cards and bars; in a terminal, as text.

## Install

On each machine, at the prompt of a terminal `claude` session:

```
/plugin install usage-panel --marketplace jamesbrad1309/claude-usage
```

Answer `y` to add the marketplace, then pick the **user** scope so every session loads it, the desktop app's included. This repository is private: the machine needs access to it on GitHub (`gh auth login`, or an SSH key).

Update after a change is pushed:

```
claude plugin update usage-panel
```

## Notes

- Costs come from Claude Code's own ledger (what `/cost` shows). A prompt's cost is the change in the session's total while it ran, subagents included. Subagents show tokens, not dollars.
- Figures are per session; nothing is sent anywhere.
- Prompts sent before the mod loaded are listed once the conversation has drawn them.

## Develop

```
claude plugin validate .
claude plugin test .
```

`hooks/register.tsx` keeps the state and draws the terminal views; `hooks/draw.ts` draws the desktop SVGs; `types/index.d.ts` is the state contract; `tests/` holds the behaviour tests.
