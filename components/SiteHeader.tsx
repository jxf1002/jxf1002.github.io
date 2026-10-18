import ThemeToggle from "./ThemeToggle"

export default function SiteHeader() {
  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        <img className="site-home-icon" src="/favicon.svg" alt="" />
        <span>贾师傅的小站</span>
      </a>
      <div className="site-actions">
        <ThemeToggle />
      </div>
    </header>
  )
}
