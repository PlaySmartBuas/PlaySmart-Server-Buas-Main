import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VideoPlayer, { type TimelineMarker } from '../../components/videoplayer';
import { getUser } from '../../utils/auth';
import { API_BASE_URL } from '../../services/api';
import { useMemo } from 'react';

interface FeedbackItem {
  id: number;
  riot_id: string;
  coach_username: string;
  timestamp: number;
  feedback_text: string;
  game: string;
  created_at: string;
}

interface Teammate {
  id: string;
  playerName: string;
}

const CoachValorantRecordingAnalysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [showTeammatesSection, setShowTeammatesSection] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  // ✅ Get riot_id from URL params or sessionStorage (priority: URL > sessionStorage)
  const riotIdFromUrl = searchParams.get('user');
  const riotId = riotIdFromUrl ||
    sessionStorage.getItem('current_valorant_riot_id') ||
    sessionStorage.getItem('riotId') ||
    '';

  const coachUsername = user?.username || sessionStorage.getItem('username') || '';

  // Tutorial/modal visibility
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  // Error codes mapping (preview) — keep concise for the tutorial
  const errorCodesByCategory = useMemo(() => ({
    mechanical: [
      { value: 'mech_aim', label: 'Aim / Crosshair placement' },
      { value: 'mech_tracking', label: 'Tracking / Target control' }
    ],
    positioning: [
      { value: 'pos_overextension', label: 'Overextension / Poor spacing' },
      { value: 'pos_angle', label: 'Angle exposure / Peek mistakes' }
    ],
    communication: [
      { value: 'comm_missing_callouts', label: 'Missing callouts' },
      { value: 'comm_timing', label: 'Poor timing / late info' }
    ],
    mental: [
      { value: 'mental_tilt', label: 'Tilt / emotional loss of control' },
      { value: 'mental_autopilot', label: 'Autopilot / passive play' }
    ],
    decision_making: [
      { value: 'macro_rotations', label: 'Rotation timing / objectives' },
      { value: 'macro_priorities', label: 'Objective prioritisation' }
    ]
  }), []);

  // Teammates list
  const teammates: Teammate[] = [
    { id: '2', playerName: 'Teammate 2' },
    { id: '3', playerName: 'Teammate 3' },
    { id: '4', playerName: 'Teammate 4' },
    { id: '5', playerName: 'Teammate 5' }
  ];

  useEffect(() => {

    if (riotId) {
      fetchFeedback();
    } else {
      alert('Riot ID not found in session. Please enter it in the game selection page.');
      navigate('/coach/gameselection');
    }
  }, [riotId]);

  // ✅ Listen to video time updates from the video player
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

  const fetchFeedback = async () => {
    try {
      const encodedRiotId = encodeURIComponent(riotId);
      const response = await fetch(`${API_BASE_URL}/api/feedback/${encodedRiotId}/valorant`);
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

    if (!riotId) {
      alert('Riot ID not found. Please go back and enter it.');
      navigate('/coach/gameselection');
      return;
    }

    const feedbackData = {
      riot_id: riotId,
      coach_username: coachUsername,
      timestamp: Math.floor(currentVideoTime),
      feedback_text: feedbackText,
      game: 'valorant'
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
        setShowFeedbackForm(false);
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
    // Create HTML content for the new window with VideoPlayer UI and sync functionality
    const videoUrl = '/videos/sampleVidShort.mp4';
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
                <source src="${videoUrl}" type="video/mp4">
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

  // ✅ Convert feedback list to timeline markers for the video player
  const timelineMarkers: TimelineMarker[] = feedbackList.map((feedback) => ({
    id: feedback.id.toString(),
    timestamp: feedback.timestamp,
    icon: '💬',
    label: `${feedback.coach_username}: ${feedback.feedback_text.substring(0, 30)}${feedback.feedback_text.length > 30 ? '...' : ''}`
  }));

  return (
    <div className="p-6">
      <div className="mb-8">
        <button
          onClick={() => navigate('/coach/valorant-recordinganalysis')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Match List
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">Valorant Recording Analysis</h2>
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
      </div>

      {/* Video Player with Timeline Markers */}
      <div className="mb-6">
        <VideoPlayer
          videoUrl="/videos/sampleVidShort.mp4"
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

      {/* Teammates Gameplay Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
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

      {/* Current Time Display & Feedback Form */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="mb-4 text-gray-300 text-lg">
          Current Time: <span className="font-bold text-blue-400">{formatTime(currentVideoTime)}</span>
        </div>

        <button
          onClick={() => setShowFeedbackForm(!showFeedbackForm)}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
        >
          {showFeedbackForm ? 'Cancel' : '+ Add Feedback at Current Time'}
        </button>

        {/* Feedback Form */}
        {showFeedbackForm && (
          <div className="mt-4 bg-gray-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">
              Add Feedback at {formatTime(currentVideoTime)}
            </h3>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Enter your feedback here..."
              className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleSubmitFeedback}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Submit Feedback
              </button>
              <button
                onClick={() => {
                  setShowFeedbackForm(false);
                  setFeedbackText('');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Feedback List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4">Feedback Timeline</h3>
        {feedbackList.length === 0 ? (
          <p className="text-gray-400">No feedback added yet. Add your first feedback above!</p>
        ) : (
          <div className="space-y-4">
            {feedbackList.map((feedback) => (
              <div key={feedback.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold">
                      {formatTime(feedback.timestamp)}
                    </span>
                    <span className="text-gray-400 text-sm">
                      by {feedback.coach_username}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {feedback.coach_username === coachUsername && (
                    <button
                      onClick={() => handleDeleteFeedback(feedback.id)}
                      className="text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-white">{feedback.feedback_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachValorantRecordingAnalysis;