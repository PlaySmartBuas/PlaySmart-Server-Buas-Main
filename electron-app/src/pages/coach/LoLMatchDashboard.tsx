import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import {API_BASE_URL} from '../../services/api';

interface CSVSummary {
  file_size_mb: number;
  total_rows: number;
  columns: string[];
  column_count: number;
  sample_rows: any[];
}
interface EmotionProgressData {
  stage: string;
  [key: string]: number | string;
}
interface CSVData {
  headers: string[];
  data: any[];
  rows_returned: number;
  total_rows: number;
}

interface EmotionData {
  name: string;
  value: number;
  count: number;
}

interface TimelineData {
  time: string;
  emotion: string;
  confidence: number;
}

interface GazePoint {
  x: number;
  y: number;
  emotion: string;
}

const LoLMatchDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [summary, setSummary] = useState<CSVSummary | null>(null);
  const [fullMatchData, setFullMatchData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [matchId, setMatchId] = useState<string>('');
  const [currentRiotId, setCurrentRiotId] = useState('');
  const [currentPuuid, setCurrentPuuid] = useState('');
  const [mergedFilePath, setMergedFilePath] = useState<string>('');

  // Analytics state
  const [emotionDistribution, setEmotionDistribution] = useState<EmotionData[]>([]);
  const [dominantEmotion, setDominantEmotion] = useState('Unknown');
  const [dominantPercentage, setDominantPercentage] = useState(0);
  const [emotionTimeline, setEmotionTimeline] = useState<TimelineData[]>([]);
  const [emotionProgressData, setEmotionProgressData] = useState<any[]>([]);
  const [gazePoints, setGazePoints] = useState<GazePoint[]>([]);
  const [screenZones, setScreenZones] = useState<any[]>([]);

  // Toggle visibility for emotions
  const [includedEmotions, setIncludedEmotions] = useState<Record<string, boolean>>({
    Neutral: true,
    Happiness: true,
    Anger: true,
    Sadness: true,
    Surprise: true,
    Disgust: true,
    Fear: true
  });

  // Colors for emotions (matching your existing component style)
  const EMOTION_COLORS: Record<string, string> = {
    'Neutral': '#60A5FA',
    'Happiness': '#34D399',
    'Anger': '#EF4444',
    'Sadness': '#A78BFA',
    'Surprise': '#FBBF24',
    'Disgust': '#F97316',
    'Fear': '#9CA3AF',
  };

  const getColor = (name: string) => EMOTION_COLORS[name] || '#6B7280';

  // Get match ID and player info from URL params
useEffect(() => {
  const matchIdFromUrl = searchParams.get('matchId');
  const riotIdFromUrl = searchParams.get('user');
  const puuidFromUrl = searchParams.get('puuid');

  if (matchIdFromUrl) {
    setMatchId(matchIdFromUrl);
  } else {
    console.error('No matchId found in URL params');
  }

  if (riotIdFromUrl) {
    setCurrentRiotId(riotIdFromUrl);
  } else {
    const savedRiotId = sessionStorage.getItem('current_riot_id');
    if (savedRiotId) setCurrentRiotId(savedRiotId);
  }
  
  if (puuidFromUrl) {
    setCurrentPuuid(puuidFromUrl);
  } else {
    const savedPuuid = sessionStorage.getItem('current_lol_puuid');
    if (savedPuuid) setCurrentPuuid(savedPuuid);
  }
}, [searchParams]);

useEffect(() => {
  const fetchSummary = async () => {
    if (!matchId) {
      return;
    }

    try {
      const dataDirectory = localStorage.getItem('toolkit_data_directory');
      if (!dataDirectory) {
        setError('Data directory not configured. Please set it up in Toolkit Setup.');
        setLoading(false);
        return;
      }

      const mergedFileName = `${matchId}_merged.csv`;
      const filePath = `${dataDirectory}/merged/${mergedFileName}`;
      setMergedFilePath(filePath);


      const response = await fetch(
        `${API_BASE_URL}/api/matches/csv-summary?file_path=${encodeURIComponent(filePath)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch match summary');
      }

      const summaryData = await response.json();

      setSummary(summaryData);
      setLoading(false);

    } catch (err) {
      console.error('❌ Error fetching summary:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load match summary');
      }
      setLoading(false);
    }
  };

  fetchSummary();
}, [matchId]);

  const loadAllMatchData = async () => {
    if (!mergedFilePath || !summary) return;

    setDataLoading(true);
    const allData: any[] = [];

    try {
      const totalRows = summary.total_rows;
      const batchSize = 500;
      const totalBatches = Math.ceil(totalRows / batchSize);


      for (let batch = 0; batch < totalBatches; batch++) {
        const skipRows = batch * batchSize;

        const response = await fetch(
          `${API_BASE_URL}/api/matches/read-csv?file_path=${encodeURIComponent(mergedFilePath)}&max_rows=${batchSize}&skip_rows=${skipRows}`
        );

        if (!response.ok) throw new Error('Failed to fetch batch');

        const batchData: CSVData = await response.json();
        allData.push(...batchData.data);

      }

      setFullMatchData(allData);
      processAnalytics(allData);

    } catch (err) {
      console.error('❌ Error loading all data:', err);
      setError('Failed to load complete match data');
    } finally {
      setDataLoading(false);
    }
  };

  const processAnalytics = (data: any[]) => {

    const emotionCounts: Record<string, number> = {};
    data.forEach(row => {
      const emotion = row.emotion || 'Unknown';
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    const total = data.length;
    const emotionData: EmotionData[] = Object.entries(emotionCounts).map(([emotion, count]) => ({
      name: emotion,
      value: parseFloat(((count / total) * 100).toFixed(1)),
      count,
    }));

    emotionData.sort((a, b) => b.count - a.count);
    setEmotionDistribution(emotionData);

    if (emotionData.length > 0) {
      setDominantEmotion(emotionData[0].name);
      setDominantPercentage(emotionData[0].value);
    }

    const stages = ['Early Game', 'Mid-Early', 'Mid Game', 'Mid-Late', 'Late Game'];
    const segmentSize = Math.floor(data.length / 5);

    const progressData = stages.map((stage, index) => {
      const segmentStart = index * segmentSize;
      const segmentEnd = index === 4 ? data.length : (index + 1) * segmentSize;
      const segmentData = data.slice(segmentStart, segmentEnd);

      const stageCounts: Record<string, number> = {
        Neutral: 0,
        Happiness: 0,
        Anger: 0,
        Sadness: 0,
        Surprise: 0,
        Disgust: 0,
        Fear: 0,
      };

      segmentData.forEach(row => {
        const emotion = row.emotion;
        if (stageCounts[emotion] !== undefined) {
          stageCounts[emotion]++;
        }
      });

      return {
        stage,
        ...stageCounts,
      };
    });

    setEmotionProgressData(progressData);

    const gazeData: GazePoint[] = [];
    for (let i = 0; i < data.length; i += 20) {
      const row = data[i];
      if (row.screen_x && row.screen_y) {
        gazeData.push({
          x: parseInt(row.screen_x),
          y: parseInt(row.screen_y),
          emotion: row.emotion || 'Unknown',
        });
      }
    }
    setGazePoints(gazeData);

    const zones = {
      minimap: 0,
      abilities: 0,
      stats: 0,
      center: 0,
      other: 0,
    };

    data.forEach(row => {
      const x = parseInt(row.screen_x || '0');
      const y = parseInt(row.screen_y || '0');

      if (x >= 0 && x <= 300 && y >= 1140 && y <= 1440) {
        zones.minimap++;
      } else if (x >= 900 && x <= 1660 && y >= 1300 && y <= 1440) {
        zones.abilities++;
      } else if (x >= 2260 && x <= 2560 && y >= 0 && y <= 100) {
        zones.stats++;
      } else if (x >= 300 && x <= 2260 && y >= 100 && y <= 1300) {
        zones.center++;
      } else {
        zones.other++;
      }
    });

    const zoneData = Object.entries(zones).map(([zone, count]) => ({
      zone: zone.charAt(0).toUpperCase() + zone.slice(1),
      count,
      percentage: ((count / data.length) * 100).toFixed(1),
    }));

    setScreenZones(zoneData);
  };

  const toggleEmotion = (name: string) => {
    setIncludedEmotions((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const filteredEmotionData = emotionDistribution.filter(
    (d) => includedEmotions[d.name] && d.value > 0
  );

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-center">
            <div className="text-yellow-400 text-xl mb-2 font-bold">Loading match summary...</div>
            <div className="text-yellow-300/60 text-sm font-semibold">Analyzing CSV file...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
            if (currentPuuid) params.set('puuid', currentPuuid);
            const qs = params.toString();
            navigate(`/coach/lol-recordinganalysis${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-yellow-300/60 hover:text-yellow-400 mb-4 transition-colors font-bold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Match List
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📊</span>
          <h2 className="text-sm font-bold text-yellow-300/60 uppercase tracking-wider">
            MATCH DASHBOARD
          </h2>
        </div>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2">League of Legends Analytics</h1>
        {currentRiotId && currentRiotId !== 'Unknown' && (
          <p className="text-yellow-400 font-black"> Analysing: {decodeURIComponent(currentRiotId)}</p>
        )}
        <p className="text-yellow-300/60 text-sm mt-1 font-semibold">Match: {matchId}</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 font-bold mb-1">{error}</p>
            {error.includes('Data directory not configured') && (
              <button
                onClick={() => navigate('/coach/lol-recordinganalysis')}
                className="mt-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black text-sm rounded transition-all duration-300 font-black shadow-lg shadow-yellow-500/30"
              >
                Go to Data Directory Setup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Load Analytics Button */}
      {summary && fullMatchData.length === 0 && !dataLoading && (
        <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-2 border-yellow-500/50 rounded-xl p-8 text-center mb-6">
          <div className="text-6xl mb-4">📈</div>
          <h3 className="text-white font-black text-2xl mb-2">Ready to Analyze Performance</h3>
          <p className="text-yellow-300/80 mb-6 font-semibold">
            Load complete match data to view emotion tracking, gaze patterns, and focus zones
          </p>
          <button
            onClick={loadAllMatchData}
            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded-lg font-black text-lg transition-all transform hover:scale-105 shadow-lg shadow-yellow-500/30"
          >
            🚀 Load Analytics Dashboard
          </button>
          <p className="text-yellow-300/60 text-sm mt-3 font-semibold">
            Analyzing {summary.total_rows.toLocaleString()} data points from {summary.file_size_mb}MB file
          </p>
        </div>
      )}

      {/* Loading State */}
      {dataLoading && (
        <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-12 text-center mb-6">
          <div className="animate-spin text-6xl mb-4">⚙️</div>
          <h3 className="text-white font-black text-xl mb-2">Processing Match Data...</h3>
          <p className="text-yellow-300/60 font-semibold">This may take a moment for large files</p>
        </div>
      )}

      {/* Analytics Dashboard */}
      {fullMatchData.length > 0 && (
        <div className="space-y-6">
          {/* Emotion Distribution Pie Chart */}
          <div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-lg border border-yellow-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-white font-black text-lg">Emotion Distribution</h4>
                <p className="text-yellow-300/60 text-sm font-semibold">During gameplay session</p>
              </div>
              <div className="text-right">
                <p className="text-yellow-300/60 text-xs font-semibold">Dominant</p>
                <p className="text-xl font-black" style={{ color: getColor(dominantEmotion) }}>
                  {dominantEmotion}
                </p>
                <p className="text-gray-500 text-xs font-bold">{dominantPercentage}%</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              {Object.keys(EMOTION_COLORS).map((emotion) => (
                <label key={emotion} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includedEmotions[emotion]}
                    onChange={() => toggleEmotion(emotion)}
                    className="accent-yellow-500 cursor-pointer"
                  />
                  <span className="text-gray-300 text-sm font-semibold">{emotion}</span>
                </label>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={filteredEmotionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {filteredEmotionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                    borderRadius: '0.5rem'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm font-semibold">
                💡 Player maintains {dominantEmotion.toLowerCase()} state {dominantPercentage}% of the time —
                {dominantPercentage > 80 ? ' Excellent emotional control' : ' Good consistency'}
              </p>
            </div>
          </div>

          {/* Input Activity Metrics */}
<div className="bg-gradient-to-br from-gray-950 to-black p-6 rounded-lg border border-yellow-500/20 shadow-lg">
  <h4 className="text-white font-black text-lg mb-6">Input Activity Analysis</h4>

  {(() => {
    let totalKeyPresses = 0;
    const keyPressEvents: Record<string, number> = {};
    
    fullMatchData.forEach(row => {
      const eventType = row.event_type?.toLowerCase() || '';
      const detailsX = row.details_x || '';

      if (eventType === 'keyboard' || eventType.includes('key')) {
        totalKeyPresses++;
        if (detailsX) {
          keyPressEvents[detailsX] = (keyPressEvents[detailsX] || 0) + 1;
        }
      }
    });

    const firstTimestamp = fullMatchData[0]?.unix_time ? parseInt(fullMatchData[0].unix_time) : 0;
    const lastTimestamp = fullMatchData[fullMatchData.length - 1]?.unix_time 
      ? parseInt(fullMatchData[fullMatchData.length - 1].unix_time) 
      : 0;
    const durationMs = lastTimestamp - firstTimestamp;
    const durationMinutes = Math.round(durationMs / 60000);

    const apm = durationMinutes > 0 ? Math.round(totalKeyPresses / durationMinutes) : 0;

    const leagueKeys = {
      'Q': keyPressEvents['Q'] || keyPressEvents['q'] || 0,
      'W': keyPressEvents['W'] || keyPressEvents['w'] || 0,
      'E': keyPressEvents['E'] || keyPressEvents['e'] || 0,
      'R': keyPressEvents['R'] || keyPressEvents['r'] || 0,
      'D': keyPressEvents['D'] || keyPressEvents['d'] || 0,
      'F': keyPressEvents['F'] || keyPressEvents['f'] || 0,
      'Tab': keyPressEvents['Tab'] || keyPressEvents['tab'] || 0,
      'Space': keyPressEvents['Space'] || keyPressEvents['space'] || 0,
    };

    const totalAbilities = leagueKeys.Q + leagueKeys.W + leagueKeys.E + leagueKeys.R;
    const totalSummoners = leagueKeys.D + leagueKeys.F;
    const hasInputData = totalKeyPresses > 0;

    if (!hasInputData) {
      return (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm mb-2 font-bold">
            ⚠️ No keyboard input data detected
          </p>
          <p className="text-yellow-300/60 text-xs font-semibold">
            This could mean:
          </p>
          <ul className="text-yellow-300/60 text-xs mt-2 ml-4 list-disc space-y-1 font-semibold">
            <li>Toolkit wasn't running during the match</li>
            <li>Input logging wasn't enabled</li>
            <li>Data wasn't merged correctly</li>
          </ul>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-lg border border-yellow-500/20 group hover:border-yellow-500/40 transition-colors">
            <p className="text-yellow-300/60 text-xs mb-2 font-semibold">APM</p>
            <p className="text-3xl font-black text-yellow-400">{apm}</p>
            <p className="text-gray-500 text-xs mt-1 font-semibold">Actions/min</p>
            <div className="mt-2 w-full h-3 bg-gray-800 rounded-full shadow-inner">
              <div
                className="bg-gradient-to-r from-yellow-500 to-amber-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((apm / 300) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-lg border border-yellow-500/20 group hover:border-green-500/40 transition-colors">
            <p className="text-yellow-300/60 text-xs mb-2 font-semibold">Key Presses</p>
            <p className="text-2xl font-black text-green-400">{totalKeyPresses.toLocaleString()}</p>
            <p className="text-gray-500 text-xs mt-1 font-semibold">Total</p>
            <div className="mt-2 w-full h-3 bg-gray-800 rounded-full shadow-inner">
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((totalKeyPresses / 5000) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {totalAbilities > 0 && (
          <div className="mb-6">
            <h5 className="text-white font-black mb-4 flex items-center gap-2 text-lg">
              <span className="text-yellow-400 animate-pulse">✨</span>
              Champion Abilities
            </h5>
            <div className="space-y-4">
              {['Q', 'W', 'E', 'R'].map((key) => {
                const count = leagueKeys[key as keyof typeof leagueKeys];
                if (count === 0) return null;
                
                const percentage = totalAbilities > 0 ? (count / totalAbilities) * 100 : 0;
                const isUlt = key === 'R';
                const barColor = isUlt 
                  ? 'bg-gradient-to-r from-yellow-400 to-amber-600' 
                  : 'bg-gradient-to-r from-yellow-500 to-amber-500';

                return (
                  <div key={key} className="group">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-black ${isUlt ? 'text-yellow-400' : 'text-yellow-400'} group-hover:scale-110 transition-transform`}>
                          {key}
                        </span>
                        <span className="text-gray-300 text-sm font-semibold">
                          {key === 'Q' ? 'Q - Ability' : 
                           key === 'W' ? 'W - Ability' : 
                           key === 'E' ? 'E - Ability' : 
                           'R - Ultimate'}
                        </span>
                        <span className="text-white font-black ml-auto">{count}</span>
                      </div>
                      <span className="text-yellow-300/60 text-xs font-bold">{Math.round(percentage)}%</span>
                    </div>
                    <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden shadow-inner border border-yellow-500/20">
                      <div
                        className={`${barColor} h-4 rounded-full transition-all duration-500 ease-out transform group-hover:scale-x-105`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalSummoners > 0 && (
          <div className="mb-6">
            <h5 className="text-white font-black mb-3 flex items-center gap-2">
              <span className="text-yellow-400">⚡</span>
              Summoner Spells
            </h5>
            <div className="grid grid-cols-2 gap-4">
              {['D', 'F'].map((key) => {
                const count = leagueKeys[key as keyof typeof leagueKeys];
                if (count === 0) return null;

                return (
                  <div key={key} className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-lg border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xl font-black text-yellow-400">{key}</span>
                      <span className="text-white font-black text-xl">{count}</span>
                    </div>
                    <p className="text-yellow-300/60 text-sm font-semibold">Summoner {key}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(leagueKeys.Tab > 0 || leagueKeys.Space > 0) && (
          <div className="mb-6">
            <h5 className="text-white font-black mb-3 flex items-center gap-2">
              <span className="text-green-400">🎮</span>
              Other Actions
            </h5>
            <div className="grid grid-cols-2 gap-3">
              {leagueKeys.Tab > 0 && (
                <div className="bg-gradient-to-br from-gray-900 to-black p-3 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm font-semibold">Tab (Scoreboard)</span>
                    <span className="text-white font-black">{leagueKeys.Tab}</span>
                  </div>
                </div>
              )}
              {leagueKeys.Space > 0 && (
                <div className="bg-gradient-to-br from-gray-900 to-black p-3 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm font-semibold">Space (Center Camera)</span>
                    <span className="text-white font-black">{leagueKeys.Space}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {apm > 150 && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm font-bold">
                ✅ High APM ({apm}) - Active and engaged playstyle
              </p>
            </div>
          )}

          {apm < 80 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm font-bold">
                ⚠️ Low APM ({apm}) - Consider being more active with abilities and movement
              </p>
            </div>
          )}

          {leagueKeys.R > 0 && leagueKeys.R < 5 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm font-bold">
                ⚠️ Low ultimate usage ({leagueKeys.R} times) - Make sure to use your ultimate effectively
              </p>
            </div>
          )}

          {leagueKeys.Tab > 30 && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm font-bold">
                ✅ Good map awareness - Checking scoreboard frequently ({leagueKeys.Tab} times)
              </p>
            </div>
          )}

          {totalAbilities > 100 && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm font-bold">
                ✅ Active ability usage - Using abilities frequently (Q: {leagueKeys.Q}, W: {leagueKeys.W}, E: {leagueKeys.E}, R: {leagueKeys.R})
              </p>
            </div>
          )}

          <p className="text-gray-500 text-xs text-center mt-4 font-semibold">
            Match duration: ~{durationMinutes} minutes
          </p>
        </div>
      </>
    );
  })()}
</div>

{/* Data Availability Warnings */}
<div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
  <h3 className="text-white font-black text-xl mb-4 flex items-center gap-2">
    <span>🔍</span> Data Quality Check
  </h3>
  <div className="space-y-3">
    {!fullMatchData.some(row => row.emotion && row.emotion !== '') && (
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-sm font-bold">
          ⚠️ No emotion data detected - Camera might not have been working or emotion detection wasn't enabled
        </p>
      </div>
    )}
    {!fullMatchData.some(row => row.screen_x && row.screen_y) && (
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-sm font-bold">
          ⚠️ No eye tracking data detected - Eye tracker might not have been connected or calibrated
        </p>
      </div>
    )}
    {!fullMatchData.some(row => row.event_type && row.event_type !== '') && (
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 text-sm font-bold">
          ⚠️ No input data detected - Keyboard logging might not have been enabled in the toolkit
        </p>
      </div>
    )}
    {fullMatchData.some(row => row.emotion) && 
     fullMatchData.some(row => row.screen_x) && 
     fullMatchData.some(row => row.event_type) && (
      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <p className="text-green-400 text-sm font-bold">
          ✅ All data streams working correctly - Emotion, eye tracking, and input data all captured
        </p>
      </div>
    )}
  </div>
</div>

          {/* Emotion Flow Over Match Progress */}
          <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <h3 className="text-white font-black text-xl mb-4 flex items-center gap-2">
              <span>📈</span> Emotion Flow Throughout Match
            </h3>
            <p className="text-yellow-300/60 text-sm mb-4 font-semibold">
              How emotional state changed from early game to late game
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={emotionProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="stage" stroke="#FCD34D" />
                <YAxis stroke="#FCD34D" label={{ value: 'Occurrences', angle: -90, position: 'insideLeft', fill: '#FCD34D' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(251, 191, 36, 0.2)' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend />
                {Object.keys(EMOTION_COLORS).map((emotion) => (
                  <Bar
                    key={emotion}
                    dataKey={emotion}
                    stackId="a"
                    fill={getColor(emotion)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Screen Attention Zones */}
          <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <h3 className="text-white font-black text-xl mb-4 flex items-center gap-2">
              <span>🎯</span> League of Legends Focus Zones
            </h3>
            <p className="text-yellow-300/60 text-sm mb-4 font-semibold">
              Distribution of visual attention across key game interface areas
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={screenZones}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="zone" stroke="#FCD34D" />
                <YAxis stroke="#FCD34D" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(251, 191, 36, 0.2)' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" fill="#EAB308" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              {screenZones.map((zone) => (
                <div key={zone.zone} className="bg-gradient-to-br from-gray-900 to-black rounded-lg p-3 text-center border border-yellow-500/20">
                  <p className="text-yellow-300/60 text-sm font-semibold">{zone.zone}</p>
                  <p className="text-white font-black text-lg">{zone.percentage}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gaze Heatmap */}
          <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <h3 className="text-white font-black text-xl mb-4 flex items-center gap-2">
              <span>👁️</span> Gaze Path Visualization
            </h3>
            <p className="text-yellow-300/60 text-sm mb-4 font-semibold">
              Eye tracking data showing where attention was focused (2560x1440 screen)
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" dataKey="x" name="X Position" domain={[0, 2560]} stroke="#FCD34D" />
                <YAxis type="number" dataKey="y" name="Y Position" domain={[0, 1440]} stroke="#FCD34D" reversed />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(251, 191, 36, 0.2)' }}
                />
                <Scatter name="Gaze Points" data={gazePoints} fill="#EAB308" fillOpacity={0.3} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Data Summary */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-2 border-yellow-500/50 rounded-xl p-6 shadow-lg">
            <h3 className="text-white font-black text-xl mb-4 flex items-center gap-2">
              <span>✅</span> Analysis Complete
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-gray-950 to-black rounded-lg p-4 border border-yellow-500/20">
                <p className="text-yellow-300/60 text-sm font-semibold">Data Points Analyzed</p>
                <p className="text-white font-black text-2xl">{fullMatchData.length.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-950 to-black rounded-lg p-4 border border-yellow-500/20">
                <p className="text-yellow-300/60 text-sm font-semibold">Emotions Tracked</p>
                <p className="text-white font-black text-2xl">{emotionDistribution.length}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-950 to-black rounded-lg p-4 border border-yellow-500/20">
                <p className="text-yellow-300/60 text-sm font-semibold">Gaze Points</p>
                <p className="text-white font-black text-2xl">{gazePoints.length.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-950 to-black rounded-lg p-4 border border-yellow-500/20">
                <p className="text-yellow-300/60 text-sm font-semibold">Focus Zones</p>
                <p className="text-white font-black text-2xl">{screenZones.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoLMatchDashboard;