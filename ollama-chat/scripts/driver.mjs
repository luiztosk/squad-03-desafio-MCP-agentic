// HTTP client to /api/chat. The endpoint streams NDJSON, one JSON object per
// line. We collect tool calls and the final assistant message and return them
// as a structured trace.

const CHAT_URL = process.env.CHAT_URL ?? 'http://localhost:3000/api/chat'
const ROUND_TIMEOUT_MS = 120_000 // a single round can take a while for cold models

export async function runChat({ messages, tools = null, signal }) {
  const t0 = Date.now()
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`chat ${res.status}: ${text.slice(0, 200)}`)
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  const toolCalls = []
  const finalParts = []
  const errors = []
  let rounds = 0
  let done = false

  // Wrap the read loop with a per-round timeout that resets whenever we get
  // a chunk. If no chunk for ROUND_TIMEOUT_MS, abort.
  for (;;) {
    const readPromise = reader.read()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`chat stalled for ${ROUND_TIMEOUT_MS}ms`)), ROUND_TIMEOUT_MS)
    )
    let next
    try {
      next = await Promise.race([readPromise, timeoutPromise])
    } catch (err) {
      errors.push(String(err))
      break
    }
    const { value, done: streamDone } = next
    if (streamDone) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let evt
      try { evt = JSON.parse(line) } catch { continue }
      if (evt.error) { errors.push(String(evt.error)); continue }
      if (evt.tool) {
        toolCalls.push({ ...evt.tool, received_at_ms: Date.now() - t0 })
        rounds = Math.max(rounds, toolCalls.length)
      }
      if (evt.message?.content) finalParts.push(evt.message.content)
      if (evt.done) done = true
    }
  }

  return {
    tool_calls: toolCalls,
    final_assistant_message: finalParts.join(''),
    rounds_estimate: toolCalls.length,
    done,
    errors,
    duration_ms: Date.now() - t0,
  }
}
