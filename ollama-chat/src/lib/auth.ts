import jwt, { type JwtPayload } from 'jsonwebtoken'

export const AUTH_SECRET = process.env.AUTH_SECRET ?? 'squad-03-dev-secret'
export const DEMO_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export function createToken(sub: string): string {
  return jwt.sign({ sub }, AUTH_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  })
}

export function verifyToken(token: string | null): string | null {
  if (!token) return null

  try {
    const payload = jwt.verify(token, AUTH_SECRET, { algorithms: ['HS256'] }) as JwtPayload

    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      return null
    }

    return payload.sub
  } catch {
    return null
  }
}
