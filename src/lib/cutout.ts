/**
 * 白い背景を透明にする：画像のふちから、白に近い色でつながっているところだけを透明にする。
 * キャラの中の白（ふちとつながっていない部分）は残る。激レアのうしろに虹色の背景を見せるのに使う。
 */
export function clearWhiteBackground(data: Uint8ClampedArray, width: number, height: number, min = 235): number {
  const white = (i: number) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= min
  const cleared = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (i: number) => {
    if (!cleared[i] && data[i * 4 + 3] > 0 && white(i)) {
      cleared[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (stack.length > 0) {
    const i = stack.pop()!
    const x = i % width
    if (x > 0) push(i - 1)
    if (x < width - 1) push(i + 1)
    if (i >= width) push(i - width)
    if (i + width < width * height) push(i + width)
  }
  let count = 0
  for (let i = 0; i < width * height; i++) {
    if (cleared[i]) {
      data[i * 4 + 3] = 0
      count++
    } else {
      // 境目の白っぽいふちは半透明にして、白い縁取りを目立たなくする
      const x = i % width
      const next = (x > 0 && cleared[i - 1]) || (x < width - 1 && cleared[i + 1]) || cleared[i - width] || cleared[i + width]
      if (next && Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= min - 40) data[i * 4 + 3] = 110
    }
  }
  return count
}

const cache = new Map<string, Promise<string>>()

/** data URL の画像の白い背景を透明にした PNG の data URL（同じ画像は1回だけ処理する） */
export function cutoutWhite(src: string): Promise<string> {
  const hit = cache.get(src)
  if (hit) return hit
  const job = new Promise<string>((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(src)
        ctx.drawImage(img, 0, 0)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        clearWhiteBackground(image.data, canvas.width, canvas.height)
        ctx.putImageData(image, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(src) // 処理できなければ、そのまま出す
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
  cache.set(src, job)
  return job
}
