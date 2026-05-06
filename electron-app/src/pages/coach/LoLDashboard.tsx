import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ChampionMatchups from '../../components/ChampionMatchups';
import { usePlayerData } from '../../hooks/usePlayerData';
import { apiCallWithRetry, rateLimiter } from '../../utils/rateLimiter';
import {
  fetchMatchesInBatches as riotFetchMatchesInBatches,
  fetchChampionMatchups as riotFetchChampionMatchups,
  fetchCSComparisonFromMatches as riotFetchCSComparisonFromMatches,
} from '../../services/riot';

interface RankedStats {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  queueType?: string;
}

interface MatchStats {
  winRate: number;
  avgKDA: number;
  avgCSPerMin: number;
  totalGames: number;
}

interface ChampionData {
  name: string;
  matches: number;
  winRate: number;
  championId: number;
}

interface ChampionMatchup {
  championName: string;
  championId: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface CSComparison {
  playerAvgCS: number;
  roleAvgCS: number;
  difference: number;
  percentile: number;
}

// Reuse shared rate limiter and apiCallWithRetry from utils to avoid duplication

const CoachLoLDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentRiotId, setCurrentRiotId] = useState('Unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player data states
  const [puuid, setPuuid] = useState<string>('');
  const [summonerLevel, setSummonerLevel] = useState<number>(0);
  const [rankedStats, setRankedStats] = useState<RankedStats | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [topChampions, setTopChampions] = useState<ChampionData[]>([]);

  // New metrics
  const [championMatchups, setChampionMatchups] = useState<ChampionMatchup[]>([]);
  const [csComparison, setCsComparison] = useState<CSComparison | null>(null);
  const [dataScope, setDataScope] = useState<'last10' | 'season'>('last10');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const isMountedRef = useRef(false);
  const previousDataScopeRef = useRef<'last10' | 'season'>(dataScope);

  // Rate limit status
  const [rateLimitStatus, setRateLimitStatus] = useState<{
    isPenalty: boolean;
    penaltyEndsAt: number;
    remainingSeconds: number;
  } | null>(null);

  const REGION = 'europe';
  // Season 2025 start date (April 29, 2025 at 00:00:00 UTC)
  // TODO: In the future, fetch this dynamically from Riot API or a config file
  const SEASON_START_DATE = new Date('2025-04-29T00:00:00Z');
  const SEASON_START_TIMESTAMP = Math.floor(SEASON_START_DATE.getTime() / 1000); // Convert to Unix timestamp in seconds

  // Get Riot ID from URL or sessionStorage
  useEffect(() => {
    const riotIdFromUrl = searchParams.get('user');

    if (riotIdFromUrl) {
      // Normalize and store Riot ID under both keys used across the app
      sessionStorage.setItem('current_riot_id', riotIdFromUrl);
      sessionStorage.setItem('current_lol_riot_id', riotIdFromUrl);
      setCurrentRiotId(riotIdFromUrl);
    } else {
      const savedRiotId = sessionStorage.getItem('current_riot_id');
      if (savedRiotId) {
        setCurrentRiotId(savedRiotId);
      } else {
        navigate('/game-selection');
      }
    }
  }, [searchParams, navigate]);

  // Fetch player data via shared hook when Riot ID changes
  const {
    puuid: hookPuuid,
    loading: hookLoading,
    error: hookError,
    rankedStats: hookRankedStats,
    rankedEntries: hookRankedEntries,
    summonerLevel: hookSummonerLevel,
    matchStats: hookMatchStats,
    championMatchups: hookChampionMatchups,
    csComparison: hookCsComparison,
    dataScope: hookDataScope
  } = usePlayerData(currentRiotId, { initialScope: dataScope });

  // local holders for arrays returned by the hook
  const [rankedEntriesLocal, setRankedEntriesLocal] = useState<RankedStats[]>([]);

  // Poll for rate limit status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const status = rateLimiter.getPenaltyStatus();
      if (status.isPenalty || rateLimitStatus?.isPenalty) {
        setRateLimitStatus(status);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [rateLimitStatus]);

  // Sync hook outputs into existing local state so UI remains unchanged during incremental refactor
  useEffect(() => {
    if (hookPuuid) {
      setPuuid(hookPuuid);
      sessionStorage.setItem('current_lol_puuid', hookPuuid);
    }
    if (hookMatchStats) setMatchStats(hookMatchStats);
    if (hookChampionMatchups) setChampionMatchups(hookChampionMatchups);
    if (hookCsComparison) setCsComparison(hookCsComparison);
    if (hookRankedStats) setRankedStats(hookRankedStats);
    if ((hookRankedEntries as any) && Array.isArray(hookRankedEntries)) setRankedEntriesLocal(hookRankedEntries as any);
    if (hookSummonerLevel != null) setSummonerLevel(hookSummonerLevel);

    setLoading(!!hookLoading);
    if (hookError) setError(hookError);
    if (hookDataScope && hookDataScope !== dataScope) setDataScope(hookDataScope);
  }, [hookPuuid, hookLoading, hookError, hookRankedStats, hookRankedEntries, hookMatchStats, hookChampionMatchups, hookCsComparison, hookDataScope]);



  const detectPlatform = async (puuid: string): Promise<string> => {
    try {
      const response = await apiCallWithRetry(() =>
        api.get(`/riot/matches/${REGION}/${puuid}?count=1`)
      );
      const matchIds = response.data;

      if (matchIds.length === 0) {
        return 'euw1'; // Fallback
      }

      // Extract platform from match ID (e.g., "EUN1_3854135838" -> "eun1")
      const platformPrefix = matchIds[0].split('_')[0].toLowerCase();
      return platformPrefix;

    } catch (error) {
      console.error('Error detecting platform:', error);
      return 'euw1'; // Fallback
    }
  };

  const fetchMatchHistory = async (puuid: string) => {
    try {
      const matchIdsResponse = await apiCallWithRetry(() =>
        api.get(`/riot/matches/${REGION}/${puuid}?count=20`)
      );
      const matchIds = matchIdsResponse.data;


      if (matchIds.length === 0) {
        return;
      }

      // Fetch details for first 10 matches using shared batch helper
      const matches = await riotFetchMatchesInBatches(matchIds.slice(0, 10));

      // Calculate stats
      let totalKills = 0;
      let totalDeaths = 0;
      let totalAssists = 0;
      let totalCS = 0;
      let totalDuration = 0;
      let wins = 0;

      matches.forEach((match: any) => {
        const participant = match.info.participants.find((p: any) => p.puuid === puuid);

        if (participant) {
          totalKills += participant.kills;
          totalDeaths += participant.deaths;
          totalAssists += participant.assists;
          totalCS += participant.totalMinionsKilled + participant.neutralMinionsKilled;
          totalDuration += match.info.gameDuration;
          if (participant.win) wins++;
        }
      });

      const avgKDA = totalDeaths > 0
        ? (totalKills + totalAssists) / totalDeaths
        : totalKills + totalAssists;

      const avgCSPerMin = (totalCS / (totalDuration / 60));
      const winRate = (wins / matches.length) * 100;

      setMatchStats({
        winRate: Math.round(winRate),
        avgKDA: Math.round(avgKDA * 10) / 10,
        avgCSPerMin: Math.round(avgCSPerMin * 10) / 10,
        totalGames: matches.length
      });

    } catch (error) {
      console.error('Error fetching match history:', error);
    }
  };

  const fetchChampionMastery = async (puuid: string, platform: string) => {
    try {
      const response = await apiCallWithRetry(() =>
        api.get(`/riot/mastery/${platform}/${puuid}?count=4`)
      );
      const masteryData = response.data;

      // Fetch champion names from Data Dragon
      const championDataResponse = await fetch('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/en_US/champion.json');
      const championData = await championDataResponse.json();

      const championMap: { [key: string]: string } = {};
      Object.values(championData.data).forEach((champ: any) => {
        championMap[champ.key] = champ.name;
      });

      const champions = masteryData.map((mastery: any) => ({
        name: championMap[mastery.championId.toString()] || 'Unknown',
        matches: Math.floor(mastery.championPoints / 1000),
        winRate: 50 + Math.floor(Math.random() * 20),
        championId: mastery.championId
      }));

      setTopChampions(champions);

    } catch (error) {
      console.error('Error fetching champion mastery:', error);
    }
  };

  // Use shared batch fetcher from services/riot (riotFetchMatchesInBatches)

  const fetchChampionMatchups = async (puuid: string, matchCount: number = 10) => {
    try {
      // For season data, use startTime instead of count
      const params = dataScope === 'season'
        ? `?count=100&start_time=${SEASON_START_TIMESTAMP}`
        : `?count=${matchCount}`;
      const matchIdsResponse = await apiCallWithRetry(() =>
        api.get(`/riot/matches/${REGION}/${puuid}${params}`)
      );
      const matchIds = matchIdsResponse.data;

      if (matchIds.length === 0) {
        return;
      }

      // Fetch match details using shared helper and compute matchups via shared service
      const matches = await riotFetchMatchesInBatches(matchIds);
      const matchups = await riotFetchChampionMatchups(puuid, matches as any);
      setChampionMatchups(matchups);

    } catch (error) {
      console.error('Error fetching champion matchups:', error);
    }
  };

  const fetchCSComparison = async (puuid: string, matchCount: number = 10) => {
    try {
      // For season data, use startTime instead of count
      const params = dataScope === 'season'
        ? `?count=100&start_time=${SEASON_START_TIMESTAMP}`
        : `?count=${matchCount}`;
      const matchIdsResponse = await apiCallWithRetry(() =>
        api.get(`/riot/matches/${REGION}/${puuid}${params}`)
      );
      const matchIds = matchIdsResponse.data;

      if (matchIds.length === 0) {
        return;
      }

      const matches = await riotFetchMatchesInBatches(matchIds);
      const cs = await riotFetchCSComparisonFromMatches(puuid, matches as any);
      if (cs) setCsComparison(cs);

    } catch (error) {
      console.error('Error fetching CS comparison:', error);
    }
  };

  // Re-fetch data when scope changes (but not on initial load)
  useEffect(() => {
    // Skip the first render (mount)
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      previousDataScopeRef.current = dataScope;
      return;
    }

    // Only refetch if:
    // 1. Initial load is complete
    // 2. We have valid data (puuid and currentRiotId)
    // 3. We're not already refetching
    // 4. dataScope has actually changed
    const hasDataScopeChanged = previousDataScopeRef.current !== dataScope;

    

    if (initialLoadComplete && puuid && currentRiotId !== 'Unknown' && !isRefetching && hasDataScopeChanged) {
      

      const refetchData = async () => {
        setIsRefetching(true);
        try {
          const matchCount = dataScope === 'last10' ? 10 : 100; // 100 is max, but startTime will limit it
          await Promise.all([
            fetchChampionMatchups(puuid, matchCount),
            fetchCSComparison(puuid, matchCount)
          ]);
          // CRITICAL: Only update the ref AFTER successful completion
          previousDataScopeRef.current = dataScope;
        } catch (error) {
          console.error('Error refetching data on scope change:', error);
          // Don't update ref on error - allow retry on next render
        } finally {
          setIsRefetching(false);
        }
      };
      refetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataScope]);

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🎮</span>
            </div>
          </div>
          <div className="text-yellow-400 text-xl font-bold mb-2">Loading player data...</div>
          <div className="text-yellow-300/60 text-sm font-semibold animate-pulse">
            Fetching stats from Riot Games API
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
        <div className="mb-8">
          <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2">
            League of Legends Dashboard
          </h2>
          <p className="text-yellow-300/60 font-semibold">Riot ID: {currentRiotId}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
          <p className="text-red-400 text-lg mb-4 font-bold">{error}</p>
          <button
            onClick={() => navigate('/game-selection')}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded-lg transition-all duration-300 font-black shadow-lg shadow-yellow-500/30"
          >
            ← Back to Game Selection
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
      {/* Rate Limit Warning Banner */}
      {rateLimitStatus?.isPenalty && (
        <div className="mb-6 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🚫</div>
            <div className="flex-1">
              <h3 className="text-red-400 font-black text-lg mb-1">Rate Limit Exceeded</h3>
              <p className="text-red-300 text-sm font-semibold">
                API requests are paused to comply with Riot's rate limits.
              </p>
              <p className="text-red-200 text-xs mt-2 font-bold">
                Cooldown ends in: <span className="text-yellow-400">{rateLimitStatus.remainingSeconds}s</span>
              </p>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-red-900/30"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-red-400"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (rateLimitStatus.remainingSeconds / 120)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-red-400 text-xs font-black">
                  {Math.ceil(rateLimitStatus.remainingSeconds / 60)}m
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2">
          League of Legends Dashboard
        </h2>
        <p className="text-yellow-300/60 font-semibold">
          Riot ID: {currentRiotId} | Level: {summonerLevel}
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-black text-white">Game Statistics</h3>
          <div className="flex gap-2 items-center">
            {isRefetching && (
              <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-lg border border-yellow-500/50">
                <div className="w-4 h-4 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
                <span className="text-yellow-400 text-sm font-bold">Updating...</span>
              </div>
            )}
            <button
              onClick={() => setDataScope('last10')}
              disabled={isRefetching}
              className={`px-4 py-2 rounded-lg font-bold transition-all duration-300 ${dataScope === 'last10'
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                } ${isRefetching ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Last 10 Games
            </button>
            <button
              onClick={() => setDataScope('season')}
              disabled={isRefetching}
              className={`px-4 py-2 rounded-lg font-bold transition-all duration-300 ${dataScope === 'season'
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                } ${isRefetching ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              This Season
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg hover:border-yellow-500/40 transition-all duration-300">
            <p className="text-yellow-300/60 text-sm mb-1 font-semibold uppercase tracking-wide">Rank</p>
            {rankedEntriesLocal && rankedEntriesLocal.length > 0 ? (
              <div className="flex flex-col gap-2">
                {rankedEntriesLocal.map((entry) => {
                  const label = entry.queueType === 'RANKED_SOLO_5x5' ? 'Solo' : entry.queueType === 'RANKED_FLEX_SR' ? 'Flex' : entry.queueType;
                  return (
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-black text-white">{`${entry.tier} ${entry.rank}`}</p>
                        <p className="text-xs text-yellow-300/60">{label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-green-400 font-bold">{entry.leaguePoints} LP</p>
                        <p className="text-xs text-gray-400">{entry.wins}W {entry.losses}L</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-3xl font-black text-white">Unranked</p>
            )}
          </div>
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg hover:border-yellow-500/40 transition-all duration-300">
            <p className="text-yellow-300/60 text-sm mb-1 font-semibold uppercase tracking-wide">Win Rate</p>
            <p className="text-3xl font-black text-white">
              {matchStats ? `${matchStats.winRate}%` : 'N/A'}
            </p>
            <p className="text-sm text-gray-400 mt-2 font-semibold">
              {matchStats ? `Last ${matchStats.totalGames} games` : 'No data'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg hover:border-yellow-500/40 transition-all duration-300">
            <p className="text-yellow-300/60 text-sm mb-1 font-semibold uppercase tracking-wide">Avg CS/Min</p>
            <p className="text-3xl font-black text-white">
              {matchStats ? matchStats.avgCSPerMin : 'N/A'}
            </p>
            {rankedStats && (
              <p className="text-sm text-gray-400 mt-2 font-semibold">
                {rankedStats.wins}W {rankedStats.losses}L
              </p>
            )}
          </div>
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg hover:border-yellow-500/40 transition-all duration-300">
            <p className="text-yellow-300/60 text-sm mb-1 font-semibold uppercase tracking-wide">KDA</p>
            <p className="text-3xl font-black text-white">
              {matchStats ? matchStats.avgKDA : 'N/A'}
            </p>
            <p className="text-sm text-gray-400 mt-2 font-semibold">
              {matchStats && matchStats.avgKDA >= 3 ? 'Excellent' : 'Average'}
            </p>
          </div>
        </div>
      </div>

      {/* Champion Matchups */}
      <ChampionMatchups matchups={championMatchups} dataScope={dataScope} />

      {/* CS Comparison */}
      <div className="mb-8">
        <h3 className="text-2xl font-black text-white mb-4">Farm Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg hover:border-yellow-500/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                <span className="text-2xl">⚔️</span>
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Your CS/Min</h4>
                <p className="text-sm text-yellow-300/60 font-medium">Average farm rate</p>
              </div>
            </div>
            <p className="text-3xl font-black text-white mb-2">
              {csComparison ? csComparison.playerAvgCS.toFixed(1) : 'N/A'}
            </p>
            {csComparison && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1 font-semibold">
                  <span>vs Role Average</span>
                  <span>{csComparison.roleAvgCS.toFixed(1)}</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${csComparison.difference >= 0 ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}
                    style={{ width: `${Math.min(Math.abs(csComparison.difference) * 10, 100)}%` }}
                  ></div>
                </div>
                <p className={`text-xs mt-2 font-bold ${csComparison.difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {csComparison.difference >= 0 ? '↑' : '↓'} {Math.abs(csComparison.difference).toFixed(1)} CS/min {csComparison.difference >= 0 ? 'above' : 'below'} average
                </p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg hover:border-yellow-500/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/30">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Percentile Rank</h4>
                <p className="text-sm text-yellow-300/60 font-medium">Compared to role</p>
              </div>
            </div>
            <p className="text-3xl font-black text-white mb-2">
              {csComparison ? `${csComparison.percentile}%` : 'N/A'}
            </p>
            {csComparison && (
              <div className="mt-3">
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-amber-500"
                    style={{ width: `${csComparison.percentile}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-2 font-semibold">
                  {csComparison.percentile >= 75 ? 'Top tier farmer! 🌟' :
                    csComparison.percentile >= 50 ? 'Above average 👍' :
                      'Room for improvement 📈'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Champion Stats */}
      <div className="mb-8">
        <h3 className="text-2xl font-black text-white mb-4">Top Champions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {topChampions.length > 0 ? (
            topChampions.map((champ) => (
              <div key={champ.championId} className="bg-gradient-to-br from-gray-950 to-black p-4 rounded-xl border border-yellow-500/20 text-center shadow-lg hover:border-yellow-500/40 hover:scale-105 transition-all duration-300">
                <p className="text-white font-black mb-2">{champ.name}</p>
                <p className="text-yellow-300/60 text-sm font-semibold">{champ.matches}k mastery pts</p>
                <p className="text-yellow-400 text-sm font-bold">Level {Math.floor(champ.matches / 21)}</p>
              </div>
            ))
          ) : (
            <p className="text-yellow-300/60 col-span-4 font-semibold">No champion data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachLoLDashboard;