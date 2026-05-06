import api from '../services/api';
import { apiCallWithRetry } from '../utils/rateLimiter';
import type { ChampionMatchup, CSComparison } from '../types/riot';

const REGION_DEFAULT = 'europe';
export const SEASON_START_TIMESTAMP = Math.floor(new Date('2025-04-29T00:00:00Z').getTime() / 1000);

export async function fetchPUUID(region: string = REGION_DEFAULT, gameName: string, tagLine: string) {
    return apiCallWithRetry(() => api.get(`/riot/account/${region}/${gameName}/${tagLine}`));
}

export async function detectPlatform(puuid: string, region: string = REGION_DEFAULT) {
    try {
        const res = await apiCallWithRetry(() => api.get(`/riot/matches/${region}/${puuid}?count=1`));
        const matchIds = res.data;
        if (!matchIds || matchIds.length === 0) return 'euw1';
        return matchIds[0].split('_')[0].toLowerCase();
    } catch (err) {
        console.error('detectPlatform error', err);
        return 'euw1';
    }
}

export async function fetchMatchesInBatches(matchIds: string[], region: string = REGION_DEFAULT) {
    const results: any[] = [];

    const fetchOneWithRetry = async (matchId: string, maxRetries = 2) => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await apiCallWithRetry(() => api.get(`/riot/match/${region}/${matchId}`));
                return res.data;
            } catch (err: any) {
                if (attempt < maxRetries) {
                    const jitter = 200 * (attempt + 1);
                    await new Promise((r) => setTimeout(r, jitter));
                    continue;
                }
                console.error(`Failed to fetch match ${matchId}:`, err);
                return null;
            }
        }
        return null;
    };

    for (const matchId of matchIds) {
        const result = await fetchOneWithRetry(matchId);
        if (result !== null) results.push(result);
        await new Promise((r) => setTimeout(r, 50));
    }

    return results.filter((r) => r !== null);
}

export async function fetchChampionMastery(puuid: string, platform: string) {
    const res = await apiCallWithRetry(() => api.get(`/riot/mastery/${platform}/${puuid}?count=4`));
    return res.data;
}

export async function fetchChampionMatchups(puuid: string, matchIds: string[]) {
    // This function expects match details (not just ids) — the caller may call fetchMatchesInBatches first.
    const matchupMap: Record<number, { wins: number; losses: number }> = {};

    matchIds.forEach((match: any) => {
        const participant = match.info.participants.find((p: any) => p.puuid === puuid);
        if (!participant) return;
        const playerTeamId = participant.teamId;
        const playerLane = participant.teamPosition || participant.individualPosition;

        const enemyLaner = match.info.participants.find((p: any) =>
            p.teamId !== playerTeamId && (p.teamPosition === playerLane || p.individualPosition === playerLane)
        );

        if (enemyLaner) {
            const enemyChampId = enemyLaner.championId;
            if (!matchupMap[enemyChampId]) matchupMap[enemyChampId] = { wins: 0, losses: 0 };
            if (participant.win) matchupMap[enemyChampId].wins++; else matchupMap[enemyChampId].losses++;
        }
    });

    // Fetch Data Dragon champion names so we can show readable champion names instead of numeric ids
    let championMap: Record<string, string> = {};
    try {
        const championDataResponse = await fetch('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/en_US/champion.json');
        const championData = await championDataResponse.json();
        Object.values(championData.data).forEach((champ: any) => {
            // champ.key is the numeric id as string (e.g., '266')
            championMap[champ.key] = champ.name;
        });
    } catch (e) {
        console.warn('Failed to fetch champion metadata from Data Dragon', e);
    }

    // Convert to ChampionMatchup[]
    const matchups: ChampionMatchup[] = Object.entries(matchupMap).map(([id, s]) => ({
        championId: parseInt(id, 10),
        championName: championMap[id] || 'Unknown',
        wins: s.wins,
        losses: s.losses,
        winRate: Math.round((s.wins / (s.wins + s.losses)) * 100),
    })).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)).slice(0, 5);

    return matchups;
}

export async function fetchSummonerByPUUID(puuid: string, platform: string) {
    // Backend endpoint returns summoner data for a platform + puuid
    const res = await apiCallWithRetry(() => api.get(`/riot/summoner/${platform}/${puuid}`));
    return res.data;
}

export async function fetchCSComparisonFromMatches(puuid: string, matches: any[]): Promise<CSComparison | null> {
    if (!matches || matches.length === 0) return null;

    let totalPlayerCS = 0; let totalPlayerGameTime = 0; let totalRoleCS = 0; let totalRoleGameTime = 0; let roleMatchCount = 0;

    matches.forEach((match: any) => {
        const participant = match.info.participants.find((p: any) => p.puuid === puuid);
        if (!participant) return;
        const playerCS = participant.totalMinionsKilled + participant.neutralMinionsKilled;
        const gameDuration = match.info.gameDuration;
        totalPlayerCS += playerCS;
        totalPlayerGameTime += gameDuration;
        const playerRole = participant.teamPosition || participant.individualPosition;
        const sameRolePlayers = match.info.participants.filter((p: any) => (p.teamPosition === playerRole || p.individualPosition === playerRole) && p.puuid !== puuid);
        sameRolePlayers.forEach((p: any) => { totalRoleCS += p.totalMinionsKilled + p.neutralMinionsKilled; totalRoleGameTime += gameDuration; roleMatchCount++; });
    });

    const playerAvgCS = (totalPlayerCS / (totalPlayerGameTime / 60));
    const roleAvgCS = roleMatchCount > 0 ? (totalRoleCS / (totalRoleGameTime / 60)) : playerAvgCS;
    const difference = playerAvgCS - roleAvgCS;
    const percentile = difference >= 0 ? 50 + Math.min(difference * 2, 49) : 50 + Math.max(difference * 2, -49);

    return {
        playerAvgCS: Math.round(playerAvgCS * 10) / 10,
        roleAvgCS: Math.round(roleAvgCS * 10) / 10,
        difference: Math.round(difference * 10) / 10,
        percentile: Math.round(percentile),
    };
}
