"use client"

import { useEffect, useRef, useState } from "react"
import { convertImage, createZip } from "../../lib/photo/convert"
import type { ZipEntry } from "../../lib/photo/convert"
import type { PhotoFormat } from "../../lib/photo/naming"
import {
  FORMAT_KEYS,
  formatSize,
  mimeLabel,
  nextFrame,
  outputName,
  stamp,
  triggerDownload,
  uniqueName,
} from "../../lib/photo/naming"

const MAX_FILES = 20

type Item = {
  id: number
  file: File
  url: string
  format: PhotoFormat
}

function isImage(file: File): boolean {
  return (
    (file.type && file.type.indexOf("image/") === 0) ||
    /\.(jpe?g|png|gif|webp|bmp|avif|svg|heic|heif|tiff?)$/i.test(
      file.name || "",
    )
  )
}

export default function PhotoConverter() {
  const input = useRef<HTMLInputElement | null>(null)
  const seq = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [globalFormat, setGlobalFormat] = useState<PhotoFormat>("jpg")
  const [quality, setQuality] = useState(0.92)
  const [dragover, setDragover] = useState(false)
  const [converting, setConverting] = useState<number[]>([])
  const [packing, setPacking] = useState<{ done: number; total: number } | null>(
    null,
  )
  const [toast, setToast] = useState("")

  const itemsRef = useRef<Item[]>(items)
  itemsRef.current = items

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    },
    [],
  )

  // 拖到页面其他位置时也要拦住浏览器默认的打开文件行为
  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault()
    window.addEventListener("dragover", prevent)
    window.addEventListener("drop", prevent)
    return () => {
      window.removeEventListener("dragover", prevent)
      window.removeEventListener("drop", prevent)
    }
  }, [])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2600)
  }

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return

    const images = incoming.filter(isImage)
    const skipped = incoming.length - images.length

    if (!images.length) {
      showToast(skipped ? "这些文件不是图片" : "没有可用的图片")
      return
    }

    const room = MAX_FILES - items.length
    if (room <= 0) {
      showToast("最多只能添加 " + MAX_FILES + " 张图片")
      return
    }

    let accepted = images
    if (images.length > room) {
      accepted = images.slice(0, room)
      showToast(
        "最多 " + MAX_FILES + " 张，已忽略 " + (images.length - room) + " 张",
      )
    } else if (skipped) {
      showToast("已忽略 " + skipped + " 个非图片文件")
    }

    setItems((prev) =>
      prev.concat(
        accepted.map((file) => {
          seq.current += 1
          return {
            id: seq.current,
            file,
            url: URL.createObjectURL(file),
            format: globalFormat,
          }
        }),
      ),
    )
  }

  function removeItem(item: Item) {
    URL.revokeObjectURL(item.url)
    setItems((prev) => prev.filter((entry) => entry.id !== item.id))
  }

  function clearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.url))
    setItems([])
    showToast("列表已清空")
  }

  async function downloadOne(item: Item) {
    setConverting((prev) => prev.concat(item.id))
    try {
      const blob = await convertImage(item.file, item.format, quality)
      triggerDownload(blob, outputName(item.file.name, item.format))
    } catch (err) {
      showToast(
        "「" +
          item.file.name +
          "」转换失败：" +
          ((err as Error | undefined)?.message || "未知错误"),
      )
    } finally {
      setConverting((prev) => prev.filter((id) => id !== item.id))
    }
  }

  async function downloadAll() {
    const current = items.slice()
    if (!current.length) return

    const used = new Set<string>()
    const entries: ZipEntry[] = []
    const failed: string[] = []
    setPacking({ done: 0, total: current.length })

    for (let index = 0; index < current.length; index++) {
      const item = current[index]
      try {
        const blob = await convertImage(item.file, item.format, quality)
        const buffer = await blob.arrayBuffer()
        entries.push({
          name: uniqueName(outputName(item.file.name, item.format), used),
          data: new Uint8Array(buffer),
        })
      } catch {
        failed.push(item.file.name)
      }
      setPacking({ done: index + 1, total: current.length })
      await nextFrame()
    }

    setPacking(null)
    if (!entries.length) {
      showToast("没有可打包的图片")
      return
    }
    triggerDownload(createZip(entries), "images-" + stamp() + ".zip")
    showToast(
      failed.length
        ? "已打包 " + entries.length + " 张，" + failed.length + " 张失败"
        : "已打包 " + entries.length + " 张图片",
    )
  }

  const hasItems = items.length > 0
  const progress = packing
    ? Math.round((packing.done / packing.total) * 100)
    : 0

  return (
    <>
      <main>
        <div className="tool-page">
          <div className="tool-main">
            <div className="app converter">
              <header className="app-header">
                <span className="header-icon" aria-hidden="true">
                  🖼️
                </span>
                <div className="header-text">
                  <h1>图片格式转换</h1>
                  <p className="sub">
                    批量把图片转成 JPG / PNG / WebP，可打包成 ZIP
                    下载。全程在浏览器本地处理，图片不会上传。
                  </p>
                </div>
                <span className="badge">纯前端 · 最多 20 张</span>
              </header>

              <section
                className={dragover ? "drop-zone is-dragover" : "drop-zone"}
                tabIndex={0}
                role="button"
                aria-label="点击或拖拽上传图片"
                onClick={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest("button")) return
                  input.current?.click()
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    input.current?.click()
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setDragover(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setDragover(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (
                    event.currentTarget.contains(event.relatedTarget as Node | null)
                  )
                    return
                  setDragover(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setDragover(false)
                  const files = event.dataTransfer && event.dataTransfer.files
                  if (files && files.length) addFiles(files)
                }}
              >
                <div className="drop-icon" aria-hidden="true">
                  ＋
                </div>
                <p className="drop-title">
                  把图片拖到这里，或
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => input.current?.click()}
                  >
                    点击选择图片
                  </button>
                </p>
                <p className="drop-hint">
                  支持 JPG / PNG / WebP / GIF / BMP / AVIF 等，单次最多 20 张
                </p>
              </section>
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ""
                }}
              />

              <div className="toolbar">
                <label className="field">
                  <span>全部转为</span>
                  <select
                    className="control"
                    value={globalFormat}
                    onChange={(event) => {
                      const format = event.target.value as PhotoFormat
                      setGlobalFormat(format)
                      setItems((prev) =>
                        prev.map((item) => ({ ...item, format })),
                      )
                    }}
                  >
                    {FORMAT_KEYS.map((key) => (
                      <option value={key} key={key}>
                        {key.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    质量 <em>{Math.round(quality * 100)}%</em>
                  </span>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.01"
                    value={quality}
                    aria-label="输出质量"
                    onChange={(event) => setQuality(Number(event.target.value))}
                  />
                </label>
                <span className="hint">
                  质量仅对 JPG / WebP 生效，PNG 为无损输出
                </span>
                <span className="spacer"></span>
                <button
                  type="button"
                  className="button"
                  disabled={!hasItems}
                  onClick={clearAll}
                >
                  清空列表
                </button>
              </div>

              <div className="conv-table-wrap">
                <table className="conv-table" hidden={!hasItems}>
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>大小</th>
                      <th>类型</th>
                      <th>转化为</th>
                      <th className="col-actions">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="file-cell">
                            <img
                              className="file-thumb"
                              src={item.url}
                              alt=""
                              loading="lazy"
                            />
                            <span className="file-name" title={item.file.name}>
                              {item.file.name}
                            </span>
                          </div>
                        </td>
                        <td>{formatSize(item.file.size)}</td>
                        <td>{mimeLabel(item.file)}</td>
                        <td>
                          <select
                            className="control"
                            aria-label="输出格式"
                            value={item.format}
                            onChange={(event) =>
                              setItems((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id
                                    ? {
                                        ...entry,
                                        format: event.target
                                          .value as PhotoFormat,
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            {FORMAT_KEYS.map((key) => (
                              <option value={key} key={key}>
                                {key.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="col-actions">
                          <button
                            type="button"
                            className="button button-primary"
                            disabled={converting.includes(item.id)}
                            onClick={() => downloadOne(item)}
                          >
                            {converting.includes(item.id) ? "转换中" : "下载"}
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="移除"
                            aria-label="移除"
                            onClick={() => removeItem(item)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="empty" hidden={hasItems}>
                  还没有添加图片，先在上方选择或拖拽文件吧
                </p>
              </div>

              <div className="batch-bar" hidden={!hasItems}>
                <span className="count">
                  共 {items.length} 张，还可添加 {MAX_FILES - items.length} 张
                </span>
                <div className="progress" hidden={!packing}>
                  <span style={{ width: progress + "%" }}></span>
                </div>
                <span className="spacer"></span>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!hasItems || !!packing}
                  onClick={downloadAll}
                >
                  {packing
                    ? "打包中 " + packing.done + "/" + packing.total
                    : "打包下载 ZIP"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div
        className={toast ? "toast show" : "toast"}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </>
  )
}
