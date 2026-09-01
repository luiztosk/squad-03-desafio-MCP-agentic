# Shopping-cycle test harness

End-to-end harness for `ollama-chat` that drives the model through N
shopping cycles and writes a self-contained archive per run. **No
automatic scoring** — the run is meant to be judged offline by a human
or any LLM the user picks.

## How to run

Prereqs: `ollama-tools` MCP server build is current, `ollama-chat` is
running on `:3000`, Ollama has the model you want to test.

```bash
# all 30 cycles against whatever prompt is on disk
node scripts/run-cycles.mjs

# quick smoke (3 cycles)
node scripts/run-cycles.mjs --cycles 3

# baseline run (uses the in-file frozen prompt, ignores disk)
node scripts/run-cycles.mjs --label baseline

# prompted run against the prompt on disk
node scripts/run-cycles.mjs --label prompted

# use a specific model
node scripts/run-cycles.mjs --model qwen3.5:2b
```

Each run lands in `scripts/results/<label>-<timestamp>/` with:
- `manifest.json` — env, model, prompt hash, cycle count
- `cycles.jsonl` — one line per cycle, full tool-call trace + final message
- `summary.md` — human-friendly index, designed to paste into any LLM
- `judge-prompt.md` — copy of the judging rubric so the dir is self-contained

## How to judge

1. Open `summary.md` in your editor.
2. Open `judge-prompt.md` in another tab.
3. In opencode (or ChatGPT, Claude, etc.), paste the contents of
   `judge-prompt.md` as instructions, then attach `summary.md` (or
   `cycles.jsonl`) and ask it to evaluate.
4. The LLM returns a per-cycle table on 5 axes plus an overall pass rate.

## How "before/after" works

```bash
# 1) capture the current behavior (uses the in-file baseline prompt)
node scripts/run-cycles.mjs --label baseline

# 2) edit src/app/prompts/system_prompt.ts (and optionally server.ts)

# 3) re-run; the harness will pick up the new prompt from disk
node scripts/run-cycles.mjs --label prompted

# 4) judge both summary.md files, compare pass rates
```

`--prompt <file>` lets you point at any TS file that exports
`SYSTEM_PROMPT`, which is useful for A/B testing alternative prompts.
