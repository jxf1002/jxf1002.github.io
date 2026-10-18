export type PhotoFormat = "jpg" | "png" | "webp"

export const FORMATS: Record<
  PhotoFormat,
  { mime: string; ext: string; quality: boolean }
> = {
  jpg: { mime: "image/jpeg", ext: "jpg", quality: true },
  png: { mime: "image/png", ext: "png", quality: false },
  webp: { mime: "image/webp", ext: "webp", quality: true },
}

export const FORMAT_KEYS = Object.keys(FORMATS) as PhotoFormat[]

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / 1024 / 1024).toFixed(2) + " MB"
}

export function mimeLabel(file: File): string {
  let type = (file.type || "").replace(/^image\//, "").toLowerCase()
  if (type === "jpeg") type = "jpg"
  if (!type) {
    const matched = /\.([a-z0-9]+)$/i.exec(file.name || "")
    type = matched ? matched[1].toLowerCase() : ""
  }
  return type ? type.toUpperCase() : "未知"
}

export function baseName(name: string): string {
  return String(name || "image").replace(/\.[^./\\]+$/, "") || "image"
}

export function outputName(name: string, format: PhotoFormat): string {
  return baseName(name) + "." + (FORMATS[format] || FORMATS.jpg).ext
}

export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  let candidate: string
  let index = 2
  do {
    candidate = stem + "(" + index + ")" + ext
    index += 1
  } while (used.has(candidate))
  used.add(candidate)
  return candidate
}

export function stamp(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? "0" + n : "" + n)
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    "-" +
    p(d.getHours()) +
    p(d.getMinutes())
  )
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
