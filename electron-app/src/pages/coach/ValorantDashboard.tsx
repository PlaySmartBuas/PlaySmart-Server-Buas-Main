
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  valorantAPI, 
  valorantStorage, 
  type ValorantAccountData,
  type ValorantMatch 
} from '../../services/api';
import MatchHistoryTable from '../../components/Valorant/MatchHistoryTable';

const CoachValorantDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentRiotId, setCurrentRiotId] = useState('Unknown');
  const [accountData, setAccountData] = useState<ValorantAccountData | null>(null);
  const [matches, setMatches] = useState<ValorantMatch[]>([]);
  const [allFetchedMatches, setAllFetchedMatches] = useState<ValorantMatch[]>([]); // Store all fetched matches
  const [displayCount, setDisplayCount] = useState(5); 
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMatches, setHasMoreMatches] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const MATCHES_PER_DISPLAY = 5; 
  const MATCHES_TO_FETCH = 10; 

  const loadInitialMatches = useCallback(async (riotId: string, region: string) => {
    try {
      setMatchesLoading(true);
      const response = await valorantAPI.getMatchHistory(
        riotId, 
        region as any, 
        undefined, 
        MATCHES_TO_FETCH 
      );

      if (response.success && response.data) {
        setAllFetchedMatches(response.data);
        setMatches(response.data.slice(0, MATCHES_PER_DISPLAY)); 
        
        if (response.data.length < MATCHES_TO_FETCH) {
          setHasMoreMatches(false);
        }
      }
    } catch (err) {
      console.error('Failed to load matches:', err);
      setError('Failed to load match history. Please try again later.');
    } finally {
      setMatchesLoading(false);
    }
  }, [MATCHES_TO_FETCH, MATCHES_PER_DISPLAY]);

  useEffect(() => {
    if (isInitialized) return;

    const initializeAccount = async () => {
      try {
        setLoading(true);
        setError(null);

        const riotIdFromUrl = searchParams.get('user');
        let riotId: string;

        if (riotIdFromUrl) {
          sessionStorage.setItem('current_valorant_riot_id', riotIdFromUrl);
          setCurrentRiotId(riotIdFromUrl);
          riotId = riotIdFromUrl;
        } else {
          const savedRiotId = sessionStorage.getItem('current_valorant_riot_id');
          if (savedRiotId) {
            setCurrentRiotId(savedRiotId);
            riotId = savedRiotId;
          } else {
            navigate('/game-selection');
            return;
          }
        }
        const response = await valorantAPI.getAccountInfo(riotId);
        
        if (response.success && response.data) {
          setAccountData(response.data);
          
          valorantStorage.storePuuid(response.data.puuid);
          valorantStorage.storeAccountData(response.data);
          
    

          await loadInitialMatches(riotId, response.data.region);
        }
      } catch (err) {
        console.error('Failed to load account:', err);
        setError(err instanceof Error ? err.message : 'Failed to load account data');
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAccount();
  }, [searchParams, navigate, loadInitialMatches, isInitialized]);

  const handleLoadMore = () => {
    if (matchesLoading) return;

    const newDisplayCount = displayCount + MATCHES_PER_DISPLAY;
    
    if (newDisplayCount > allFetchedMatches.length && hasMoreMatches) {
      setHasMoreMatches(false);
      setMatches(allFetchedMatches);
    } else if (newDisplayCount <= allFetchedMatches.length) {
      setMatches(allFetchedMatches.slice(0, newDisplayCount));
      setDisplayCount(newDisplayCount);
    } else {
      setMatches(allFetchedMatches); 
      setHasMoreMatches(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen flex items-center justify-center">
        <div className="text-yellow-400 text-xl">Loading account data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
        <div className="bg-red-900/20 border border-red-500 rounded p-4">
          <p className="text-red-400">Error: {error}</p>
          <button 
            onClick={() => navigate('/game-selection')}
            className="mt-4 px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500"
          >
            Back to Game Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
      {/* Header Section */}
      <div className="mb-8">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2">
          VALORANT Dashboard
        </h2>
        <p className="text-yellow-300/60 font-semibold">Riot ID: {currentRiotId}</p>
        
        {accountData && (
          <div className="mt-4 bg-black/40 border border-yellow-400/30 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-yellow-400/60 text-sm">Level</p>
                <p className="text-yellow-400 font-bold text-xl">{accountData.account_level}</p>
              </div>
              <div>
                <p className="text-yellow-400/60 text-sm">Region</p>
                <p className="text-yellow-400 font-bold text-xl">{accountData.region.toUpperCase()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-yellow-400/60 text-sm">PUUID</p>
                <p className="text-yellow-400 font-mono text-xs break-all">{accountData.puuid}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-black/40 border border-yellow-400/30 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-yellow-400">Match History</h3>
          <p className="text-yellow-400/60 text-sm">
            Showing {matches.length} of {allFetchedMatches.length} matches
          </p>
        </div>
        
        {accountData && (
          <MatchHistoryTable
            matches={matches}
            playerPuuid={accountData.puuid}
            loading={matchesLoading}
            onLoadMore={handleLoadMore}
            hasMore={hasMoreMatches && displayCount < allFetchedMatches.length}
          />
        )}
      </div>
    </div>
  );
};

export default CoachValorantDashboard;