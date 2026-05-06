import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { setAuthToken, setUser } from '../utils/auth';
import { UserRole } from '../types';
import logo from '../../assets/logo.png';

/**
 * Login
 *
 * Simple login form used to authenticate users. On successful authentication
 * the auth token and user object are stored via helper utilities and the
 * app navigates to the game selection screen.
 */
const Login: React.FC = () => {
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /**
   * Attempt to authenticate the user using the authAPI service. Shows a
   * user-friendly error message when authentication fails.
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ username, password });
      setAuthToken(response.access_token);
      setUser(response.user);

      // Navigate to game selection regardless of role for now. Keeping role
      // check in case future behavior diverges.
      navigate('/game-selection');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-yellow-900/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <div className="bg-gradient-to-b from-gray-950 to-black p-8 rounded-2xl shadow-2xl w-full max-w-md border border-yellow-500/20 relative z-10">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/5 to-amber-600/5 rounded-2xl pointer-events-none" />

        {/* Logo and Title */}
        <div className="text-center mb-8 relative z-10">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-yellow-500 rounded-full blur-md opacity-20" />
            <img
              src={logo}
              alt="B.G.E.T."
              className="w-32 h-32 mx-auto object-contain relative z-10"
            />
          </div>

          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2 tracking-tight">
            B.G.E.T.
          </h1>

          <p className="text-yellow-300/60 font-semibold tracking-wide text-sm uppercase">
            Breda Guardians Esports Tool
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              // small console trace to help during development
              // remove or gate behind a debug flag in production
              // eslint-disable-next-line no-console
              setUsername(e.target.value);
            }}
            className="w-full px-4 py-3 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
            placeholder="Enter your username"
            autoComplete="username"
            name="username"
            id="username"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
            placeholder="Enter your password"
            autoComplete="current-password"
            name="password"
            id="password"
            required
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black py-3 rounded-lg font-black tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105 text-sm uppercase"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <p className="text-gray-400 text-sm font-medium">
            Don't have an account?{' '}
            <Link to="/signup" className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;