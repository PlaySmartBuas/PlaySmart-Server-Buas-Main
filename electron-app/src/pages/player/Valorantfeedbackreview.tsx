// import React, { useEffect, useState } from 'react';
// import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
// import VideoPlayer, { type TimelineMarker } from '../../components/videoplayer';

// import api, { API_BASE_URL } from '../../services/api';

// /**
//  * ValorantFeedbackReview
//  * ----------------------
//  * Review page for a single recording that overlays emotion markers, coach
//  * feedback and supports opening teammate-synced video windows.
//  *
//  * Major responsibilities:
//  * - Load coach feedback for the match/player and convert to timeline markers
//  * - Load emotion CSV and generate emotion markers (with optional neutral filter)
//  * - Allow teammates' windows to be opened and synchronized via postMessage
//  */
// // Emotion to icon mapping
// const EMOTION_CONFIG = {
//   Anger: { icon: '😠', color: '#ef4444' },
//   Disgust: { icon: '🤢', color: '#84cc16' },
//   Happiness: { icon: '😊', color: '#fbbf24' },
//   Sadness: { icon: '😢', color: '#3b82f6' },
//   Fear: { icon: '😨', color: '#a855f7' },
//   Surprise: { icon: '😲', color: '#f97316' },
//   Neutral: { icon: '😐', color: '#6b7280' }
// };

// interface RawEmotionDataPoint {
//   unix_time: string;
//   emotion: string;
//   confidence: string;
//   datetime: string;
//   video_timestamp?: number;
// }

// interface CoachFeedback {
//   id: number;
//   riot_id: string;
//   coach_username: string;
//   timestamp: number;
//   feedback_text: string;
//   game: string;
//   created_at: string;
// }

// interface Teammate {
//   id: string;
//   playerName: string;
// }

// const ValorantFeedbackReview: React.FC = () => {
//   const navigate = useNavigate();
//   const { filename } = useParams<{ filename: string }>();
//   const [searchParams] = useSearchParams();

//   // Console log at the very top
//   console.log('=== VALORANT FEEDBACK REVIEW PAGE LOAD ===');
//   console.log('Current URL:', window.location.href);
//   console.log('Pathname:', window.location.pathname);
//   console.log('Search params:', window.location.search);
//   console.log('Filename from useParams:', filename);
//   console.log('User from searchParams:', searchParams.get('user'));
//   console.log('PUUID from searchParams:', searchParams.get('puuid'));
//   console.log('All search params:', Object.fromEntries(searchParams.entries()));
//   console.log('==========================================');

//   const [markers, setMarkers] = useState<TimelineMarker[]>([]);
//   const [allEmotionMarkers, setAllEmotionMarkers] = useState<TimelineMarker[]>([]);
//   const [coachFeedbackList, setCoachFeedbackList] = useState<CoachFeedback[]>([]);
//   const [selectedFeedback, setSelectedFeedback] = useState<CoachFeedback | null>(null);
//   const [loading, setLoading] = useState(true);

//   const [emotionsToShow, setEmotionsToShow] = useState<string[]>([]);
//   const [showTeammatesSection, setShowTeammatesSection] = useState(false);
//   const [reactionMarkers, setReactionMarkers] = useState<TimelineMarker[]>([]);
//   const [reactionRunning, setReactionRunning] = useState(false);
//   // user info not required in this component
//   const [currentRiotId, setCurrentRiotId] = useState('Unknown');
//   const [currentPuuid, setCurrentPuuid] = useState<string>('');
//   const [videoUrl, setVideoUrl] = useState<string>('');

//   // Teammates list
//   const teammates: Teammate[] = [
//     { id: '2', playerName: 'Teammate 2' },
//     { id: '3', playerName: 'Teammate 3' },
//     { id: '4', playerName: 'Teammate 4' },
//     { id: '5', playerName: 'Teammate 5' }
//   ];

//   // Resolve Riot ID (user) and PUUID from either URL params or sessionStorage.
//   // This ensures the page can be deep-linked (URL) or opened from within
//   // the app where sessionStorage was previously set.
//   useEffect(() => {
//     const riotIdFromUrl = searchParams.get('user');
//     const puuidFromUrl = searchParams.get('puuid');

//     console.log('=== RIOT ID & PUUID RESOLUTION ===');
//     console.log('riotIdFromUrl:', riotIdFromUrl);
//     console.log('puuidFromUrl:', puuidFromUrl);

//     if (riotIdFromUrl) {
//       console.log('✅ Setting Riot ID from URL:', riotIdFromUrl);
//       sessionStorage.setItem('current_valorant_riot_id', riotIdFromUrl);
//       setCurrentRiotId(riotIdFromUrl);
//     } else {
//       const savedRiotId = sessionStorage.getItem('current_valorant_riot_id') || sessionStorage.getItem('current_riot_id');
//       console.log('📦 Riot ID from sessionStorage:', savedRiotId);
//       if (savedRiotId) {
//         setCurrentRiotId(savedRiotId);
//       } else {
//         console.warn('⚠️ No Riot ID found in URL or sessionStorage');
//       }
//     }

//     if (puuidFromUrl) {
//       console.log('✅ Setting PUUID from URL:', puuidFromUrl);
//       sessionStorage.setItem('current_valorant_puuid', puuidFromUrl);
//       setCurrentPuuid(puuidFromUrl);
//     } else {
//       const savedPuuid = sessionStorage.getItem('current_valorant_puuid');
//       console.log('📦 PUUID from sessionStorage:', savedPuuid);
//       if (savedPuuid) {
//         setCurrentPuuid(savedPuuid);
//       } else {
//         console.warn('⚠️ No PUUID found in URL or sessionStorage');
//       }
//     }

//     console.log('==================================');
//   }, [searchParams]);

//   // Get the match filename from URL params
//   const matchFilename = filename || '';

//   // Build video URL from data directory and match filename
//   useEffect(() => {
//     if (matchFilename) {
//       // Use explicit backend host so VideoPlayer fallback probing (which uses
//       // http://localhost:8000) matches the same origin and avoids relative-path
//       // resolution differences between dev servers.
//       const backendHost = 'http://localhost:8000';
//       let backendVideoUrl = `${backendHost}/api/videos/${encodeURIComponent(matchFilename)}.mp4`;

//       // Prefill inference-related paths and append data_directory query param if present
//       const dataDirectory = localStorage.getItem('toolkit_data_directory') || '';
//       if (dataDirectory) {
//         backendVideoUrl += `?data_directory=${encodeURIComponent(dataDirectory)}`;
//         console.log('📂 Using data directory for video request:', dataDirectory);
//       }

//       console.log('🎥 Video URL (via backend):', backendVideoUrl);
//       setVideoUrl(backendVideoUrl);
//     }
//   }, [matchFilename]);

//   console.log('=== FINAL VALUES ===');
//   console.log('matchFilename:', matchFilename);
//   console.log('currentRiotId:', currentRiotId);
//   console.log('currentPuuid:', currentPuuid);
//   console.log('====================');

//   // Fetch coach feedback for the current player/match and convert to
//   // timeline markers. Kept separate from emotion marker generation so we
//   // can combine them flexibly (and optionally filter neutral emotions).
//   useEffect(() => {
//     const fetchCoachFeedback = async () => {
//       if (!currentRiotId || currentRiotId === 'Unknown') {
//         console.log('⚠️ Skipping coach feedback fetch - no Riot ID');
//         return;
//       }

//       try {
//         console.log('📡 Fetching coach feedback for:', currentRiotId);
//         console.log('📡 Match filename for coach feedback:', matchFilename);
//         const encodedRiotId = encodeURIComponent(currentRiotId);
//         const url = `${API_BASE_URL}/api/feedback/${encodedRiotId}/valorant${matchFilename ? `?match_id=${encodeURIComponent(matchFilename)}` : ''}`;
//         console.log('📡 Fetching from URL:', url);
//         const response = await fetch(url);
//         if (response.ok) {
//           const data = await response.json();
//           setCoachFeedbackList(data);
//           console.log(`✅ Loaded ${data.length} coach feedback items for match: ${matchFilename}`);
//         }
//       } catch (error) {
//         console.error('❌ Error fetching coach feedback:', error);
//       }
//     };

//     fetchCoachFeedback();
//   }, [currentRiotId]);

//   // When coach feedback or emotion marker filters change, rebuild the
//   // combined `markers` array shown on the timeline.
//   useEffect(() => {
//     // Convert coach feedback to markers
//     const coachingMarkers: TimelineMarker[] = coachFeedbackList.map((feedback) => ({
//       id: `coach-${feedback.id}`,
//       timestamp: feedback.timestamp,
//       icon: '💬',
//       label: `${feedback.coach_username}: ${feedback.feedback_text.substring(0, 40)}${feedback.feedback_text.length > 40 ? '...' : ''}`
//     }));

//     const filteredEmotionMarkers = allEmotionMarkers;

//     const combinedMarkers = [...coachingMarkers, ...filteredEmotionMarkers, ...reactionMarkers].sort(
//       (a, b) => a.timestamp - b.timestamp
//     );

//     setMarkers(combinedMarkers);
//   }, [allEmotionMarkers.length, coachFeedbackList.length, reactionMarkers.length]);

//   // Load raw emotion CSV for the recording and transform into timeline
//   // markers. The CSV parsing is intentionally tolerant: missing fields
//   // are handled and we attach a `video_timestamp` when available.
//   useEffect(() => {
//     const fetchEmotionData = async () => {
//       try {
//         // CSV files have _merged suffix, videos don't
//         let csvFilename = matchFilename;

//         // Remove .mp4 extension if present
//         if (csvFilename.endsWith('.mp4')) {
//           csvFilename = csvFilename.replace('.mp4', '');
//         }

//         // Add _merged suffix for CSV files if not already present
//         if (!csvFilename.includes('_merged')) {
//           csvFilename = `${csvFilename}_merged`;
//         }

//         // Ensure .csv extension
//         if (!csvFilename.endsWith('.csv')) {
//           csvFilename = `${csvFilename}.csv`;
//         }

//         const encodedFilename = encodeURIComponent(csvFilename);
//         console.log('🔍 Requesting emotion data for CSV:', csvFilename);

//         // Get data directory from localStorage (same as video loading)
//         const dataDirectory = localStorage.getItem('toolkit_data_directory');

//         // Build URL with data_directory query parameter if available
//         let url = `/biometrics/match/${encodedFilename}`;
//         if (dataDirectory) {
//           url += `?data_directory=${encodeURIComponent(dataDirectory)}`;
//           console.log('📂 Using data directory:', dataDirectory);
//         }

//         const response = await api.get(url);
//         console.log('Full API Response:', response.data);

//         const rawEmotionData: RawEmotionDataPoint[] = response.data.raw_emotion_data || [];

//         if (rawEmotionData.length === 0) {
//           console.warn('⚠️ No raw_emotion_data found in API response.');
//           setLoading(false);
//           return;
//         }

//         console.log(`Processing ${rawEmotionData.length} emotion data points`);

//         // Sample first few and some throughout to debug
//         console.log('First 5 data points:', rawEmotionData.slice(0, 5));
//         console.log('Middle 5 data points:', rawEmotionData.slice(Math.floor(rawEmotionData.length / 2), Math.floor(rawEmotionData.length / 2) + 5));
//         console.log('Last 5 data points:', rawEmotionData.slice(-5));

//         // Count unique emotions
//         const uniqueEmotions = new Set(rawEmotionData.map(p => p.emotion));
//         console.log('Unique emotions in data:', Array.from(uniqueEmotions));

//         // Relaxed thresholds for better marker detection
//         const MIN_TIME_GAP = 5;  // Reduced from 10 seconds
//         const MIN_CONFIDENCE = 70;  // Reduced from 90% to 70%
//         const MIN_DURATION = 2;  // Reduced from 4 seconds to 2 seconds

//         let lastEmotion = '';  // Start with empty string instead of 'Neutral'
//         let lastMarkerTime = -MIN_TIME_GAP;
//         let emotionStartTime = 0;
//         const emotionMarkers: TimelineMarker[] = [];

//         let debugCount = 0;

//         rawEmotionData.forEach((point, index) => {
//           const currentEmotion = point.emotion;
//           const timestamp = point.video_timestamp || 0;
//           const confidence = parseInt(point.confidence);

//           // Debug first few iterations
//           if (debugCount < 5) {
//             console.log(`Point ${index}: emotion=${currentEmotion}, timestamp=${timestamp}, confidence=${confidence}, lastEmotion=${lastEmotion}`);
//             debugCount++;
//           }

//           if (timestamp - lastMarkerTime < MIN_TIME_GAP) {
//             return;
//           }

//           if (currentEmotion !== lastEmotion) {
//             if (
//               confidence >= MIN_CONFIDENCE &&
//               (timestamp - emotionStartTime) >= MIN_DURATION &&
//               lastEmotion !== ''
//             ) {
//               const config = EMOTION_CONFIG[lastEmotion as keyof typeof EMOTION_CONFIG];

//               if (config) {
//                 emotionMarkers.push({
//                   id: `emotion-${emotionMarkers.length}`,
//                   timestamp: Math.round(emotionStartTime * 10) / 10,
//                   icon: config.icon,
//                   label: `${lastEmotion} (${Math.round((timestamp - emotionStartTime))}s duration)`,
//                   type: 'emotion',
//                   emotion: lastEmotion
//                 });

//                 lastMarkerTime = emotionStartTime;

//                 if (emotionMarkers.length <= 10) {
//                   console.log(`Marker ${emotionMarkers.length}: ${lastEmotion} at ${emotionStartTime.toFixed(1)}s for ${(timestamp - emotionStartTime).toFixed(1)}s`);
//                 }
//               }
//             }

//             lastEmotion = currentEmotion;
//             emotionStartTime = timestamp;
//           }
//         });

//         // Create a final marker for the last emotion period (if any)
//         if (lastEmotion !== '' && rawEmotionData.length > 0) {
//           const lastTimestamp = rawEmotionData[rawEmotionData.length - 1].video_timestamp || 0;
//           const duration = lastTimestamp - emotionStartTime;

//           if (duration >= MIN_DURATION) {
//             const config = EMOTION_CONFIG[lastEmotion as keyof typeof EMOTION_CONFIG];

//             if (config) {
//               emotionMarkers.push({
//                 id: `emotion-${emotionMarkers.length}`,
//                 timestamp: Math.round(emotionStartTime * 10) / 10,
//                 icon: config.icon,
//                 label: `${lastEmotion} (${Math.round(duration)}s duration)`,
//                 type: 'emotion',
//                 emotion: lastEmotion
//               });

//               console.log(`Final marker: ${lastEmotion} at ${emotionStartTime.toFixed(1)}s for ${duration.toFixed(1)}s`);
//             }
//           }
//         }

//         console.log(`✅ Created ${emotionMarkers.length} emotion markers (filtered from ${rawEmotionData.length} data points)`);

//         setAllEmotionMarkers(emotionMarkers);

//         if (emotionMarkers.length > 12) {
//           const emotionCounts: { [key: string]: number } = {};
//           emotionMarkers.forEach(marker => {
//             const emotion = (marker.label || '').split(' ')[0] || 'Unknown';
//             emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
//           });

//           const topEmotions = Object.entries(emotionCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 6)
//             .map(([emotion]) => emotion);

//           setEmotionsToShow(topEmotions);
//         } else {
//           setEmotionsToShow(Object.keys(EMOTION_CONFIG));
//         }

//       } catch (error) {
//         console.error('Error fetching emotion data:', error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchEmotionData();
//   }, [matchFilename]);

//   const formatTime = (seconds: number): string => {
//     const mins = Math.floor(seconds / 60);
//     const secs = Math.floor(seconds % 60);
//     return `${mins}:${secs.toString().padStart(2, '0')}`;
//   };

//   const handleFeedbackClick = (feedback: CoachFeedback) => {
//     setSelectedFeedback(feedback);
//     const videoElement = document.querySelector('video');
//     if (videoElement) {
//       videoElement.currentTime = feedback.timestamp;
//       videoElement.play();
//     }
//   };

//   const runReactionInference = async () => {
//     // Run server-side inference to produce reaction instances and convert to timeline markers
//     if (!matchFilename) {
//       console.warn('No match filename to infer from');
//       return;
//     }

//     setReactionRunning(true);
//     try {

//       const dataDirectory = localStorage.getItem('toolkit_data_directory') || '';
//       // Default server-side video path: dataDirectory + '/' + matchFilename + '.mp4'
//       // Ensure we append .mp4 so the backend looks for the correct file name
//       const fileBase = matchFilename.replace(/\.mp4$/, '');
//       // Files live under data/video and data/merged respectively
//       const videoPathServer = dataDirectory ? `${dataDirectory}/video/${fileBase}.mp4` : `video/${fileBase}.mp4`;

//       // Compute merged CSV path automatically (no user input required)
//       const base = dataDirectory ? (dataDirectory.endsWith('/') ? dataDirectory.slice(0, -1) : dataDirectory) : '';
//       const csvName = matchFilename.replace(/\.mp4$/, '') + '_merged.csv';
//       const inputLogPathLocal = base ? `${base}/merged/${csvName}` : `merged/${matchFilename.replace(/\.mp4$/, '')}_merged.csv`;

//       const payload: any = {
//         video_path: videoPathServer,
//         input_log_path: inputLogPathLocal,
//         threshold: 0.8,
//         output_csv_path: ''
//       };

//       console.log('Reaction inference payload (final):', payload);

//       console.log('Running reaction inference with payload:', payload);
//       const resp = await api.post('/reaction_time/run', payload);
//       const reactionData = resp.data?.reaction_data || resp.data;
//       console.log('Reaction inference result count:', reactionData?.length);

//       const markers: TimelineMarker[] = (reactionData || []).map((r: any, idx: number) => {
//         const seconds = typeof r.seconds === 'number' ? r.seconds : (r['Start Time (ms)'] ? r['Start Time (ms)'] / 1000 : 0);

//         // Collect numeric reaction times (ms) from available columns
//         const times: number[] = [];
//         const v = r['Visual Reaction Time (ms)'];
//         const c = r['Click Reaction Time (ms)'];
//         const g = r['Gaze Reaction Time (ms)'];
//         if (v && v !== 'N/A') times.push(Number(v));
//         if (c && c !== 'N/A') times.push(Number(c));
//         if (g && g !== 'N/A') times.push(Number(g));

//         const parts: string[] = [];
//         if (v && v !== 'N/A') parts.push(`Visual ${Math.round(Number(v))}ms`);
//         if (c && c !== 'N/A') parts.push(`Click ${Math.round(Number(c))}ms`);
//         if (g && g !== 'N/A') parts.push(`Gaze ${Math.round(Number(g))}ms`);

//         // Compute an average RT for evaluation if we have any times
//         const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

//         // Classification: Fast (<180ms), Average (180-240ms), Slow (>240ms)
//         let evalIcon = '';
//         let evalLabel = '';
//         if (avg !== null) {
//           if (avg < 180) {
//             evalIcon = '🟢+'; // fast
//             evalLabel = 'Fast';
//           } else if (avg <= 240) {
//             evalIcon = '🟡/'; // average
//             evalLabel = 'Average';
//           } else {
//             evalIcon = '🔴-'; // slow
//             evalLabel = 'Slow';
//           }
//         }

//         const baseLabel = parts.length ? parts.join(' | ') : `Reaction instance ${idx + 1}`;
//         const label = avg !== null ? `${baseLabel} — ${evalIcon} ${avg}ms (${evalLabel})` : baseLabel;

//         return {
//           id: `reaction-${idx}`,
//           timestamp: seconds,
//           icon: '⚡',
//           label,
//           type: 'other'
//         } as unknown as TimelineMarker;
//       });

//       setReactionMarkers(markers);
//     } catch (err: any) {
//       // Surface server validation response if present
//       const serverDetail = err?.response?.data;
//       console.error('Reaction inference failed:', err, 'server detail:', serverDetail);
//       if (serverDetail) {
//         // Show a short alert to the user and also log full detail
//         try {
//           alert('Reaction inference failed: ' + JSON.stringify(serverDetail));
//         } catch (e) {
//           // ignore alert failure
//         }
//       }
//     } finally {
//       setReactionRunning(false);
//     }
//   };


//   // Listen for postMessage sync requests from teammate video windows.
//   // Other windows created by `handleOpenTeammateVideo` will post messages
//   // containing a timestamp to seek to; this handler forwards that to the
//   // local <video> element for synchronized playback.
//   useEffect(() => {
//     const handleMessage = (event: MessageEvent) => {
//       if (event.data.type === 'REQUEST_VIDEO_TIME') {
//         const mainVideo = document.querySelector('video');
//         if (mainVideo) {
//           // Send current time back to the requesting window
//           event.source?.postMessage({
//             type: 'SYNC_VIDEO_TIME',
//             time: mainVideo.currentTime
//           }, '*' as any);
//         }
//       }
//     };

//     window.addEventListener('message', handleMessage);

//     return () => {
//       window.removeEventListener('message', handleMessage);
//     };
//   }, []);

//   console.log('Current URL:', window.location.href);

//   const handleOpenTeammateVideo = (playerName: string) => {
//     // Create HTML content for the new window with VideoPlayer UI and sync functionality (Valorant themed)
//     const videoUrl = '/videos/sampleVidShort.mp4';
//     const htmlContent = `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <title>${playerName} Gameplay</title>
//           <style>
//             * {
//               box-sizing: border-box;
//             }
//             body {
//               margin: 0;
//               padding: 20px;
//               background: linear-gradient(to bottom right, #000, #111827, rgba(239, 68, 68, 0.1));
//               font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
//               color: white;
//             }
//             .container {
//               max-width: 1400px;
//               margin: 0 auto;
//             }
//             .header {
//               margin-bottom: 32px;
//             }
//             h1 {
//               margin: 0 0 8px 0;
//               font-size: 30px;
//               font-weight: 900;
//               background: linear-gradient(to right, #EF4444, #DC2626, #EF4444);
//               -webkit-background-clip: text;
//               -webkit-text-fill-color: transparent;
//               background-clip: text;
//             }
//             .subtitle {
//               color: rgba(239, 68, 68, 0.6);
//               font-size: 16px;
//               font-weight: 600;
//             }
//             .sync-controls {
//               background: linear-gradient(to bottom right, #0a0a0a, #000);
//               border: 1px solid rgba(239, 68, 68, 0.2);
//               border-radius: 12px;
//               padding: 20px;
//               margin-bottom: 20px;
//               display: flex;
//               gap: 12px;
//               align-items: center;
//               flex-wrap: wrap;
//             }
//             .video-container {
//               background: linear-gradient(to bottom right, #0a0a0a, #000);
//               border: 1px solid rgba(239, 68, 68, 0.2);
//               border-radius: 12px;
//               padding: 24px;
//               box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
//             }
//             video {
//               width: 100%;
//               border-radius: 8px;
//               background: #000;
//               display: block;
//             }
//             .controls-bar {
//               margin-top: 16px;
//               background: linear-gradient(to bottom right, #1f1f1f, #0a0a0a);
//               border: 1px solid rgba(239, 68, 68, 0.2);
//               border-radius: 8px;
//               padding: 16px;
//             }
//             .timeline-container {
//               margin-bottom: 16px;
//             }
//             .timeline {
//               width: 100%;
//               height: 8px;
//               background: #1f1f1f;
//               border-radius: 4px;
//               position: relative;
//               cursor: pointer;
//             }
//             .timeline-progress {
//               height: 100%;
//               background: linear-gradient(to right, #EF4444, #DC2626);
//               border-radius: 4px;
//               width: 0%;
//               transition: width 0.1s;
//             }
//             .timeline-thumb {
//               position: absolute;
//               top: 50%;
//               transform: translate(-50%, -50%);
//               width: 16px;
//               height: 16px;
//               background: #EF4444;
//               border-radius: 50%;
//               box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
//               cursor: pointer;
//             }
//             .playback-controls {
//               display: flex;
//               gap: 12px;
//               align-items: center;
//             }
//             .time-display {
//               color: rgba(239, 68, 68, 0.6);
//               font-size: 14px;
//               font-weight: 700;
//               min-width: 100px;
//             }
//             .btn {
//               padding: 8px 16px;
//               border: none;
//               border-radius: 6px;
//               font-weight: 900;
//               font-size: 14px;
//               cursor: pointer;
//               transition: all 0.3s;
//               display: flex;
//               align-items: center;
//               gap: 6px;
//             }
//             .btn:hover {
//               transform: translateY(-2px);
//               box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
//             }
//             .btn-play {
//               background: linear-gradient(to right, #EF4444, #DC2626);
//               color: white;
//             }
//             .btn-play:hover {
//               background: linear-gradient(to right, #F87171, #EF4444);
//             }
//             .btn-pause {
//               background: linear-gradient(to right, #B91C1C, #991B1B);
//               color: white;
//             }
//             .btn-pause:hover {
//               background: linear-gradient(to right, #DC2626, #B91C1C);
//             }
//             .btn-sync {
//               background: linear-gradient(to right, #EF4444, #DC2626);
//               color: white;
//               margin-left: auto;
//             }
//             .btn-sync:hover {
//               background: linear-gradient(to right, #F87171, #EF4444);
//             }
//             .sync-status {
//               padding: 6px 12px;
//               background: #0a0a0a;
//               border-radius: 6px;
//               color: rgba(239, 68, 68, 0.6);
//               font-size: 13px;
//               font-weight: 700;
//               border: 1px solid rgba(239, 68, 68, 0.2);
//             }
//             .sync-status.synced {
//               background: #065F46;
//               color: #10B981;
//               border-color: #10B981;
//             }
//           </style>
//         </head>
//         <body>
//           <div class="container">
//             <div class="header">
//               <h1>${playerName}'s Gameplay</h1>
//               <p class="subtitle">Review gameplay recording</p>
//             </div>

//             <div class="sync-controls">
//               <button class="btn btn-sync" id="syncBtn">
//                 <span>🔄</span> Sync with Main Video
//               </button>
//               <div class="sync-status" id="syncStatus">Not synced</div>
//             </div>

//             <div class="video-container">
//               <video id="teammateVideo">
//                 <source src="${videoUrl}" type="video/mp4">
//                 Your browser does not support the video tag.
//               </video>

//               <div class="controls-bar">
//                 <div class="timeline-container">
//                   <div class="timeline" id="timeline">
//                     <div class="timeline-progress" id="timelineProgress"></div>
//                     <div class="timeline-thumb" id="timelineThumb"></div>
//                   </div>
//                 </div>
                
//                 <div class="playback-controls">
//                   <button class="btn btn-play" id="playBtn">
//                     <span>▶</span> Play
//                   </button>
//                   <button class="btn btn-pause" id="pauseBtn">
//                     <span>⏸</span> Pause
//                   </button>
//                   <div class="time-display" id="timeDisplay">
//                     <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <script>
//             const video = document.getElementById('teammateVideo');
//             const playBtn = document.getElementById('playBtn');
//             const pauseBtn = document.getElementById('pauseBtn');
//             const syncBtn = document.getElementById('syncBtn');
//             const currentTimeDisplay = document.getElementById('currentTime');
//             const durationDisplay = document.getElementById('duration');
//             const syncStatus = document.getElementById('syncStatus');
//             const timeline = document.getElementById('timeline');
//             const timelineProgress = document.getElementById('timelineProgress');
//             const timelineThumb = document.getElementById('timelineThumb');

//             let isDragging = false;

//             // Format time helper
//             function formatTime(seconds) {
//               const mins = Math.floor(seconds / 60);
//               const secs = Math.floor(seconds % 60);
//               return mins + ':' + (secs < 10 ? '0' : '') + secs;
//             }

//             // Update timeline
//             function updateTimeline() {
//               const percent = (video.currentTime / video.duration) * 100;
//               timelineProgress.style.width = percent + '%';
//               timelineThumb.style.left = percent + '%';
//             }

//             // Update time displays
//             video.addEventListener('timeupdate', () => {
//               currentTimeDisplay.textContent = formatTime(video.currentTime);
//               updateTimeline();
//             });

//             // Set duration when loaded
//             video.addEventListener('loadedmetadata', () => {
//               durationDisplay.textContent = formatTime(video.duration);
//             });

//             // Play button
//             playBtn.addEventListener('click', () => {
//               video.play();
//             });

//             // Pause button
//             pauseBtn.addEventListener('click', () => {
//               video.pause();
//             });

//             // Timeline click
//             timeline.addEventListener('click', (e) => {
//               const rect = timeline.getBoundingClientRect();
//               const percent = (e.clientX - rect.left) / rect.width;
//               video.currentTime = percent * video.duration;
//             });

//             // Timeline drag
//             timelineThumb.addEventListener('mousedown', (e) => {
//               isDragging = true;
//               e.stopPropagation();
//             });

//             document.addEventListener('mousemove', (e) => {
//               if (isDragging) {
//                 const rect = timeline.getBoundingClientRect();
//                 let percent = (e.clientX - rect.left) / rect.width;
//                 percent = Math.max(0, Math.min(1, percent));
//                 video.currentTime = percent * video.duration;
//               }
//             });

//             document.addEventListener('mouseup', () => {
//               isDragging = false;
//             });

//             // Sync button - communicate with parent window
//             syncBtn.addEventListener('click', () => {
//               try {
//                 // Request current time from parent window
//                 if (window.opener && !window.opener.closed) {
//                   window.opener.postMessage({ 
//                     type: 'REQUEST_VIDEO_TIME',
//                     source: '${playerName}'
//                   }, '*');
//                 } else {
//                   alert('Main window is not available. Please keep the main analysis page open.');
//                 }
//               } catch (e) {
//                 console.error('Error syncing:', e);
//                 alert('Unable to sync with main video.');
//               }
//             });

//             // Listen for time sync message from parent
//             window.addEventListener('message', (event) => {
//               if (event.data.type === 'SYNC_VIDEO_TIME') {
//                 const targetTime = event.data.time;
//                 video.currentTime = targetTime;
//                 video.play();
//                 syncStatus.textContent = 'Synced at ' + formatTime(targetTime);
//                 syncStatus.classList.add('synced');
                
//                 // Reset sync status after 3 seconds
//                 setTimeout(() => {
//                   syncStatus.classList.remove('synced');
//                   syncStatus.textContent = 'Not synced';
//                 }, 3000);
//               }
//             });

//             // Auto-play on load
//             video.addEventListener('loadeddata', () => {
//               video.play();
//             });
//           </script>
//         </body>
//       </html>
//     `;

//     // Open new window
//     const newWindow = window.open('', '_blank', 'width=1200,height=800');
//     if (newWindow) {
//       newWindow.document.write(htmlContent);
//       newWindow.document.close();
//     } else {
//       alert('Please allow pop-ups to view teammate gameplay');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-red-900/10 min-h-screen">
//         <div className="flex items-center justify-center h-64">
//           <div className="text-red-400 text-xl font-bold">Loading emotion data...</div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-red-900/10 min-h-screen">
//       {/* PAGE HEADING*/}
//       <div className="mb-8">
//         <button
//           onClick={() => {
//             // Only include query params when they are meaningful (not empty and not the default 'Unknown')
//             const params = new URLSearchParams();
//             if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
//             if (currentPuuid) params.set('puuid', currentPuuid);
//             const qs = params.toString();
//             navigate(`/player/valorant-recordinglist${qs ? `?${qs}` : ''}`);
//           }}
//           className="flex items-center gap-2 text-red-300/60 hover:text-red-400 mb-4 transition-colors font-bold"
//         >
//           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
//           </svg>
//           Back to Match List
//         </button>
//         <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-red-400 mb-2">VALORANT Feedback & Review</h2>
//         <p className="text-red-300/60 font-semibold mb-2">
//           Review feedback from your coaches and track your improvements.
//         </p>
//         <p className="text-red-400/60 text-sm font-semibold">
//           Match: {matchFilename.replace(/_/g, ' ')}
//         </p>
//         {currentRiotId && currentRiotId !== 'Unknown' && (
//           <p className="text-red-400 mt-2 font-black">
//             Riot ID: {currentRiotId}
//           </p>
//         )}
//       </div>

//       <VideoPlayer
//         videoUrl={videoUrl}
//         markers={markers}
//       />

//       {/* Teammates Gameplay Section */}
//       <div className="mt-6 bg-gradient-to-br from-gray-950 to-black border border-red-500/20 rounded-lg p-6 shadow-lg">
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-xl font-black text-white">Teammates' Gameplay</h3>
//           <button
//             onClick={() => setShowTeammatesSection(!showTeammatesSection)}
//             className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg transition-all duration-300 font-black flex items-center gap-2 shadow-lg shadow-red-500/30"
//           >
//             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
//             </svg>
//             {showTeammatesSection ? 'Hide Teammates' : 'View Teammates'}
//           </button>
//         </div>

//         {showTeammatesSection && (
//           <div>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {teammates.map((teammate) => (
//                 <div key={teammate.id} className="bg-gradient-to-br from-gray-900 to-black rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-colors">
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <h4 className="text-white font-black">{teammate.playerName}</h4>
//                       <p className="text-red-300/60 text-sm font-semibold">View gameplay recording</p>
//                     </div>
//                     <button
//                       onClick={() => handleOpenTeammateVideo(teammate.playerName)}
//                       className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg transition-all duration-300 font-black shadow-lg shadow-red-500/30"
//                     >
//                       View Gameplay
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Selected Coach Feedback Detail */}
//       {selectedFeedback && (
//         <div className="mt-6 bg-red-900/20 border border-red-500/50 rounded-lg p-6 shadow-lg">
//           <h4 className="text-red-400 font-black text-lg mb-3">Currently Viewing Coach Feedback</h4>
//           <div className="flex items-start gap-4">
//             <span className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded text-lg font-black shadow-lg">
//               {formatTime(selectedFeedback.timestamp)}
//             </span>
//             <div className="flex-1">
//               <div className="flex items-center gap-2 mb-2">
//                 <p className="text-white font-black">
//                   {selectedFeedback.coach_username}
//                 </p>
//                 <span className="text-red-500/30">•</span>
//                 <p className="text-red-300/60 text-sm font-semibold">
//                   {new Date(selectedFeedback.created_at).toLocaleDateString()}
//                 </p>
//               </div>
//               <p className="text-white text-base font-medium">{selectedFeedback.feedback_text}</p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Coach Feedback List */}
//       {coachFeedbackList.length > 0 && (
//         <div className="mt-6 bg-gradient-to-br from-gray-950 to-black border border-red-500/20 rounded-lg p-6 shadow-lg">
//           <h3 className="text-xl font-black text-white mb-4">
//             Coach Feedback ({coachFeedbackList.length})
//           </h3>
//           <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
//             {coachFeedbackList.map((feedback) => (
//               <div
//                 key={feedback.id}
//                 onClick={() => handleFeedbackClick(feedback)}
//                 className={`bg-gradient-to-br from-gray-900 to-black rounded-lg p-4 border cursor-pointer transition-all duration-300 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/20 ${selectedFeedback?.id === feedback.id
//                   ? 'border-red-500/60 shadow-lg shadow-red-500/20'
//                   : 'border-red-500/20'
//                   }`}
//               >
//                 <div className="flex items-start justify-between mb-2">
//                   <div className="flex items-center gap-3">
//                     <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded text-sm font-black shadow-lg">
//                       {formatTime(feedback.timestamp)}
//                     </span>
//                     <div>
//                       <p className="text-gray-300 text-sm font-bold">
//                         {feedback.coach_username}
//                       </p>
//                       <p className="text-red-300/60 text-xs font-semibold">
//                         {new Date(feedback.created_at).toLocaleDateString()}
//                       </p>
//                     </div>
//                   </div>
//                   <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                   </svg>
//                 </div>
//                 <p className="text-white text-sm font-medium">{feedback.feedback_text}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}



//       {/* Emotion Legend */}
//       <div className="mt-6 p-4 bg-gradient-to-br from-gray-950 to-black border border-red-500/20 rounded-lg shadow-lg">
//         <h3 className="text-white font-black mb-3">
//           Emotion Markers Legend
//           {allEmotionMarkers.length > 12 && (
//             <span className="text-red-300/60 text-sm font-semibold ml-2">
//               (Showing top 6 most frequent emotions)
//             </span>
//           )}
//         </h3>
//         <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
//           {Object.entries(EMOTION_CONFIG)
//             .filter(([emotion]) => emotionsToShow.includes(emotion))
//             .map(([emotion, config]) => (
//               <div key={emotion} className="flex items-center gap-2 bg-gradient-to-br from-gray-900 to-black p-3 rounded border border-red-500/20">
//                 <span className="text-2xl">{config.icon}</span>
//                 <span className="text-white font-semibold">{emotion}</span>
//               </div>
//             ))}
//         </div>
//         <p className="text-red-300/60 text-sm mt-3 font-semibold">
//           💡 Coaching feedback: 💬 Coach notes | Emotion markers show sustained emotional states (2s+ duration, 70%+ confidence, 5s intervals)
//         </p>
//       </div>

//       {/* Reaction Time Inference Panel */}
//       <div className="mt-6 p-4 bg-gradient-to-br from-gray-900 to-black border border-red-500/10 rounded-lg shadow-md">
//         <h3 className="text-white font-black mb-3">Reaction Time Inference</h3>
//         <p className="text-gray-300 text-sm mb-3">Run the server-side reaction time inference to generate timeline events (visual/click/gaze RTs).</p>

//         <div className="mb-3">
//           <p className="text-gray-400 text-sm">Model and CSV selection are automatic — the server will use the default model and the merged CSV for this match.</p>
//         </div>

//         <div className="flex items-center gap-3">
//           <button onClick={runReactionInference} disabled={reactionRunning} className={`px-4 py-2 font-black rounded ${reactionRunning ? 'bg-gray-700 text-gray-400' : 'bg-red-500 text-white hover:from-red-400 hover:to-red-500'}`}>
//             {reactionRunning ? 'Running…' : 'Run Reaction Inference'}
//           </button>
//           <div className="text-sm text-gray-300">Generated markers: {reactionMarkers.length}</div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ValorantFeedbackReview;



import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import VideoPlayer, { type TimelineMarker } from '../../components/videoplayer';

import api, { API_BASE_URL } from '../../services/api';

/**
 * ValorantFeedbackReview
 * ----------------------
 * Review page for a single recording that overlays emotion markers, coach
 * feedback and supports opening teammate-synced video windows.
 *
 * Major responsibilities:
 * - Load coach feedback for the match/player and convert to timeline markers
 * - Load emotion CSV directly and generate emotion markers with calculated video timestamps
 * - Allow teammates' windows to be opened and synchronized via postMessage
 */

const EMOTION_CONFIG = {
  Anger: { icon: '😠', color: '#ef4444' },
  Disgust: { icon: '🤢', color: '#84cc16' },
  Happiness: { icon: '😊', color: '#fbbf24' },
  Sadness: { icon: '😢', color: '#3b82f6' },
  Fear: { icon: '😨', color: '#a855f7' },
  Surprise: { icon: '😲', color: '#f97316' },
  Neutral: { icon: '😐', color: '#6b7280' }
};

interface CSVData {
  headers: string[];
  data: any[];
  rows_returned: number;
  total_rows: number;
}

interface EmotionDataPoint {
  unix_time: string;
  emotion: string;
  confidence: number;
  datetime: string;
  video_timestamp: number;
}

interface CoachFeedback {
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

const ValorantFeedbackReview: React.FC = () => {
  const navigate = useNavigate();
  const { filename } = useParams<{ filename: string }>();
  const [searchParams] = useSearchParams();

  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [allEmotionMarkers, setAllEmotionMarkers] = useState<TimelineMarker[]>([]);
  const [coachFeedbackList, setCoachFeedbackList] = useState<CoachFeedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<CoachFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  const [emotionsToShow, setEmotionsToShow] = useState<string[]>([]);
  const [showTeammatesSection, setShowTeammatesSection] = useState(false);
  const [reactionMarkers, setReactionMarkers] = useState<TimelineMarker[]>([]);
  const [reactionRunning, setReactionRunning] = useState(false);
  
  const [currentRiotId, setCurrentRiotId] = useState('Unknown');
  const [currentPuuid, setCurrentPuuid] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');

  const teammates: Teammate[] = [
    { id: '2', playerName: 'Teammate 2' },
    { id: '3', playerName: 'Teammate 3' },
    { id: '4', playerName: 'Teammate 4' },
    { id: '5', playerName: 'Teammate 5' }
  ];

  useEffect(() => {
    const riotIdFromUrl = searchParams.get('user');
    const puuidFromUrl = searchParams.get('puuid');

    if (riotIdFromUrl) {
      sessionStorage.setItem('current_valorant_riot_id', riotIdFromUrl);
      setCurrentRiotId(riotIdFromUrl);
    } else {
      const savedRiotId = sessionStorage.getItem('current_valorant_riot_id') || sessionStorage.getItem('current_riot_id');
      if (savedRiotId) {
        setCurrentRiotId(savedRiotId);
      }
    }

    if (puuidFromUrl) {
      sessionStorage.setItem('current_valorant_puuid', puuidFromUrl);
      setCurrentPuuid(puuidFromUrl);
    } else {
      const savedPuuid = sessionStorage.getItem('current_valorant_puuid');
      if (savedPuuid) {
        setCurrentPuuid(savedPuuid);
      }
    }
  }, [searchParams]);

  const matchFilename = filename || '';

  useEffect(() => {
    if (matchFilename) {
      const backendHost = '';
      let backendVideoUrl = `${backendHost}/api/videos/${encodeURIComponent(matchFilename)}.mp4`;

      const dataDirectory = localStorage.getItem('toolkit_data_directory') || '';
      if (dataDirectory) {
        backendVideoUrl += `?data_directory=${encodeURIComponent(dataDirectory)}`;
      }

      setVideoUrl(backendVideoUrl);
    }
  }, [matchFilename]);

  useEffect(() => {
    const fetchCoachFeedback = async () => {
      if (!currentRiotId || currentRiotId === 'Unknown') {
        return;
      }

      try {
        const encodedRiotId = encodeURIComponent(currentRiotId);
        const url = `${API_BASE_URL}/api/feedback/${encodedRiotId}/valorant${matchFilename ? `?match_id=${encodeURIComponent(matchFilename)}` : ''}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setCoachFeedbackList(data);
        }
      } catch (error) {
        console.error('Error fetching coach feedback:', error);
      }
    };

    fetchCoachFeedback();
  }, [currentRiotId, matchFilename]);

  useEffect(() => {
    const coachingMarkers: TimelineMarker[] = coachFeedbackList.map((feedback) => ({
      id: `coach-${feedback.id}`,
      timestamp: feedback.timestamp,
      icon: '💬',
      label: `${feedback.coach_username}: ${feedback.feedback_text.substring(0, 40)}${feedback.feedback_text.length > 40 ? '...' : ''}`
    }));

    const combinedMarkers = [...coachingMarkers, ...allEmotionMarkers, ...reactionMarkers].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    setMarkers(combinedMarkers);
  }, [allEmotionMarkers.length, coachFeedbackList.length, reactionMarkers.length]);

  useEffect(() => {
    const fetchEmotionDataFromCSV = async () => {
      try {
        let csvFilename = matchFilename;

        if (csvFilename.endsWith('.mp4')) {
          csvFilename = csvFilename.replace('.mp4', '');
        }

        if (!csvFilename.includes('_merged')) {
          csvFilename = `${csvFilename}_merged`;
        }

        if (!csvFilename.endsWith('.csv')) {
          csvFilename = `${csvFilename}.csv`;
        }

        const dataDirectory = localStorage.getItem('toolkit_data_directory');
        if (!dataDirectory) {
          setLoading(false);
          return;
        }

        const filePath = `${dataDirectory}/merged/${csvFilename}`;
        const allData: any[] = [];
        
        const summaryResponse = await fetch(
          `${API_BASE_URL}/api/matches/csv-summary?file_path=${encodeURIComponent(filePath)}`
        );

        if (!summaryResponse.ok) {
          throw new Error('Failed to fetch CSV summary');
        }

        const summary = await summaryResponse.json();
        const totalRows = summary.total_rows;
        const batchSize = 500;
        const totalBatches = Math.ceil(totalRows / batchSize);

        for (let batch = 0; batch < totalBatches; batch++) {
          const skipRows = batch * batchSize;

          const response = await fetch(
            `${API_BASE_URL}/api/matches/read-csv?file_path=${encodeURIComponent(filePath)}&max_rows=${batchSize}&skip_rows=${skipRows}`
          );

          if (!response.ok) throw new Error('Failed to fetch batch');

          const batchData: CSVData = await response.json();
          allData.push(...batchData.data);
        }

        const emotionDataWithTimestamps = calculateVideoTimestamps(allData);
        processEmotionMarkers(emotionDataWithTimestamps);

      } catch (error) {
        console.error('Error fetching emotion data from CSV:', error);
      } finally {
        setLoading(false);
      }
    };

    if (matchFilename) {
      fetchEmotionDataFromCSV();
    }
  }, [matchFilename]);

  const calculateVideoTimestamps = (data: any[]): EmotionDataPoint[] => {
    const rowsWithEmotion = data.filter(row => row.emotion && row.emotion !== '');

    if (rowsWithEmotion.length === 0) {
      return [];
    }

    const sampleConfidence = rowsWithEmotion.length > 0 ? parseFloat(rowsWithEmotion[0].confidence) : 0;
    const confidenceIsDecimal = sampleConfidence <= 1.0;

    const confidenceThreshold = confidenceIsDecimal ? 0.5 : 50;
    const emotionRows = rowsWithEmotion.filter(row => {
      const conf = parseFloat(row.confidence);
      return conf > confidenceThreshold;
    });

    if (emotionRows.length === 0) {
      return [];
    }

    let useDatetime = false;
    let timestamps: Date[] = [];

    if (emotionRows[0].datetime) {
      timestamps = emotionRows
        .map(row => {
          try {
            const dateStr = row.datetime;
            if (dateStr && dateStr.includes(':')) {
              return new Date(dateStr);
            }
            return null;
          } catch (e) {
            return null;
          }
        })
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

      const uniqueTimestamps = new Set(timestamps.map(t => t.getTime())).size;
      
      if (uniqueTimestamps > 10) {
        useDatetime = true;
      }
    }

    let result: EmotionDataPoint[] = [];

    if (useDatetime && timestamps.length > 0) {
      const startTime = timestamps[0].getTime();
      
      emotionRows.forEach((row, index) => {
        if (timestamps[index]) {
          const currentTime = timestamps[index].getTime();
          const secondsFromStart = (currentTime - startTime) / 1000;

          result.push({
            unix_time: row.unix_time || '',
            emotion: row.emotion,
            confidence: confidenceIsDecimal ? parseFloat(row.confidence) * 100 : parseFloat(row.confidence),
            datetime: row.datetime || '',
            video_timestamp: secondsFromStart
          });
        }
      });
      
    } else {
      const unixTimestamps = emotionRows
        .map(row => {
          try {
            return Number(row.unix_time);
          } catch (e) {
            return null;
          }
        })
        .filter((t): t is number => t !== null && !isNaN(t));

      if (unixTimestamps.length > 0) {
        const startTime = unixTimestamps[0];
        const uniqueUnixTimes = new Set(unixTimestamps.slice(0, 100).map(t => t.toFixed(0))).size;
        const allSame = uniqueUnixTimes === 1;

        emotionRows.forEach((row, index) => {
          if (unixTimestamps[index]) {
            let secondsFromStart;
            
            if (allSame) {
              secondsFromStart = index / 60.0;
            } else {
              const currentTime = unixTimestamps[index];
              secondsFromStart = (currentTime - startTime) / 1000;
            }

            result.push({
              unix_time: row.unix_time || '',
              emotion: row.emotion,
              confidence: confidenceIsDecimal ? parseFloat(row.confidence) * 100 : parseFloat(row.confidence),
              datetime: row.datetime || '',
              video_timestamp: secondsFromStart
            });
          }
        });
      }
    }

    return result;
  };

  const processEmotionMarkers = (emotionDataWithTimestamps: EmotionDataPoint[]) => {
    if (emotionDataWithTimestamps.length === 0) {
      setAllEmotionMarkers([]);
      setEmotionsToShow([]);
      return;
    }

    const MIN_TIME_GAP = 5;
    const MIN_CONFIDENCE = 70;
    const MIN_DURATION = 2;

    let lastEmotion = '';
    let lastMarkerTime = -MIN_TIME_GAP;
    let emotionStartTime = 0;
    const emotionMarkers: TimelineMarker[] = [];

    emotionDataWithTimestamps.forEach((point) => {
      const currentEmotion = point.emotion;
      const timestamp = point.video_timestamp;
      const confidence = point.confidence;

      if (timestamp - lastMarkerTime < MIN_TIME_GAP) {
        return;
      }

      if (currentEmotion !== lastEmotion) {
        if (
          confidence >= MIN_CONFIDENCE &&
          (timestamp - emotionStartTime) >= MIN_DURATION &&
          lastEmotion !== ''
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
          }
        }

        lastEmotion = currentEmotion;
        emotionStartTime = timestamp;
      }
    });

    if (lastEmotion !== '' && emotionDataWithTimestamps.length > 0) {
      const lastTimestamp = emotionDataWithTimestamps[emotionDataWithTimestamps.length - 1].video_timestamp;
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
        const emotion = (marker.label || '').split(' ')[0] || 'Unknown';
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      });

      const topEmotions = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([emotion]) => emotion);

      setEmotionsToShow(topEmotions);
    } else {
      setEmotionsToShow(Object.keys(EMOTION_CONFIG));
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFeedbackClick = (feedback: CoachFeedback) => {
    setSelectedFeedback(feedback);
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = feedback.timestamp;
      videoElement.play();
    }
  };

  const runReactionInference = async () => {
    if (!matchFilename) {
      return;
    }

    setReactionRunning(true);
    try {
      const dataDirectory = localStorage.getItem('toolkit_data_directory') || '';
      const fileBase = matchFilename.replace(/\.mp4$/, '');
      const videoPathServer = dataDirectory ? `${dataDirectory}/video/${fileBase}.mp4` : `video/${fileBase}.mp4`;

      const base = dataDirectory ? (dataDirectory.endsWith('/') ? dataDirectory.slice(0, -1) : dataDirectory) : '';
      const csvName = matchFilename.replace(/\.mp4$/, '') + '_merged.csv';
      const inputLogPathLocal = base ? `${base}/merged/${csvName}` : `merged/${matchFilename.replace(/\.mp4$/, '')}_merged.csv`;

      const payload: any = {
        video_path: videoPathServer,
        input_log_path: inputLogPathLocal,
        threshold: 0.8,
        output_csv_path: ''
      };

      const resp = await api.post('/reaction_time/run', payload);
      const reactionData = resp.data?.reaction_data || resp.data;

      const markers: TimelineMarker[] = (reactionData || []).map((r: any, idx: number) => {
        const seconds = typeof r.seconds === 'number' ? r.seconds : (r['Start Time (ms)'] ? r['Start Time (ms)'] / 1000 : 0);

        const times: number[] = [];
        const v = r['Visual Reaction Time (ms)'];
        const c = r['Click Reaction Time (ms)'];
        const g = r['Gaze Reaction Time (ms)'];
        if (v && v !== 'N/A') times.push(Number(v));
        if (c && c !== 'N/A') times.push(Number(c));
        if (g && g !== 'N/A') times.push(Number(g));

        const parts: string[] = [];
        if (v && v !== 'N/A') parts.push(`Visual ${Math.round(Number(v))}ms`);
        if (c && c !== 'N/A') parts.push(`Click ${Math.round(Number(c))}ms`);
        if (g && g !== 'N/A') parts.push(`Gaze ${Math.round(Number(g))}ms`);

        const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

        let evalIcon = '';
        let evalLabel = '';
        if (avg !== null) {
          if (avg < 180) {
            evalIcon = '🟢+';
            evalLabel = 'Fast';
          } else if (avg <= 240) {
            evalIcon = '🟡/';
            evalLabel = 'Average';
          } else {
            evalIcon = '🔴-';
            evalLabel = 'Slow';
          }
        }

        const baseLabel = parts.length ? parts.join(' | ') : `Reaction instance ${idx + 1}`;
        const label = avg !== null ? `${baseLabel} — ${evalIcon} ${avg}ms (${evalLabel})` : baseLabel;

        return {
          id: `reaction-${idx}`,
          timestamp: seconds,
          icon: '⚡',
          label,
          type: 'other'
        } as unknown as TimelineMarker;
      });

      setReactionMarkers(markers);
    } catch (err: any) {
      const serverDetail = err?.response?.data;
      console.error('Reaction inference failed:', err);
      if (serverDetail) {
        try {
          alert('Reaction inference failed: ' + JSON.stringify(serverDetail));
        } catch (e) {
          // ignore
        }
      }
    } finally {
      setReactionRunning(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'REQUEST_VIDEO_TIME') {
        const mainVideo = document.querySelector('video');
        if (mainVideo) {
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

  const handleOpenTeammateVideo = (playerName: string) => {
    const videoUrl = '/videos/sampleVidShort.mp4';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${playerName} Gameplay</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 20px;
              background: linear-gradient(to bottom right, #000, #111827, rgba(239, 68, 68, 0.1));
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              color: white;
            }
            .container { max-width: 1400px; margin: 0 auto; }
            .header { margin-bottom: 32px; }
            h1 {
              margin: 0 0 8px 0;
              font-size: 30px;
              font-weight: 900;
              background: linear-gradient(to right, #EF4444, #DC2626, #EF4444);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .subtitle { color: rgba(239, 68, 68, 0.6); font-size: 16px; font-weight: 600; }
            .sync-controls {
              background: linear-gradient(to bottom right, #0a0a0a, #000);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              display: flex;
              gap: 12px;
              align-items: center;
              flex-wrap: wrap;
            }
            .video-container {
              background: linear-gradient(to bottom right, #0a0a0a, #000);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }
            video { width: 100%; border-radius: 8px; background: #000; display: block; }
            .controls-bar {
              margin-top: 16px;
              background: linear-gradient(to bottom right, #1f1f1f, #0a0a0a);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 8px;
              padding: 16px;
            }
            .timeline-container { margin-bottom: 16px; }
            .timeline {
              width: 100%;
              height: 8px;
              background: #1f1f1f;
              border-radius: 4px;
              position: relative;
              cursor: pointer;
            }
            .timeline-progress {
              height: 100%;
              background: linear-gradient(to right, #EF4444, #DC2626);
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
              background: #EF4444;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
              cursor: pointer;
            }
            .playback-controls { display: flex; gap: 12px; align-items: center; }
            .time-display { color: rgba(239, 68, 68, 0.6); font-size: 14px; font-weight: 700; min-width: 100px; }
            .btn {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              font-weight: 900;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.3s;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3); }
            .btn-play { background: linear-gradient(to right, #EF4444, #DC2626); color: white; }
            .btn-play:hover { background: linear-gradient(to right, #F87171, #EF4444); }
            .btn-pause { background: linear-gradient(to right, #B91C1C, #991B1B); color: white; }
            .btn-pause:hover { background: linear-gradient(to right, #DC2626, #B91C1C); }
            .btn-sync { background: linear-gradient(to right, #EF4444, #DC2626); color: white; margin-left: auto; }
            .btn-sync:hover { background: linear-gradient(to right, #F87171, #EF4444); }
            .sync-status {
              padding: 6px 12px;
              background: #0a0a0a;
              border-radius: 6px;
              color: rgba(239, 68, 68, 0.6);
              font-size: 13px;
              font-weight: 700;
              border: 1px solid rgba(239, 68, 68, 0.2);
            }
            .sync-status.synced { background: #065F46; color: #10B981; border-color: #10B981; }
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

            function formatTime(seconds) {
              const mins = Math.floor(seconds / 60);
              const secs = Math.floor(seconds % 60);
              return mins + ':' + (secs < 10 ? '0' : '') + secs;
            }

            function updateTimeline() {
              const percent = (video.currentTime / video.duration) * 100;
              timelineProgress.style.width = percent + '%';
              timelineThumb.style.left = percent + '%';
            }

            video.addEventListener('timeupdate', () => {
              currentTimeDisplay.textContent = formatTime(video.currentTime);
              updateTimeline();
            });

            video.addEventListener('loadedmetadata', () => {
              durationDisplay.textContent = formatTime(video.duration);
            });

            playBtn.addEventListener('click', () => { video.play(); });
            pauseBtn.addEventListener('click', () => { video.pause(); });

            timeline.addEventListener('click', (e) => {
              const rect = timeline.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              video.currentTime = percent * video.duration;
            });

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

            document.addEventListener('mouseup', () => { isDragging = false; });

            syncBtn.addEventListener('click', () => {
              try {
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

            window.addEventListener('message', (event) => {
              if (event.data.type === 'SYNC_VIDEO_TIME') {
                const targetTime = event.data.time;
                video.currentTime = targetTime;
                video.play();
                syncStatus.textContent = 'Synced at ' + formatTime(targetTime);
                syncStatus.classList.add('synced');
                
                setTimeout(() => {
                  syncStatus.classList.remove('synced');
                  syncStatus.textContent = 'Not synced';
                }, 3000);
              }
            });

            video.addEventListener('loadeddata', () => { video.play(); });
          </script>
        </body>
      </html>
    `;

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
      <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-red-900/10 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-400 text-xl font-bold">Loading emotion data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-black via-gray-900 to-red-900/10 min-h-screen">
      <div className="mb-8">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (currentRiotId && currentRiotId !== 'Unknown') params.set('user', currentRiotId);
            if (currentPuuid) params.set('puuid', currentPuuid);
            const qs = params.toString();
            navigate(`/player/valorant-recordinglist${qs ? `?${qs}` : ''}`);
          }}
          className="flex items-center gap-2 text-red-300/60 hover:text-red-400 mb-4 transition-colors font-bold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Match List
        </button>
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-red-400 mb-2">VALORANT Feedback & Review</h2>
        <p className="text-red-300/60 font-semibold mb-2">
          Review feedback from your coaches and track your improvements.
        </p>
        <p className="text-red-400/60 text-sm font-semibold">
          Match: {matchFilename.replace(/_/g, ' ')}
        </p>
        {currentRiotId && currentRiotId !== 'Unknown' && (
          <p className="text-red-400 mt-2 font-black">
            Riot ID: {currentRiotId}
          </p>
        )}
      </div>

      <VideoPlayer
        videoUrl={videoUrl}
        markers={markers}
      />

      <div className="mt-6 bg-gradient-to-br from-gray-950 to-black border border-red-500/20 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-white">Teammates' Gameplay</h3>
          <button
            onClick={() => setShowTeammatesSection(!showTeammatesSection)}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg transition-all duration-300 font-black flex items-center gap-2 shadow-lg shadow-red-500/30"
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
                <div key={teammate.id} className="bg-gradient-to-br from-gray-900 to-black rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-black">{teammate.playerName}</h4>
                      <p className="text-red-300/60 text-sm font-semibold">View gameplay recording</p>
                    </div>
                    <button
                      onClick={() => handleOpenTeammateVideo(teammate.playerName)}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-lg transition-all duration-300 font-black shadow-lg shadow-red-500/30"
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

      {selectedFeedback && (
        <div className="mt-6 bg-red-900/20 border border-red-500/50 rounded-lg p-6 shadow-lg">
          <h4 className="text-red-400 font-black text-lg mb-3">Currently Viewing Coach Feedback</h4>
          <div className="flex items-start gap-4">
            <span className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded text-lg font-black shadow-lg">
              {formatTime(selectedFeedback.timestamp)}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-white font-black">
                  {selectedFeedback.coach_username}
                </p>
                <span className="text-red-500/30">•</span>
                <p className="text-red-300/60 text-sm font-semibold">
                  {new Date(selectedFeedback.created_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-white text-base font-medium">{selectedFeedback.feedback_text}</p>
            </div>
          </div>
        </div>
      )}

      {coachFeedbackList.length > 0 && (
        <div className="mt-6 bg-gradient-to-br from-gray-950 to-black border border-red-500/20 rounded-lg p-6 shadow-lg">
          <h3 className="text-xl font-black text-white mb-4">
            Coach Feedback ({coachFeedbackList.length})
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {coachFeedbackList.map((feedback) => (
              <div
                key={feedback.id}
                onClick={() => handleFeedbackClick(feedback)}
                className={`bg-gradient-to-br from-gray-900 to-black rounded-lg p-4 border cursor-pointer transition-all duration-300 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/20 ${selectedFeedback?.id === feedback.id
                  ? 'border-red-500/60 shadow-lg shadow-red-500/20'
                  : 'border-red-500/20'
                  }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded text-sm font-black shadow-lg">
                      {formatTime(feedback.timestamp)}
                    </span>
                    <div>
                      <p className="text-gray-300 text-sm font-bold">
                        {feedback.coach_username}
                      </p>
                      <p className="text-red-300/60 text-xs font-semibold">
                        {new Date(feedback.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white text-sm font-medium">{feedback.feedback_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-gradient-to-br from-gray-950 to-black border border-red-500/20 rounded-lg shadow-lg">
        <h3 className="text-white font-black mb-3">
          Emotion Markers Legend
          {allEmotionMarkers.length > 12 && (
            <span className="text-red-300/60 text-sm font-semibold ml-2">
              (Showing top 6 most frequent emotions)
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(EMOTION_CONFIG)
            .filter(([emotion]) => emotionsToShow.includes(emotion))
            .map(([emotion, config]) => (
              <div key={emotion} className="flex items-center gap-2 bg-gradient-to-br from-gray-900 to-black p-3 rounded border border-red-500/20">
                <span className="text-2xl">{config.icon}</span>
                <span className="text-white font-semibold">{emotion}</span>
              </div>
            ))}
        </div>
        <p className="text-red-300/60 text-sm mt-3 font-semibold">
          💡 Coaching feedback: 💬 Coach notes | Emotion markers show sustained emotional states (2s+ duration, 70%+ confidence, 5s intervals)
        </p>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-br from-gray-900 to-black border border-red-500/10 rounded-lg shadow-md">
        <h3 className="text-white font-black mb-3">Reaction Time Inference</h3>
        <p className="text-gray-300 text-sm mb-3">Run the server-side reaction time inference to generate timeline events (visual/click/gaze RTs).</p>

        <div className="mb-3">
          <p className="text-gray-400 text-sm">Model and CSV selection are automatic — the server will use the default model and the merged CSV for this match.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={runReactionInference} disabled={reactionRunning} className={`px-4 py-2 font-black rounded ${reactionRunning ? 'bg-gray-700 text-gray-400' : 'bg-red-500 text-white hover:from-red-400 hover:to-red-500'}`}>
            {reactionRunning ? 'Running…' : 'Run Reaction Inference'}
          </button>
          <div className="text-sm text-gray-300">Generated markers: {reactionMarkers.length}</div>
        </div>
      </div>
    </div>
  );
};

export default ValorantFeedbackReview;