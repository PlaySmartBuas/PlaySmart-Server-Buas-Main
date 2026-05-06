import { useEffect, useState, useRef } from 'react';
import type { RankedStats, MatchStats, ChampionMatchup, CSComparison } from '../types/riot';
import { fetchPUUID, detectPlatform, fetchMatchesInBatches, fetchChampionMatchups, fetchCSComparisonFromMatches, fetchSummonerByPUUID } from '../services/riot';
import { apiCallWithRetry } from '../utils/rateLimiter';
import api from '../services/api';

interface UsePlayerDataOptions {
    initialScope?: 'last10' | 'season';
    region?: string;
}

export function usePlayerData(riotId: string | null, options?: UsePlayerDataOptions) {
    const [puuid, setPuuid] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rankedStats, setRankedStats] = useState<RankedStats | null>(null);
    const [rankedEntries, setRankedEntries] = useState<RankedStats[]>([]);
    const [summonerLevel, setSummonerLevel] = useState<number | null>(null);
    const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
    const [championMatchups, setChampionMatchups] = useState<ChampionMatchup[]>([]);
    const [csComparison, setCsComparison] = useState<CSComparison | null>(null);
    const [dataScope, setDataScope] = useState<'last10' | 'season'>(options?.initialScope || 'last10');
    const isMountedRef = useRef(false);

    const REGION = options?.region || 'europe';

    useEffect(() => {
        // Validate riotId — it must be a non-empty string containing a '#' (e.g. 'name#tag')
        if (!riotId || riotId === 'Unknown' || riotId.indexOf('#') === -1) return;
        if (!isMountedRef.current) isMountedRef.current = true;

        let cancelled = false;

        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                const [gameName, tagLine] = riotId.split('#');
                const puuidResp: any = await fetchPUUID(REGION, gameName, tagLine);
                const fetchedPuuid = puuidResp.data.puuid;
                if (cancelled) return;
                setPuuid(fetchedPuuid);

                // Detect platform (e.g., euw1, na1) so we can fetch ranked entries
                let platform = 'euw1';
                try {
                    platform = await detectPlatform(fetchedPuuid, REGION);
                } catch (e) {
                    // fallback to default platform
                    platform = 'euw1';
                }

                // Fetch ranked entries for the player
                try {
                    const rankedResp: any = await apiCallWithRetry(() => api.get(`/riot/ranked-by-puuid/${platform}/${fetchedPuuid}`));
                    const entries = Array.isArray(rankedResp) ? rankedResp : (rankedResp?.data || []);

                    const mapped = (entries || []).map((e: any) => ({
                        tier: e.tier,
                        rank: e.rank,
                        leaguePoints: e.leaguePoints || 0,
                        wins: e.wins || 0,
                        losses: e.losses || 0,
                        queueType: e.queueType || 'UNKNOWN'
                    } as any));

                    setRankedEntries(mapped);

                    // Keep a single 'primary' rankedStats for backwards compatibility (prefer solo)
                    const solo = mapped.find((m: any) => m.queueType === 'RANKED_SOLO_5x5');
                    const chosen = solo || (mapped.length > 0 ? mapped[0] : null);
                    if (chosen) setRankedStats(chosen);
                } catch (rankErr) {
                    console.warn('Failed to fetch ranked stats', rankErr);
                }

                // Fetch summoner/profile info (to get level)
                try {
                    const summonerInfo: any = await fetchSummonerByPUUID(fetchedPuuid, platform);
                    // Riot Summoner V4 uses 'summonerLevel'
                    const level = summonerInfo?.summonerLevel ?? summonerInfo?.level ?? null;
                    if (level != null) setSummonerLevel(level);
                } catch (sErr) {
                    console.warn('Failed to fetch summoner info', sErr);
                }

                // Fetch matches and other metrics concurrently (small batch for initial)
                const matchIdsResp: any = await apiCallWithRetry(() => api.get(`/riot/matches/${REGION}/${fetchedPuuid}?count=20`));
                const matchIds = matchIdsResp.data || [];
                const matchDetails = await fetchMatchesInBatches(matchIds.slice(0, dataScope === 'last10' ? 10 : 100));

                const matchups = await fetchChampionMatchups(fetchedPuuid, matchDetails);
                const csComp = await fetchCSComparisonFromMatches(fetchedPuuid, matchDetails);

                if (cancelled) return;
                setChampionMatchups(matchups);
                setCsComparison(csComp);

                // Calculate matchStats similar to dashboard
                let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalCS = 0, totalDuration = 0, wins = 0;
                matchDetails.forEach((match: any) => {
                    const participant = match.info.participants.find((p: any) => p.puuid === fetchedPuuid);
                    if (!participant) return;
                    totalKills += participant.kills; totalDeaths += participant.deaths; totalAssists += participant.assists;
                    totalCS += participant.totalMinionsKilled + participant.neutralMinionsKilled;
                    totalDuration += match.info.gameDuration; if (participant.win) wins++;
                });

                const avgKDA = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : totalKills + totalAssists;
                const avgCSPerMin = (totalCS / (totalDuration / 60));
                const winRate = matchDetails.length ? (wins / matchDetails.length) * 100 : 0;

                setMatchStats({ winRate: Math.round(winRate), avgKDA: Math.round(avgKDA * 10) / 10, avgCSPerMin: Math.round(avgCSPerMin * 10) / 10, totalGames: matchDetails.length });

            } catch (err: any) {
                if (!cancelled) setError(err.message || 'Failed to load player data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchAll();

        return () => { cancelled = true; };
    }, [riotId, dataScope]);

    return { puuid, loading, error, rankedStats, rankedEntries, summonerLevel, matchStats, championMatchups, csComparison, dataScope, setDataScope };
}