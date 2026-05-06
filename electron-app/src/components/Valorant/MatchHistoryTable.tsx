import React, { useState } from 'react';
import { type ValorantMatch, type ValorantPlayer, valorantAPI, type ValorantMatchDetails } from '../../services/api';

interface MatchHistoryTableProps {
  matches: ValorantMatch[];
  playerPuuid: string;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const MatchHistoryTable: React.FC<MatchHistoryTableProps> = ({
  matches,
  playerPuuid,
  loading = false,
  onLoadMore,
  hasMore = false
}) => {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ValorantMatchDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const getPlayerData = (match: ValorantMatch): ValorantPlayer | undefined => {
    return match.players.all_players.find(p => p.puuid === playerPuuid);
  };

  const getMatchResult = (match: ValorantMatch, playerData: ValorantPlayer | undefined): string => {
    if (!playerData) return 'Unknown';
    
    const playerTeam = playerData.team.toLowerCase();
    const teamData = match.teams[playerTeam as 'red' | 'blue'];
    
    return teamData?.has_won ? 'Victory' : 'Defeat';
  };

  const getScore = (match: ValorantMatch, playerData: ValorantPlayer | undefined): string => {
    if (!playerData) return '0 - 0';
    
    const playerTeam = playerData.team.toLowerCase() as 'red' | 'blue';
    const opponentTeam = playerTeam === 'red' ? 'blue' : 'red';
    
    const playerScore = match.teams[playerTeam]?.rounds_won || 0;
    const opponentScore = match.teams[opponentTeam]?.rounds_won || 0;
    
    return `${playerScore} - ${opponentScore}`;
  };

  const getKDA = (stats: ValorantPlayer['stats']): string => {
    return `${stats.kills} / ${stats.deaths} / ${stats.assists}`;
  };

  const getKDRatio = (stats: ValorantPlayer['stats']): string => {
    const ratio = stats.deaths === 0 ? stats.kills : (stats.kills / stats.deaths);
    return ratio.toFixed(2);
  };

  const getHeadshotPercentage = (stats: ValorantPlayer['stats']): string => {
    const totalShots = stats.headshots + stats.bodyshots + stats.legshots;
    if (totalShots === 0) return '0%';
    return `${((stats.headshots / totalShots) * 100).toFixed(1)}%`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) {
      return 'N/A';
    }

    const minutes = Math.round(seconds / 60);
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    
    return `${minutes}m`;
  };

  const handleRowClick = (matchId: string) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
    } else {
      setExpandedMatchId(matchId);
    }
  };

  const handleViewDetails = async (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation(); 
    
    try {
      setDetailsLoading(true);
      const response = await valorantAPI.getMatchDetails(matchId);
      
      if (response.success && response.data) {
        setSelectedMatch(response.data);
        setDetailsModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load match details:', err);
      alert('Failed to load match details. Please try again.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setDetailsModalOpen(false);
    setSelectedMatch(null);
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black/60 border-b-2 border-yellow-400/30">
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Result</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Map</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Agent</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Mode</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Score</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">K/D/A</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">K/D</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">HS%</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Duration</th>
              <th className="px-4 py-3 text-left text-yellow-400 font-bold text-sm">Date</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match, index) => {
              const playerData = getPlayerData(match);
              const result = getMatchResult(match, playerData);
              const isVictory = result === 'Victory';
              const isExpanded = expandedMatchId === match.metadata.matchid;

              return (
                <React.Fragment key={`${match.metadata.matchid}-${index}`}>
                  {/* Main Row */}
                  <tr 
                    onClick={() => handleRowClick(match.metadata.matchid)}
                    className={`border-b border-yellow-400/10 hover:bg-yellow-400/10 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-yellow-400/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span 
                        className={`px-3 py-1 rounded font-bold text-xs ${
                          isVictory 
                            ? 'bg-green-900/30 text-green-400 border border-green-400/30' 
                            : 'bg-red-900/30 text-red-400 border border-red-400/30'
                        }`}
                      >
                        {result}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-yellow-100 font-medium">
                      {match.metadata.map}
                    </td>

                    <td className="px-4 py-3 text-yellow-100">
                      {playerData?.character || 'Unknown'}
                    </td>

                    <td className="px-4 py-3 text-yellow-100/80 text-sm capitalize">
                      {match.metadata.mode}
                    </td>

                    <td className="px-4 py-3 text-yellow-100 font-mono">
                      {getScore(match, playerData)}
                    </td>

                    <td className="px-4 py-3 text-yellow-100 font-mono">
                      {playerData ? getKDA(playerData.stats) : '-/-/-'}
                    </td>

                    <td className="px-4 py-3 text-yellow-100 font-mono font-bold">
                      {playerData ? getKDRatio(playerData.stats) : '0.00'}
                    </td>

                    <td className="px-4 py-3 text-yellow-100 font-mono">
                      {playerData ? getHeadshotPercentage(playerData.stats) : '0%'}
                    </td>

                    <td className="px-4 py-3 text-yellow-100/80 text-sm">
                      {formatDuration(match.metadata.game_length)}
                    </td>

                    <td className="px-4 py-3 text-yellow-100/80 text-sm">
                      {formatDate(match.metadata.game_start)}
                    </td>
                  </tr>

                  {/* Expanded Row - Basic Info */}
                  {isExpanded && (
                    <tr className="bg-yellow-400/5 border-b border-yellow-400/20">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="space-y-4">
                          {playerData && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div className="bg-black/40 rounded p-3">
                                <p className="text-yellow-400/60 text-xs mb-1">Combat Score</p>
                                <p className="text-yellow-400 font-bold text-lg">{playerData.stats.score}</p>
                              </div>
                              <div className="bg-black/40 rounded p-3">
                                <p className="text-yellow-400/60 text-xs mb-1">Damage Done</p>
                                <p className="text-yellow-400 font-bold text-lg">{playerData.damage_made}</p>
                              </div>
                              <div className="bg-black/40 rounded p-3">
                                <p className="text-yellow-400/60 text-xs mb-1">Damage Taken</p>
                                <p className="text-yellow-400 font-bold text-lg">{playerData.damage_received}</p>
                              </div>
                              <div className="bg-black/40 rounded p-3">
                                <p className="text-yellow-400/60 text-xs mb-1">Current Rank</p>
                                <p className="text-yellow-400 font-bold text-lg">{playerData.currenttier_patched}</p>
                              </div>
                            </div>
                          )}

                          {/* Quick Team Overview */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
                              <h4 className="text-red-400 font-bold mb-2 flex items-center justify-between">
                                <span>Red Team</span>
                                {match.teams.red.has_won && (
                                  <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">Victory</span>
                                )}
                              </h4>
                              <p className="text-red-300 text-2xl font-bold">{match.teams.red.rounds_won}</p>
                              <p className="text-red-400/60 text-xs mt-1">{match.players.red.length} Players</p>
                            </div>
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
                              <h4 className="text-blue-400 font-bold mb-2 flex items-center justify-between">
                                <span>Blue Team</span>
                                {match.teams.blue.has_won && (
                                  <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">Victory</span>
                                )}
                              </h4>
                              <p className="text-blue-300 text-2xl font-bold">{match.teams.blue.rounds_won}</p>
                              <p className="text-blue-400/60 text-xs mt-1">{match.players.blue.length} Players</p>
                            </div>
                          </div>

                          {/* View Full Details Button */}
                          <div className="flex justify-center">
                            <button
                              onClick={(e) => handleViewDetails(e, match.metadata.matchid)}
                              disabled={detailsLoading}
                              className="px-6 py-2 bg-yellow-400 text-black font-bold rounded hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {detailsLoading ? 'Loading...' : 'View Full Match Details →'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-3 bg-yellow-400 text-black font-bold rounded hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More Matches'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {matches.length === 0 && !loading && (
        <div className="text-center py-12 text-yellow-400/60">
          <p>No matches found</p>
        </div>
      )}

      {/* Full Details Modal */}
      {detailsModalOpen && selectedMatch && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-yellow-400/30 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-black/90 backdrop-blur border-b border-yellow-400/30 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400">
                  Match Details
                </h2>
                <p className="text-yellow-300/60">{selectedMatch.metadata.map} • {selectedMatch.metadata.mode}</p>
              </div>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
              >
                Close ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Match Overview */}
              <div className="bg-black/40 border border-yellow-400/30 rounded-lg p-4">
                <h3 className="text-xl font-bold text-yellow-400 mb-3">Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-yellow-400/60 text-sm">Map</p>
                    <p className="text-yellow-400 font-bold">{selectedMatch.metadata.map}</p>
                  </div>
                  <div>
                    <p className="text-yellow-400/60 text-sm">Mode</p>
                    <p className="text-yellow-400 font-bold capitalize">{selectedMatch.metadata.mode}</p>
                  </div>
                  <div>
                    <p className="text-yellow-400/60 text-sm">Rounds</p>
                    <p className="text-yellow-400 font-bold">{selectedMatch.metadata.rounds_played}</p>
                  </div>
                  <div>
                    <p className="text-yellow-400/60 text-sm">Duration</p>
                    <p className="text-yellow-400 font-bold">{formatDuration(selectedMatch.metadata.game_length)}</p>
                  </div>
                </div>
              </div>

              {/* Team Scoreboards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Red Team */}
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center justify-between">
                    <span>Red Team</span>
                    {selectedMatch.teams.red.has_won && (
                      <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">Victory</span>
                    )}
                  </h3>
                  <p className="text-red-300 text-3xl font-bold mb-3">{selectedMatch.teams.red.rounds_won}</p>
                  <div className="space-y-2">
                    {selectedMatch.players.red.map((player) => (
                      <div key={player.puuid} className="flex justify-between items-center text-sm bg-black/30 rounded p-2">
                        <div>
                          <p className="text-red-200 font-medium">{player.name}#{player.tag}</p>
                          <p className="text-red-400/60 text-xs">{player.character}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-300 font-mono font-bold">
                            {player.stats.kills}/{player.stats.deaths}/{player.stats.assists}
                          </p>
                          <p className="text-red-400/60 text-xs">Score: {player.stats.score}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blue Team */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center justify-between">
                    <span>Blue Team</span>
                    {selectedMatch.teams.blue.has_won && (
                      <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">Victory</span>
                    )}
                  </h3>
                  <p className="text-blue-300 text-3xl font-bold mb-3">{selectedMatch.teams.blue.rounds_won}</p>
                  <div className="space-y-2">
                    {selectedMatch.players.blue.map((player) => (
                      <div key={player.puuid} className="flex justify-between items-center text-sm bg-black/30 rounded p-2">
                        <div>
                          <p className="text-blue-200 font-medium">{player.name}#{player.tag}</p>
                          <p className="text-blue-400/60 text-xs">{player.character}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-blue-300 font-mono font-bold">
                            {player.stats.kills}/{player.stats.deaths}/{player.stats.assists}
                          </p>
                          <p className="text-blue-400/60 text-xs">Score: {player.stats.score}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Player Stats Table */}
              <div className="bg-black/40 border border-yellow-400/30 rounded-lg p-4">
                <h3 className="text-xl font-bold text-yellow-400 mb-3">Player Statistics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-yellow-400/30">
                        <th className="px-3 py-2 text-left text-yellow-400 font-bold">Player</th>
                        <th className="px-3 py-2 text-left text-yellow-400 font-bold">Agent</th>
                        <th className="px-3 py-2 text-left text-yellow-400 font-bold">K/D/A</th>
                        <th className="px-3 py-2 text-left text-yellow-400 font-bold">Score</th>
                        <th className="px-3 py-2 text-left text-yellow-400 font-bold">Damage</th>
                        <th className="px-3 py-2 text-left text-yellow-400 font-bold">HS%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMatch.players.all_players
                        .sort((a, b) => b.stats.score - a.stats.score)
                        .map((player) => {
                          const totalShots = player.stats.headshots + player.stats.bodyshots + player.stats.legshots;
                          const hsPercent = totalShots === 0 ? 0 : (player.stats.headshots / totalShots * 100).toFixed(1);
                          
                          return (
                            <tr key={player.puuid} className="border-b border-yellow-400/10 hover:bg-yellow-400/5">
                              <td className="px-3 py-2 text-yellow-100">
                                {player.name}#{player.tag}
                              </td>
                              <td className="px-3 py-2 text-yellow-100">{player.character}</td>
                              <td className="px-3 py-2 text-yellow-100 font-mono">
                                {player.stats.kills}/{player.stats.deaths}/{player.stats.assists}
                              </td>
                              <td className="px-3 py-2 text-yellow-100 font-bold">{player.stats.score}</td>
                              <td className="px-3 py-2 text-yellow-100">{player.damage_made}</td>
                              <td className="px-3 py-2 text-yellow-100">{hsPercent}%</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ability Usage Section - Player Only */}
              {(() => {
                const playerInMatch = selectedMatch.players.all_players.find(p => p.puuid === playerPuuid);
                
                if (!playerInMatch || !playerInMatch.ability_casts) {
                  return null;
                }

                const abilities = playerInMatch.ability_casts;
                const total = (abilities.c_cast || 0) + (abilities.q_cast || 0) + (abilities.e_cast || 0) + (abilities.x_cast || 0);

                return (
                  <div className="bg-black/40 border border-yellow-400/30 rounded-lg p-4">
                    <h3 className="text-xl font-bold text-yellow-400 mb-3">Your Ability Usage</h3>
                    
                    {/* Player Info */}
                    <div className="mb-4 pb-4 border-b border-yellow-400/20">
                      <div className="flex items-center gap-3">
                        <div className="text-yellow-100">
                          <p className="font-bold">{playerInMatch.name}#{playerInMatch.tag}</p>
                          <p className="text-sm text-yellow-400/60">{playerInMatch.character}</p>
                        </div>
                      </div>
                    </div>

                    {/* Ability Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-center">
                        <div className="text-purple-400 font-bold mb-2">C</div>
                        <div className="text-3xl font-bold text-purple-300">{abilities.c_cast || 0}</div>
                        <div className="text-xs text-purple-400/60 mt-1">Signature</div>
                      </div>

                      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
                        <div className="text-blue-400 font-bold mb-2">Q</div>
                        <div className="text-3xl font-bold text-blue-300">{abilities.q_cast || 0}</div>
                        <div className="text-xs text-blue-400/60 mt-1">Ability 1</div>
                      </div>

                      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                        <div className="text-green-400 font-bold mb-2">E</div>
                        <div className="text-3xl font-bold text-green-300">{abilities.e_cast || 0}</div>
                        <div className="text-xs text-green-400/60 mt-1">Ability 2</div>
                      </div>

                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
                        <div className="text-red-400 font-bold mb-2">X</div>
                        <div className="text-3xl font-bold text-red-300">{abilities.x_cast || 0}</div>
                        <div className="text-xs text-red-400/60 mt-1">Ultimate</div>
                      </div>

                      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-center">
                        <div className="text-yellow-400 font-bold mb-2">Total</div>
                        <div className="text-3xl font-bold text-yellow-300">{total}</div>
                        <div className="text-xs text-yellow-400/60 mt-1">All Casts</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-black/40 rounded p-3">
                        <p className="text-yellow-400/60 text-xs mb-1">Avg per Round</p>
                        <p className="text-yellow-400 font-bold">
                          {selectedMatch.metadata.rounds_played > 0 
                            ? (total / selectedMatch.metadata.rounds_played).toFixed(1)
                            : '0'
                          }
                        </p>
                      </div>
                      <div className="bg-black/40 rounded p-3">
                        <p className="text-yellow-400/60 text-xs mb-1">Total Rounds</p>
                        <p className="text-yellow-400 font-bold">{selectedMatch.metadata.rounds_played}</p>
                      </div>
                      <div className="bg-black/40 rounded p-3">
                        <p className="text-yellow-400/60 text-xs mb-1">Ult Usage</p>
                        <p className="text-yellow-400 font-bold">{abilities.x_cast || 0}x</p>
                      </div>
                      <div className="bg-black/40 rounded p-3">
                        <p className="text-yellow-400/60 text-xs mb-1">Most Used</p>
                        <p className="text-yellow-400 font-bold">
                          {Math.max(abilities.c_cast || 0, abilities.q_cast || 0, abilities.e_cast || 0, abilities.x_cast || 0) === (abilities.c_cast || 0) && 'C'}
                          {Math.max(abilities.c_cast || 0, abilities.q_cast || 0, abilities.e_cast || 0, abilities.x_cast || 0) === (abilities.q_cast || 0) && 'Q'}
                          {Math.max(abilities.c_cast || 0, abilities.q_cast || 0, abilities.e_cast || 0, abilities.x_cast || 0) === (abilities.e_cast || 0) && 'E'}
                          {Math.max(abilities.c_cast || 0, abilities.q_cast || 0, abilities.e_cast || 0, abilities.x_cast || 0) === (abilities.x_cast || 0) && 'X'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchHistoryTable;