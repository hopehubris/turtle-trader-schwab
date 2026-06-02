import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import TerminalDashboard from './pages/TerminalDashboard'
import Trades from './pages/Trades'
import Signals from './pages/Signals'
import Settings from './pages/Settings'
import Help from './pages/Help'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', exact: true, icon: '▦' },
  { path: '/trades', label: 'Trades', icon: '↕' },
  { path: '/signals', label: 'Signals', icon: '◈' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
  { path: '/help', label: 'Help', icon: '?' },
]

function TerminalSidebar() {
  const { theme, setView } = useTheme()
  const location = useLocation()

  return (
    <aside
      style={{ width: 220, background: '#0d1117', borderRight: '1px solid #1a2233', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}
      className="hidden md:flex"
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1a2233' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', fontFamily: "'Sora', sans-serif" }}>🐢 Turtle Trader</div>
        <div style={{ fontSize: 10, color: '#637087', fontFamily: "'JetBrains Mono', monospace", marginTop: 4, letterSpacing: '0.1em' }}>SCHWAB · TERMINAL</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                fontFamily: "'Sora', sans-serif",
                transition: 'all 0.15s',
                ...(isActive
                  ? { color: '#00e5b0', background: 'rgba(0,229,176,0.1)', border: '1px solid rgba(0,229,176,0.15)' }
                  : { color: '#637087', background: 'transparent', border: '1px solid transparent' }),
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* View Switcher */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #1a2233' }}>
        <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', paddingLeft: 4 }}>VIEW MODE</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setView('classic')}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: "'Sora', sans-serif",
              transition: 'all 0.15s',
              ...(theme === 'classic'
                ? { background: '#60a5fa', color: '#07090f' }
                : { background: '#1a2233', color: '#637087' }),
            }}
          >
            Classic
          </button>
          <button
            onClick={() => setView('terminal')}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: "'Sora', sans-serif",
              transition: 'all 0.15s',
              ...(theme === 'terminal'
                ? { background: '#00e5b0', color: '#07090f' }
                : { background: '#1a2233', color: '#637087' }),
            }}
          >
            Terminal
          </button>
        </div>
      </div>
    </aside>
  )
}

function ClassicNav() {
  const { theme, setView } = useTheme()

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="font-bold text-gray-900 dark:text-white mr-4 text-sm">🐢 Turtle Trader (Schwab)</span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setView('classic')}
              style={{
                padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                ...(theme === 'classic' ? { background: '#3b82f6', color: '#fff' } : { background: '#f3f4f6', color: '#6b7280' }),
              }}
            >
              Classic
            </button>
            <button
              onClick={() => setView('terminal')}
              style={{
                padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                ...(theme === 'terminal' ? { background: '#00e5b0', color: '#07090f' } : { background: '#f3f4f6', color: '#6b7280' }),
              }}
            >
              Terminal
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

function MobileBottomNav() {
  const location = useLocation()
  const mobileItems = NAV_ITEMS.slice(0, 4)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ background: '#0d1117', borderTop: '1px solid #1a2233' }}
    >
      <div style={{ display: 'flex' }}>
        {mobileItems.map((item) => {
          const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 0', textDecoration: 'none', gap: 2,
                color: isActive ? '#00e5b0' : '#637087',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>{item.label.toUpperCase()}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

function AppContent() {
  const { theme } = useTheme()

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'terminal') {
      html.classList.add('dark', 'terminal')
    } else {
      html.classList.remove('dark', 'terminal')
    }
  }, [theme])

  if (theme === 'terminal') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#07090f' }}>
        <TerminalSidebar />
        <main style={{ flex: 1, padding: '20px 24px', paddingBottom: 64, overflowY: 'auto' }} className="md:pb-0">
          <Routes>
            <Route path="/" element={<TerminalDashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </main>
        <MobileBottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ClassicNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  )
}
