/** となりの色とこれ以内の差なら、同じ背景が続いているとみなす（黒→茶色のグラデーションもたどれる） */
const STEP = 28

/**
 * 暗い背景を白にする：画像のふちから、暗い色（明るさ threshold 以下）で、色がなめらかにつながっているところだけを白で塗る。
 * 背景が黒でも茶色でも、グラデーションでもたどれる。キャラの縁（背景と色がはっきり違うところ）で止まり、キャラの中の黒は残る。
 */
export function whitenPixels(data: Uint8ClampedArray, width: number, height: number, threshold: number): number {
  const dark = (i: number) => data[i * 4 + 3] < 16 || Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) <= threshold
  const near = (a: number, b: number) =>
    Math.abs(data[a * 4] - data[b * 4]) + Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) + Math.abs(data[a * 4 + 2] - data[b * 4 + 2]) <=
    STEP * 3
  const filled = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (i: number, from = -1) => {
    if (!filled[i] && dark(i) && (from < 0 || near(i, from))) {
      filled[i] = 1
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
    const y = (i - x) / width
    if (x > 0) push(i - 1, i)
    if (x < width - 1) push(i + 1, i)
    if (y > 0) push(i - width, i)
    if (y < height - 1) push(i + width, i)
  }
  // 塗る前に、境目の判定に使う元の色を見るので、白にするのは最後にまとめて
  const edge: number[] = []
  for (let i = 0; i < width * height; i++) {
    if (filled[i]) continue
    const x = i % width
    const next = (x > 0 && filled[i - 1]) || (x < width - 1 && filled[i + 1]) || filled[i - width] || filled[i + width]
    if (next && Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) <= threshold * 1.5) edge.push(i)
  }
  let count = 0
  for (let i = 0; i < width * height; i++) {
    if (filled[i]) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = data[i * 4 + 3] = 255
      count++
    }
  }
  for (const i of edge) for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round((data[i * 4 + c] + 255) / 2)
  return count
}

/** 画像（ファイルや data URL）の黒い背景を白にして、PNG のファイルにする */
export async function whitenBackground(src: Blob, threshold: number, name = 'image.png'): Promise<File> {
  const url = URL.createObjectURL(src)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('画像を読み込めませんでした'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('画像を処理できませんでした')
    ctx.drawImage(img, 0, 0)
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    whitenPixels(image.data, canvas.width, canvas.height, threshold)
    ctx.putImageData(image, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('画像を処理できませんでした')
    return new File([blob], name, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
