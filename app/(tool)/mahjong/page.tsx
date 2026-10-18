import MahjongGame from "../../../components/mahjong/MahjongGame"
import { metadataFor } from "../../../lib/site"

export const metadata = metadataFor("mahjong")

export default function Page() {
  return (
    <>
      {/* 主题与牌桌样式必须排在 site.css 之后（游戏自带 :root 变量要压过站点浅色变量），
          所以这里手写 <link> 而不是 import，保证级联顺序和旧页面一致 */}
      <link rel="stylesheet" href="/mahjong/vendor/driver.css?v=1" />
      <link rel="stylesheet" href="/mahjong/style.css?v=52" />
      <MahjongGame />
    </>
  )
}
