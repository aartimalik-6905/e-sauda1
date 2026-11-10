import { useEffect, useRef, useState, useCallback } from 'react'
import { RotateCcw, RotateCw, Check, X } from 'lucide-react'

interface PhotoEditorModalProps {
  file: File
  onSave: (file: File) => void
  onCancel: () => void
}

const PREVIEW_MAX = 420 // display size cap in px -- keeps the modal usable on phones
const MIN_CROP = 24 // px, in display coordinates

type CropRect = { x: number; y: number; w: number; h: number }
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

// Crops and rotates a photo entirely in the browser via <canvas> -- no upload or
// server round trip needed just to straighten/crop a photo before it's attached to
// a listing. Rotation is composed into an offscreen "source" canvas (each rotate
// redraws the current pixels into a new, swapped-dimension canvas) so multiple
// rotates and a crop after rotating both work with simple axis-aligned math -- no
// combined rotate+crop transform matrix to get wrong.
export default function PhotoEditorModal({ file, onSave, onCancel }: PhotoEditorModalProps) {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startCrop: CropRect } | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      setSourceCanvas(canvas)
      URL.revokeObjectURL(url)
    }
    img.src = url
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  // Whenever the source canvas changes (initial load or after a rotate), fit it into
  // the preview area and reset the crop box to cover the full image.
  useEffect(() => {
    if (!sourceCanvas) return
    const scale = Math.min(PREVIEW_MAX / sourceCanvas.width, PREVIEW_MAX / sourceCanvas.height, 1)
    const w = Math.round(sourceCanvas.width * scale)
    const h = Math.round(sourceCanvas.height * scale)
    setDisplaySize({ w, h })
    setCrop({ x: 0, y: 0, w, h })
  }, [sourceCanvas])

  useEffect(() => {
    if (!sourceCanvas || !previewRef.current || displaySize.w === 0) return
    const canvas = previewRef.current
    canvas.width = displaySize.w
    canvas.height = displaySize.h
    canvas.getContext('2d')!.drawImage(sourceCanvas, 0, 0, displaySize.w, displaySize.h)
  }, [sourceCanvas, displaySize])

  function rotate(direction: 1 | -1) {
    if (!sourceCanvas) return
    const rotated = document.createElement('canvas')
    rotated.width = sourceCanvas.height
    rotated.height = sourceCanvas.width
    const ctx = rotated.getContext('2d')!
    ctx.translate(rotated.width / 2, rotated.height / 2)
    ctx.rotate((direction * Math.PI) / 2)
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2)
    setSourceCanvas(rotated)
  }

  const onHandleDown = useCallback(
    (handle: Handle) => (e: React.PointerEvent) => {
      if (!crop) return
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startCrop: crop }
    },
    [crop],
  )

  const onAreaPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const { x, y, w, h } = drag.startCrop
      const maxW = displaySize.w
      const maxH = displaySize.h
      const next: CropRect = { x, y, w, h }

      if (drag.handle === 'move') {
        next.x = Math.min(Math.max(0, x + dx), maxW - w)
        next.y = Math.min(Math.max(0, y + dy), maxH - h)
      } else {
        if (drag.handle.includes('w')) {
          const newX = Math.min(Math.max(0, x + dx), x + w - MIN_CROP)
          next.w = w + (x - newX)
          next.x = newX
        }
        if (drag.handle.includes('e')) {
          next.w = Math.min(Math.max(MIN_CROP, w + dx), maxW - x)
        }
        if (drag.handle.includes('n')) {
          const newY = Math.min(Math.max(0, y + dy), y + h - MIN_CROP)
          next.h = h + (y - newY)
          next.y = newY
        }
        if (drag.handle.includes('s')) {
          next.h = Math.min(Math.max(MIN_CROP, h + dy), maxH - y)
        }
      }
      setCrop(next)
    },
    [displaySize],
  )

  function onAreaPointerUp() {
    dragRef.current = null
  }

  function handleSave() {
    if (!sourceCanvas || !crop) return
    const scale = sourceCanvas.width / displaySize.w
    const sx = Math.round(crop.x * scale)
    const sy = Math.round(crop.y * scale)
    const sw = Math.round(crop.w * scale)
    const sh = Math.round(crop.h * scale)

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    out.getContext('2d')!.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh)

    out.toBlob(
      (blob) => {
        if (!blob) {
          onCancel()
          return
        }
        onSave(new File([blob], file.name, { type: blob.type || file.type }))
      },
      file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl2 bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Edit photo</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-ink/50 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div
          className="relative mx-auto mt-4 touch-none select-none"
          style={{ width: displaySize.w || PREVIEW_MAX, height: displaySize.h || PREVIEW_MAX }}
          onPointerMove={onAreaPointerMove}
          onPointerUp={onAreaPointerUp}
        >
          <canvas ref={previewRef} className="absolute inset-0 h-full w-full" />
          {crop && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/50" style={{ height: crop.y }} />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50"
                style={{ height: displaySize.h - crop.y - crop.h }}
              />
              <div
                className="pointer-events-none absolute bg-black/50"
                style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }}
              />
              <div
                className="pointer-events-none absolute bg-black/50"
                style={{
                  left: crop.x + crop.w,
                  top: crop.y,
                  width: displaySize.w - crop.x - crop.w,
                  height: crop.h,
                }}
              />
              <div
                onPointerDown={onHandleDown('move')}
                className="absolute cursor-move border-2 border-white/90"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <div
                  key={corner}
                  onPointerDown={onHandleDown(corner)}
                  className="absolute h-4 w-4 rounded-full border-2 border-forest bg-white shadow"
                  style={{
                    left: (corner.includes('w') ? crop.x : crop.x + crop.w) - 8,
                    top: (corner.includes('n') ? crop.y : crop.y + crop.h) - 8,
                    cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                />
              ))}
            </>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-ink/40">
          Drag the corners to crop, drag inside the box to move it
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => rotate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line/10 text-ink hover:bg-cream-dark"
              aria-label="Rotate left"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={() => rotate(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line/10 text-ink hover:bg-cream-dark"
              aria-label="Rotate right"
            >
              <RotateCw size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-line/10 px-4 py-2 text-sm font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream"
            >
              <Check size={15} /> Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
