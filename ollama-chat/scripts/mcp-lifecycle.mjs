// Spawns and tears down the ollama-tools MCP server between cycles so each
// cycle starts with a fresh user.gasto_total and an empty intention registry.
// The server speaks Streamable HTTP on /mcp; we wait for the "ollama-tools
// (MCP) on ..." line on stdout before returning.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOLS_DIR = resolve(HERE, '..', '..', 'ollama-tools')
const PORT = 4000
const READY_MARKER = `ollama-tools (MCP) on http://localhost:${PORT}/mcp`
const STARTUP_TIMEOUT_MS = 15_000
const SHUTDOWN_GRACE_MS = 2_000

export function startMcp() {
  const child = spawn('npm', ['start'], {
    cwd: TOOLS_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let ready = false
  let stderrBuf = ''
  const onReady = () => {}
  const readyPromise = new Promise((resolveReady, rejectReady) => {
    const onChunk = (buf) => {
      const s = buf.toString()
      if (!ready && s.includes(READY_MARKER)) {
        ready = true
        resolveReady()
      }
    }
    child.stdout.on('data', onChunk)
    child.stderr.on('data', (b) => {
      stderrBuf += b.toString()
      onChunk(b)
    })
    const killTimer = setTimeout(() => {
      if (!ready) rejectReady(new Error(`mcp startup timed out after ${STARTUP_TIMEOUT_MS}ms\nstderr: ${stderrBuf}`))
    }, STARTUP_TIMEOUT_MS)
    child.once('exit', (code) => {
      clearTimeout(killTimer)
      if (!ready) rejectReady(new Error(`mcp exited before ready (code=${code})\nstderr: ${stderrBuf}`))
    })
  })

  return { child, ready: readyPromise, onReady }
}

export async function stopMcp(child) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  const exited = await Promise.race([
    new Promise((r) => child.once('exit', () => r(true))),
    new Promise((r) => setTimeout(() => r(false), SHUTDOWN_GRACE_MS)),
  ])
  if (!exited) child.kill('SIGKILL')
  // also make sure the port is free in case the child left a zombie
  await waitForPortFree(PORT, 3_000)
}

async function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

function isPortListening(port) {
  return new Promise((res) => {
    import('node:net').then((net) => {
      const sock = new net.Socket()
      let done = false
      const finish = (open) => {
        if (done) return
        done = true
        sock.destroy()
        res(open)
      }
      sock.setTimeout(300)
      sock.once('connect', () => finish(true))
      sock.once('timeout', () => finish(false))
      sock.once('error', () => finish(false))
      sock.connect(port, '127.0.0.1')
    })
  })
}
