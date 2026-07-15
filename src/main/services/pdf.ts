/**
 * Generación de PDF con Electron (BrowserWindow.printToPDF sobre HTML).
 * Evita empaquetar Puppeteer/Chromium extra.
 */
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { getPaths } from '../paths'

/** Renderiza un HTML autocontenido a un PDF en exports/ y devuelve la ruta. */
export async function renderHtmlToPdf(html: string, fileName: string): Promise<string> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true }
  })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const data = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    })
    const outPath = join(getPaths().exportsDir, fileName)
    writeFileSync(outPath, data)
    return outPath
  } finally {
    win.destroy()
  }
}
