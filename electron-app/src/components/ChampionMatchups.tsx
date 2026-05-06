import React, { useState } from 'react';

interface ChampionMatchup {
    championName: string;
    championId: number;
    wins: number;
    losses: number;
    winRate: number;
}

interface ChampionMatchupsProps {
    matchups: ChampionMatchup[];
    dataScope: 'last10' | 'season';
}

const ChampionMatchups: React.FC<ChampionMatchupsProps> = ({ matchups, dataScope }) => {
    const [matchupSort, setMatchupSort] = useState<'games' | 'wins' | 'losses'>('games');

    const sortedMatchups = [...matchups].sort((a, b) => {
        if (matchupSort === 'wins') return b.wins - a.wins;
        if (matchupSort === 'losses') return b.losses - a.losses;
        return (b.wins + b.losses) - (a.wins + a.losses); // Most played
    });

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-black text-white">Champion Matchups</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMatchupSort('games')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${matchupSort === 'games'
                                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        Most Played
                    </button>
                    <button
                        onClick={() => setMatchupSort('wins')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${matchupSort === 'wins'
                                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        Most Wins
                    </button>
                    <button
                        onClick={() => setMatchupSort('losses')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${matchupSort === 'losses'
                                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        Most Losses
                    </button>
                </div>
            </div>
            <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-xl border border-yellow-500/20 shadow-lg">
                {matchups.length > 0 ? (
                    <div className="space-y-3">
                        {sortedMatchups.map((matchup) => (
                            <div
                                key={matchup.championId}
                                className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-yellow-500/10 hover:border-yellow-500/30 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                                        <span className="text-lg font-black text-yellow-400">
                                            {matchup.championName.substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg">{matchup.championName}</p>
                                        <p className="text-gray-400 text-sm font-semibold">
                                            {matchup.wins + matchup.losses} games played
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-white mb-1">{matchup.winRate}%</p>
                                    <p className="text-sm font-semibold">
                                        <span className="text-green-400">{matchup.wins}W</span>
                                        {' / '}
                                        <span className="text-red-400">{matchup.losses}L</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-yellow-300/60 text-center py-4 font-semibold">
                        No matchup data available for {dataScope === 'last10' ? 'last 10 games' : 'this season'}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ChampionMatchups;
