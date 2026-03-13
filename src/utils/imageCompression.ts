/**
 * Client-side image compression utility.
 * Resizes images to max 1920px and compresses to JPEG quality 0.8.
 * Typically reduces a 5-10MB phone photo to ~200-500KB.
 */

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.8

export async function compressImage(file: File): Promise<File> {
  // Skip compression for small files (< 500KB) or non-image types
  if (file.size < 500 * 1024) return file

  // HEIC files can't be rendered in canvas — skip compression
  if (file.type === 'image/heic') return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Only resize if larger than max dimension
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        // Still compress quality even if dimensions are fine
        if (file.size < 1024 * 1024) {
          resolve(file)
          return
        }
      }

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        if (width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width)
          width = MAX_DIMENSION
        }
      } else {
        if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height)
          height = MAX_DIMENSION
        }
      }

      // Draw to canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file) // fallback
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }

          // Only use compressed version if it's actually smaller
          if (blob.size >= file.size) {
            resolve(file)
            return
          }

          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })

          console.log(
            `Image compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB (${Math.round((1 - compressed.size / file.size) * 100)}% smaller)`
          )

          resolve(compressed)
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // fallback to original on error
    }

    img.src = url
  })
}
