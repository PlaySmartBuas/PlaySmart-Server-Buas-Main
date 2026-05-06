import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import VideoPlayer from '../../components/videoplayer';
import type { TimelineMarker } from '../../components/videoplayer';
import FeedbackCard from '../../components/FeedbackCard';
import FeedbackCategoryFilter from '../../components/FeedbackCategoryFilter';
import api from '../../services/api';
import {API_BASE_URL} from '../../services/api';

// Emotion to icon mapping
const EMOTION_CONFIG = {
  Anger: { icon: '😠', color: '#ef4444' },
  Disgust: { icon: '🤢', color: '#84cc16' },
  Happiness: { icon: '😊', color: '#fbbf24' },
  Sadness: { icon: '😢', color: '#3b82f6' },
  Fear: { icon: '😨', color: '#a855f7' },
  Surprise: { icon: '😲', color: '#f97316' },
  Neutral: { icon: '😐', color: '#6b7280' }
};

interface RawEmotionDataPoint {
  unix_time: string;
  emotion: string;
  confidence: string;
  datetime: string;
  video_timestamp?: number;
}

interface CoachFeedback {
  id: number;
  riot_id: string;
  coach_username: string;
  timestamp: number;
  feedback_text: string;
  game: string;
  created_at: string;
  category?: string;
  error_code?: string;
}

interface Teammate {
  id: string;
  playerName: string;
}

/**
 * LoL Feedback & Review Page
 *
 * Purpose:
 * - Load emotion marker CSVs for a recorded match and convert them into
 *   timeline markers for the VideoPlayer component.
 * - Fetch coach feedback for the current Riot ID and allow category filtering.
 * - Provide teammate windows that can sync playback with the main video.
 *
 * Notes:
 * - Pulls Riot ID / PUUID from URL query params or sessionStorage.
 * - Emotion detection thresholds are tuned to reduce noise (see constants below).
 */
const LoLFeedbackReview: React.FC = () => {
  const navigate = useNavigate();
  const { filename } = useParams<{ filename: string }>();
  const [searchParams] = useSearchParams();


  // UI state
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [allEmotionMarkers, setAllEmotionMarkers] = useState<TimelineMarker[]>([]);
  const [coachFeedbackList, setCoachFeedbackList] = useState<CoachFeedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<CoachFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  const [emotionsToShow, setEmotionsToShow] = useState<string[]>([]);
  const [showTeammatesSection, setShowTeammatesSection] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Current logged-in user (not used directly here, but available if needed)
  // const user = getUser();
  const [currentRiotId, setCurrentRiotId] = useState('Unknown');
  const [currentPuuid, setCurrentPuuid] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Get Riot ID and PUUID from URL or sessionStorage
  useEffect(() => {
    const riotIdFromUrl = searchParams.get('user');
    const puuidFromUrl = searchParams.get('puuid');

    if (riotIdFromUrl) {
      sessionStorage.setItem('current_riot_id', riotIdFromUrl);
      setCurrentRiotId(riotIdFromUrl);
    } else {
      const savedRiotId = sessionStorage.getItem('current_riot_id') || sessionStorage.getItem('current_lol_riot_id');
      if (savedRiotId) {
        setCurrentRiotId(savedRiotId);
      } else {
        console.warn('⚠️ No Riot ID found in URL or sessionStorage');
      }
    }

    if (puuidFromUrl) {
      sessionStorage.setItem('current_lol_puuid', puuidFromUrl);
      setCurrentPuuid(puuidFromUrl);
    } else {
      const savedPuuid = sessionStorage.getItem('current_lol_puuid');
      if (savedPuuid) {
        setCurrentPuuid(savedPuuid);
      } else {
        console.warn('⚠️ No PUUID found in URL or sessionStorage');
      }
    }

  }, [searchParams]);

  // Get the match filename from URL params
  const matchFilename = filename || '';

  // Build video URL from data directory and match filename
  // This uses the backend /api/videos endpoint and (optionally) passes the
  // toolkit_data_directory so the server can locate locally-hosted recordings.
  useEffect(() => {
    if (matchFilename) {
      // Use backend video serving endpoint and include the toolkit data directory
      // (set in Toolkit Setup) so the backend knows where to look for .mp4 files.
      const dataDirectory = localStorage.getItem('toolkit_data_directory');
      let backendVideoUrl = `${API_BASE_URL}/api/videos/${encodeURIComponent(matchFilename)}.mp4`;
      if (dataDirectory) {
        backendVideoUrl += `?data_directory=${encodeURIComponent(dataDirectory)}`;
      }
      setVideoUrl(backendVideoUrl);
    }
  }, [matchFilename]);

  // Update coach feedback fetch to use currentRiotId
  // Fetch only feedback for the currently selected match (matchFilename)
  useEffect(() => {
    const fetchCoachFeedback = async () => {
      if (!currentRiotId || currentRiotId === 'Unknown') {
        return;
      }

      try {
        const encodedRiotId = encodeURIComponent(currentRiotId);
        // Include match_id to fetch only feedback for this specific match
        const url = `${API_BASE_URL}/api/feedback/${encodedRiotId}/lol${matchFilename ? `?match_id=${encodeURIComponent(matchFilename)}` : ''}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setCoachFeedbackList(data);
        }
      } catch (error) {
        console.error('❌ Error fetching coach feedback:', error);
      }
    };

    fetchCoachFeedback();
  }, [currentRiotId, matchFilename]);  // Added matchFilename dependency

  // Teammates list (placeholder). These open a small synced player window.
  const teammates: Teammate[] = [
    { id: '2', playerName: 'Teammate 2' },
    { id: '3', playerName: 'Teammate 3' },
    { id: '4', playerName: 'Teammate 4' },
    { id: '5', playerName: 'Teammate 5' }
  ];

  // Listen for sync requests from teammate windows
  // When a teammate window asks for the current time we respond with the
  // current main video time so it can sync playback.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'REQUEST_VIDEO_TIME') {
        const mainVideo = document.querySelector('video');
        if (mainVideo) {
          // Send current time back to the requesting window
          event.source?.postMessage({
            type: 'SYNC_VIDEO_TIME',
            time: mainVideo.currentTime
          }, '*' as any);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Filter coach feedback list based on selected categories
  const filteredCoachFeedbackList = useMemo(() => {
    if (selectedCategories.length === 0) {
      return coachFeedbackList; // Show all if no filter selected
    }
    return coachFeedbackList.filter((feedback) =>
      feedback.category && selectedCategories.includes(feedback.category)
    );
  }, [coachFeedbackList, selectedCategories]);

  // Update markers when includeNeutral or coachFeedbackList changes
  // Combines coach notes and emotion markers into a single timeline array.
  useEffect(() => {
    // Convert coach feedback to markers (use filtered list)
    const coachingMarkers: TimelineMarker[] = filteredCoachFeedbackList.map((feedback) => ({
      id: `coach-${feedback.id}`,
      timestamp: feedback.timestamp,
      icon: '💬',
      label: `${feedback.coach_username}: ${feedback.feedback_text.substring(0, 40)}${feedback.feedback_text.length > 40 ? '...' : ''}`
    }));

    const filteredEmotionMarkers = allEmotionMarkers;

    const combinedMarkers = [...coachingMarkers, ...filteredEmotionMarkers].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    setMarkers(combinedMarkers);
  }, [allEmotionMarkers, filteredCoachFeedbackList]);

  // Fetch emotion data
  // This reads the backend biometrics CSV endpoint and converts raw emotion
  // samples into sustained emotion markers suitable for the timeline.
  useEffect(() => {
    const fetchEmotionData = async () => {
      try {
        // CSV files have _merged suffix, videos don't
        let csvFilename = matchFilename;

        // Remove .mp4 extension if present
        if (csvFilename.endsWith('.mp4')) {
          csvFilename = csvFilename.replace('.mp4', '');
        }

        // Add _merged suffix for CSV files if not already present
        if (!csvFilename.includes('_merged')) {
          csvFilename = `${csvFilename}_merged`;
        }

        // Ensure .csv extension
        if (!csvFilename.endsWith('.csv')) {
          csvFilename = `${csvFilename}.csv`;
        }

        const encodedFilename = encodeURIComponent(csvFilename);

        // Get data directory from localStorage (same as video loading)
        const dataDirectory = localStorage.getItem('toolkit_data_directory');

        // Build URL with data_directory query parameter if available
        let url = `/biometrics/match/${encodedFilename}`;
        if (dataDirectory) {
          url += `?data_directory=${encodeURIComponent(dataDirectory)}`;
        }

        const response = await api.get(url);

        const rawEmotionData: RawEmotionDataPoint[] = response.data.raw_emotion_data || [];

        if (rawEmotionData.length === 0) {
          console.warn('⚠️ No raw_emotion_data found in API response.');
          setLoading(false);
          return;
        }

        // Relaxed thresholds for better marker detection (tunable)
        // - MIN_TIME_GAP: minimum seconds between markers to avoid dense noise
        // - MIN_CONFIDENCE: minimum emotion confidence percentage to accept
        // - MIN_DURATION: minimum sustained seconds for an emotion to become a marker
        const MIN_TIME_GAP = 5;  // seconds
        const MIN_CONFIDENCE = 70;  // percent
        const MIN_DURATION = 2;  // seconds

        let lastEmotion = '';  // Start with empty string instead of 'Neutral'
        let lastMarkerTime = -MIN_TIME_GAP;
        let emotionStartTime = 0;
        const emotionMarkers: TimelineMarker[] = [];


        rawEmotionData.forEach((point) => {
          const currentEmotion = point.emotion;
          const timestamp = point.video_timestamp || 0;
          const confidence = parseInt(point.confidence);



          if (timestamp - lastMarkerTime < MIN_TIME_GAP) {
            return;
          }

          if (currentEmotion !== lastEmotion) {
            if (
              confidence >= MIN_CONFIDENCE &&
              (timestamp - emotionStartTime) >= MIN_DURATION &&
              lastEmotion !== ''  // Only create marker if we have a previous emotion
            ) {
              const config = EMOTION_CONFIG[lastEmotion as keyof typeof EMOTION_CONFIG];

              if (config) {
                emotionMarkers.push({
                  id: `emotion-${emotionMarkers.length}`,
                  timestamp: Math.round(emotionStartTime * 10) / 10,
                  icon: config.icon,
                  label: `${lastEmotion} (${Math.round((timestamp - emotionStartTime))}s duration)`,
                  type: 'emotion',
                  emotion: lastEmotion
                });

                lastMarkerTime = emotionStartTime;

                if (emotionMarkers.length <= 10) {
                }
              }
            }

            lastEmotion = currentEmotion;
            emotionStartTime = timestamp;
          }
        });

        // Create a final marker for the last emotion period (if any)
        if (lastEmotion !== '' && rawEmotionData.length > 0) {
          const lastTimestamp = rawEmotionData[rawEmotionData.length - 1].video_timestamp || 0;
          const duration = lastTimestamp - emotionStartTime;

          if (duration >= MIN_DURATION) {
            const config = EMOTION_CONFIG[lastEmotion as keyof typeof EMOTION_CONFIG];

            if (config) {
              emotionMarkers.push({
                id: `emotion-${emotionMarkers.length}`,
                timestamp: Math.round(emotionStartTime * 10) / 10,
                icon: config.icon,
                label: `${lastEmotion} (${Math.round(duration)}s duration)`,
                type: 'emotion',
                emotion: lastEmotion
              });

            }
          }
        }


        setAllEmotionMarkers(emotionMarkers);

        if (emotionMarkers.length > 12) {
          const emotionCounts: { [key: string]: number } = {};
          emotionMarkers.forEach(marker => {
            const emotion = marker.label?.split(' ')[0];
            if (emotion) {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            }
          });

          const topEmotions = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([emotion]) => emotion);

          setEmotionsToShow(topEmotions);
        } else {
          setEmotionsToShow(Object.keys(EMOTION_CONFIG));
        }

      } catch (error) {
        console.error('Error fetching emotion data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmotionData();
  }, [matchFilename]);

  // UI helper: format seconds into M:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // When a coach feedback card is clicked, jump the main video to that timestamp
  const handleFeedbackClick = (feedback: CoachFeedback) => {
    setSelectedFeedback(feedback);
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = feedback.timestamp;
      videoElement.play();
    }
  };


  // Open a new window with a small teammate player that can request sync
  // messages from the main window (used to compare perspectives).
  const handleOpenTeammateVideo = (playerName: string) => {
    // Use the same video URL as the main video (for now - in future could be teammate-specific)
    const teammateVideoUrl = videoUrl || '/videos/2nd_game_P035_league of legends_03-11-2025_15-41-49.mp4';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${playerName} Gameplay</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 20px;
              background: #111827;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              color: white;
            }
            .container {
              max-width: 1400px;
              margin: 0 auto;
            }
            .header {
              margin-bottom: 32px;
            }
            h1 {
              margin: 0 0 8px 0;
              font-size: 30px;
              font-weight: bold;
            }
            .subtitle {
              color: #9CA3AF;
              font-size: 16px;
            }
            .sync-controls {
              background: #1F2937;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              display: flex;
              gap: 12px;
              align-items: center;
              flex-wrap: wrap;
            }
            .video-container {
              background: #1F2937;
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }
            video {
              width: 100%;
              border-radius: 8px;
              background: #000;
              display: block;
            }
            .controls-bar {
              margin-top: 16px;
              background: #374151;
              border-radius: 8px;
              padding: 16px;
            }
            .timeline-container {
              margin-bottom: 16px;
            }
            .timeline {
              width: 100%;
              height: 8px;
              background: #4B5563;
              border-radius: 4px;
              position: relative;
              cursor: pointer;
            }
            .timeline-progress {
              height: 100%;
              background: #3B82F6;
              border-radius: 4px;
              width: 0%;
              transition: width 0.1s;
            }
            .timeline-thumb {
              position: absolute;
              top: 50%;
              transform: translate(-50%, -50%);
              width: 16px;
              height: 16px;
              background: white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              cursor: pointer;
            }
            .playback-controls {
              display: flex;
              gap: 12px;
              align-items: center;
            }
            .time-display {
              color: #9CA3AF;
              font-size: 14px;
              font-weight: 500;
              min-width: 100px;
            }
            .btn {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            }
            .btn-play {
              background: #10B981;
              color: white;
            }
            .btn-play:hover {
              background: #059669;
            }
            .btn-pause {
              background: #EF4444;
              color: white;
            }
            .btn-pause:hover {
              background: #DC2626;
            }
            .btn-sync {
              background: #3B82F6;
              color: white;
              margin-left: auto;
            }
            .btn-sync:hover {
              background: #2563EB;
            }
            .sync-status {
              padding: 6px 12px;
              background: #1F2937;
              border-radius: 6px;
              color: #9CA3AF;
              font-size: 13px;
            }
            .sync-status.synced {
              background: #065F46;
              color: #10B981;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${playerName}'s Gameplay</h1>
              <p class="subtitle">Review gameplay recording</p>
            </div>

            <div class="sync-controls">
              <button class="btn btn-sync" id="syncBtn">
                <span>🔄</span> Sync with Main Video
              </button>
              <div class="sync-status" id="syncStatus">Not synced</div>
            </div>

            <div class="video-container">
              <video id="teammateVideo">
                <source src="${teammateVideoUrl}" type="video/mp4">
                Your browser does not support the video tag.
              </video>

              <div class="controls-bar">
                <div class="timeline-container">
                  <div class="timeline" id="timeline">
                    <div class="timeline-progress" id="timelineProgress"></div>
                    <div class="timeline-thumb" id="timelineThumb"></div>
                  </div>
                </div>
                
                <div class="playback-controls">
                  <button class="btn btn-play" id="playBtn">
                    <span>▶</span> Play
                  </button>
                  <button class="btn btn-pause" id="pauseBtn">
                    <span>⏸</span> Pause
                  </button>
                  <div class="time-display" id="timeDisplay">
                    <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <script>
            const video = document.getElementById('teammateVideo');
            const playBtn = document.getElementById('playBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const syncBtn = document.getElementById('syncBtn');
            const currentTimeDisplay = document.getElementById('currentTime');
            const durationDisplay = document.getElementById('duration');
            const syncStatus = document.getElementById('syncStatus');
            const timeline = document.getElementById('timeline');
            const timelineProgress = document.getElementById('timelineProgress');
            const timelineThumb = document.getElementById('timelineThumb');

            let isDragging = false;

            // Format time helper
            function formatTime(seconds) {
              const mins = Math.floor(seconds / 60);
              const secs = Math.floor(seconds % 60);
              return mins + ':' + (secs < 10 ? '0' : '') + secs;
            }

            // Update timeline
            function updateTimeline() {
              const percent = (video.currentTime / video.duration) * 100;
              timelineProgress.style.width = percent + '%';
              timelineThumb.style.left = percent + '%';
            }

            // Update time displays
            video.addEventListener('timeupdate', () => {
              currentTimeDisplay.textContent = formatTime(video.currentTime);
              updateTimeline();
            });

            // Set duration when loaded
            video.addEventListener('loadedmetadata', () => {
              durationDisplay.textContent = formatTime(video.duration);
            });

            // Play button
            playBtn.addEventListener('click', () => {
              video.play();
            });

            // Pause button
            pauseBtn.addEventListener('click', () => {
              video.pause();
            });

            // Timeline click
            timeline.addEventListener('click', (e) => {
              const rect = timeline.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              video.currentTime = percent * video.duration;
            });

            // Timeline drag
            timelineThumb.addEventListener('mousedown', (e) => {
              isDragging = true;
              e.stopPropagation();
            });

            document.addEventListener('mousemove', (e) => {
              if (isDragging) {
                const rect = timeline.getBoundingClientRect();
                let percent = (e.clientX - rect.left) / rect.width;
                percent = Math.max(0, Math.min(1, percent));
                video.currentTime = percent * video.duration;
              }
            });

            document.addEventListener('mouseup', () => {
              isDragging = false;
            });

            // Sync button - communicate with parent window
            syncBtn.addEventListener('click', () => {
              try {
                // Request current time from parent window
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage({ 
                    type: 'REQUEST_VIDEO_TIME',
                    source: '${playerName}'
                  }, '*');
                } else {
                  alert('Main window is not available. Please keep the main analysis page open.');
                }
              } catch (e) {
                console.error('Error syncing:', e);
                alert('Unable to sync with main video.');
              }
            });

            // Listen for time sync message from parent
            window.addEventListener('message', (event) => {
              if (event.data.type === 'SYNC_VIDEO_TIME') {
                const targetTime = event.data.time;
                video.currentTime = targetTime;
                video.play();
                syncStatus.textContent = 'Synced at ' + formatTime(targetTime);
                syncStatus.classList.add('synced');
                
                // Reset sync status after 3 seconds
                setTimeout(() => {
                  syncStatus.classList.remove('synced');
                  syncStatus.textContent = 'Not synced';
                }, 3000);
              }
            });

            // Auto-play on load
            video.addEventListener('loadeddata', () => {
              video.play();
            });
          </script>
        </body>
      </html>
    `;

    // Open new window
    const newWindow = window.open('', '_blank', 'width=1200,height=800');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view teammate gameplay');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-white text-xl">Loading emotion data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* PAGE HEADING*/}
      <div className="mb-8">
        <button
          onClick={() => {
            // Only include query params when they are meaningful (not empty and not the default 'Unknown')
            const params = new URLSearchParams();
            if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
            if (currentPuuid) params.set('puuid', currentPuuid);
            const qs = params.toString();
            navigate(`/player/lol-recordinglist${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Match List
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">LoL Feedback & Review</h2>
        <p className="text-gray-400 mb-2">
          Review feedback from your coaches and track your improvements.
        </p>
        <p className="text-gray-500 text-sm">
          Match: {matchFilename.replace(/_/g, ' ')}
        </p>
        {currentRiotId && currentRiotId !== 'Unknown' && (
          <p className="text-gray-400 mt-2 font-semibold">
            Riot ID: {currentRiotId}
          </p>
        )}
      </div>

      <VideoPlayer
        videoUrl={videoUrl}
        markers={markers}
      />

      {/* Teammates Gameplay Section */}
      <div className="mt-6 bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Teammates' Gameplay</h3>
          <button
            onClick={() => setShowTeammatesSection(!showTeammatesSection)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {showTeammatesSection ? 'Hide Teammates' : 'View Teammates'}
          </button>
        </div>

        {showTeammatesSection && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teammates.map((teammate) => (
                <div key={teammate.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold">{teammate.playerName}</h4>
                      <p className="text-gray-400 text-sm">View gameplay recording</p>
                    </div>
                    <button
                      onClick={() => handleOpenTeammateVideo(teammate.playerName)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                    >
                      View Gameplay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coach Feedback List */}
      {coachFeedbackList.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">
              Coach Feedback ({filteredCoachFeedbackList.length}{selectedCategories.length > 0 && ` of ${coachFeedbackList.length}`})
            </h3>
            <FeedbackCategoryFilter
              selectedCategories={selectedCategories}
              onCategoriesChange={setSelectedCategories}
            />
          </div>
          {filteredCoachFeedbackList.length === 0 ? (
            <p className="text-gray-400">No feedback matches the selected category filters.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredCoachFeedbackList.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  formatTime={formatTime}
                  onClick={() => handleFeedbackClick(feedback)}
                  isSelected={selectedFeedback?.id === feedback.id}
                />
              ))}
            </div>
          )}
        </div>
      )}



      {/* Emotion Legend */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-white font-semibold mb-3">
          Emotion Markers Legend
          {allEmotionMarkers.length > 12 && (
            <span className="text-gray-400 text-sm font-normal ml-2">
              (Top 6 most frequent)
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(EMOTION_CONFIG)
            .filter(([emotion]) => emotionsToShow.includes(emotion))
            .map(([emotion, config]) => (
              <div key={emotion} className="flex items-center gap-2">
                <span className="text-2xl">{config.icon}</span>
                <span className="text-gray-300 text-sm">{emotion}</span>
              </div>
            ))}
        </div>
        <p className="text-gray-400 text-sm mt-3">
          💡 Coaching feedback: 💬 Coach notes | Emotion markers show sustained emotional states (4s+ duration, 90%+ confidence, 10s intervals)
        </p>
      </div>
    </div>
  );
};

export default LoLFeedbackReview;