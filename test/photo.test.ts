// 图片工具纯逻辑：文件名与 ZIP 打包
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { createZip } from "../lib/photo/convert.ts"
import { outputName, uniqueName } from "../lib/photo/naming.ts"

test("图片：输出名与重名去重", () => {
  assert.equal(outputName("photo.PNG", "webp"), "photo.webp")
  assert.equal(outputName("无后缀", "jpg"), "无后缀.jpg")
  const used = new Set<string>()
  assert.equal(uniqueName("a.jpg", used), "a.jpg")
  assert.equal(uniqueName("a.jpg", used), "a(2).jpg")
  assert.equal(uniqueName("a.jpg", used), "a(3).jpg")
})

test("图片：ZIP 结构能被 unzip 校验并还原内容", async () => {
  const encoder = new TextEncoder()
  const entries = [
    { name: "a.txt", data: encoder.encode("hello zip") },
    { name: "b.txt", data: encoder.encode("第二份内容") },
  ]
  const blob = await createZip(entries).arrayBuffer()
  const dir = mkdtempSync(join(tmpdir(), "zip-test-"))
  const file = join(dir, "out.zip")
  writeFileSync(file, Buffer.from(blob))

  const listed = execFileSync("unzip", ["-l", file], { encoding: "utf8" })
  assert.ok(listed.includes("a.txt"))
  assert.ok(listed.includes("b.txt"))
  execFileSync("unzip", ["-t", file])
  const text = execFileSync("unzip", ["-p", file, "b.txt"], {
    encoding: "utf8",
  })
  assert.equal(text, "第二份内容")
})
