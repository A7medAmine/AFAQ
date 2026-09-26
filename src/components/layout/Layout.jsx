import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import SmoothScroll from '../shared/SmoothScroll'

export default function Layout() {
  return (
    <SmoothScroll>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <Navbar />
        <main className="flex-1">
          {/* Pages are lazy chunks; keep the navbar up while one loads. */}
          <Suspense fallback={<div className="min-h-screen" />}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  )
}
