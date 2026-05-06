export interface RankedStats {
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
}

export interface MatchStats {
    winRate: number;
    avgKDA: number;
    avgCSPerMin: number;
    totalGames: number;
}

export interface ChampionData {
    name: string;
    matches: number;
    winRate: number;
    championId: number;
}

export interface ChampionMatchup {
    championName: string;
    championId: number;
    wins: number;
    losses: number;
    winRate: number;
}

export interface CSComparison {
    playerAvgCS: number;
    roleAvgCS: number;
    difference: number;
    percentile: number;
}

export type DataScope = 'last10' | 'season';
