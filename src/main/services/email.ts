/**
 * Envío de correos (facturas) con nodemailer sobre SMTP configurable.
 * Credenciales SMTP: usuario/host en settings; contraseña cifrada con safeStorage.
 */
import nodemailer from 'nodemailer'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { get as getSetting } from '../repositories/settingsRepo'
import { decryptSecret } from './crypto'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = getSetting('smtp_host')
  const user = getSetting('smtp_user')
  const passEnc = getSetting('smtp_pass')
  if (!host || !user || !passEnc) return null
  const port = parseInt(getSetting('smtp_port') ?? '587', 10)
  return {
    host,
    port,
    secure: port === 465,
    user,
    pass: decryptSecret(passEnc),
    from: getSetting('smtp_from') ?? user
  }
}

export interface SendResult {
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendInvoiceEmail(
  to: string,
  subject: string,
  bodyText: string,
  pdfPath: string
): Promise<SendResult> {
  const cfg = getSmtpConfig()
  if (!cfg) return { ok: false, error: 'SMTP no configurado. Ve a Ajustes → Correo.' }
  if (!to) return { ok: false, error: 'El cliente no tiene email registrado.' }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    })
    const info = await transporter.sendMail({
      from: cfg.from,
      to,
      subject,
      text: bodyText,
      attachments: [{ filename: basename(pdfPath), content: readFileSync(pdfPath) }]
    })
    return { ok: true, messageId: info.messageId }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al enviar el correo' }
  }
}

/** Verifica la conexión SMTP (botón "Probar" en Ajustes). */
export async function verifySmtp(): Promise<SendResult> {
  const cfg = getSmtpConfig()
  if (!cfg) return { ok: false, error: 'SMTP no configurado.' }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    })
    await transporter.verify()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo conectar al servidor SMTP' }
  }
}
