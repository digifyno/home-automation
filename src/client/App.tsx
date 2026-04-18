import React, { useState } from 'react';
import { Home, Lightbulb, Thermometer, Shield, Zap, PlayCircle, Menu, X } from 'lucide-react';
import { useHealth } from './hooks/useHealth.ts';
import Dashboard from './pages/Dashboard.tsx';
import Lights from './pages/Lights.tsx';
import Climate from './pages/Climate.tsx';
import Security from './pages/Security.tsx';
import Energy from './pages/Energy.tsx';
import Scenes from './pages/Scenes.tsx';

type Page = 'dashboard' | 'lights' | 'climate' | 'security' | 'energy' | 'scenes';

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={20} /> },
  { id: 'lights', label: 'Lights', icon: <Lightbulb size={20} /> },
  { id: 'climate', label: 'Climate', icon: <Thermometer size={20} /> },
  { id: 'security', label: 'Security', icon: <Shield size={20} /> },
  { id: 'energy', label: 'Energy', icon: <Zap size={20} /> },
  { id: 'scenes', label: 'Scenes', icon: <PlayCircle size={20} /> },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: health, isError: healthError, isLoading: healthLoading } = useHealth();
  const healthStatus: 'live' | 'degraded' | 'offline' | 'checking' =
    healthLoading ? 'checking'
    : healthError ? 'offline'
    : health?.status === 'ok' ? 'live'
    : health?.status === 'degraded' ? 'degraded'
    : 'offline';
  const dotColor =
    healthStatus === 'live' ? 'bg-green-400 animate-pulse'
    : healthStatus === 'degraded' ? 'bg-yellow-400'
    : healthStatus === 'checking' ? 'bg-gray-400 animate-pulse'
    : 'bg-red-400';
  const statusLabel =
    healthStatus === 'live' ? 'Live'
    : healthStatus === 'degraded' ? 'Degraded'
    : healthStatus === 'checking' ? 'Checking'
    : 'Offline';

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard />,
    lights: <Lights />,
    climate: <Climate />,
    security: <Security />,
    energy: <Energy />,
    scenes: <Scenes />,
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Hamburger button (mobile only) */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 rounded-lg text-gray-400 hover:text-white"
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop (mobile only) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed md:static inset-y-0 left-0 z-40
        w-64 bg-gray-900 border-r border-gray-800 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Home size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm">Home Control</h1>
              <p className="text-xs text-gray-400">Fibaro HC3</p>
            </div>
          </div>
        </div>
        <div className="flex-1 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              aria-current={page === item.id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                page === item.id
                  ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            {statusLabel}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto md:ml-0">
        {pages[page]}
      </main>
    </div>
  );
}
