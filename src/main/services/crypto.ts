/**
 * Cifrado de secretos en reposo (contraseña SMTP).
 * Usa safeStorage de Electron (DPAPI en Windows, ligado a la cuenta del SO).
 * Con fallback a texto plano marcado si safeStorage no está disponible.
 */
import { safeStorage } from 'electron'

export function encryptSecret(plain: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(plain).toString('base64')
    }
  } catch {
    /* noop */
  }
  return 'plain:' + Buffer.from(plain, 'utf8').toString('base64')
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return ''
  if (stored.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    } catch {
      return ''
    }
  }
  if (stored.startsWith('plain:')) {
    return Buffer.from(stored.slice(6), 'base64').toString('utf8')
  }
  return stored
}
