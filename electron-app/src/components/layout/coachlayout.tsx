import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../../utils/auth';
import logo from '../../../assets/logo.png';

interface CoachLayoutProps {
  children: React.ReactNode;
}

const CoachLayout: React.FC<CoachLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [currentGame, setCurrentGame] = useState<'valorant' | 'lol' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (location.pathname.includes('valorant-dashboard')) {
      setCurrentGame('valorant');
      if (user) {
        localStorage.setItem(`user_${user.id}_lastGame`, 'valorant');
      }
    } else if (location.pathname.includes('lol-dashboard')) {
      setCurrentGame('lol');
      if (user) {
        localStorage.setItem(`user_${user.id}_lastGame`, 'lol');
      }
    } else {
      if (user) {
        const lastGame = localStorage.getItem(`user_${user.id}_lastGame`) as 'valorant' | 'lol' | null;
        if (lastGame) {
          setCurrentGame(lastGame);
        }
      }
    }
  }, [location.pathname, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const navItems = [];

  // First: Change Game
  navItems.push({ path: '/game-selection', label: 'Change Game', icon: 'swap' });

  if (currentGame === 'valorant') {
    const riotId = sessionStorage.getItem('current_valorant_riot_id');
    const dashboardPath = riotId
      ? `/coach/valorant-dashboard?user=${encodeURIComponent(riotId)}`
      : '/coach/valorant-dashboard';

    navItems.push({
      path: dashboardPath,
      label: 'Valorant Dashboard',
      icon: 'dashboard'
    });
  } else if (currentGame === 'lol') {
    const riotId = sessionStorage.getItem('current_lol_riot_id');
    const dashboardPath = riotId
      ? `/coach/lol-dashboard?user=${encodeURIComponent(riotId)}`
      : '/coach/lol-dashboard';

    navItems.push({
      path: dashboardPath,
      label: 'LoL Dashboard',
      icon: 'dashboard'
    });
  }

  if (currentGame === 'valorant') {
    navItems.push(
      { path: '/coach/valorant-recordinganalysis', label: 'Recording Analysis', icon: 'video' }
    );
  } else if (currentGame === 'lol') {
    navItems.push(
      { path: '/coach/lol-recordinganalysis', label: 'Recording Analysis', icon: 'video' }
    );
  }

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'swap':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'dashboard':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const isActive = (path: string) => {
    if (path.includes('valorant-dashboard')) {
      return location.pathname.includes('valorant-dashboard');
    }
    if (path.includes('lol-dashboard')) {
      return location.pathname.includes('lol-dashboard');
    }
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-900 to-yellow-900/20">
      {/* Sidebar */}
      <aside
        className={`bg-gradient-to-b from-gray-950 to-black border-r border-yellow-500/20 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0'
        } overflow-hidden relative shadow-2xl`}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/5 to-amber-600/5 pointer-events-none"></div>

        {/* Toggle Button */}
        {sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-1/2 transform -translate-y-1/2 
               bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500
               text-black rounded-lg p-3 shadow-lg
               border border-yellow-500/50 transition-all duration-300 z-50
               hover:shadow-yellow-500/50 hover:shadow-xl"
            title="Close Sidebar"
          >
            <svg
              className="w-5 h-5 transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Logo */}
        <div className="p-4 border-b border-yellow-500/20 pr-14 relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500 rounded-lg blur-md opacity-20"></div>
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain relative z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 tracking-tight">
                B.G.E.T.
              </h1>
              <p className="text-xs font-semibold text-yellow-300/80 tracking-wide uppercase">
                {user?.team}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 relative z-10">
          {navItems.map((item, index) => (
            <Link
              key={`${item.path}-${index}`}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isActive(item.path)
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/50 scale-105 font-black'
                  : 'text-gray-300 hover:bg-gray-800/50 hover:text-yellow-400 hover:scale-102'
              }`}
            >
              <div className="group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                {getIcon(item.icon)}
              </div>
              <span className="font-bold text-sm tracking-wide whitespace-nowrap">
                {item.label}
              </span>
              {isActive(item.path) && (
                <div className="ml-auto w-2 h-2 rounded-full bg-black animate-pulse"></div>
              )}
            </Link>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-yellow-500/20 relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full blur-sm opacity-50"></div>
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full flex items-center justify-center relative z-10 shadow-lg">
                <span className="text-black font-black text-lg">
                  {user?.username[0].toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-bold tracking-wide">
                {user?.username}
              </p>
              <p className="text-xs font-semibold text-yellow-300/80 tracking-wider uppercase">
                Coach
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 
                     hover:from-red-600 hover:to-red-700 text-white rounded-lg text-sm 
                     font-bold tracking-wide transition-all duration-300 
                     hover:shadow-lg hover:shadow-red-500/50 hover:scale-105"
          >
            Logout
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50 p-3 
                   bg-gradient-to-r from-yellow-500 to-amber-500 
                   hover:from-yellow-400 hover:to-amber-400
                   text-black rounded-r-lg shadow-lg border border-l-0 border-yellow-500/50 
                   transition-all duration-300 hover:shadow-yellow-500/50 hover:shadow-xl"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default CoachLayout;