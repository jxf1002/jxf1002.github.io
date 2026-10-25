import MahjongGame from "../../../components/mahjong/MahjongGame"
import { metadataFor } from "../../../lib/site"
// 主题与牌桌样式仍要排在 site.css 之后（游戏自带 :root 变量要压过站点浅色变量）。
// 路由 CSS 由 Next 统一注入，级联顺序由 scripts/check-build.ts 断言。
import "./driver.css"
import "./style.css"

export const metadata = metadataFor("mahjong")

export default function Page() {
  return <MahjongGame />
}
