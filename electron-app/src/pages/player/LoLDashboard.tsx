import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ChampionMatchups from '../../components/ChampionMatchups';
import { usePlayerData } from '../../hooks/usePlayerData';

/**
 * LoL Dashboard
 *
 * This page aggregates a variety of player-centric metrics fetched from the
 * backend Riot proxy and external resources (Data Dragon). It uses a
 * rate-limited API wrapper to avoid hitting Riot's rate limits and exposes
 * several helper functions that fetch match history, champion mastery, and
 * matchup statistics.
 */

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

/**
 * RateLimiter
 *
 * A lightweight in-memory token-tracking rate limiter designed to avoid
 * hitting Riot API rate limits. It maintains two sliding windows:
 *  - shortWindow: tracks timestamps within a 1-second window (max 20)
 *  - longWindow: tracks timestamps within a 2-minute window (max 100)
 *
 * If a 429 (rate exceeded) is encountered the limiter can be instructed to enter a
 * penalty state (pause) using `handle429Error`, which uses the
 * optional Retry-After header value when available.
 */
class RateLimiter {
  private shortWindow: number[] = []; // timestamps for 1-second window
  private longWindow: number[] = []; // timestamps for 2-minute window
  private readonly SHORT_LIMIT = 20;
  private readonly SHORT_WINDOW = 1000; // 1 second
  private readonly LONG_LIMIT = 100;
  private readonly LONG_WINDOW = 120000; // 2 minutes
  private rateLimitPenalty: number = 0; // Penalty time if we hit 429

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // If we're under penalty (hit 429), wait it out
    if (this.rateLimitPenalty > now) {
      const penaltyWait = this.rateLimitPenalty - now;
      console.warn(`[RateLimiter] ⚠️ Rate limit penalty active. Waiting ${Math.ceil(penaltyWait / 1000)}s before next request`);
      await new Promise(resolve => setTimeout(resolve, penaltyWait));
    }

    // Clean old entries
    this.shortWindow = this.shortWindow.filter(t => now - t < this.SHORT_WINDOW);
    this.longWindow = this.longWindow.filter(t => now - t < this.LONG_WINDOW);

    // Check if we need to wait
    while (this.shortWindow.length >= this.SHORT_LIMIT || this.longWindow.length >= this.LONG_LIMIT) {
      let waitTime = 0;

      if (this.shortWindow.length >= this.SHORT_LIMIT) {
        // Wait until the oldest request in the short window expires
        const oldestShort = this.shortWindow[0];
        waitTime = Math.max(waitTime, this.SHORT_WINDOW - (now - oldestShort) + 100); // Add 100ms buffer
      }

      if (this.longWindow.length >= this.LONG_LIMIT) {
        // Wait until the oldest request in the long window expires
        const oldestLong = this.longWindow[0];
        waitTime = Math.max(waitTime, this.LONG_WINDOW - (now - oldestLong) + 100); // Add 100ms buffer
      }

      
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Re-clean after waiting
      const newNow = Date.now();
      this.shortWindow = this.shortWindow.filter(t => newNow - t < this.SHORT_WINDOW);
      this.longWindow = this.longWindow.filter(t => newNow - t < this.LONG_WINDOW);
    }

    // Record this request
    const timestamp = Date.now();
    this.shortWindow.push(timestamp);
    this.longWindow.push(timestamp);
  }

  // Call this when a 429 error is received
  handle429Error(retryAfterSeconds?: number): void {
    // Use Retry-After header if provided, otherwise default to 2 minutes
    const penaltyDuration = (retryAfterSeconds || 120) * 1000;
    this.rateLimitPenalty = Date.now() + penaltyDuration;
    console.error(`[RateLimiter] 🚫 429 Rate Limit Hit! Pausing all requests for ${retryAfterSeconds || 120}s`);

    // Clear windows to reset our tracking
    this.shortWindow = [];
    this.longWindow = [];
  }

  getStats() {
    const now = Date.now();
    this.shortWindow = this.shortWindow.filter(t => now - t < this.SHORT_WINDOW);
    this.longWindow = this.longWindow.filter(t => now - t < this.LONG_WINDOW);
    return {
      shortWindow: `${this.shortWindow.length}/${this.SHORT_LIMIT}`,
      longWindow: `${this.longWindow.length}/${this.LONG_LIMIT}`,
      penaltyActive: this.rateLimitPenalty > now
    };
  }

  getPenaltyStatus() {
    const now = Date.now();
    const isPenalty = this.rateLimitPenalty > now;
    return {
      isPenalty,
      penaltyEndsAt: this.rateLimitPenalty,
      remainingSeconds: isPenalty ? Math.ceil((this.rateLimitPenalty - now) / 1000) : 0
    };
  }
}

// Create a singleton rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * apiCallWithRetry
 *
 * Executes the provided API call while coordinating with the RateLimiter.
 * If a 429 response is encountered, the limiter is informed and the call
 * will be retried up to `maxRetries` times (default 3). The function
 * respects the Retry-After header when present.
 */
async function apiCallWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.waitForSlot();
      return await apiCall();
    } catch (error: any) {
      // Check if it's a 429 rate limit error
      if (error.response?.status === 429) {
        console.warn(`[API Retry] Attempt ${attempt}/${maxRetries} - Got 429, handling rate limit...`);

        // Extract Retry-After header if available (in seconds)
        const retryAfter = error.response?.headers?.['retry-after'];
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter) : 120;

        // Tell the rate limiter to pause
        rateLimiter.handle429Error(retryAfterSeconds);

        // If this was our last attempt, throw the error
        if (attempt === maxRetries) {
          throw new Error(`Rate limit exceeded after ${maxRetries} attempts. Please wait ${retryAfterSeconds}s and try again.`);
        }

        continue;
      }

      // If it's not a 429, throw immediately
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * LoLDashboard Component
 *
 * Main player-facing dashboard that orchestrates data fetching, handles UI
 * state (loading, error, rate limit status), and renders a collection of
 * metric panels and subcomponents such as ChampionMatchups.
 */
const LoLDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentRiotId, setCurrentRiotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player data states
  const [puuid, setPuuid] = useState<string>('');
  const [rankedStats, setRankedStats] = useState<RankedStats | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [topChampions] = useState<ChampionData[]>([]);

  // New metrics
  const [championMatchups, setChampionMatchups] = useState<ChampionMatchup[]>([]);
  const [csComparison, setCsComparison] = useState<CSComparison | null>(null);
  const [dataScope, setDataScope] = useState<'last10' | 'season'>('last10');
  const [initialLoadComplete] = useState(false);
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
      // Check both keys used across the app for stored Riot ID (some pages use current_lol_riot_id)
      const savedRiotId = sessionStorage.getItem('current_riot_id') || sessionStorage.getItem('current_lol_riot_id');
      if (savedRiotId && savedRiotId !== 'Unknown') {
        setCurrentRiotId(savedRiotId);
      } else {
        navigate('/game-selection');
      }
    }
  }, [searchParams, navigate]);

  // Fetch PUUID and player data via shared hook when Riot ID changes
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

  // Hook-ranked entries (all available queues)
  const [rankedEntriesLocal, setRankedEntriesLocal] = useState<RankedStats[]>([]);
  const [summonerLevel, setSummonerLevel] = useState<number>(0);

  // Sync selected values from the hook into local state to keep the rest of the
  // component unchanged during an incremental refactor. This allows us to start
  // migrating UI pieces to the hook gradually.
  useEffect(() => {
    if (hookPuuid) {
      setPuuid(hookPuuid);
      sessionStorage.setItem('current_lol_puuid', hookPuuid);
    }
    // Mirror basic data to existing state holders so downstream UI still works
    if (hookMatchStats) setMatchStats(hookMatchStats);
    if (hookChampionMatchups) setChampionMatchups(hookChampionMatchups);
    if (hookCsComparison) setCsComparison(hookCsComparison);
    if (hookRankedStats) setRankedStats(hookRankedStats);
    // sync all ranked entries from the hook (array of queues)
    if ((hookRankedEntries as any) && Array.isArray(hookRankedEntries)) setRankedEntriesLocal(hookRankedEntries as any);
    if (hookSummonerLevel != null) setSummonerLevel(hookSummonerLevel);
    // sync loading/error flags
    setLoading(!!hookLoading);
    if (hookError) setError(hookError);
    // Keep component-level dataScope in sync with the hook so toggles continue to work
    if (hookDataScope && hookDataScope !== dataScope) {
      setDataScope(hookDataScope);
    }
  }, [hookPuuid, hookLoading, hookError, hookRankedStats, hookRankedEntries, hookMatchStats, hookChampionMatchups, hookCsComparison, hookDataScope]);

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





  // Helper to fetch match details in controlled batches to avoid rate limits
  /**
   * fetchMatchesInBatches
   *
   * Sequentially fetches match detail objects for the provided match ids.
   * Requests are performed sequentially (not parallel) so the rate limiter
   * can reliably track request timing. A small jitter/delay between calls
   * improves behavior under strict rate limits.
   */
  const fetchMatchesInBatches = async (matchIds: string[]) => {
    const results: any[] = [];

    const fetchOneWithRetry = async (matchId: string, maxRetries = 2) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await apiCallWithRetry(() =>
            api.get(`/riot/match/${REGION}/${matchId}`)
          );
          return res.data;
        } catch (err: any) {
          // For network/transient errors retry a couple times
          if (attempt < maxRetries) {
            const jitter = 200 * (attempt + 1);
            await new Promise(resolve => setTimeout(resolve, jitter));
            continue;
          }
          console.error(`Failed to fetch match ${matchId}:`, err);
          return null;
        }
      }
      return null;
    };

    // Process sequentially instead of in parallel batches to work better with rate limiter
    for (const matchId of matchIds) {
      const result = await fetchOneWithRetry(matchId);
      if (result !== null) {
        results.push(result);
      }
      // Small delay between individual requests (rate limiter handles the real throttling)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return results.filter(r => r !== null);
  };

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

      // Fetch match details (batched to avoid rate limits)
      const matches = await fetchMatchesInBatches(matchIds);

      // Get champion name mapping
      const championDataResponse = await fetch('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/en_US/champion.json');
      const championData = await championDataResponse.json();
      const championMap: { [key: string]: string } = {};
      Object.values(championData.data).forEach((champ: any) => {
        championMap[champ.key] = champ.name;
      });

      // Track matchups
      const matchupMap: { [championId: number]: { wins: number, losses: number } } = {};

      matches.forEach((match: any) => {
        const participant = match.info.participants.find((p: any) => p.puuid === puuid);
        if (!participant) return;

        const playerTeamId = participant.teamId;
        const playerLane = participant.teamPosition || participant.individualPosition;

        // Find enemy laner (same position, different team)
        const enemyLaner = match.info.participants.find((p: any) =>
          p.teamId !== playerTeamId &&
          (p.teamPosition === playerLane || p.individualPosition === playerLane)
        );

        if (enemyLaner) {
          const enemyChampId = enemyLaner.championId;
          if (!matchupMap[enemyChampId]) {
            matchupMap[enemyChampId] = { wins: 0, losses: 0 };
          }

          if (participant.win) {
            matchupMap[enemyChampId].wins++;
          } else {
            matchupMap[enemyChampId].losses++;
          }
        }
      });

      // Convert to array and sort by total games
      const matchups: ChampionMatchup[] = Object.entries(matchupMap)
        .map(([championId, stats]) => ({
          championId: parseInt(championId),
          championName: championMap[championId] || 'Unknown',
          wins: stats.wins,
          losses: stats.losses,
          winRate: Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
        }))
        .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
        .slice(0, 5);

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

      const matches = await fetchMatchesInBatches(matchIds);

      let totalPlayerCS = 0;
      let totalPlayerGameTime = 0;
      let totalRoleCS = 0;
      let totalRoleGameTime = 0;
      let roleMatchCount = 0;

      matches.forEach((match: any) => {
        const participant = match.info.participants.find((p: any) => p.puuid === puuid);
        if (!participant) return;

        const playerCS = participant.totalMinionsKilled + participant.neutralMinionsKilled;
        const gameDuration = match.info.gameDuration;

        totalPlayerCS += playerCS;
        totalPlayerGameTime += gameDuration;

        const playerRole = participant.teamPosition || participant.individualPosition;

        // Get average CS for the same role across both teams
        const sameRolePlayers = match.info.participants.filter((p: any) =>
          (p.teamPosition === playerRole || p.individualPosition === playerRole) && p.puuid !== puuid
        );

        sameRolePlayers.forEach((p: any) => {
          totalRoleCS += p.totalMinionsKilled + p.neutralMinionsKilled;
          totalRoleGameTime += gameDuration;
          roleMatchCount++;
        });
      });

      const playerAvgCS = (totalPlayerCS / (totalPlayerGameTime / 60));
      const roleAvgCS = roleMatchCount > 0 ? (totalRoleCS / (totalRoleGameTime / 60)) : playerAvgCS;
      const difference = playerAvgCS - roleAvgCS;

      // Simple percentile calculation (above average = 50+)
      const percentile = difference >= 0 ? 50 + Math.min(difference * 2, 49) : 50 + Math.max(difference * 2, -49);

      setCsComparison({
        playerAvgCS: Math.round(playerAvgCS * 10) / 10,
        roleAvgCS: Math.round(roleAvgCS * 10) / 10,
        difference: Math.round(difference * 10) / 10,
        percentile: Math.round(percentile)
      });

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


    if (initialLoadComplete && puuid && currentRiotId != null && !isRefetching && hasDataScopeChanged) {

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
            <p className="text-yellow-300/60 text-sm mb-1 font-semibold uppercase tracking-wide">Rank (Out of use, riot api issue)</p>
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
        <h3 className="text-2xl font-black text-white mb-4">Top Champions (Out of use, riot api issue)</h3>
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

export default LoLDashboard;