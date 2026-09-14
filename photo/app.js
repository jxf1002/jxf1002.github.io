;(function () {
  "use strict"

  var MAX_FILES = 20

  var FORMATS = {
    jpg: { mime: "image/jpeg", ext: "jpg", quality: true },
    png: { mime: "image/png", ext: "png", quality: false },
    webp: { mime: "image/webp", ext: "webp", quality: true },
  }

  var state = { items: [], seq: 0 }

  var el = {}
  ;[
    "dropZone",
    "fileInput",
    "pickBtn",
    "globalFormat",
    "quality",
    "qualityValue",
    "clearBtn",
    "fileTable",
    "fileBody",
    "emptyState",
    "fileCount",
    "batchBar",
    "downloadAll",
    "progress",
    "progressBar",
    "toast",
  ].forEach(function (id) {
    el[id] = document.getElementById(id)
  })

  /* ---------------- 基础工具 ---------------- */

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]
    })
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / 1024 / 1024).toFixed(2) + " MB"
  }

  function mimeLabel(file) {
    var t = (file.type || "").replace(/^image\//, "").toLowerCase()
    if (t === "jpeg") t = "jpg"
    if (!t) {
      var m = /\.([a-z0-9]+)$/i.exec(file.name || "")
      t = m ? m[1].toLowerCase() : ""
    }
    return t ? t.toUpperCase() : "未知"
  }

  function baseName(name) {
    return String(name || "image").replace(/\.[^./\\]+$/, "") || "image"
  }

  function outputName(name, fmt) {
    return baseName(name) + "." + (FORMATS[fmt] || FORMATS.jpg).ext
  }

  function uniqueName(name, used) {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    var dot = name.lastIndexOf(".")
    var stem = dot > 0 ? name.slice(0, dot) : name
    var ext = dot > 0 ? name.slice(dot) : ""
    var i = 2
    var candidate
    do {
      candidate = stem + "(" + i + ")" + ext
      i += 1
    } while (used.has(candidate))
    used.add(candidate)
    return candidate
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        resolve()
      })
    })
  }

  function stamp() {
    var d = new Date()
    function p(n) {
      return n < 10 ? "0" + n : "" + n
    }
    return (
      d.getFullYear() +
      p(d.getMonth() + 1) +
      p(d.getDate()) +
      "-" +
      p(d.getHours()) +
      p(d.getMinutes())
    )
  }

  var toastTimer = null
  function toast(msg) {
    el.toast.textContent = msg
    el.toast.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () {
      el.toast.classList.remove("show")
    }, 2600)
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob)
    var a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(function () {
      URL.revokeObjectURL(url)
    }, 4000)
  }

  /* ---------------- 图片解码 / 转换 ---------------- */

  function loadImageSource(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, {
        imageOrientation: "from-image",
      }).catch(function () {
        return createImageBitmap(file)
      })
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file)
      var img = new Image()
      img.onload = function () {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = function () {
        URL.revokeObjectURL(url)
        reject(new Error("无法解码该图片"))
      }
      img.src = url
    })
  }

  function convertImage(file, fmt) {
    var target = FORMATS[fmt] || FORMATS.jpg

    return loadImageSource(file).then(function (src) {
      var w = src.width || src.naturalWidth
      var h = src.height || src.naturalHeight
      if (!w || !h) throw new Error("图片尺寸无效")

      var canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      var ctx = canvas.getContext("2d")

      if (target.mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(src, 0, 0)
      if (typeof src.close === "function") src.close()

      var quality = target.quality ? Number(el.quality.value) : undefined

      return new Promise(function (resolve, reject) {
        if (typeof canvas.toBlob !== "function") {
          reject(new Error("当前浏览器不支持图片导出"))
          return
        }
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error("转换失败"))
              return
            }
            if (blob.type !== target.mime) {
              reject(
                new Error("当前浏览器不支持导出 " + fmt.toUpperCase()),
              )
              return
            }
            resolve(blob)
          },
          target.mime,
          quality,
        )
      })
    })
  }

  /* ---------------- ZIP 打包（store 模式，无依赖） ---------------- */

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256)
    for (var i = 0; i < 256; i++) {
      var c = i
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      table[i] = c >>> 0
    }
    return table
  })()

  function crc32(bytes) {
    var c = 0xffffffff
    for (var i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
    }
    return (c ^ 0xffffffff) >>> 0
  }

  function dosDateTime(d) {
    var time =
      ((d.getHours() & 0x1f) << 11) |
      ((d.getMinutes() & 0x3f) << 5) |
      (Math.floor(d.getSeconds() / 2) & 0x1f)
    var date =
      (((d.getFullYear() - 1980) & 0x7f) << 9) |
      (((d.getMonth() + 1) & 0x0f) << 5) |
      (d.getDate() & 0x1f)
    return { time: time & 0xffff, date: date & 0xffff }
  }

  function createZip(files) {
    var encoder = new TextEncoder()
    var chunks = []
    var central = []
    var offset = 0
    var now = dosDateTime(new Date())

    files.forEach(function (f) {
      var nameBytes = encoder.encode(f.name)
      var data = f.data
      var crc = crc32(data)
      var size = data.length

      var local = new Uint8Array(30 + nameBytes.length)
      var lv = new DataView(local.buffer)
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

      var cd = new Uint8Array(46 + nameBytes.length)
      var cv = new DataView(cd.buffer)
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

    var centralSize = central.reduce(function (sum, c) {
      return sum + c.length
    }, 0)

    var end = new Uint8Array(22)
    var ev = new DataView(end.buffer)
    ev.setUint32(0, 0x06054b50, true)
    ev.setUint16(4, 0, true)
    ev.setUint16(6, 0, true)
    ev.setUint16(8, files.length, true)
    ev.setUint16(10, files.length, true)
    ev.setUint32(12, centralSize, true)
    ev.setUint32(16, offset, true)
    ev.setUint16(20, 0, true)

    return new Blob(chunks.concat(central, [end]), {
      type: "application/zip",
    })
  }

  /* ---------------- 列表渲染 ---------------- */

  function render() {
    var items = state.items
    var hasItems = items.length > 0

    el.fileTable.hidden = !hasItems
    el.emptyState.hidden = hasItems
    el.batchBar.hidden = !hasItems
    el.clearBtn.disabled = !hasItems
    el.downloadAll.disabled = !hasItems

    el.fileBody.innerHTML = items
      .map(function (item) {
        var f = item.file
        var options = ["jpg", "png", "webp"]
          .map(function (k) {
            return (
              '<option value="' +
              k +
              '"' +
              (item.format === k ? " selected" : "") +
              ">" +
              k.toUpperCase() +
              "</option>"
            )
          })
          .join("")

        return (
          "" +
          '<tr data-id="' +
          item.id +
          '">' +
          "<td>" +
          '<div class="file-cell">' +
          '<img class="file-thumb" src="' +
          item.url +
          '" alt="" loading="lazy" />' +
          '<span class="file-name" title="' +
          escapeHtml(f.name) +
          '">' +
          escapeHtml(f.name) +
          "</span>" +
          "</div>" +
          "</td>" +
          "<td>" +
          formatSize(f.size) +
          "</td>" +
          "<td>" +
          mimeLabel(f) +
          "</td>" +
          "<td>" +
          '<select class="control" data-action="format" aria-label="输出格式">' +
          options +
          "</select>" +
          "</td>" +
          '<td class="col-actions">' +
          '<button type="button" class="button button-primary" data-action="download">下载</button>' +
          '<button type="button" class="icon-btn" data-action="remove" title="移除" aria-label="移除">×</button>' +
          "</td>" +
          "</tr>"
        )
      })
      .join("")

    el.fileCount.textContent =
      "共 " +
      items.length +
      " 张，还可添加 " +
      (MAX_FILES - items.length) +
      " 张"
  }

  function findItem(id) {
    var num = Number(id)
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === num) return state.items[i]
    }
    return null
  }

  /* ---------------- 添加 / 删除 ---------------- */

  function addFiles(fileList) {
    var incoming = Array.prototype.slice.call(fileList || [])
    if (!incoming.length) return

    var images = incoming.filter(function (f) {
      return (
        (f.type && f.type.indexOf("image/") === 0) ||
        /\.(jpe?g|png|gif|webp|bmp|avif|svg|heic|heif|tiff?)$/i.test(
          f.name || "",
        )
      )
    })
    var skipped = incoming.length - images.length

    if (!images.length) {
      toast(skipped ? "这些文件不是图片" : "没有可用的图片")
      return
    }

    var room = MAX_FILES - state.items.length
    if (room <= 0) {
      toast("最多只能添加 " + MAX_FILES + " 张图片")
      return
    }

    var accepted = images
    if (images.length > room) {
      accepted = images.slice(0, room)
      toast(
        "最多 " +
          MAX_FILES +
          " 张，已忽略 " +
          (images.length - room) +
          " 张",
      )
    } else if (skipped) {
      toast("已忽略 " + skipped + " 个非图片文件")
    }

    accepted.forEach(function (file) {
      state.items.push({
        id: ++state.seq,
        file: file,
        url: URL.createObjectURL(file),
        format: el.globalFormat.value,
      })
    })

    render()
  }

  function removeItem(item) {
    var idx = state.items.indexOf(item)
    if (idx < 0) return
    state.items.splice(idx, 1)
    URL.revokeObjectURL(item.url)
    render()
  }

  function clearAll() {
    state.items.forEach(function (it) {
      URL.revokeObjectURL(it.url)
    })
    state.items = []
    render()
    toast("列表已清空")
  }

  /* ---------------- 下载 ---------------- */

  function downloadOne(item, btn) {
    var original = btn.textContent
    btn.disabled = true
    btn.textContent = "转换中"

    return convertImage(item.file, item.format)
      .then(function (blob) {
        triggerDownload(blob, outputName(item.file.name, item.format))
      })
      .catch(function (err) {
        toast(
          "「" +
            item.file.name +
            "」转换失败：" +
            ((err && err.message) || "未知错误"),
        )
      })
      .then(function () {
        btn.disabled = false
        btn.textContent = original
      })
  }

  function setProgress(done, total) {
    var pct = total ? Math.round((done / total) * 100) : 0
    el.progressBar.style.width = pct + "%"
    el.downloadAll.textContent =
      done < total ? "打包中 " + done + "/" + total : "打包下载 ZIP"
  }

  function downloadAll() {
    var items = state.items.slice()
    if (!items.length) return

    var used = new Set()
    var entries = []
    var failed = []
    var index = 0

    el.downloadAll.disabled = true
    el.progress.hidden = false
    setProgress(0, items.length)

    function step() {
      if (index >= items.length) return Promise.resolve()

      var item = items[index]

      return convertImage(item.file, item.format)
        .then(function (blob) {
          return blob.arrayBuffer().then(function (buf) {
            entries.push({
              name: uniqueName(
                outputName(item.file.name, item.format),
                used,
              ),
              data: new Uint8Array(buf),
            })
          })
        })
        .catch(function () {
          failed.push(item.file.name)
        })
        .then(function () {
          index += 1
          setProgress(index, items.length)
          return nextFrame().then(step)
        })
    }

    step().then(function () {
      el.progress.hidden = true
      el.downloadAll.textContent = "打包下载 ZIP"
      el.downloadAll.disabled = false

      if (!entries.length) {
        toast("没有可打包的图片")
        return
      }

      triggerDownload(createZip(entries), "images-" + stamp() + ".zip")

      if (failed.length) {
        toast(
          "已打包 " +
            entries.length +
            " 张，" +
            failed.length +
            " 张失败",
        )
      } else {
        toast("已打包 " + entries.length + " 张图片")
      }
    })
  }

  /* ---------------- 事件绑定 ---------------- */

  el.pickBtn.addEventListener("click", function () {
    el.fileInput.click()
  })

  el.fileInput.addEventListener("change", function () {
    addFiles(el.fileInput.files)
    el.fileInput.value = ""
  })

  ;["dragenter", "dragover"].forEach(function (type) {
    el.dropZone.addEventListener(type, function (e) {
      e.preventDefault()
      e.stopPropagation()
      el.dropZone.classList.add("is-dragover")
    })
  })
  ;["dragleave", "drop"].forEach(function (type) {
    el.dropZone.addEventListener(type, function (e) {
      e.preventDefault()
      e.stopPropagation()
      if (type === "dragleave" && el.dropZone.contains(e.relatedTarget))
        return
      el.dropZone.classList.remove("is-dragover")
    })
  })

  el.dropZone.addEventListener("drop", function (e) {
    var files = e.dataTransfer && e.dataTransfer.files
    if (files && files.length) addFiles(files)
  })

  el.dropZone.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("button")) return
    el.fileInput.click()
  })

  el.dropZone.addEventListener("keydown", function (e) {
    if (e.target !== el.dropZone) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      el.fileInput.click()
    }
  })

  window.addEventListener("dragover", function (e) {
    e.preventDefault()
  })
  window.addEventListener("drop", function (e) {
    e.preventDefault()
  })

  el.globalFormat.addEventListener("change", function () {
    var fmt = el.globalFormat.value
    state.items.forEach(function (it) {
      it.format = fmt
    })
    Array.prototype.forEach.call(
      el.fileBody.querySelectorAll('select[data-action="format"]'),
      function (sel) {
        sel.value = fmt
      },
    )
  })

  el.quality.addEventListener("input", function () {
    el.qualityValue.textContent = Math.round(el.quality.value * 100) + "%"
  })

  el.clearBtn.addEventListener("click", clearAll)

  el.downloadAll.addEventListener("click", downloadAll)

  el.fileBody.addEventListener("change", function (e) {
    var sel =
      e.target.closest && e.target.closest('select[data-action="format"]')
    if (!sel) return
    var row = sel.closest("tr")
    var item = findItem(row.dataset.id)
    if (item) item.format = sel.value
  })

  el.fileBody.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button[data-action]")
    if (!btn) return

    var row = btn.closest("tr")
    var item = findItem(row.dataset.id)
    if (!item) return

    if (btn.dataset.action === "download") {
      downloadOne(item, btn)
    } else if (btn.dataset.action === "remove") {
      removeItem(item)
    }
  })

  render()
})()
