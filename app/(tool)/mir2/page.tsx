import Mir2Game from "../../../components/mir2/Mir2Game"
import { metadataFor } from "../../../lib/site"

export const metadata = metadataFor("mir2")

export default function Page() {
  return (
    <>
      {/* 游戏样式必须排在 site.css 之后（自带 :root 变量要压过站点浅色变量），
          所以这里手写 <link> 而不是 import，保证级联顺序和旧页面一致 */}
      <link rel="stylesheet" href="/mir2/style.css?v=2" />
      <Mir2Game />
    </>
  )
}
