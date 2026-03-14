/**
 * Client-side image compression utility.
 * Resizes images to max 1200px and compresses to JPEG quality 0.7.
 * Target: ~200-400KB per photo (saves 80-95% on typical phone photos).
 */

const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.7

export async function compressImage(file: File): Promise<File> {
  // HEIC files can't be rendered in canvas — skip compression
  if (file.type === 'image/heic') return file

  // Timeout after 10s — return original file if compression takes too long
  return Promise.race([
    new Promise<File>((resolve) => {
      setTimeout(() => resolve(file), 10000)
    }),
    new Promise<File>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

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
        resolve(file)
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
            `Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${Math.round((1 - compressed.size / file.size) * 100)}% smaller)`
          )

          resolve(compressed)
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  }),
  ])
}
