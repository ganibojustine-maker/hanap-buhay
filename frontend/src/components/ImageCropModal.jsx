import { useState, useRef, useEffect, useCallback } from 'react'
import { IconCheck, IconX } from './icons.jsx'

/**
 * ImageCropModal — Interactive Photo Cropper and Adjuster
 * Supports: Pan/Drag, Zoom slider (1x - 3x), 90-degree Rotation, Reset,
 * Circular/Square overlay preview, and high-resolution export.
 */
export default function ImageCropModal({
  imageSrc,
  title = 'Crop & Adjust Profile Photo',
  cropShape = 'circle', // 'circle' | 'round-rect'
  onCrop,
  onCancel,
  saving = false
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })

  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  const VIEW_SIZE = 280 // Viewport width & height in px

  // Load image
  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setRotation(0)
    }
    img.src = imageSrc
  }, [imageSrc])

  // Draw preview canvas
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgLoaded) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE)

    // Base scale to cover the 280x280 viewport
    const isSideways = rotation === 90 || rotation === 270
    const w = isSideways ? img.naturalHeight : img.naturalWidth
    const h = isSideways ? img.naturalWidth : img.naturalHeight

    const baseScale = Math.max(VIEW_SIZE / w, VIEW_SIZE / h)
    const currentScale = baseScale * zoom

    ctx.save()
    // Move to center + user pan
    ctx.translate(VIEW_SIZE / 2 + pan.x, VIEW_SIZE / 2 + pan.y)
    ctx.rotate((rotation * Math.PI) / 180)

    const drawW = img.naturalWidth * currentScale
    const drawH = img.naturalHeight * currentScale
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }, [imgLoaded, zoom, pan, rotation])

  useEffect(() => {
    drawPreview()
  }, [drawPreview])

  // Pointer drag events for panning
  const handlePointerDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    })
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    setPan({
      x: dragStart.panX + dx,
      y: dragStart.panY + dy
    })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.0015
    setZoom(z => Math.min(3, Math.max(1, +(z + delta).toFixed(2))))
  }

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation(r => (r + 90) % 360)
  }

  // Reset adjustments
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }

  // Export cropped image
  const handleApply = () => {
    const img = imgRef.current
    if (!img) return

    const OUTPUT_SIZE = 512
    const outCanvas = document.createElement('canvas')
    outCanvas.width = OUTPUT_SIZE
    outCanvas.height = OUTPUT_SIZE
    const outCtx = outCanvas.getContext('2d')

    const isSideways = rotation === 90 || rotation === 270
    const w = isSideways ? img.naturalHeight : img.naturalWidth
    const h = isSideways ? img.naturalWidth : img.naturalHeight

    const baseScale = Math.max(VIEW_SIZE / w, VIEW_SIZE / h)
    const currentScale = baseScale * zoom
    const ratio = OUTPUT_SIZE / VIEW_SIZE

    outCtx.save()
    outCtx.translate(OUTPUT_SIZE / 2 + pan.x * ratio, OUTPUT_SIZE / 2 + pan.y * ratio)
    outCtx.rotate((rotation * Math.PI) / 180)

    const drawW = img.naturalWidth * currentScale * ratio
    const drawH = img.naturalHeight * currentScale * ratio
    outCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    outCtx.restore()

    // Export as Blob and DataURL
    outCanvas.toBlob(
      (blob) => {
        const dataUrl = outCanvas.toDataURL('image/jpeg', 0.92)
        if (blob) {
          onCrop(blob, dataUrl)
        }
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 29, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onPointerUp={handlePointerUp}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>
              {title}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Drag to reposition, adjust zoom or rotate
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: 'var(--muted)',
              display: 'flex',
              padding: 4
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Cropper Viewport */}
        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#f8fafc'
          }}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onWheel={handleWheel}
            style={{
              width: VIEW_SIZE,
              height: VIEW_SIZE,
              position: 'relative',
              borderRadius: cropShape === 'circle' ? '50%' : 20,
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
              background: '#0f172a'
            }}
          >
            {/* Live Canvas */}
            <canvas
              ref={canvasRef}
              width={VIEW_SIZE}
              height={VIEW_SIZE}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />

            {/* Circular or Rounded Border Guide */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: cropShape === 'circle' ? '50%' : 20,
                border: '2.5px solid #ffffff',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
                pointerEvents: 'none'
              }}
            />

            {/* Grid overlay for positioning reference */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: cropShape === 'circle' ? '50%' : 20,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: '1fr 1fr 1fr',
                pointerEvents: 'none',
                opacity: isDragging ? 0.45 : 0.2,
                transition: 'opacity 0.2s'
              }}
            >
              <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
              <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
              <div style={{ borderBottom: '1px dashed #fff' }} />
              <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
              <div style={{ borderRight: '1px dashed #fff', borderBottom: '1px dashed #fff' }} />
              <div style={{ borderBottom: '1px dashed #fff' }} />
              <div style={{ borderRight: '1px dashed #fff' }} />
              <div style={{ borderRight: '1px dashed #fff' }} />
              <div />
            </div>
          </div>

          <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Tip: Scroll to zoom in/out or drag with mouse
          </span>
        </div>

        {/* Controls Toolbar */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)' }}>
          {/* Zoom Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy-d)', minWidth: 42 }}>
              Zoom
            </span>
            <button
              className="btn btn-light btn-xs"
              style={{ width: 28, height: 28, padding: 0, fontSize: 14, fontWeight: 700 }}
              onClick={() => setZoom(z => Math.max(1, +(z - 0.2).toFixed(2)))}
              title="Zoom out"
            >
              −
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--gold)' }}
            />
            <button
              className="btn btn-light btn-xs"
              style={{ width: 28, height: 28, padding: 0, fontSize: 14, fontWeight: 700 }}
              onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(2)))}
              title="Zoom in"
            >
              +
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)', width: 34, textAlign: 'right' }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Rotate & Reset Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-light btn-xs"
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={handleRotate}
                title="Rotate 90 degrees"
              >
                ↻ Rotate 90°
              </button>
              <button
                className="btn btn-light btn-xs"
                style={{ fontSize: 12 }}
                onClick={handleReset}
                title="Reset position and zoom"
              >
                Reset
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-light btn-sm"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                onClick={handleApply}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spin" style={{ width: 14, height: 14 }} />
                    Saving…
                  </>
                ) : (
                  <>
                    <IconCheck size={14} />
                    Apply &amp; Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
