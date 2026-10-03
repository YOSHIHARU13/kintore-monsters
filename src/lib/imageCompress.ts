import { CONFIG } from '../config/gameConfig'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像を読み込めませんでした'))
    }
    img.src = url
  })
}

function dataUrlBytes(dataUrl: string): number {
  return Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)
}

/**
 * 長辺を縮めてWebPに圧縮し、data URL で返す。
 * WebPで書き出せないブラウザではPNG/JPEGになるので、その場合はサイズを落として収める。
 */
export async function compressImage(file: File): Promise<string> {
  const img = await loadImage(file)
  let side: number = CONFIG.image.maxSidePx
  let best = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('画像を処理できませんでした')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      best = canvas.toDataURL('image/webp', quality)
      if (dataUrlBytes(best) <= CONFIG.image.targetBytes) return best
      if (!best.startsWith('data:image/webp')) break // 品質指定が効かない形式
    }
    side = Math.round(side * 0.75)
  }
  return best
}
