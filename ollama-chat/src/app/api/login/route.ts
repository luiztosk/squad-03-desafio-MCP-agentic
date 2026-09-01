const LOGIN_USERNAME = process.env.LOGIN_USERNAME ?? 'demo'
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD ?? 'demo'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string }
    const { username, password } = body

    if (!username || !password) {
      return Response.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    if (username !== LOGIN_USERNAME || password !== LOGIN_PASSWORD) {
      return Response.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const { createToken, DEMO_USER_ID } = await import('@/lib/auth')
    const token = createToken(DEMO_USER_ID)

    return Response.json({ token }, { status: 200 })
  } catch {
    return Response.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }
}
