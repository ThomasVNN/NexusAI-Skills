import React, { useState, useEffect } from 'react';
import { SkillsPage } from './pages/Skills';
import { MonitorPage } from './pages/Monitor';
import { ApprovalsPage } from './pages/Approvals';
import { AnalyticsPage } from './pages/Analytics';
import { ConfigPage } from './pages/Config';

type Page = 'skills' | 'monitor' | 'approvals' | 'analytics' | 'config';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('skills');
  const [health, setHealth] = useState<{ status: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealth(data);
    } catch {
      setHealth({ status: 'ok' }); // Mock for demo
    }
  };

  const navItems: NavItem[] = [
    {
      id: 'skills',
      label: 'Skills Registry',
      icon: <SkillsIcon />,
    },
    {
      id: 'monitor',
      label: 'Execution Monitor',
      icon: <MonitorIcon />,
    },
    {
      id: 'approvals',
      label: 'Approval Queue',
      icon: <ApprovalIcon />,
      badge: 3,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <AnalyticsIcon />,
    },
    {
      id: 'config',
      label: 'Configuration',
      icon: <ConfigIcon />,
    },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'skills':
        return <SkillsPage />;
      case 'monitor':
        return <MonitorPage />;
      case 'approvals':
        return <ApprovalsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'config':
        return <ConfigPage />;
      default:
        return <SkillsPage />;
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-bg-secondary border-r border-border-subtle flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-text-primary">NexusAI</h1>
                <p className="text-xs text-text-tertiary">Skills Dashboard</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 hover:bg-bg-elevated transition-colors flex justify-center"
        >
          <svg className={`w-5 h-5 text-text-tertiary transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${
                currentPage === item.id
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-transparent'
              }`}
            >
              <span className={`flex-shrink-0 ${currentPage === item.id ? 'text-accent-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="font-medium flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="bg-accent-primary text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Health Status */}
        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                health?.status === 'ok' ? 'bg-success animate-pulse' : 'bg-warning'
              }`}
            />
            {!collapsed && (
              <span className="text-sm text-text-tertiary truncate">
                {health?.status === 'ok' ? 'Service Healthy' : 'Checking...'}
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary capitalize">
                {currentPage.replace('-', ' ')}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-tertiary">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function SkillsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ApprovalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ConfigIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default App;
