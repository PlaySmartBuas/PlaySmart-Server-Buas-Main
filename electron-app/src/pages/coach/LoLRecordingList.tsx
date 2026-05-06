import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import {API_BASE_URL} from '../../services/api';

interface RiotMatchData {
  matchId: string;
  championName: string;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  champLevel: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
  items: number[]; // item0-6
  win: boolean;
  gameDuration: number;
  gameMode: string;
  teamPosition: string;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  killParticipation: number;
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
}

interface EnrichedMatch extends Match {
  riotData?: RiotMatchData;
  loading?: boolean;
}

const LoLRecordingList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [currentRiotId, setCurrentRiotId] = useState('');
  const [currentPuuid, setCurrentPuuid] = useState('');
  const [dataDirectory, setDataDirectory] = useState('');
  const [showDirectoryInput, setShowDirectoryInput] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [platformDetected, setPlatformDetected] = useState('euw1');
  const hasEnrichedWithPuuid = useRef(false);

  const REGION = 'europe';

  // Get Riot ID and PUUID from URL or sessionStorage (matching player pattern)
  useEffect(() => {
    const riotIdFromUrl = searchParams.get('user');
    const puuidFromUrl = searchParams.get('puuid');


    if (riotIdFromUrl) {
      // Normalize and store Riot ID under both keys used across the app
      sessionStorage.setItem('current_riot_id', riotIdFromUrl);
      sessionStorage.setItem('current_lol_riot_id', riotIdFromUrl);
      setCurrentRiotId(riotIdFromUrl);
    } else {
      // Try both keys for compatibility (dashboard uses 'current_riot_id')
      const savedRiotId = sessionStorage.getItem('current_riot_id') || sessionStorage.getItem('current_lol_riot_id');
      if (savedRiotId) {
        setCurrentRiotId(savedRiotId);
        sessionStorage.setItem('current_riot_id', savedRiotId); // Normalize to dashboard's key
      } else {
        console.warn('⚠️ No Riot ID found');
      }
    }

    if (puuidFromUrl) {
      // Persist PUUID under the standard key used by player pages
      sessionStorage.setItem('current_lol_puuid', puuidFromUrl);
      setCurrentPuuid(puuidFromUrl);
    } else {
      const savedPuuid = sessionStorage.getItem('current_lol_puuid');
      if (savedPuuid) {
        setCurrentPuuid(savedPuuid);
      } else {
        console.warn('⚠️ No PUUID found - will fetch from Riot API');
      }
    }

  }, [searchParams]);

  // Fetch PUUID if we have Riot ID but no PUUID (like the dashboard does)
  useEffect(() => {
    const fetchPuuid = async () => {
      if (currentRiotId && currentRiotId !== 'Unknown' && !currentPuuid) {
        try {
          const [gameName, tagLine] = currentRiotId.split('#');
          const response = await api.get(`/riot/account/${REGION}/${gameName}/${tagLine}`);
          const fetchedPuuid = response.data.puuid;

          setCurrentPuuid(fetchedPuuid);
          // Persist fetched PUUID so other pages/components can access it
          sessionStorage.setItem('current_lol_puuid', fetchedPuuid);
        } catch (error) {
          console.error('❌ Error fetching PUUID:', error);
        }
      }
    };

    fetchPuuid();
  }, [currentRiotId, currentPuuid]);


  // Helper function to extract timestamp from filename
  const extractTimestampFromFilename = (filename: string): Date | null => {
    const parts = filename.split('_');
    let dateStr = '';
    let timeStr = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.match(/^\d{2}-\d{2}-\d{4}$/)) {
        dateStr = part;
        if (i + 1 < parts.length && parts[i + 1].match(/^\d{2}-\d{2}-\d{2}$/)) {
          timeStr = parts[i + 1];
        }
        break;
      }
    }

    if (!dateStr || !timeStr) {
      console.warn(`Could not extract timestamp from filename: ${filename}`);
      return null;
    }

    const [day, month, year] = dateStr.split('-').map(Number);
    const [hour, minute, second] = timeStr.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day, hour, minute, second);

    return timestamp;
  };

  // Detect platform from match history
  const detectPlatform = async (puuid: string): Promise<string> => {
    try {
      const response = await api.get(`/riot/matches/${REGION}/${puuid}?count=1`);
      const matchIds = response.data;

      if (matchIds.length === 0) {
        return 'euw1';
      }

      const platformPrefix = matchIds[0].split('_')[0].toLowerCase();
      return platformPrefix;
    } catch (error) {
      console.error('Error detecting platform:', error);
      return 'euw1';
    }
  };

  // Fetch match IDs in a time window around a local timestamp
  const fetchMatchIdsWindow = async (
    puuid: string,
    localMs: number,
    windowMs: number = 60 * 60 * 1000,
    count: number = 50
  ): Promise<string[]> => {
    try {
      const startTime = Math.max(0, localMs - windowMs);
      const endTime = localMs + windowMs;
      const response = await api.get(
        `/riot/matches/${REGION}/${puuid}?count=${count}&startTime=${startTime}&endTime=${endTime}`
      );
      const matchIds = response.data || [];
      return matchIds;
    } catch (error) {
      console.error('Error fetching windowed match IDs:', error);
      return [];
    }
  };

  // Match local file to Riot match by timestamp
  const findMatchingRiotMatch = async (
    localTimestamp: Date,
    matchIds: string[],
    puuid: string
  ): Promise<{ matchId: string; riotData: RiotMatchData } | null> => {
    const TIME_TOLERANCE_MS = 10 * 60 * 2000; // 20 minutes


    for (const matchId of matchIds) {
      try {
        const response = await api.get(`/riot/match/${REGION}/${matchId}`);
        const matchData = response.data;

        const gameStartMs = matchData.info.gameStartTimestamp || matchData.info.gameCreation;
        const gameDurationSec = matchData.info.gameDuration || 0;
        const gameEndMs = matchData.info.gameEndTimestamp
          || (gameStartMs ? gameStartMs + (gameDurationSec * 1000) : undefined)
          || gameStartMs;

        const gameEndDate = new Date(gameEndMs);
        const localMs = localTimestamp.getTime();
        const timeDiff = Math.abs(gameEndDate.getTime() - localMs);

        if (timeDiff <= TIME_TOLERANCE_MS) {

          const participant = matchData.info.participants.find((p: any) => p.puuid === puuid);

          if (!participant) {
            console.warn(`    ⚠️ Player with PUUID ${puuid} not found in match ${matchId}`);
            continue;
          }

          const teamKills = matchData.info.participants
            .filter((p: any) => p.teamId === participant.teamId)
            .reduce((sum: number, p: any) => sum + p.kills, 0);

          const killParticipation = teamKills > 0
            ? Math.round(((participant.kills + participant.assists) / teamKills) * 100)
            : 0;

          const riotData: RiotMatchData = {
            matchId,
            championName: participant.championName,
            championId: participant.championId,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            goldEarned: participant.goldEarned,
            totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
            champLevel: participant.champLevel,
            totalMinionsKilled: participant.totalMinionsKilled,
            neutralMinionsKilled: participant.neutralMinionsKilled,
            visionScore: participant.visionScore,
            items: [
              participant.item0,
              participant.item1,
              participant.item2,
              participant.item3,
              participant.item4,
              participant.item5,
              participant.item6
            ],
            win: participant.win,
            gameDuration: matchData.info.gameDuration,
            gameMode: matchData.info.gameMode,
            teamPosition: participant.teamPosition || 'UNKNOWN',
            doubleKills: participant.doubleKills || 0,
            tripleKills: participant.tripleKills || 0,
            quadraKills: participant.quadraKills || 0,
            pentaKills: participant.pentaKills || 0,
            killParticipation
          };

          return { matchId, riotData };
        }
      } catch (error) {
        console.error(`    ⚠️ Error checking match ${matchId}:`, error);
      }
    }

    return null;
  };

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
            await fetchMatchesFromDirectory(config.data_directory);
          } else {
            setShowDirectoryInput(true);
          }
        } else {
          setShowDirectoryInput(true);
        }
      } catch (error) {
        console.error('Error loading coach config:', error);
        setShowDirectoryInput(true);
      }
    };

    loadCoachConfig();
  }, []);

  // Re-fetch matches when PUUID becomes available to enrich with Riot data
  useEffect(() => {
    if (currentPuuid && dataDirectory && matches.length > 0 && !hasEnrichedWithPuuid.current) {
      // Check if any match is missing Riot data
      const needsEnrichment = matches.some(m => !m.riotData);

      if (needsEnrichment) {
        hasEnrichedWithPuuid.current = true;
        fetchMatchesFromDirectory(dataDirectory);
      }
    }
  }, [currentPuuid, dataDirectory, matches]);

  const fetchMatchesFromDirectory = async (dirPath: string) => {
    setLoading(true);
    setError('');

    try {

      const encodedDataDir = encodeURIComponent(dirPath);
      const url = `${API_BASE_URL}/api/matches/list-matches?game_type=league of legends&data_directory=${encodedDataDir}`;


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
        // Initialize matches with loading state
        const enrichedMatches: EnrichedMatch[] = data.matches.map((m: Match) => ({
          ...m,
          loading: true
        }));

        setMatches(enrichedMatches);
        setShowDirectoryInput(false);

        // Fetch Riot data for each match if we have PUUID
        if (currentPuuid) {

          // Detect platform first
          const platform = await detectPlatform(currentPuuid);
          setPlatformDetected(platform);


          const TIME_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

          const enrichmentPromises = enrichedMatches.map(async (match) => {
            const localTimestamp = extractTimestampFromFilename(match.filename);

            if (!localTimestamp) {
              console.warn(`Could not extract timestamp from: ${match.filename}`);
              return { ...match, loading: false };
            }

            const candidates = await fetchMatchIdsWindow(currentPuuid, localTimestamp.getTime(), TIME_WINDOW_MS, 50);

            if (candidates.length === 0) {
              console.warn(`❌ No Riot match IDs for ${match.filename}`);
              return { ...match, loading: false };
            }

            const matchResult = await findMatchingRiotMatch(localTimestamp, candidates, currentPuuid);

            if (matchResult) {
              return {
                ...match,
                riotData: matchResult.riotData,
                loading: false
              };
            } else {
              console.warn(`❌ No Riot match found for: ${match.filename}`);
              return { ...match, loading: false };
            }
          });

          const fullyEnrichedMatches = await Promise.all(enrichmentPromises);
          setMatches(fullyEnrichedMatches);

          const matchedCount = fullyEnrichedMatches.filter(m => m.riotData).length;
        } else {
          // No PUUID, just mark as not loading
          setMatches(enrichedMatches.map(m => ({ ...m, loading: false })));
        }
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
    hasEnrichedWithPuuid.current = false; // Reset enrichment flag

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
    hasEnrichedWithPuuid.current = false; // Reset enrichment flag when changing directory
  };

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match.filename);
  };

  const handleRecordingAnalysis = () => {
    if (selectedMatch) {
      const params = new URLSearchParams();
      params.set('matchId', selectedMatch);
      params.set('match_id', selectedMatch); // Add match_id for feedback isolation
      if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
      navigate(`/coach/lol-recording-analysis?${params.toString()}`);
    }
  };

  const handleMatchDashboard = () => {
    if (selectedMatch) {
      const params = new URLSearchParams();
      params.set('matchId', selectedMatch);
      params.set('match_id', selectedMatch); // Add match_id for feedback isolation
      if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
      navigate(`/coach/lol-match-dashboard?${params.toString()}`);
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
            navigate(`/coach/lol-dashboard${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-yellow-300/60 hover:text-yellow-400 mb-4 transition-colors font-bold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎮</span>
          <h2 className="text-sm font-bold text-yellow-300/60 uppercase tracking-wider">
            LEAGUE OF LEGENDS - COACH VIEW
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
              Make sure the data directory path is correct and contains League of Legends match files.
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
                  <p className="text-yellow-300/60 mb-2 font-semibold">No League of Legends matches found</p>
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
                    const riotData = match.riotData;
                    const kda = riotData
                      ? `${riotData.kills}/${riotData.deaths}/${riotData.assists}`
                      : null;
                    const kdaRatio = riotData && riotData.deaths > 0
                      ? ((riotData.kills + riotData.assists) / riotData.deaths).toFixed(2)
                      : riotData ? (riotData.kills + riotData.assists).toFixed(2) : null;
                    const cs = riotData
                      ? riotData.totalMinionsKilled + riotData.neutralMinionsKilled
                      : null;
                    const csPerMin = riotData && riotData.gameDuration > 0
                      ? (cs! / (riotData.gameDuration / 60)).toFixed(1)
                      : null;

                    return (
                      <div
                        key={match.filename}
                        onClick={() => handleMatchClick(match)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${selectedMatch === match.filename
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

                        {/* Header with Champion Info */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            {riotData ? (
                              <div className="flex items-center gap-3">
                                {/* Champion Icon Placeholder */}
                                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                                  <span className="text-xl font-black text-yellow-400">
                                    {riotData.championName.substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="text-white font-black text-sm mb-0.5">
                                    {riotData.championName}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold ${riotData.win ? 'text-green-400' : 'text-red-400'}`}>
                                      {riotData.win ? '🏆 Victory' : '💀 Defeat'}
                                    </span>
                                    <span className="text-yellow-300/60 text-xs">•</span>
                                    <span className="text-yellow-300/60 text-xs font-semibold">
                                      {Math.floor(riotData.gameDuration / 60)}m {riotData.gameDuration % 60}s
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-white font-bold mb-1 text-sm">
                                  {match.display_name}
                                </h4>
                                <p className="text-yellow-300/60 text-xs font-semibold">{match.date}</p>
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
                        {riotData && (
                          <div className="grid grid-cols-4 gap-2 my-3 pb-3 border-b border-yellow-500/20">
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">KDA</p>
                              <p className="text-white font-black text-xs">{kda}</p>
                              <p className="text-yellow-400 text-[10px] font-bold">{kdaRatio}:1</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">CS</p>
                              <p className="text-white font-black text-xs">{cs}</p>
                              <p className="text-yellow-400 text-[10px] font-bold">{csPerMin}/min</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">Gold</p>
                              <p className="text-white font-black text-xs">{(riotData.goldEarned / 1000).toFixed(1)}k</p>
                              <p className="text-yellow-400 text-[10px] font-bold">Level {riotData.champLevel}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-yellow-300/60 text-[10px] uppercase font-bold mb-1">KP</p>
                              <p className="text-white font-black text-xs">{riotData.killParticipation}%</p>
                              <p className="text-yellow-400 text-[10px] font-bold">Vision {riotData.visionScore}</p>
                            </div>
                          </div>
                        )}

                        {/* Items Row */}
                        {riotData && (
                          <div className="flex gap-1 mb-3">
                            {riotData.items.slice(0, 6).map((itemId, idx) => (
                              <div
                                key={idx}
                                className={`w-6 h-6 rounded border ${itemId > 0
                                  ? 'bg-gray-800 border-yellow-500/30'
                                  : 'bg-gray-900/50 border-gray-700/30'
                                  } flex items-center justify-center`}
                              >
                                {itemId > 0 ? (
                                  <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/15.1.1/img/item/${itemId}.png`}
                                    alt={`Item ${itemId}`}
                                    className="w-full h-full rounded"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span className="text-gray-600 text-[8px]">•</span>
                                )}
                              </div>
                            ))}
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
                          {!match.has_video && (
                            <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded flex items-center gap-1 font-semibold border border-gray-600/30">
                              <span>⚠️</span> No Video
                            </span>
                          )}
                          {riotData && riotData.pentaKills > 0 && (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1 font-bold border border-purple-500/30 animate-pulse">
                              <span>🏆</span> PENTA!
                            </span>
                          )}
                          {riotData && riotData.quadraKills > 0 && !riotData.pentaKills && (
                            <span className="px-2 py-1 bg-pink-500/20 text-pink-400 text-xs rounded flex items-center gap-1 font-bold border border-pink-500/30">
                              <span>⚡</span> Quadra
                            </span>
                          )}
                          {riotData && riotData.tripleKills > 0 && !riotData.quadraKills && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1 font-bold border border-blue-500/30">
                              <span>⭐</span> Triple
                            </span>
                          )}
                          {riotData && riotData.teamPosition && riotData.teamPosition !== 'UNKNOWN' && (
                            <span className="px-2 py-1 bg-gray-700/20 text-gray-300 text-xs rounded font-semibold border border-gray-600/30">
                              {riotData.teamPosition}
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
                </div>
              </div>
            )}

            {/* Debug Info (remove in production) */}
            {import.meta.env.DEV && (
              <div className="bg-gradient-to-br from-gray-900 to-black border border-yellow-500/20 rounded-xl p-4">
                <h4 className="text-yellow-300/60 font-bold text-xs mb-2">🔧 Debug Info</h4>
                <div className="text-yellow-300/40 text-xs space-y-1 font-semibold">
                  <p>Data Dir: {localStorage.getItem('toolkit_data_directory') || 'Not set'}</p>
                  <p>Matches Found: {matches.length}</p>
                  <p>Game Filter: League of Legends</p>
                  <p>PUUID: {currentPuuid ? '✓ Available' : '❌ Missing'}</p>
                  <p>Riot Data: {matches.filter(m => m.riotData).length}/{matches.length}</p>
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

export default LoLRecordingList;