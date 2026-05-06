import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../../utils/auth';
import logo from '../../../assets/logo.png';

interface PlayerLayoutProps {
  children: React.ReactNode;
}

const PlayerLayout: React.FC<PlayerLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [currentGame, setCurrentGame] = useState<'valorant' | 'lol' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Track sessionStorage values to rebuild nav links when they change
  const [sessionVersion, setSessionVersion] = useState(0);

  // Poll sessionStorage for changes (needed because sessionStorage doesn't emit events)
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionVersion(v => v + 1);
    }, 1000); // Check every 1 second (reduced from 500ms to minimize re-renders)

    return () => clearInterval(interval);
  }, []);

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

  // Build nav items with Riot ID and PUUID from sessionStorage
  // Re-builds on every render triggered by sessionVersion updates
  const navItems = [];

  // This reference ensures component re-renders when sessionVersion changes (triggers re-render every 1s)
  void sessionVersion;

  // First: Change Game
  navItems.push({ path: '/game-selection', label: 'Change Game', icon: 'swap' });

  // Second: Current game dashboard WITH Riot ID
  if (currentGame === 'valorant') {
    const riotId = sessionStorage.getItem('current_valorant_riot_id');
    const dashboardPath = riotId && riotId !== 'Unknown'
      ? `/player/valorant-dashboard?user=${encodeURIComponent(riotId)}`
      : '/player/valorant-dashboard';

    navItems.push({
      path: dashboardPath,
      label: 'Valorant Dashboard',
      icon: 'dashboard'
    });
  } else if (currentGame === 'lol') {
    const riotId = sessionStorage.getItem('current_lol_riot_id');
    const dashboardPath = riotId && riotId !== 'Unknown'
      ? `/player/lol-dashboard?user=${encodeURIComponent(riotId)}`
      : '/player/lol-dashboard';

    navItems.push({
      path: dashboardPath,
      label: 'LoL Dashboard',
      icon: 'dashboard'
    });
  }

  if (currentGame === 'valorant') {
    const riotId = sessionStorage.getItem('current_valorant_riot_id');
    const puuid = sessionStorage.getItem('current_valorant_puuid');
    const feedbackPath = riotId && riotId !== 'Unknown' && puuid
      ? `/player/valorant-recordinglist?user=${encodeURIComponent(riotId)}&puuid=${encodeURIComponent(puuid)}`
      : '/player/valorant-recordinglist';

    navItems.push({
      path: feedbackPath,
      label: 'Feedback Review',
      icon: 'feedback'
    });
  } else if (currentGame === 'lol') {
    const riotId = sessionStorage.getItem('current_lol_riot_id');
    const puuid = sessionStorage.getItem('current_lol_puuid');

    const feedbackPath = riotId && riotId !== 'Unknown' && puuid
      ? `/player/lol-recordinglist?user=${encodeURIComponent(riotId)}&puuid=${encodeURIComponent(puuid)}`
      : '/player/lol-recordinglist';

    navItems.push({
      path: feedbackPath,
      label: 'Feedback Review',
      icon: 'feedback'
    });
  }

  // Third & Fourth: Other pages
  navItems.push({ path: '/player/toolkitsetup', label: 'Toolkit Setup', icon: 'toolkit' });

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
      case 'feedback':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'toolkit':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // const isActive = (path: string) => {
  //   // For dashboard links, just check if we're on a dashboard page
  //   if (path.includes('valorant-dashboard')) {
  //     return location.pathname.includes('valorant-dashboard');
  //   }
  //   if (path.includes('lol-dashboard')) {
  //     return location.pathname.includes('lol-dashboard');
  //   }
  //   return location.pathname === path;
  // };
  const normalize = (p: string) => p.split('?')[0].replace(/\/+$/, '');

const isActive = (path: string) => {
  const navPath = normalize(path);
  const currentPath = normalize(location.pathname);

  // Dashboards (special case)
  if (navPath.includes('valorant-dashboard')) {
    return currentPath.includes('valorant-dashboard');
  }
  if (navPath.includes('lol-dashboard')) {
    return currentPath.includes('lol-dashboard');
  }

  // Feedback + others (prefix match)
  return currentPath === navPath || currentPath.startsWith(navPath + '/');
};

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-900 to-yellow-900/20">
      {/* Sidebar */}
      <aside
        className={`bg-gradient-to-b from-gray-950 to-black border-r border-yellow-500/20 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'
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
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${isActive(item.path)
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
                Player
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

      {/* Toggle Button When Sidebar is Closed */}
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

export default PlayerLayout;