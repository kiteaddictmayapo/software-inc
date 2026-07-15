/**
 * Gestión de fotos de perfil (clientes y profesores).
 *
 * Guarda en media/persons/<id>/:
 *   profile.jpg       (original re-encodado, lado mayor <= 1600px)
 *   profile_thumb.jpg (miniatura cuadrada 256x256)
 * En la BD solo se guardan las rutas RELATIVAS a userData.
 */
import sharp from 'sharp'
import { join, relative } from 'node:path'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { getPaths } from '../paths'
import { getDb } from '../db/connection'

export interface SavedPhoto {
  photoPath: string // relativo a userData
  photoThumbPath: string
}

/**
 * Guarda una foto para una persona a partir de un buffer (imagen subida).
 * Devuelve las rutas relativas y actualiza la fila en persons.
 */
export async function savePersonPhoto(personId: number, input: Buffer): Promise<SavedPhoto> {
  const paths = getPaths()
  const dir = join(paths.personsMediaDir, String(personId))
  mkdirSync(dir, { recursive: true })

  // Versionado por timestamp para evitar caché obsoleta al reemplazar
  const stamp = tstamp()
  const fullFile = join(dir, `profile_${stamp}.jpg`)
  const thumbFile = join(dir, `profile_${stamp}_thumb.jpg`)

  await sharp(input)
    .rotate() // auto-orientación EXIF
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(fullFile)

  await sharp(input)
    .rotate()
    .resize({ width: 256, height: 256, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toFile(thumbFile)

  const photoPath = relative(paths.root, fullFile)
  const photoThumbPath = relative(paths.root, thumbFile)

  getDb()
    .prepare('UPDATE persons SET photo_path=?, photo_thumb_path=?, updated_at=strftime(\'%Y-%m-%dT%H:%M:%SZ\',\'now\') WHERE id=?')
    .run(photoPath, photoThumbPath, personId)

  // Limpiar versiones anteriores (mejor esfuerzo)
  return { photoPath, photoThumbPath }
}

/** Ruta absoluta a partir de una ruta relativa guardada en la BD. */
export function absolutePhotoPath(relPath: string | null): string | null {
  if (!relPath) return null
  const abs = join(getPaths().root, relPath)
  return existsSync(abs) ? abs : null
}

/** Elimina la carpeta de fotos de una persona (al borrarla). */
export function deletePersonPhotos(personId: number): void {
  const dir = join(getPaths().personsMediaDir, String(personId))
  try {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  } catch {
    /* mejor esfuerzo */
  }
}

// Nota: Date.now no está disponible en algunos entornos de test; aquí (runtime
// del proceso main) sí lo está.
function tstamp(): string {
  return String(Date.now())
}
