import { useEffect, useRef, useState } from 'react'
import { Check, X, Volume2, VolumeX } from 'lucide-react'

interface VideoEditorModalProps {
  file: File
  onSave: (file: File) => void
  onCancel: () => void
}

// Trims and (optionally) mutes a video entirely client-side. There's no ffmpeg.wasm
// here -- that's a 20-30MB dependency for what's meant to stay a lightweight listing
// flow. Instead this plays the source video through <video>.captureStream() and
// re-records just the trimmed window with MediaRecorder, dropping the audio track
// first when "mute" is on. Processing therefore takes as long as the trimmed clip
// itself (it's realtime, not instant) and the output re-encodes to webm -- both
// acceptable trade-offs for a "show the item" clip capped at 60s. Browsers without
// captureStream support (older Safari) fall back to letting the original file
// through unchanged rather than blocking the listing flow.
export default function VideoEditorModal({ file, onSave, onCancel }: VideoEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoUrl] = useState(() => URL.createObjectURL(file))
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [muted, setMuted] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onLoadedMetadata() {
    const v = videoRef.current as any
    setSupported(!!(v && (v.captureStream || v.mozCaptureStream)))
    const d = videoRef.current?.duration || 0
    setDuration(d)
    setTrimEnd(d)
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  async function handleApply() {
    const video = videoRef.current as any
    if (!video || !supported) {
      onSave(file)
      return
    }
    const noTrim = trimStart <= 0.05 && trimEnd >= duration - 0.05
    if (noTrim && !muted) {
      onSave(file)
      return
    }

    setError(null)
    setProcessing(true)
    setProgress(0)

    try {
      const rawStream: MediaStream = video.captureStream ? video.captureStream() : video.mozCaptureStream()
      const tracks = muted ? rawStream.getVideoTracks() : rawStream.getTracks()
      const stream = new MediaStream(tracks)

      const mimeCandidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      const mimeType =
        mimeCandidates.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const done = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
        recorder.onerror = (ev: any) => reject(ev.error || new Error('Recording failed'))
      })

      await new Promise<void>((resolve, reject) => {
        video.currentTime = trimStart
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        setTimeout(() => reject(new Error('Could not seek video')), 5000)
      })

      recorder.start()
      video.muted = muted
      await video.play()

      await new Promise<void>((resolve) => {
        function onTimeUpdate() {
          const pct = Math.min(1, (video.currentTime - trimStart) / Math.max(0.001, trimEnd - trimStart))
          setProgress(pct)
          if (video.currentTime >= trimEnd) cleanup()
        }
        function onEnded() {
          cleanup()
        }
        function cleanup() {
          video.pause()
          video.removeEventListener('timeupdate', onTimeUpdate)
          video.removeEventListener('ended', onEnded)
          recorder.stop()
          resolve()
        }
        video.addEventListener('timeupdate', onTimeUpdate)
        video.addEventListener('ended', onEnded)
      })

      const blob = await done
      const name = file.name.replace(/\.[^.]+$/, '') + '.webm'
      onSave(new File([blob], name, { type: mimeType }))
    } catch (err: any) {
      setError(err.message || 'Could not process the video. Try again, or use it as-is.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl2 bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Edit video</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-ink/50 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <video
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={onLoadedMetadata}
          controls
          muted={muted}
          className="mt-4 aspect-video w-full rounded-xl2 bg-black"
        />

        {!supported && (
          <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-500">
            Your browser doesn't support in-browser video editing. You can still upload the video as-is.
          </p>
        )}

        {supported && duration > 0 && (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-ink/50">
                <span>Start: {fmt(trimStart)}</span>
                <span>End: {fmt(trimEnd)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={trimStart}
                onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.5))}
                className="mt-1 w-full"
              />
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={trimEnd}
                onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.5))}
                className="mt-1 w-full"
              />
              <p className="mt-1 text-xs text-ink/40">Trimmed length: {fmt(Math.max(0, trimEnd - trimStart))}</p>
            </div>

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="flex items-center gap-2 rounded-full border border-line/10 px-3 py-1.5 text-sm text-ink hover:bg-cream-dark"
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {muted ? 'Audio muted' : 'Mute audio'}
            </button>
          </div>
        )}

        {processing && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
              <div className="h-full bg-forest transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-center text-xs text-ink/40">Processing…</p>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}

        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={() => onSave(file)}
            disabled={processing}
            className="rounded-full border border-line/10 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Use original
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing}
            className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50"
          >
            <Check size={15} /> {processing ? 'Processing…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
