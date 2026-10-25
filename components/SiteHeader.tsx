import ThemeToggle from "./ThemeToggle"

export default function SiteHeader() {
  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        <img className="site-home-icon" src="/favicon.svg" alt="" />
        <span>贾师傅的小站</span>
      </a>
      <nav className="site-nav" aria-label="站点导航">
        <a href="/#data">数据</a>
        <a href="/#tools">工具</a>
        <a href="/#games">游戏</a>
      </nav>
      <div className="site-actions">
        <ThemeToggle />
      </div>
    </header>
  )
}
