import { supabase } from './supabase'

// Downscales before base64-encoding -- a raw 12MP phone photo is needlessly
// large to send to a vision model (which downsamples internally anyway) and
// would slow the request down on exactly the slow connections this feature
// most needs to work well on. Returns a JPEG data URL.
function fileToResizedDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image'))
    }
    img.src = objectUrl
  })
}

// Grabs a single still frame partway into a video file (rather than frame 0,
// which for a lot of phone clips is a black/blank moment before the item is
// actually in shot) and returns it the same way as a photo -- a JPEG data URL.
export function captureVideoFrame(file: File, atSeconds = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => URL.revokeObjectURL(objectUrl)

    video.onloadedmetadata = () => {
      // Clamp so a very short clip doesn't get seeked past its own end.
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.1))
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width === 0) {
        cleanup()
        reject(new Error('Could not capture a frame from the video'))
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      cleanup()
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not read video'))
    }
    video.src = objectUrl
  })
}

export interface DescriptionSuggestionInput {
  photoFiles: File[]
  videoFile?: File | null
  category?: string
  subCategory?: string
  condition?: string
  title?: string
}

// Builds the image set (up to 2 photos + 1 video frame, matching the edge
// function's cap) and asks the suggest-description edge function for a draft
// description. Throws with a user-facing message on failure -- callers show
// it directly rather than a generic "something went wrong."
export async function suggestListingDescription(input: DescriptionSuggestionInput): Promise<string> {
  const images: string[] = []

  for (const file of input.photoFiles.slice(0, 2)) {
    try {
      images.push(await fileToResizedDataUrl(file))
    } catch {
      // Skip a photo that fails to process rather than failing the whole
      // suggestion -- there may still be others (or the video frame) to work with.
    }
  }
  if (input.videoFile) {
    try {
      images.push(await captureVideoFrame(input.videoFile))
    } catch {
      // Same reasoning -- fall back to whatever photos succeeded.
    }
  }

  if (images.length === 0) {
    throw new Error('Add at least one photo or video before generating a description.')
  }

  const { data, error } = await supabase.functions.invoke('suggest-description', {
    body: {
      images,
      category: input.category,
      subCategory: input.subCategory,
      condition: input.condition,
      title: input.title,
    },
  })

  if (error) {
    // Same pattern as lib/chatbot.ts -- supabase-js's default error message on
    // a non-2xx response doesn't include what the function actually said.
    // Clone before reading: some supabase-js versions/paths have already
    // touched the response body by the time we get here, and calling
    // .json() on an already-consumed stream throws -- which used to fall
    // through silently to the generic "Edge Function returned a non-2xx
    // status code" message and hide the real error. Cloning guarantees a
    // fresh, independently-readable stream regardless of what the SDK did.
    if ('context' in error && error.context instanceof Response) {
      let message: string | undefined
      try {
        const body = await error.context.clone().json()
        message = body?.error
      } catch {
        // Not JSON (or the stream really is unreadable) -- fall back to raw
        // text so at least something diagnostic reaches the user/console
        // instead of the opaque generic message.
        try {
          const text = await error.context.clone().text()
          message = text?.slice(0, 300)
        } catch {
          // Give up -- use supabase-js's generic message below.
        }
      }
      throw new Error(message || error.message)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return (data?.description as string) || ''
}