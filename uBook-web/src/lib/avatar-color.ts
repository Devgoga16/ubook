/**
 * Paleta para profesionales y clientes. Tonos del prototipo oscurecidos para
 * que las iniciales en blanco tengan contraste ≥ 4.5:1.
 */
export const AVATAR_COLORS = ['#575B9F', '#2F7C8C', '#4A6FA5', '#6A5FA8', '#3B6F8F', '#7B4F96', '#45579C', '#2A6F7F']

/** Color estable a partir del nombre. */
export function colorFor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}
