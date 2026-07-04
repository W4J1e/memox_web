export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + '_memox_salt_2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function verifyPin(pin, hash) {
  return hashPin(pin).then(h => h === hash)
}
