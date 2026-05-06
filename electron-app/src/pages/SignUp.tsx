import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import logo from '../../assets/logo.png';
/**
 * SignUp
 *
 * Registration form used to create a new user. Performs basic client-side
 * validation (password length and confirmation) before calling the backend
 * signup endpoint. On success, a success banner is shown and the user is
 * redirected to the login screen.
 */
const SignUp: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'player' as 'player' | 'coach',
    team: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  /**
   * Generic handler for inputs and selects that updates the local form state.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /**
   * Submit the registration form after validating passwords client-side.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match and satisfy a minimal length requirement
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await authAPI.signup({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        team: formData.team,
      });

      // Show a small success confirmation and redirect to login.
      setShowSuccess(true);

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Sign up failed. Please try again.');
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

        <div className="text-center mb-6 relative z-10">
          <div className="relative inline-block mb-3">
            <div className="absolute inset-0 bg-yellow-500 rounded-full blur-md opacity-20" />
            <img src={logo} alt="B.G.E.T." className="w-20 h-20 mx-auto object-contain relative z-10" />
          </div>

          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2 tracking-tight">
            Create Account
          </h1>

          <p className="text-yellow-300/60 font-semibold tracking-wide text-sm uppercase">Join Play-O-Meter Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-yellow-200 mb-2 text-sm font-bold tracking-wide">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
              placeholder="Choose a username"
              required
            />
          </div>

          <div>
            <label className="block text-yellow-200 mb-2 text-sm font-bold tracking-wide">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
              placeholder="your.email@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-yellow-200 mb-2 text-sm font-bold tracking-wide">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div>
            <label className="block text-yellow-200 mb-2 text-sm font-bold tracking-wide">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
              placeholder="Re-enter password"
              required
            />
          </div>

          <div>
            <label className="block text-yellow-200 mb-2 text-sm font-bold tracking-wide">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-medium cursor-pointer transition-all duration-300"
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
            </select>
          </div>

          <div>
            <label className="block text-yellow-200 mb-2 text-sm font-bold tracking-wide">Team</label>
            <input
              type="text"
              name="team"
              value={formData.team}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-gray-900/50 text-white rounded-lg border border-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500 font-medium transition-all duration-300"
              placeholder="Team name"
              required
            />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm font-semibold">{error}</div>}

          {showSuccess && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <span>✓</span>
              <span>Account created! Redirecting to login...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || showSuccess}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black py-3 rounded-lg font-black tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105 text-sm uppercase"
          >
            {loading ? 'Creating Account...' : showSuccess ? 'Success!' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <p className="text-gray-400 text-sm font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;