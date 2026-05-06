import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VideoPlayer from '../../components/videoplayer';
import type { TimelineMarker } from '../../components/videoplayer';
import FeedbackCard from '../../components/FeedbackCard';
import FeedbackCategoryFilter from '../../components/FeedbackCategoryFilter';
import { getUser } from '../../utils/auth';
import api from '../../services/api';
import { API_BASE_URL } from '../../services/api';

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

interface FeedbackItem {
  id: number;
  riot_id: string;
  coach_username: string;
  match_id?: string;
  timestamp: number;
  category?: string;
  error_code?: string;
  feedback_text: string;
  game: string;
  created_at: string;
}

interface Teammate {
  id: string;
  playerName: string;
}

const CoachLoLRecordingAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [feedbackText, setFeedbackText] = useState('');
  const [category, setCategory] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [showTeammatesSection, setShowTeammatesSection] = useState(false);
  const [confidence, setConfidence] = useState(0.85);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [allEmotionMarkers, setAllEmotionMarkers] = useState<TimelineMarker[]>([]);
  const [includeNeutral, setIncludeNeutral] = useState(false);
  const [emotionsToShow, setEmotionsToShow] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();

  // Error codes mapped by category
  const errorCodesByCategory: Record<string, { value: string; label: string }[]> = {
    mechanical: [
      { value: 'mech_crosshair_placement', label: 'Crosshair/Cursor Placement Failures' },
      { value: 'mech_movement_while_action', label: 'Movement While Shooting/Casting' },
      { value: 'mech_ability_execution', label: 'Ability/Skill Execution Failures' },
      { value: 'mech_panic_response', label: 'Panic Responses Under Pressure' },
      { value: 'mech_last_hitting', label: 'Last-Hitting/CS Failures' },
    ],
    positioning: [
      { value: 'pos_static_predictable', label: 'Static, Predictable Positioning' },
      { value: 'pos_overextension', label: 'Overextension Without Information' },
      { value: 'pos_angle_exposure', label: 'Angle Exposure to Multiple Sightlines' },
      { value: 'pos_poor_spacing', label: 'Poor Spacing Relative to Teammates' },
      { value: 'pos_teamfight_plant', label: 'Post-Plant or Teamfight Positioning Failures' },
    ],
    communication: [
      { value: 'comm_missing_callouts', label: 'Missing Callouts' },
      { value: 'comm_duplicated_utility', label: 'Duplicated Utility Usage' },
      { value: 'comm_confused_rotations', label: 'Confused Rotations from Poor Information Sharing' },
      { value: 'comm_lack_intent_signaling', label: 'Lack of Intent Signaling (Pings)' },
    ],
    mental_psychological: [
      { value: 'mental_tilt', label: 'Tilt (Frustration Overriding Decision-Making)' },
      { value: 'mental_autopilot', label: 'Autopilot (Mechanical Play Without Active Thinking)' },
      { value: 'mental_tunnel_vision', label: 'Tunnel Vision After Landing Abilities' },
      { value: 'mental_performance_anxiety', label: 'Performance Anxiety in High-Stakes Moments' },
    ],
    resource_management: [
      { value: 'resource_economy', label: 'Economy Mistakes (Overspending, Poor Team Coordination)' },
      { value: 'resource_ability_waste', label: 'Ability/Cooldown Waste (Using Abilities Without Purpose)' },
      { value: 'resource_smite_management', label: 'Smite Management Failures on Objectives' },
    ],
    decision_making: [
      { value: 'macro_rotation_timing', label: 'Incorrect Rotation Timing' },
      { value: 'macro_objective_priority', label: 'Objective Prioritization Failures (Chasing Kills Over Objectives)' },
      { value: 'macro_wave_management', label: 'Wave Management Mistakes (Missed Crashes, Poor Freeze Execution)' },
      { value: 'macro_power_spike_ignorance', label: 'Power Spike Ignorance' },
      { value: 'macro_cooldown_misjudgment', label: 'Cooldown Misjudgment Before Engagement' },
    ],
    scientific: [
      { value: 'evidence_centered_design', label: 'Evidence-Centered Design (ECD)' },
      { value: 'attention_behaviour_cognition', label: 'Attention-Behaviour-Cognition (ABC-C)' },
      { value: 'collaborative_problem_solving', label: 'Collaborative Problem Solving (CPS)' },
      { value: 'antecedent_behavioral_consequence', label: 'Antecedent-Behavioral-Consequence (ABC-B)' },
    ]
  };

  // Get filtered error codes based on selected category
  const availableErrorCodes = category ? errorCodesByCategory[category] || [] : [];

  // Helper: convert category key to a human-friendly name
  const formatCategoryName = (cat: string) => {
    if (!cat) return '';
    return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Helper: find the label for an error code value within the selected category
  const getErrorLabel = (cat: string, val: string) => {
    if (!cat || !val) return '';
    const list = errorCodesByCategory[cat] || [];
    const found = list.find((it) => it.value === val);
    return found ? found.label : val;
  };

  // Get user object directly
  const user = getUser();

  // Get riot_id and match_id from URL params or sessionStorage
  const riotIdFromUrl = searchParams.get('user');
  const matchId = searchParams.get('match_id') || searchParams.get('matchId') || 'default_match';
  const riotId = riotIdFromUrl ||
    sessionStorage.getItem('current_lol_riot_id') ||
    sessionStorage.getItem('riotId') ||
    '';

  // Get username from user object OR sessionStorage as fallback
  const coachUsername = user?.username || sessionStorage.getItem('username') || '';

  // Inline categories panel visibility inside the annotation component
  const [showCategoriesInline, setShowCategoriesInline] = useState(false);
  // Tutorial/modal visibility for categories
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  // Teammates list
  const teammates: Teammate[] = [
    { id: '2', playerName: 'Teammate 2' },
    { id: '3', playerName: 'Teammate 3' },
    { id: '4', playerName: 'Teammate 4' },
    { id: '5', playerName: 'Teammate 5' }
  ];

  // Build video URL from data directory and match filename
  useEffect(() => {
    if (matchId) {
      // Use backend video serving endpoint and include the toolkit data directory
      // (set in Toolkit Setup) so the backend knows where to look for .mp4 files.
      const dataDirectory = localStorage.getItem('toolkit_data_directory');
      let backendVideoUrl = `${API_BASE_URL}/api/videos/${encodeURIComponent(matchId)}.mp4`;
      if (dataDirectory) {
        backendVideoUrl += `?data_directory=${encodeURIComponent(dataDirectory)}`;
      }
      setVideoUrl(backendVideoUrl);
    }
  }, [matchId]);


  useEffect(() => {

    if (riotId) {
      fetchFeedback();
    } else {
      alert('Riot ID not found in session. Please enter it in the game selection page.');
      navigate('/coach/gameselection');
    }
  }, [riotId]);

  // Listen to video time updates from the video player
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentVideoTime(videoElement.currentTime);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    // Listen for sync requests from teammate windows
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
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Fetch emotion data for the match
  useEffect(() => {
    const fetchEmotionData = async () => {
      if (!matchId) {
        return;
      }

      setLoading(true);
      try {
        const dataDirectory = localStorage.getItem('toolkit_data_directory');
        if (!dataDirectory) {
          setLoading(false);
          return;
        }

        // Convert matchId to CSV filename format
        const csvFilename = `${matchId}_merged.csv`;

        const response = await api.get(`/biometrics/match/${csvFilename}`, {
          params: { data_directory: dataDirectory }
        });


        const rawEmotionData: RawEmotionDataPoint[] = response.data.raw_emotion_data || [];

        if (rawEmotionData.length === 0) {
          console.warn('⚠️ No raw_emotion_data found in API response.');
          setLoading(false);
          return;
        }


        // Count unique emotions
        const uniqueEmotionsInData = new Set(rawEmotionData.map(p => p.emotion));

        // Process emotion data to create markers
        const MIN_TIME_GAP = 5; // seconds
        const MIN_CONFIDENCE = 70; // 70%
        const MIN_DURATION = 2; // seconds

        let lastEmotion = ''; // Start with empty string instead of 'Neutral'
        let lastMarkerTime = -MIN_TIME_GAP;
        let emotionStartTime = 0;
        const emotionMarkers: TimelineMarker[] = [];

        let debugCount = 0;

        rawEmotionData.forEach((point, index) => {
          const currentEmotion = point.emotion;
          const timestamp = point.video_timestamp || 0;
          const confidence = parseInt(point.confidence);

          // Debug first few iterations
          if (debugCount < 5) {
            debugCount++;
          }

          if (timestamp - lastMarkerTime < MIN_TIME_GAP) {
            return;
          }

          if (currentEmotion !== lastEmotion) {
            if (
              confidence >= MIN_CONFIDENCE &&
              (timestamp - emotionStartTime) >= MIN_DURATION &&
              lastEmotion !== '' // Only create marker if we have a previous emotion
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
            const emotion = marker.label?.split(' ')[0] || '';
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
  }, [matchId]);

  const fetchFeedback = async () => {
    try {
      const encodedRiotId = encodeURIComponent(riotId);
      const url = `${API_BASE_URL}/api/feedback/${encodedRiotId}/lol${matchId ? `?match_id=${encodeURIComponent(matchId)}` : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setFeedbackList(data);
      } else {
        console.error('Failed to fetch feedback');
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      alert('Please enter feedback text');
      return;
    }

    if (!category) {
      alert('Please select a category');
      return;
    }

    if (!errorCode) {
      alert('Please select an error type');
      return;
    }

    if (!riotId) {
      alert('Riot ID not found. Please go back and enter it.');
      navigate('/coach/gameselection');
      return;
    }

    const feedbackData = {
      riot_id: riotId,
      coach_username: coachUsername,
      match_id: matchId,
      timestamp: Math.floor(currentVideoTime),
      category: category,
      error_code: errorCode,
      feedback_text: feedbackText,
      game: 'lol'
    };


    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      if (response.ok) {
        alert('Feedback submitted successfully!');
        setFeedbackText('');
        setCategory('');
        setErrorCode('');
        fetchFeedback();
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        alert(`Failed to submit feedback: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Error submitting feedback');
    }
  };

  const handleDeleteFeedback = async (feedbackId: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback/${feedbackId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Feedback deleted successfully!');
        fetchFeedback();
      } else {
        alert('Failed to delete feedback');
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Error deleting feedback');
    }
  };

  const handleOpenTeammateVideo = (playerName: string) => {
    // Use the same video URL as the main video (for now - in future could be teammate-specific)
    const teammateVideoUrl = videoUrl || '/videos/testingvid.mp4';
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

  // Filter feedback list based on selected categories
  const filteredFeedbackList = useMemo(() => {
    if (selectedCategories.length === 0) {
      return feedbackList; // Show all if no filter selected
    }
    return feedbackList.filter((feedback) =>
      feedback.category && selectedCategories.includes(feedback.category)
    );
  }, [feedbackList, selectedCategories]);

  // Convert feedback list to timeline markers for the video player
  const feedbackMarkers: TimelineMarker[] = filteredFeedbackList.map((feedback) => ({
    id: feedback.id.toString(),
    timestamp: feedback.timestamp,
    icon: '💬',
    label: `${feedback.coach_username}: ${feedback.feedback_text.substring(0, 30)}${feedback.feedback_text.length > 30 ? '...' : ''}`
  }));

  // Combine feedback and emotion markers, filtering based on includeNeutral
  const filteredEmotionMarkers = includeNeutral
    ? allEmotionMarkers
    : allEmotionMarkers.filter(marker => !marker.label?.includes('Neutral'));

  const timelineMarkers: TimelineMarker[] = [...feedbackMarkers, ...filteredEmotionMarkers]
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="p-6">
      <div className="mb-8">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (riotId && riotId !== 'Unknown') params.set('user', riotId);
            const qs = params.toString();
            navigate(`/coach/lol-recordinganalysis${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Match List
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">League of Legends Recording Analysis</h2>
        <p className="text-gray-400">Review gameplay recordings and provide detailed feedback for {riotId || 'Unknown Player'}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-semibold text-sm"
          >
            Categories & Error Codes
          </button>
          <span className="text-gray-400 text-sm">Quick guide to help pick a category when adding feedback</span>
        </div>
        {matchId && matchId !== 'default_match' && (
          <p className="text-gray-500 text-sm mt-2">
            Match: {matchId.replace(/_/g, ' ').replace('.mp4', '')}
          </p>
        )}
      </div>

      {/* Video Player with Timeline Markers */}
      <div className="mb-6">
        <VideoPlayer
          videoUrl={videoUrl}
          markers={timelineMarkers}
        />
      </div>

      {/* Categories / Error Codes Modal */}
      {showCategoriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCategoriesModal(false)} />
          <div className="relative max-w-3xl w-full mx-4 bg-gray-900 rounded-lg p-6 border border-yellow-500/20 shadow-lg text-gray-100">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold">Feedback categories & example error codes</h3>
              <button onClick={() => setShowCategoriesModal(false)} className="text-gray-300 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(errorCodesByCategory).map(([cat, codes]) => (
                <div key={cat} className="bg-gray-800 p-3 rounded border border-gray-700">
                  <h4 className="text-yellow-300 font-semibold mb-2">{cat}</h4>
                  <ul className="text-sm space-y-1">
                    {codes.map((c: any) => (
                      <li key={c.value} className="flex items-start gap-2">
                        <span className="text-xs text-gray-400">•</span>
                        <div>
                          <div className="font-medium text-gray-100">{c.label}</div>
                          <div className="text-xs text-gray-400">{c.value}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-400">Tip: choose the category that best matches the player's behavioural issue (mechanical, positioning, communication, mental, decision-making). Use specific error codes when possible to make feedback actionable.</div>
          </div>
        </div>
      )}

      {/* Feedback Form - Always Visible */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="mb-6 bg-gray-900/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-amber-400">+ ADD ANNOTATION</h3>
              <button
                onClick={() => setShowCategoriesInline(!showCategoriesInline)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black rounded font-semibold text-sm"
              >
                Categories & Error Codes
              </button>
            </div>
            <div className="text-gray-300 text-sm">
              Current Time: <span className="font-bold text-amber-400">{formatTime(currentVideoTime)}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Category/Error selects removed - use the scrollable inline selector below */}

            {/* Inline categories panel (fits inside annotation area) */}
            {showCategoriesInline && (
              <div className="mt-3 bg-gray-800 rounded-lg p-3 border border-gray-700 max-h-64 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(errorCodesByCategory).map(([cat, codes]) => (
                    <div key={cat} className="p-2">
                      <h4 className="text-yellow-300 font-semibold mb-2">{cat}</h4>
                      <ul className="text-sm space-y-1">
                        {codes.map((c) => (
                          <li key={c.value} className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-100">{c.label}</div>
                              <div className="text-xs text-gray-400">{c.value}</div>
                            </div>
                            <button
                              onClick={() => {
                                setCategory(cat);
                                setErrorCode(c.value);
                                setShowCategoriesInline(false);
                              }}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-black rounded text-xs font-semibold"
                            >
                              Use
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected category + error code summary (visible when a selection exists) */}
            {(category || errorCode) && (
              <div className="bg-gray-900 rounded p-3 border border-gray-700 text-sm text-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-xs">Selected Category</div>
                    <div className="font-medium text-white">{formatCategoryName(category)}</div>
                    <div className="text-gray-400 text-xs mt-2">Selected Error Code</div>
                    <div className="text-sm text-white">{getErrorLabel(category, errorCode) || errorCode}</div>
                  </div>
                  <div>
                    <button
                      onClick={() => { setCategory(''); setErrorCode(''); }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error code select removed in favor of inline selector */}

            {/* Comment Textarea */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Comment (coaching feedback)
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="What happened? What should player do instead?"
                className="w-full p-4 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none transition-all"
                rows={4}
              />
            </div>

            {/* Confidence Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Confidence: {confidence.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${confidence * 100}%, #374151 ${confidence * 100}%, #374151 100%)`
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitFeedback}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold rounded-lg transition-colors"
            >
              ADD AT {formatTime(currentVideoTime)}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Feedback List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-white">
            Annotations ({filteredFeedbackList.length}{selectedCategories.length > 0 && ` of ${feedbackList.length}`})
          </h3>
          {feedbackList.length > 0 && (
            <FeedbackCategoryFilter
              selectedCategories={selectedCategories}
              onCategoriesChange={setSelectedCategories}
            />
          )}
        </div>
        {feedbackList.length === 0 ? (
          <p className="text-gray-400">No annotations added yet. Add your first annotation above!</p>
        ) : filteredFeedbackList.length === 0 ? (
          <p className="text-gray-400">No annotations match the selected category filters.</p>
        ) : (
          <div className="space-y-4">
            {filteredFeedbackList.map((feedback) => (
              <FeedbackCard
                key={feedback.id}
                feedback={feedback}
                formatTime={formatTime}
                onClick={() => {
                  const videoElement = document.querySelector('video');
                  if (videoElement) {
                    videoElement.currentTime = feedback.timestamp;
                    videoElement.play();
                  }
                }}
                onDelete={() => handleDeleteFeedback(feedback.id)}
                canDelete={feedback.coach_username === coachUsername}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachLoLRecordingAnalysis;