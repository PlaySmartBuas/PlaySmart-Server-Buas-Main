import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const ValorantRecordingList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [currentRiotId, setCurrentRiotId] = useState('');
  const [dataDirectory, setDataDirectory] = useState('');
  const [showDirectoryInput, setShowDirectoryInput] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isMatchingWithAPI, setIsMatchingWithAPI] = useState(false);
  const [matchingError, setMatchingError] = useState<string>('');
  const hasEnrichedWithRiotId = useRef(false);

  // Get Riot ID from URL or sessionStorage (matching coach pattern)
  // useEffect(() => {
  //   const riotIdFromUrl = searchParams.get('user');

  //   if (riotIdFromUrl) {
  //     // Normalize and store Riot ID
  //     sessionStorage.setItem('current_riot_id', riotIdFromUrl);
  //     sessionStorage.setItem('current_valorant_riot_id', riotIdFromUrl);
  //     setCurrentRiotId(riotIdFromUrl);
  //   } else {
  //     // Try both keys for compatibility
  //     const savedRiotId = sessionStorage.getItem('current_valorant_riot_id') || sessionStorage.getItem('current_valorant_riot_id');
  //     if (savedRiotId) {
  //       setCurrentRiotId(savedRiotId);
  //       sessionStorage.setItem('current_riot_id', savedRiotId);
  //     } else {
  //       console.warn('⚠️ No Riot ID found');
  //     }
  //   }

  // }, [searchParams]);
  useEffect(() => {
  const riotIdFromUrl = searchParams.get('user');

  if (riotIdFromUrl) {
    console.log('✅ Setting Riot ID from URL:', riotIdFromUrl);
    // Normalize and store Riot ID
    sessionStorage.setItem('current_riot_id', riotIdFromUrl);
    sessionStorage.setItem('current_valorant_riot_id', riotIdFromUrl);
    setCurrentRiotId(riotIdFromUrl);
  } else {
    // FIXED: Check different keys for fallback
    const savedRiotId = sessionStorage.getItem('current_valorant_riot_id') || 
                        sessionStorage.getItem('current_riot_id');
    
    console.log('📦 Riot ID from sessionStorage:', savedRiotId);
    
    if (savedRiotId) {
      setCurrentRiotId(savedRiotId);
      sessionStorage.setItem('current_riot_id', savedRiotId);
      sessionStorage.setItem('current_valorant_riot_id', savedRiotId);
    } else {
      console.warn('⚠️ No Riot ID found');
    }
  }
}, [searchParams]);


  // Load saved data directory from database on mount
  useEffect(() => {
    const loadCoachConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/coach/config`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const config = await response.json();
          
          if (config.data_directory) {
            setDataDirectory(config.data_directory);
            setShowDirectoryInput(false);
            await fetchMatchesFromDirectory(config.data_directory);
          } else {
            setShowDirectoryInput(true);
          }
        } else {
          setShowDirectoryInput(true);
        }
      } catch (error) {
        console.error('❌ Error loading coach config:', error);
        setShowDirectoryInput(true);
      }
    };

    loadCoachConfig();
  }, []);

  // Enrich matches when Riot ID becomes available
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

      // Send only filenames, not full match objects
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
        
        // Merge enriched data with existing matches
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

  const fetchMatchesFromDirectory = async (dirPath: string) => {
    setLoading(true);
    setError('');
    setShowDirectoryInput(false);

    try {

      const encodedDataDir = encodeURIComponent(dirPath);
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
        const sortedMatches = [...data.matches].sort((a, b) => {
          // Extract timestamps from filenames
          const getTimestamp = (filename: string) => {
            const parts = filename.split('_');
            if (parts.length >= 2) {
              const dateStr = parts[parts.length - 2]; // DD-MM-YYYY
              const timeStr = parts[parts.length - 1]; // HH-MM-SS
              
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
          
          return getTimestamp(b.filename) - getTimestamp(a.filename); // Descending (newest first)
        });

        // Initialize with loading state
        const initialMatches: Match[] = sortedMatches.map((m: Match) => ({
          ...m,
          loading: true
        }));

        setMatches(initialMatches);
        setShowDirectoryInput(false);
      } else {
        setError('Failed to load matches');
        setShowDirectoryInput(true);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Could not connect to server. Make sure FastAPI is running on port 8000.');
      }
      setShowDirectoryInput(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseDirectory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/select-data-directory`);
      const data = await response.json();

      if (data.success && data.directoryPath) {
        setDataDirectory(data.directoryPath);
        setError('');
      } else if (!data.success && data.message) {
      }
    } catch (error) {
      console.error('Error opening directory dialog:', error);
      setError('Could not open directory dialog. Make sure the backend server is running.');
    }
  };

  const handleLoadMatches = async () => {
    if (!dataDirectory.trim()) {
      setError('Please enter or browse to a directory path');
      return;
    }

    setIsValidating(true);
    hasEnrichedWithRiotId.current = false; // Reset enrichment flag

    try {
      await fetch(`${API_BASE_URL}/api/coach/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          data_directory: dataDirectory
        })
      });
    } catch (error) {
      console.error('Error saving coach config:', error);
    }

    await fetchMatchesFromDirectory(dataDirectory);

    setIsValidating(false);
  };

  const handleChangeDirectory = () => {
    setShowDirectoryInput(true);
    setMatches([]);
    setSelectedMatch(null);
    setError('');
    hasEnrichedWithRiotId.current = false; // Reset enrichment flag
  };

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match.filename);
  };

  const handleRecordingAnalysis = () => {
    if (selectedMatch) {
      const params = new URLSearchParams();
      params.set('matchId', selectedMatch);
      params.set('match_id', selectedMatch);
      if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
      navigate(`/coach/valorant-recording-analysis?${params.toString()}`);
    }
  };

  const handleMatchDashboard = () => {
    if (selectedMatch) {
      const params = new URLSearchParams();
      params.set('matchId', selectedMatch);
      params.set('match_id', selectedMatch);
      if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
      navigate(`/coach/valorant-match-dashboard?${params.toString()}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
            const qs = params.toString();
            navigate(`/coach/valorant-dashboard${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-yellow-300/60 hover:text-yellow-400 mb-4 transition-colors font-bold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎯</span>
          <h2 className="text-sm font-bold text-yellow-300/60 uppercase tracking-wider">
            VALORANT - COACH VIEW
          </h2>
        </div>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2">
          Match Recordings
        </h1>
        <p className="text-yellow-300/60 font-semibold">
          Select a match to analyze or review performance
        </p>
        {currentRiotId && currentRiotId !== 'Unknown' && (
          <p className="text-yellow-400 mt-2 font-black">Analyzing player: {decodeURIComponent(currentRiotId)}</p>
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

      {/* Directory Selection Section */}
      {showDirectoryInput && (
        <div className="mb-6 bg-gradient-to-br from-gray-950 to-black border-2 border-yellow-500/20 rounded-xl p-6 shadow-lg">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">📁</span>
            <div className="flex-1">
              <h3 className="text-yellow-400 font-black mb-1">Select Data Directory</h3>
              <p className="text-yellow-300/70 text-sm font-semibold">
                Choose the folder containing your match data files to view recordings
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-yellow-300/60 font-bold text-sm mb-2 uppercase tracking-wider">
                Data Directory Path
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={dataDirectory}
                  onChange={(e) => setDataDirectory(e.target.value)}
                  placeholder="C:\Users\Coach\Documents\GameData"
                  className="flex-1 px-4 py-3 bg-gray-900/50 border border-yellow-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20 font-semibold"
                />
                <button
                  onClick={handleBrowseDirectory}
                  className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg font-bold transition-all duration-300 border border-yellow-500/20 shadow-lg flex items-center gap-2"
                >
                  <span>📂</span> Browse
                </button>
              </div>
              <p className="text-yellow-300/40 text-xs mt-2 font-semibold">
                Example: C:\Users\Coach\Documents\PlayOMeter\Data
              </p>
            </div>

            <button
              onClick={handleLoadMatches}
              disabled={isValidating || !dataDirectory.trim()}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded-lg font-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30 flex items-center justify-center gap-2"
            >
              {isValidating || loading ? (
                <>
                  <div className="animate-spin">⚙️</div>
                  Loading Matches...
                </>
              ) : (
                <>
                  <span>🎯</span> Load Matches
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 font-bold mb-1">{error}</p>
            <p className="text-red-300 text-sm mt-2 font-semibold">
              Make sure the data directory path is correct and contains Valorant match files.
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !showDirectoryInput && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse">
            <div className="text-yellow-400 text-xl mb-2 font-bold">Loading matches...</div>
            <div className="text-yellow-300/60 text-sm font-semibold">Scanning data directory...</div>
          </div>
        </div>
      )}

      {/* Matches View */}
      {!showDirectoryInput && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Match List */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-950 to-black border-2 border-yellow-500/20 rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-black text-lg">Available Matches ({matches.length})</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleChangeDirectory}
                    className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1 font-bold"
                  >
                    <span>📁</span> Change Directory
                  </button>
                  {matches.length > 0 && (
                    <>
                      <span className="text-yellow-500/30">|</span>
                      <button
                        onClick={() => {
                          if (dataDirectory) {
                            hasEnrichedWithRiotId.current = false;
                            fetchMatchesFromDirectory(dataDirectory);
                          }
                        }}
                        className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1 font-bold"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </>
                  )}
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-yellow-300/60 mb-2 font-semibold">No Valorant matches found</p>
                  <p className="text-gray-500 text-sm mt-2 font-medium">
                    Make sure the directory contains valid match files
                  </p>
                  <button
                    onClick={handleChangeDirectory}
                    className="mt-4 px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded-lg font-black transition-all duration-300 shadow-lg shadow-yellow-500/30"
                  >
                    Select Different Directory
                  </button>
                  <p className="text-yellow-300/40 text-xs mt-4 font-semibold">
                    Current directory: {dataDirectory}
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
                      const dateStr = parts[parts.length - 2]; // DD-MM-YYYY
                      const timeStr = parts[parts.length - 1]; // HH-MM-SS
                      
                      // Format date
                      if (dateStr && dateStr.includes('-')) {
                        const [day, month, year] = dateStr.split('-');
                        displayDate = `${day}/${month}/${year}`;
                      }
                      
                      // Format time
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
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                          selectedMatch === match.filename
                            ? 'bg-yellow-500/20 border-yellow-500/60 shadow-lg shadow-yellow-500/20'
                            : 'bg-gradient-to-br from-gray-900 to-black border-yellow-500/20 hover:border-yellow-500/40'
                        }`}
                      >
                        {/* Loading State */}
                        {match.loading && (
                          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
                            <div className="animate-spin">⚙️</div>
                            <span>Loading match details...</span>
                          </div>
                        )}

                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
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
                                    <span className="text-yellow-400 text-xs font-bold">
                                      {matchData.map}
                                    </span>
                                    <span className="text-yellow-300/60 text-xs">•</span>
                                    <span className="text-yellow-300/60 text-xs font-semibold">
                                      {matchData.mode}
                                    </span>
                                  </div>
                                  {/* Date & Time */}
                                  {displayDate && displayTime && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className="text-yellow-300/40 text-[10px] font-semibold">
                                         {displayDate} • {displayTime}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-white font-bold mb-1 text-sm">
                                  {match.display_name}
                                </h4>
                                {/* Date & Time for non-matched */}
                                {displayDate && displayTime ? (
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-yellow-300/60 text-xs font-semibold">
                                       {displayDate} • {displayTime}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-yellow-300/60 text-xs font-semibold">{match.date}</p>
                                )}
                              </>
                            )}
                          </div>
                          {selectedMatch === match.filename && (
                            <div className="w-6 h-6 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                              <span className="text-black text-xs font-black">✓</span>
                            </div>
                          )}
                        </div>

                        {/* Stats Row */}
                        {matchData && stats && (
                          <div className="grid grid-cols-4 gap-2 my-3 pb-3 border-b border-yellow-500/20">
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">KDA</p>
                              <p className="text-white font-black text-xs">
                                {stats.kills}/{stats.deaths}/{stats.assists}
                              </p>
                              <p className="text-yellow-400 text-[10px] font-bold">{kdaRatio}:1</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">HS%</p>
                              <p className="text-white font-black text-xs">{hsPercent !== null ? `${hsPercent}%` : 'N/A'}</p>
                              <p className="text-yellow-400 text-[10px] font-bold">{stats.headshots} HS</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">Score</p>
                              <p className="text-white font-black text-xs">{stats.score || 0}</p>
                              <p className="text-yellow-400 text-[10px] font-bold">{matchData.rounds_played}R</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">Team</p>
                              <p className="text-white font-black text-xs">{stats.team}</p>
                              <p className="text-yellow-400 text-[10px] font-bold">
                                {Math.floor(matchData.game_length / 60)}m
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Match Info */}
                        {matchData && (
                          <div className="mb-3 text-xs text-yellow-300/60 font-semibold">
                            {matchData.rounds_played} rounds • {Math.floor(matchData.game_length / 60)}m {matchData.game_length % 60}s
                            {match.match_data?.time_difference_seconds !== undefined && (
                              <span className="ml-2 text-[10px]">
                                (±{Math.round(match.match_data.time_difference_seconds / 60)}min)
                              </span>
                            )}
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex gap-2 flex-wrap">
                          {match.has_video && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1 font-bold border border-green-500/30">
                              <span>🎥</span> Video
                            </span>
                          )}
                          {match.has_merged_data && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded flex items-center gap-1 font-bold border border-yellow-500/30">
                              <span>📊</span> Data
                            </span>
                          )}
                          {matchData && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1 font-bold border border-blue-500/30">
                              <span>✓</span> Matched
                            </span>
                          )}
                          {!match.has_video && (
                            <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded flex items-center gap-1 font-semibold border border-gray-600/30">
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
            <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
              <h3 className="text-white font-black text-center mb-6">COACH ACTIONS</h3>

              {!selectedMatch ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">👈</div>
                  <p className="text-yellow-300/60 text-sm font-semibold">Select a match to continue</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleRecordingAnalysis}
                    disabled={!matches.find(m => m.filename === selectedMatch)?.has_video}
                    className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded-lg font-black transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30"
                  >
                    <span>🎬</span> Recording Analysis
                  </button>

                  <button
                    onClick={handleMatchDashboard}
                    className="w-full py-3 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg font-black transition-all duration-300 flex items-center justify-center gap-2 border border-yellow-500/20"
                  >
                    <span>📊</span> Match Dashboard
                  </button>

                  {!matches.find(m => m.filename === selectedMatch)?.has_video && (
                    <p className="text-yellow-400 text-xs text-center pt-2 font-bold">
                      ⚠️ Video file not found for this match
                    </p>
                  )}

                  <div className="pt-4 border-t border-yellow-500/20">
                    <p className="text-yellow-300/60 text-xs text-center break-words font-semibold">
                      {matches.find(m => m.filename === selectedMatch)?.display_name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Info Card */}
            {matches.length > 0 && (
              <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
                <h3 className="text-white font-black mb-4">📋 Quick Info</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-yellow-300/60 font-semibold">Total Matches:</span>
                    <span className="text-white font-black">{matches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-300/60 font-semibold">With Video:</span>
                    <span className="text-green-400 font-black">
                      {matches.filter(m => m.has_video).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-300/60 font-semibold">With Data:</span>
                    <span className="text-yellow-400 font-black">
                      {matches.filter(m => m.has_merged_data).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-300/60 font-semibold">Matched:</span>
                    <span className="text-blue-400 font-black">
                      {matches.filter(m => m.match_data).length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Current Directory Info */}
            {dataDirectory && (
              <div className="bg-gradient-to-br from-gray-900 to-black border border-yellow-500/20 rounded-xl p-4">
                <h4 className="text-yellow-300/60 font-bold text-xs mb-2">📁 Current Directory</h4>
                <p className="text-yellow-300/70 text-xs font-mono break-all">{dataDirectory}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValorantRecordingList;