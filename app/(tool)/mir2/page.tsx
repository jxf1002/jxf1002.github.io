import Mir2Game from "../../../components/mir2/Mir2Game"
import { metadataFor } from "../../../lib/site"
// 游戏样式必须排在 site.css 之后（自带 :root 变量要压过站点浅色变量），
// 级联顺序由 scripts/check-build.ts 断言。
import "./style.css"

export const metadata = metadataFor("mir2")

export default function Page() {
  return <Mir2Game />
}
