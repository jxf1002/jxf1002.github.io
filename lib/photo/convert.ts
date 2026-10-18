import { FORMATS } from "./naming.ts"
import type { PhotoFormat } from "./naming.ts"

// ZIP 打包：store 模式，无压缩、无依赖，自己写 CRC32 与文件头
export type ZipEntry = { name: string; data: Uint8Array<ArrayBuffer> }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    (Math.floor(d.getSeconds() / 2) & 0x1f)
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f)
  return { time: time & 0xffff, date: date & 0xffff }
}

export function createZip(files: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  const now = dosDateTime(new Date())

  files.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)
    const size = data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, now.time, true)
    lv.setUint16(12, now.date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    chunks.push(local, data)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, now.time, true)
    cv.setUint16(14, now.date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + size
  })

  const centralSize = central.reduce((sum, item) => sum + item.length, 0)

  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  return new Blob(chunks.concat(central, [end]), { type: "application/zip" })
}

function loadImageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(
      () => createImageBitmap(file),
    )
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("无法解码该图片"))
    }
    img.src = url
  })
}

export function convertImage(
  file: File,
  format: PhotoFormat,
  quality: number,
): Promise<Blob> {
  const target = FORMATS[format] || FORMATS.jpg

  return loadImageSource(file).then((src) => {
    const w = src.width || (src as HTMLImageElement).naturalWidth
    const h = src.height || (src as HTMLImageElement).naturalHeight
    if (!w || !h) throw new Error("图片尺寸无效")

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("当前浏览器不支持图片导出")

    if (target.mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(src, 0, 0)
    if ("close" in src && typeof src.close === "function") src.close()

    return new Promise<Blob>((resolve, reject) => {
      if (typeof canvas.toBlob !== "function") {
        reject(new Error("当前浏览器不支持图片导出"))
        return
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("转换失败"))
            return
          }
          if (blob.type !== target.mime) {
            reject(new Error("当前浏览器不支持导出 " + format.toUpperCase()))
            return
          }
          resolve(blob)
        },
        target.mime,
        target.quality ? quality : undefined,
      )
    })
  })
}
