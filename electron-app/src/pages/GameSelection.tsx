import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../utils/auth';
import valoBG from '../../assets/valorant-bg.jpg';
import lolBG from '../../assets/lol-bg.jpg';

/**
 * GameSelection
 *
 * Simple page that lets the user choose between Valorant and League of Legends.
 * Users enter their Riot ID in the form <gameName>#<tagLine> and press Enter to
 * navigate to the appropriate dashboard. This component performs a minimal
 * validation against Riot's account API to resolve the account and obtain the
 * player's PUUID.
 */
const GameSelection: React.FC = () => {
  const [activeGame, setActiveGame] = useState<'valorant' | 'lol' | null>(null);
  const [valorantId, setValorantId] = useState('');
  const [lolId, setLolId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const user = getUser();

  // Read Riot API key from the environment once (used for fetch headers).
  const API_KEY = import.meta.env.RIOT_API_KEY as string;

  /**
   * Mark a game tile as active and clear any existing error message.
   */
  const handleGameClick = (game: 'valorant' | 'lol') => {
    setActiveGame(game);
    setErrorMessage('');
  };

  /**
   * Validate a Riot ID by calling Riot's account endpoint.
   *
   * Expected format: "name#tag" (e.g. "skywalker17#17605").
   * Throws an Error with a user-friendly message on failure.
   */
  const validateRiotId = async (
    riotId: string,
    region = 'europe'
  ): Promise<{ success: boolean; data?: any }> => {
    const parts = riotId.trim().split('#');

    if (parts.length !== 2) {
      throw new Error('Invalid format. Please use: gameName#tagLine');
    }

    const [gameName, tagLine] = parts;

    if (!gameName || !tagLine) {
      throw new Error('Both gameName and tagLine are required');
    }

    // const url =
    //   `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
    //   `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const backendurl = import.meta.env.VITE_BACKEND_URL || '';
    const url =
      `${backendurl}/api/riot/account/${region}/` +
      `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          // Prefer header token; keep API_KEY available for tools that expect
          // it in querystring if needed elsewhere.
          'X-Riot-Token': API_KEY,
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        return { success: true, data };
      }

      // Map common HTTP error statuses to clear messages for the user.
      if (response.status === 404) {
        throw new Error('Account not found. Please check your Riot ID.');
      }
      if (response.status === 401) {
        throw new Error('API key is invalid or expired.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      throw new Error(`Error ${response.status}: Unable to validate account.`);
    } catch (err) {
      // Re-throw any Error instances so callers can surface friendly text.
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Network error. Please check your connection.');
    }
  };

  /**
   * Handle Enter key on the Valorant input. Resolves Riot account and navigates
   * to the Valorant dashboard on success.
   */
  const handleValorantSubmit = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== 'Enter' || !valorantId.trim() || isValidating) return;

    setIsValidating(true);
    setErrorMessage('');

    try {
      const result = await validateRiotId(valorantId, 'europe');

      if (result.success && user) {
        localStorage.setItem(`user_${user.id}_lastGame`, 'valorant');
      }

      const role = user?.role || 'player';
      navigate(
        `/${role}/valorant-dashboard?user=${encodeURIComponent(
          valorantId
        )}&puuid=${result.data.puuid}`
      );
    } catch (err) {
      if (err instanceof Error) setErrorMessage(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Handle Enter key on the LoL input. Resolves Riot account and navigates to
   * the LoL dashboard on success.
   */
  const handleLolSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !lolId.trim() || isValidating) return;

    setIsValidating(true);
    setErrorMessage('');

    try {
      const result = await validateRiotId(lolId, 'europe');

      if (result.success && user) {
        localStorage.setItem(`user_${user.id}_lastGame`, 'lol');
      }

      const role = user?.role || 'player';
      navigate(
        `/${role}/lol-dashboard?user=${encodeURIComponent(lolId)}&puuid=${result.data.puuid}`
      );
    } catch (err) {
      if (err instanceof Error) setErrorMessage(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden">
      {/* Valorant Side */}
      <div
        className={`relative flex-1 bg-cover bg-center cursor-pointer transition-all duration-500 ease-in-out ${activeGame === 'valorant'
          ? 'flex-[0.6]'
          : activeGame === 'lol'
            ? 'flex-[0.4]'
            : 'flex-1'
          } ${activeGame === 'lol' ? 'brightness-60' : ''}`}
        style={{
          backgroundImage: `url(${valoBG})`,
          backgroundSize: activeGame === 'valorant' ? '110%' : 'cover',
        }}
        onClick={() => handleGameClick('valorant')}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40 hover:bg-opacity-20 transition-all duration-300" />

        <div className="absolute bottom-8 left-8 text-white text-5xl font-bold z-10 drop-shadow-2xl">
          VALORANT
        </div>

        <div
          className={`absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center transition-all duration-500 z-20 ${activeGame === 'valorant'
            ? 'opacity-100 bottom-1/2 translate-y-1/2'
            : 'opacity-0 bottom-24 pointer-events-none'
            }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={valorantId}
            onChange={(e) => setValorantId(e.target.value)}
            onKeyPress={handleValorantSubmit}
            placeholder="Enter Riot ID (e.g., skywalker17#17605)"
            className="px-5 py-3 w-80 rounded-full text-center text-base outline-none bg-white text-gray-800"
            disabled={activeGame !== 'valorant' || isValidating}
          />

          <div className="text-white text-sm mt-3">
            {isValidating && activeGame === 'valorant' ? 'Validating...' : 'Press Enter to view dashboard'}
          </div>

          {errorMessage && activeGame === 'valorant' && (
            <div className="text-red-400 text-sm mt-2 bg-black bg-opacity-70 px-4 py-2 rounded">
              {errorMessage}
            </div>
          )}
        </div>
      </div>

      {/* League of Legends Side */}
      <div
        className={`relative flex-1 bg-cover bg-center cursor-pointer transition-all duration-500 ease-in-out ${activeGame === 'lol' ? 'flex-[0.6]' : activeGame === 'valorant' ? 'flex-[0.4]' : 'flex-1'
          } ${activeGame === 'valorant' ? 'brightness-60' : ''}`}
        style={{
          backgroundImage: `url(${lolBG})`,
          backgroundSize: activeGame === 'lol' ? '110%' : 'cover',
        }}
        onClick={() => handleGameClick('lol')}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40 hover:bg-opacity-20 transition-all duration-300" />

        <div className="absolute bottom-8 left-8 text-white text-5xl font-bold z-10 drop-shadow-2xl">
          LEAGUE OF LEGENDS
        </div>

        <div
          className={`absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center transition-all duration-500 z-20 ${activeGame === 'lol'
            ? 'opacity-100 bottom-1/2 translate-y-1/2'
            : 'opacity-0 bottom-24 pointer-events-none'
            }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={lolId}
            onChange={(e) => setLolId(e.target.value)}
            onKeyPress={handleLolSubmit}
            placeholder="Enter Riot ID (e.g., skywalker17#17605)"
            className="px-5 py-3 w-80 rounded-full text-center text-base outline-none bg-white text-gray-800"
            disabled={activeGame !== 'lol' || isValidating}
          />

          <div className="text-white text-sm mt-3">
            {isValidating && activeGame === 'lol' ? 'Validating...' : 'Press Enter to view dashboard'}
          </div>

          {errorMessage && activeGame === 'lol' && (
            <div className="text-red-400 text-sm mt-2 bg-black bg-opacity-70 px-4 py-2 rounded">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameSelection;