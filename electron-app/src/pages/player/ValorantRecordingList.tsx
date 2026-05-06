import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser } from '../../utils/auth';
import api from '../../services/api';
import {API_BASE_URL} from '../../services/api';

interface MatchData {
  match_id: string;
  map: string;
  mode: string;
  rounds_played: number;
  game_start: number;
  game_end: number;
  game_length: number;
  time_difference_seconds: number;
  player_stats: {
    agent: string;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    headshots: number;
    bodyshots: number;
    legshots: number;
    team: string;
  } | null;
}

interface Match {
  filename: string;
  display_name: string;
  game_type: string;
  date: string;
  has_video: boolean;
  has_merged_data: boolean;
  video_path: string | null;
  merged_data_path: string | null;
  match_data?: MatchData | null;
  loading?: boolean;
}

/**
 * PlayerValorantRecordingList
 * ---------------------------
 * Lists Valorant recording files found in the toolkit data directory and
 * optionally enriches them with online match metadata using the backend
 * enrichment endpoint.
 *
 * Key behaviors:
 * - Resolve Riot ID / PUUID from URL or sessionStorage
 * - Fetch local matches from the toolkit data directory
 * - When a Riot ID is available, call an enrichment endpoint to match
 *   local files to Riot match metadata (reduces manual matching effort)
 */
const PlayerValorantRecordingList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = getUser();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [currentRiotId, setCurrentRiotId] = useState('');
  const [currentPuuid, setCurrentPuuid] = useState('');
  const [isMatchingWithAPI, setIsMatchingWithAPI] = useState(false);
  const [matchingError, setMatchingError] = useState<string>('');
  const hasEnrichedWithRiotId = useRef(false);

  const REGION = 'europe';

  // Resolve Riot ID and PUUID from URL or sessionStorage. We set both
  // the `current_valorant_riot_id` and `current_valorant_puuid` keys for
  // compatibility with other pages that expect either key.
  useEffect(() => {
    const riotIdFromUrl = searchParams.get('user');
    const puuidFromUrl = searchParams.get('puuid');


    if (riotIdFromUrl) {
      sessionStorage.setItem('current_valorant_riot_id', riotIdFromUrl);
      setCurrentRiotId(riotIdFromUrl);
    } else {
      const savedRiotId = sessionStorage.getItem('current_valorant_riot_id');
      if (savedRiotId) {
        setCurrentRiotId(savedRiotId);
      } else {
        console.warn('⚠️ No Riot ID found');
      }
    }

    if (puuidFromUrl) {
      sessionStorage.setItem('current_valorant_puuid', puuidFromUrl);
      setCurrentPuuid(puuidFromUrl);
    } else {
      const savedPuuid = sessionStorage.getItem('current_valorant_puuid');
      if (savedPuuid) {
        setCurrentPuuid(savedPuuid);
      } else {
        console.warn('⚠️ No PUUID found - will fetch from Riot API');
      }
    }

  }, [searchParams]);

  // If a Riot ID is present but no PUUID is stored, fetch the PUUID using
  // the backend Riot account lookup endpoint so we can call match APIs.
  useEffect(() => {
    const fetchPuuid = async () => {
      if (currentRiotId && currentRiotId !== 'Unknown' && !currentPuuid) {
        try {
          const [gameName, tagLine] = currentRiotId.split('#');
          const response = await api.get(`/riot/account/${REGION}/${gameName}/${tagLine}`);
          const fetchedPuuid = response.data.puuid;

          setCurrentPuuid(fetchedPuuid);
          sessionStorage.setItem('current_valorant_puuid', fetchedPuuid);
        } catch (error) {
          console.error('❌ Error fetching PUUID:', error);
        }
      }
    };

    fetchPuuid();
  }, [currentRiotId, currentPuuid]);

  // When a Riot ID is known and we haven't enriched matches yet, call the
  // enrichment API to attach Riot match metadata to local recordings.
  useEffect(() => {
    if (currentRiotId && currentRiotId !== 'Unknown' && matches.length > 0 && !hasEnrichedWithRiotId.current) {
      const needsEnrichment = matches.some(m => !m.match_data && m.loading !== false);

      if (needsEnrichment) {
        hasEnrichedWithRiotId.current = true;
        enrichMatchesWithAPI();
      }
    }
  }, [currentRiotId, matches]);

  const enrichMatchesWithAPI = async () => {
    if (!currentRiotId || currentRiotId === 'Unknown' || matches.length === 0) {
      return;
    }

    setIsMatchingWithAPI(true);
    setMatchingError('');

    try {

      const matchesToEnrich = matches.map(m => ({ filename: m.filename }));

      const response = await fetch(`${API_BASE_URL}/api/valorant/enrich-matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          riot_id: decodeURIComponent(currentRiotId),
          matches: matchesToEnrich,
          region: 'eu'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to enrich matches with API');
      }

      const data = await response.json();

      if (data.success && data.enriched_matches) {

        const enhancedMatches = matches.map(match => {
          const enriched = data.enriched_matches.find(
            (e: any) => e.filename === match.filename
          );

          if (enriched && enriched.match_data) {
            return {
              ...match,
              match_data: enriched.match_data,
              loading: false
            };
          }

          return { ...match, loading: false };
        });

        setMatches(enhancedMatches);
      }
    } catch (error) {
      console.error('❌ Error enriching matches:', error);
      setMatchingError('Could not enrich matches with online data');
    } finally {
      setIsMatchingWithAPI(false);
    }
  };

  // Fetch matches from file system
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const dataDirectory = localStorage.getItem('toolkit_data_directory');

        if (!dataDirectory) {
          setError('Data directory not configured. Please set it up in Toolkit Setup.');
          setLoading(false);
          return;
        }


        const encodedDataDir = encodeURIComponent(dataDirectory);
        const url = `${API_BASE_URL}/api/matches/list-matches?game_type=valorant&data_directory=${encodedDataDir}`;


        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response text:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
          throw new Error(errorData.detail || 'Failed to fetch matches');
        }

        const data = await response.json();

        if (data.success) {
          // Sort matches by date (most recent first)
          const sortedMatches = [...(data.matches || [])].sort((a, b) => {
            const getTimestamp = (filename: string) => {
              const parts = filename.split('_');
              if (parts.length >= 2) {
                const dateStr = parts[parts.length - 2];
                const timeStr = parts[parts.length - 1];

                if (dateStr.includes('-') && timeStr.includes('-')) {
                  try {
                    const [day, month, year] = dateStr.split('-');
                    const [hour, minute, second] = timeStr.split('-');
                    return new Date(
                      parseInt(year),
                      parseInt(month) - 1,
                      parseInt(day),
                      parseInt(hour),
                      parseInt(minute),
                      parseInt(second)
                    ).getTime();
                  } catch {
                    return 0;
                  }
                }
              }
              return 0;
            };

            return getTimestamp(b.filename) - getTimestamp(a.filename);
          });

          // Initialize with loading state
          const initialMatches: Match[] = sortedMatches.map((m: Match) => ({
            ...m,
            loading: true
          }));

          setMatches(initialMatches);
        } else {
          setError('Failed to load matches');
        }
      } catch (err) {
        console.error('Error fetching matches:', err);

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not connect to server. Make sure FastAPI is running on port 8000.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match.filename);
  };

  const handleViewFeedback = () => {
    if (selectedMatch) {
      const params = new URLSearchParams();
      if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
      if (currentPuuid) params.set('puuid', currentPuuid);
      const qs = params.toString();
      navigate(`/player/valorant-feedbackreview/${selectedMatch}${qs ? `?${qs}` : ''}`);
    }
  };

  const handleViewDashboard = () => {
    if (selectedMatch) {
      const params = new URLSearchParams();
      params.set('matchId', selectedMatch);
      if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
      if (currentPuuid) params.set('puuid', currentPuuid);
      navigate(`/player/valorant-matchdashboard?${params.toString()}`);
    }
  };

  const refreshMatches = async () => {
    setLoading(true);
    hasEnrichedWithRiotId.current = false;

    const dataDirectory = localStorage.getItem('toolkit_data_directory');
    if (dataDirectory) {
      const encodedDataDir = encodeURIComponent(dataDirectory);
      const response = await fetch(
        `${API_BASE_URL}/api/matches/list-matches?game_type=valorant&data_directory=${encodedDataDir}`
      );
      const data = await response.json();

      if (data.success) {
        const sortedMatches = [...(data.matches || [])].sort((a, b) => {
          const getTimestamp = (filename: string) => {
            const parts = filename.split('_');
            if (parts.length >= 2) {
              const dateStr = parts[parts.length - 2];
              const timeStr = parts[parts.length - 1];

              if (dateStr.includes('-') && timeStr.includes('-')) {
                try {
                  const [day, month, year] = dateStr.split('-');
                  const [hour, minute, second] = timeStr.split('-');
                  return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second)
                  ).getTime();
                } catch {
                  return 0;
                }
              }
            }
            return 0;
          };

          return getTimestamp(b.filename) - getTimestamp(a.filename);
        });

        const initialMatches: Match[] = sortedMatches.map((m: Match) => ({
          ...m,
          loading: true
        }));

        setMatches(initialMatches);
      }
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse">
            <div className="text-white text-xl mb-2">Loading matches...</div>
            <div className="text-gray-400 text-sm">Scanning data directory...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
            if (currentPuuid) params.set('puuid', currentPuuid);
            const qs = params.toString();
            navigate(`/player/valorant-dashboard${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎯</span>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            VALORANT
          </h2>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Match Recordings</h1>
        <p className="text-gray-400">
          Select a match to review feedback or analyze performance
        </p>
        {currentRiotId && currentRiotId !== 'Unknown' && (
          <p className="text-red-400 mt-2">Playing as: {decodeURIComponent(currentRiotId)}</p>
        )}
      </div>

      {/* API Matching Status */}
      {isMatchingWithAPI && (
        <div className="mb-4 bg-blue-500/10 border border-blue-500/50 rounded-lg p-3 flex items-center gap-3">
          <div className="animate-spin text-xl">🔄</div>
          <p className="text-blue-400 font-semibold text-sm">
            Matching recordings with online match data...
          </p>
        </div>
      )}

      {matchingError && (
        <div className="mb-4 bg-orange-500/10 border border-orange-500/50 rounded-lg p-3 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <p className="text-orange-400 font-semibold text-sm">{matchingError}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 font-semibold mb-1">{error}</p>
            {error.includes('Data directory not configured') && (
              <button
                onClick={() => navigate('/player/toolkitsetup')}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              >
                Go to Toolkit Setup
              </button>
            )}
            {error.includes('not found') && (
              <p className="text-red-300 text-sm mt-2">
                Make sure the data directory path is correct in Toolkit Setup.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match List */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Available Matches ({matches.length})</h3>
              {matches.length > 0 && (
                <button
                  onClick={refreshMatches}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
            </div>

            {matches.length === 0 && !error ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📁</div>
                <p className="text-gray-400 mb-2">No Valorant matches found</p>
                <p className="text-gray-500 text-sm mt-2">
                  Play some games and they'll appear here!
                </p>
                <p className="text-gray-600 text-xs mt-4">
                  Looking for files in: {localStorage.getItem('toolkit_data_directory') || 'Not set'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {matches.map((match) => {
                  const matchData = match.match_data;
                  const stats = matchData?.player_stats;

                  // Extract date and time from filename
                  const parts = match.filename.split('_');
                  let displayDate = '';
                  let displayTime = '';

                  if (parts.length >= 2) {
                    const dateStr = parts[parts.length - 2];
                    const timeStr = parts[parts.length - 1];

                    if (dateStr && dateStr.includes('-')) {
                      const [day, month, year] = dateStr.split('-');
                      displayDate = `${day}/${month}/${year}`;
                    }

                    if (timeStr && timeStr.includes('-')) {
                      const [hour, minute] = timeStr.split('-');
                      displayTime = `${hour}:${minute}`;
                    }
                  }

                  // Calculate headshot percentage
                  const totalShots = stats ? (stats.headshots || 0) + (stats.bodyshots || 0) + (stats.legshots || 0) : 0;
                  const hsPercent = stats && totalShots > 0
                    ? Math.round((stats.headshots / totalShots) * 100)
                    : null;

                  // Calculate KDA ratio
                  const kdaRatio = stats
                    ? stats.deaths > 0
                      ? ((stats.kills + stats.assists) / stats.deaths).toFixed(2)
                      : (stats.kills + stats.assists).toFixed(1)
                    : null;

                  return (
                    <div
                      key={match.filename}
                      onClick={() => handleMatchClick(match)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMatch === match.filename
                        ? 'bg-red-600/20 border-red-500 shadow-lg'
                        : 'bg-gray-900 border-gray-700 hover:border-gray-600 hover:bg-gray-850'
                        }`}
                    >
                      {/* Loading State */}
                      {match.loading && (
                        <div className="flex items-center gap-2 text-red-400 text-xs mb-2">
                          <div className="animate-spin">⚙️</div>
                          <span>Loading match details...</span>
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          {matchData && stats ? (
                            <div className="flex items-center gap-3">
                              {/* Agent Icon */}
                              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
                                <span className="text-xl font-black text-red-400">
                                  {stats.agent?.substring(0, 2).toUpperCase() || '??'}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-white font-black text-sm mb-0.5">
                                  {stats.agent || 'Unknown Agent'}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-red-400 text-xs font-bold">
                                    {matchData.map}
                                  </span>
                                  <span className="text-gray-400 text-xs">•</span>
                                  <span className="text-gray-400 text-xs font-semibold">
                                    {matchData.mode}
                                  </span>
                                </div>
                                {/* Date & Time */}
                                {displayDate && displayTime && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-gray-500 text-[10px] font-semibold">
                                      📅 {displayDate} • {displayTime}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-white font-semibold mb-1 text-sm">
                                {match.display_name}
                              </h4>
                              {displayDate && displayTime ? (
                                <p className="text-gray-400 text-xs">
                                  📅 {displayDate} • {displayTime}
                                </p>
                              ) : (
                                <p className="text-gray-400 text-xs">{match.date}</p>
                              )}
                            </>
                          )}
                        </div>
                        {selectedMatch === match.filename && (
                          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>

                      {/* Stats Row */}
                      {matchData && stats && (
                        <div className="grid grid-cols-4 gap-2 my-3 pb-3 border-b border-gray-700">
                          <div className="text-center">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">KDA</p>
                            <p className="text-white font-black text-xs">
                              {stats.kills}/{stats.deaths}/{stats.assists}
                            </p>
                            <p className="text-red-400 text-[10px] font-bold">{kdaRatio}:1</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">HS%</p>
                            <p className="text-white font-black text-xs">{hsPercent !== null ? `${hsPercent}%` : 'N/A'}</p>
                            <p className="text-red-400 text-[10px] font-bold">{stats.headshots} HS</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Score</p>
                            <p className="text-white font-black text-xs">{stats.score || 0}</p>
                            <p className="text-red-400 text-[10px] font-bold">{matchData.rounds_played}R</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Team</p>
                            <p className="text-white font-black text-xs">{stats.team}</p>
                            <p className="text-red-400 text-[10px] font-bold">
                              {Math.floor(matchData.game_length / 60)}m
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Match Info */}
                      {matchData && (
                        <div className="mb-3 text-xs text-gray-400 font-semibold">
                          {matchData.rounds_played} rounds • {Math.floor(matchData.game_length / 60)}m {matchData.game_length % 60}s
                          {match.match_data?.time_difference_seconds !== undefined && (
                            <span className="ml-2 text-[10px]">
                              (±{Math.round(match.match_data.time_difference_seconds / 60)}min)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        {match.has_video && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1 font-bold border border-green-500/30">
                            <span>🎥</span> Video
                          </span>
                        )}
                        {match.has_merged_data && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded flex items-center gap-1 font-bold border border-red-500/30">
                            <span>📊</span> Data
                          </span>
                        )}
                        {matchData && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1 font-bold border border-blue-500/30">
                            <span>✓</span> Matched
                          </span>
                        )}
                        {!match.has_video && (
                          <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded flex items-center gap-1 border border-gray-600/30">
                            <span>⚠️</span> No Video
                          </span>
                        )}
                        {stats && hsPercent && hsPercent >= 50 && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1 font-bold border border-purple-500/30">
                            <span>🎯</span> Headshot King
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white font-bold text-center mb-6">ACTIONS</h3>

            {!selectedMatch ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">👈</div>
                <p className="text-gray-400 text-sm">Select a match to continue</p>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleViewFeedback}
                  disabled={!matches.find(m => m.filename === selectedMatch)?.has_video}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>🎬</span> Video Feedback Review
                </button>

                <button
                  onClick={handleViewDashboard}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <span>📊</span> Match Dashboard
                </button>

                {!matches.find(m => m.filename === selectedMatch)?.has_video && (
                  <p className="text-yellow-400 text-xs text-center pt-2">
                    ⚠️ Video file not found for this match
                  </p>
                )}

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-xs text-center break-words">
                    {matches.find(m => m.filename === selectedMatch)?.display_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">📋 Quick Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Matches:</span>
                <span className="text-white font-semibold">{matches.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">With Video:</span>
                <span className="text-green-400 font-semibold">
                  {matches.filter(m => m.has_video).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">With Data:</span>
                <span className="text-red-400 font-semibold">
                  {matches.filter(m => m.has_merged_data).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Matched:</span>
                <span className="text-blue-400 font-semibold">
                  {matches.filter(m => m.match_data).length}
                </span>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <h4 className="text-gray-400 font-semibold text-xs mb-2">🔧 Debug Info</h4>
            <div className="text-gray-500 text-xs space-y-1">
              <p>Data Dir: {localStorage.getItem('toolkit_data_directory') || 'Not set'}</p>
              <p>Matches Found: {matches.length}</p>
              <p>Game Filter: Valorant</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerValorantRecordingList;