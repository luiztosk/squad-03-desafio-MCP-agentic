// Drives N shopping cycles against the running ollama-chat app, archiving
// everything under results/<run-id>/. No automatic scoring — the run is
// intended to be judged offline by a human or any LLM the user chooses.
//
// Usage:
//   node run-cycles.mjs                       # run all 30 cycles
//   node run-cycles.mjs --cycles 5            # quick smoke test
//   node run-cycles.mjs --label baseline      # tag the run
//   node run-cycles.mjs --prompt /path/to/file.ts   # override system prompt
//
// The --prompt flag is the way we do "before vs after": point it at the
// real system_prompt.ts for the prompted run, and at the in-file baseline
// prompt (or omit --prompt) for the baseline run.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { runChat } from './driver.mjs'
import { startMcp, stopMcp } from './mcp-lifecycle.mjs'
import { CYCLES, CATALOG_BLOB, SYSTEM_PROMPT as BASELINE_PROMPT } from './cycle-configs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = join(HERE, 'results')
const DEFAULT_PROMPT_FILE = resolve(HERE, '..', 'src', 'app', 'prompts', 'system_prompt.ts')

function parseArgs(argv) {
  const out = { cycles: null, label: null, prompt: null, model: null, port: 4000 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--cycles') out.cycles = Number(argv[++i])
    else if (a === '--label') out.label = argv[++i]
    else if (a === '--prompt') out.prompt = argv[++i]
    else if (a === '--model') out.model = argv[++i]
    else if (a === '--port') out.port = Number(argv[++i])
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node run-cycles.mjs [--cycles N] [--label TAG] [--prompt FILE] [--model NAME]')
      process.exit(0)
    }
  }
  return out
}

async function loadSystemPrompt(filePath) {
  // The system prompt file is a TS module that exports a const string. We
  // import it as ESM via a data URL so we don't need a transpiler.
  const url = new URL('file://' + filePath).href
  const mod = await import(url)
  if (typeof mod.SYSTEM_PROMPT !== 'string') {
    throw new Error(`SYSTEM_PROMPT not found in ${filePath}`)
  }
  return mod.SYSTEM_PROMPT
}

function shortHash(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 8)
}

function buildCycleMessages(systemPrompt, turns) {
  // Conversation scaffold: [system, user("oi"), assistant(catalog), ...turns]
  // The catalog blob is sent in place of having the model render the catalog,
  // so the variable under test is the post-tool format, not catalog rendering.
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: CATALOG_BLOB },
    ...turns,
  ]
}

async function fileExists(p) {
  try { await stat(p); return true } catch { return false }
}

async function main() {
  const args = parseArgs(process.argv)
  const cycles = args.cycles ? CYCLES.slice(0, args.cycles) : CYCLES
  const label = args.label ?? 'run'
  const model = args.model ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:2b'

  // Resolve which system prompt to use. Priority: --prompt flag, then
  // default file location, then baseline frozen in cycle-configs.mjs.
  let systemPrompt
  let promptSource
  if (args.prompt) {
    systemPrompt = await loadSystemPrompt(args.prompt)
    promptSource = args.prompt
  } else if (await fileExists(DEFAULT_PROMPT_FILE)) {
    systemPrompt = await loadSystemPrompt(DEFAULT_PROMPT_FILE)
    promptSource = DEFAULT_PROMPT_FILE
  } else {
    systemPrompt = BASELINE_PROMPT
    promptSource = '(baseline frozen in cycle-configs.mjs)'
  }

  const runId = `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const runDir = join(RESULTS_DIR, runId)
  await mkdir(runDir, { recursive: true })

  const promptHash = shortHash(systemPrompt)
  const manifest = {
    run_id: runId,
    started_at: new Date().toISOString(),
    label,
    model,
    prompt_source: promptSource,
    prompt_hash: promptHash,
    cycle_count: cycles.length,
    cycle_categories: cycles.reduce((acc, c) => { acc[c.category] = (acc[c.category] ?? 0) + 1; return acc }, {}),
  }
  await writeFile(join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`[harness] run=${runId}  model=${model}  prompt=${promptSource}  cycles=${cycles.length}`)
  console.log(`[harness] prompt sha256[0:8]=${promptHash}`)
  console.log(`[harness] results -> ${runDir}`)

  const jsonlLines = []
  let pass = 0
  let fail = 0
  for (const cycle of cycles) {
    process.stdout.write(`[harness] cycle ${String(cycle.cycle_id).padStart(2, '0')}/${cycles.length} (${cycle.category}) ... `)
    let mcp
    let trace
    let mcpErr = null
    try {
      mcp = await startMcp()
      await mcp.ready

      // Build a multi-turn conversation. Each user turn is a separate POST
      // to /api/chat; we accumulate the full message history (including
      // the model's prior responses) between calls so the small model has
      // the context it needs to call the right tool next.
      const history = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: CATALOG_BLOB },
      ]
      const perTurnTraces = []

      for (const turn of cycle.turns) {
        history.push({ role: 'user', content: turn.content })
        const t = await runChat({ messages: history })
        perTurnTraces.push(t)
        // Add the assistant reply (and any prior tool messages are not
        // carried across POSTs since the server is stateless; the small
        // model relies on the conversation context instead).
        history.push({ role: 'assistant', content: t.final_assistant_message || '' })
      }

      // Stitch the per-turn traces into a single record.
      trace = {
        rounds_estimate: perTurnTraces.reduce((a, t) => a + t.rounds_estimate, 0),
        duration_ms: perTurnTraces.reduce((a, t) => a + t.duration_ms, 0),
        done: perTurnTraces.every((t) => t.done),
        tool_calls: perTurnTraces.flatMap((t, i) =>
          t.tool_calls.map((c) => ({ ...c, turn: i + 1 }))
        ),
        errors: perTurnTraces.flatMap((t) => t.errors),
        // The "final" message is the last turn's response. We also keep
        // per-turn responses for the judge to inspect.
        final_assistant_message: perTurnTraces.at(-1)?.final_assistant_message ?? '',
        per_turn_assistant_messages: perTurnTraces.map((t) => t.final_assistant_message),
      }
    } catch (err) {
      mcpErr = String(err)
    } finally {
      if (mcp?.child) await stopMcp(mcp.child)
    }

    if (mcpErr) {
      const rec = { cycle_id: cycle.cycle_id, category: cycle.category, expected_outcome: cycle.expected_outcome, error: mcpErr }
      jsonlLines.push(JSON.stringify(rec))
      fail++
      console.log(`ERROR (${mcpErr.slice(0, 60)}…)`)
      continue
    }

    const rec = {
      cycle_id: cycle.cycle_id,
      category: cycle.category,
      expected_outcome: cycle.expected_outcome,
      request: { turns: cycle.turns },
      trace: {
        rounds_estimate: trace.rounds_estimate,
        duration_ms: trace.duration_ms,
        done: trace.done,
        tool_calls: trace.tool_calls,
        errors: trace.errors,
        per_turn_assistant_messages: trace.per_turn_assistant_messages,
      },
      final_assistant_message: trace.final_assistant_message,
    }
    jsonlLines.push(JSON.stringify(rec))
    if (trace.tool_calls.length > 0 && trace.final_assistant_message) pass++; else fail++
    console.log(`${trace.tool_calls.length} tool call(s) over ${cycle.turns.length} turn(s), ${trace.duration_ms}ms`)
  }

  await writeFile(join(runDir, 'cycles.jsonl'), jsonlLines.join('\n') + '\n')

  // Copy the judge-prompt template in so this dir is self-contained.
  const judgeSrc = join(HERE, 'judge-prompt.md')
  if (existsSync(judgeSrc)) {
    const judgeTxt = await readFile(judgeSrc, 'utf8')
    await writeFile(join(runDir, 'judge-prompt.md'), judgeTxt)
  }

  // Human-friendly summary designed to be pasted into any LLM.
  const summary = renderSummary(manifest, cycles, jsonlLines)
  await writeFile(join(runDir, 'summary.md'), summary)

  console.log(`\n[harness] done. pass=${pass} fail=${fail} / total=${cycles.length}`)
  console.log(`[harness] ${runDir}/summary.md ready to paste into an LLM.`)
}

function renderSummary(manifest, cycles, jsonlLines) {
  const lines = []
  lines.push(`# Run summary — ${manifest.run_id}`)
  lines.push('')
  lines.push(`- **Model:** ${manifest.model}`)
  lines.push(`- **Prompt source:** \`${manifest.prompt_source}\``)
  lines.push(`- **Prompt hash (sha256[0:8]):** \`${manifest.prompt_hash}\``)
  lines.push(`- **Cycles:** ${manifest.cycle_count} (${Object.entries(manifest.cycle_categories).map(([k, v]) => `${k}=${v}`).join(', ')})`)
  lines.push(`- **Started at:** ${manifest.started_at}`)
  lines.push('')
  lines.push('## How to judge this run')
  lines.push('')
  lines.push('Open `judge-prompt.md` in this directory, then paste its contents along with this `summary.md` (or `cycles.jsonl`) into any LLM. The judge prompt will produce a per-cycle pass/fail table on 5 axes plus an overall summary.')
  lines.push('')
  lines.push('## Cycles')
  lines.push('')
  let i = 0
  for (const line of jsonlLines) {
    const rec = JSON.parse(line)
    const cfg = cycles[i++]
    lines.push(`### Cycle ${rec.cycle_id} — ${rec.category} (expect: ${rec.expected_outcome})`)
    lines.push('')
    if (rec.error) {
      lines.push(`**ERROR:** ${rec.error}`)
      lines.push('')
      continue
    }
    const tc = rec.trace.tool_calls ?? []
    lines.push(`- **Tool calls (${tc.length}):**`)
    for (const c of tc) {
      const argStr = JSON.stringify(c.arguments ?? {})
      const res = c.result
      let resShort
      if (res && typeof res === 'object') {
        if (res.status === 'aprovado') resShort = `aprovado (tx=${res.transacao_id}, valor=R$ ${Number(res.valor).toFixed(2)}, limite_rest=R$ ${Number(res.limite_restante).toFixed(2)})`
        else if (res.status === 'recusado') resShort = `recusado (erro=${res.erro})`
        else if (res.intencao_id) resShort = `intencao_id=${res.intencao_id}, status=${res.status}, valor=R$ ${Number(res.valor_total).toFixed(2)}`
        else resShort = JSON.stringify(res).slice(0, 120)
      } else resShort = String(res).slice(0, 120)
      lines.push(`  - turn=${c.turn} \`${c.name}(${argStr})\` → ${resShort}`)
    }
    const perTurn = rec.trace.per_turn_assistant_messages ?? []
    if (perTurn.length > 0) {
      lines.push(`- **Assistant message(s) per turn (${perTurn.length}):**`)
      lines.push('')
      perTurn.forEach((m, i) => {
        lines.push(`  _Turn ${i + 1}_`)
        lines.push('  ```')
        lines.push('  ' + (m || '(empty)').replace(/\n/g, '\n  '))
        lines.push('  ```')
      })
    } else {
      lines.push(`- **Final assistant message:**`)
      lines.push('')
      lines.push('```')
      lines.push((rec.final_assistant_message ?? '').trim() || '(empty)')
      lines.push('```')
    }
    lines.push('')
  }
  return lines.join('\n')
}

main().catch((err) => {
  console.error('[harness] fatal:', err)
  process.exit(1)
})
