import { supabase } from './supabase'

const BUCKET = 'listing-photos'
export const MAX_PHOTOS = 6
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB — generous for phone photos, keeps free-tier storage/bandwidth in check

export function validatePhotoFiles(files: File[]): string | null {
  if (files.length > MAX_PHOTOS) {
    return `You can upload up to ${MAX_PHOTOS} photos.`
  }
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      return `"${f.name}" isn't an image file.`
    }
    if (f.size > MAX_FILE_BYTES) {
      return `"${f.name}" is over 5MB — try a smaller photo.`
    }
  }
  return null
}

// Uploads each file under {ownerId}/{listingId}/{index}-{filename} and returns their
// public URLs. Storage RLS (see supabase/image_upload_schema.sql) only allows a user to
// write into a folder that starts with their own auth.uid(), so ownerId here must match
// the currently logged-in user or the upload will be rejected server-side.
//
// startIndex matters when adding MORE photos to a listing that already has some (from
// the edit-listing page) — since uploads use upsert:true, indices always starting back
// at 0 would silently overwrite the existing photo at that same index instead of
// adding a new one. Sell.tsx (posting a brand-new listing) doesn't pass this, so it
// keeps its original default-to-0 behavior.
export async function uploadListingPhotos(
  ownerId: string,
  listingId: string,
  files: File[],
  startIndex = 0,
): Promise<string[]> {
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${ownerId}/${listingId}/${startIndex + i}-${safeName}`

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      // Explicit, rather than left to be inferred server-side -- needed so a photo
      // fetched back later (e.g. to re-open it in the crop/rotate editor) reports
      // the right blob.type instead of a generic fallback.
      contentType: file.type || 'image/jpeg',
    })
    if (error) throw error

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    urls.push(data.publicUrl)
  }

  return urls
}

export async function deleteListingPhotos(ownerId: string, listingId: string): Promise<void> {
  // Storage has no "delete by prefix" — list the folder first, then remove each file by path.
  const prefix = `${ownerId}/${listingId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix)
  if (error || !data || data.length === 0) return

  const paths = data.map((f) => `${prefix}/${f.name}`)
  await supabase.storage.from(BUCKET).remove(paths)
}

// Removes a single photo from an existing listing (used by the edit-listing page's
// per-photo remove button — deleteListingPhotos above clears an entire listing's
// folder, which is too broad for removing just one). Supabase's public URL always
// contains `/object/public/{bucket}/{path}` — everything after the bucket name is
// exactly the storage path we uploaded it under, so no need to track paths
// separately from the URLs already stored on the listing.
export async function deleteListingPhotoByUrl(url: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return // not a URL from our own bucket — nothing to do
  const path = decodeURIComponent(url.slice(idx + marker.length))
  await supabase.storage.from(BUCKET).remove([path])
}

// --- Video (feature/mandatory-video) ---------------------------------------------

const VIDEO_BUCKET = 'listing-videos'
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB — a 30-60s phone video comfortably fits
const MAX_VIDEO_SECONDS = 60 // "show the product," not a full walkthrough film

export function validateVideoFile(file: File): string | null {
  if (!file.type.startsWith('video/')) {
    return `"${file.name}" isn't a video file.`
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `"${file.name}" is over 50MB — try a shorter clip or lower resolution.`
  }
  return null
}

// File-size and type can be checked synchronously, but duration needs the browser to
// actually load the video's metadata first -- there's no way to read that straight off
// a File object. Returns null (no error) if it can't determine duration at all (some
// mobile browsers/codecs don't reliably fire loadedmetadata) rather than blocking a
// legitimate upload over a browser quirk.
export function validateVideoDuration(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(url)

    video.onloadedmetadata = () => {
      cleanup()
      if (video.duration > MAX_VIDEO_SECONDS) {
        resolve(`Video is ${Math.round(video.duration)}s — keep it under ${MAX_VIDEO_SECONDS}s.`)
      } else {
        resolve(null)
      }
    }
    video.onerror = () => {
      cleanup()
      resolve(null)
    }
    video.src = url
  })
}

export async function uploadListingVideo(ownerId: string, listingId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${ownerId}/${listingId}/${safeName}`

  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    // Explicit, rather than left to be inferred server-side -- needed so the video
    // fetched back later (e.g. to re-open it in the trim/mute editor) reports the
    // right blob.type instead of a generic fallback that can mismatch the actual
    // container and make the browser refuse to play it.
    contentType: file.type || 'video/mp4',
  })
  if (error) throw error

  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteListingVideo(ownerId: string, listingId: string): Promise<void> {
  const prefix = `${ownerId}/${listingId}`
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).list(prefix)
  if (error || !data || data.length === 0) return
  const paths = data.map((f) => `${prefix}/${f.name}`)
  await supabase.storage.from(VIDEO_BUCKET).remove(paths)
}
