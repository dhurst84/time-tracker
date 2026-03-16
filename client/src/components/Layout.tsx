import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import ActiveTimerBar from './ActiveTimerBar'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile timer bar — sits below the fixed top bar */}
        <div className="lg:hidden pt-12">
          <ActiveTimerBar />
        </div>

        <main className="flex-1 overflow-y-auto lg:pt-0">
          <Outlet />
        </main>

        {/* Mobile hamburger + slide-out nav */}
        <BottomNav />
      </div>
    </div>
  )
}
