import { verifyToken } from '@/lib/auth'

export async function GET(request: Request) {
  const raw = request.headers.get('authorization') ?? ''
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null

  if (!token) {
    return Response.json({ error: 'Token ausente' }, { status: 401 })
  }

  const sub = verifyToken(token)
  if (!sub) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  return Response.json({ valid: true, user: sub }, { status: 200 })
}
