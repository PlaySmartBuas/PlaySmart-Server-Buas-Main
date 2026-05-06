import React, { useRef, useState, useEffect } from 'react';

export interface TimelineMarker {
    id: string;
    timestamp: number; // in seconds
    icon: string;
    label?: string;
    type?: 'feedback' | 'emotion' | 'other'; // Add type to distinguish marker types
    emotion?: string; // For emotion markers (e.g., 'Neutral', 'Happiness', etc.)
}

interface VideoPlayerProps {
    videoUrl: string;
    markers: TimelineMarker[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, markers }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [progress, setProgress] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [includeNeutral, setIncludeNeutral] = useState(false);
    const [emotionDisplay, setEmotionDisplay] = useState<'first10' | 'all' | 'collapsed'>('first10');

    const playbackSpeeds = [0.25, 0.5, 1, 2];

    // Filter markers based on emotion settings
    const filteredMarkers = React.useMemo(() => {
        let filtered = markers;

        // Filter out neutral emotions if not included
        if (!includeNeutral) {
            filtered = filtered.filter(m =>
                m.type !== 'emotion' || (m.emotion && m.emotion.toLowerCase() !== 'neutral')
            );
        }

        // Apply emotion display setting (only affects emotion markers)
        const emotionMarkers = filtered.filter(m => m.type === 'emotion');
        const otherMarkers = filtered.filter(m => m.type !== 'emotion');


        let result;
        if (emotionDisplay === 'collapsed') {
            // Don't show any emotion markers
            result = otherMarkers;
        } else if (emotionDisplay === 'first10') {
            // Show only first 10 emotion markers
            result = [...otherMarkers, ...emotionMarkers.slice(0, 10)];
        } else {
            // Show all markers
            result = filtered;
        }

        return result;
    }, [markers, includeNeutral, emotionDisplay]);

    // Get reaction markers for the legend (reaction inference results)
    const reactionMarkersForLegend = React.useMemo(() => {
        // Reaction markers are created with id like 'reaction-#' and currently use type 'other' and icon '⚡'
        const candidates = markers.filter(m => (m.id && m.id.toString().startsWith('reaction-')) || (m.type === 'other' && m.icon === '⚡'));
        return candidates.slice(0, 50); // limit to 50 for UI sanity
    }, [markers]);

    // Get emotion markers for the legend (respecting filters)
    const emotionMarkersForLegend = React.useMemo(() => {
        let emotionMarkers = markers.filter(m => m.type === 'emotion');

        // Apply neutral filter
        if (!includeNeutral) {
            emotionMarkers = emotionMarkers.filter(m => m.emotion && m.emotion.toLowerCase() !== 'neutral');
        }

        // Apply display mode
        if (emotionDisplay === 'collapsed') {
            return [];
        } else if (emotionDisplay === 'first10') {
            return emotionMarkers.slice(0, 10);
        } else {
            return emotionMarkers;
        }
    }, [markers, includeNeutral, emotionDisplay]);

    // Listen to video time updates
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (video.duration > 0) {
                setProgress((video.currentTime / video.duration) * 100);
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            video.playbackRate = playbackRate;
            video.volume = volume;
        };

        const handlePlay = () => setPlaying(true);
        const handlePause = () => setPlaying(false);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        if (video.readyState >= 1) {
            setDuration(video.duration);
            video.playbackRate = playbackRate;
            video.volume = volume;
        }

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
        };
    }, []);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLElement &&
                (e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'TEXTAREA')) {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    seekBy(5);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    seekBy(-5);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playing]);

    const handlePlaybackRateChange = (rate: number) => {
        setPlaybackRate(rate);
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
    };

    const seekTo = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = seconds;
        }
    };

    const seekBy = (seconds: number) => {
        if (videoRef.current) {
            const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
            videoRef.current.currentTime = newTime;
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (playing) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
        }
    };

    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (progressBarRef.current && duration > 0) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, clickX / rect.width));
            const newTime = percentage * duration;
            seekTo(newTime);
        }
    };

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || seconds === 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const [videoError, setVideoError] = useState<string | null>(null);

    const tryFallbacks = async (failedUrl: string) => {
        // Try HEAD first (lightweight). If the server disallows HEAD, we'll
        // fall back to a ranged GET. Keep logging minimal to avoid noisy
        // console output when fallbacks are expected.
        try {
            const headResp = await fetch(failedUrl, { method: 'HEAD' });
            if (headResp.ok) return failedUrl;
        } catch (err) {
            // HEAD may be blocked by some servers - continue to ranged GET
            console.debug('HEAD probe failed (expected on some servers):', failedUrl, err);
        }

        try {
            // Try a ranged request to probe server response (some servers block HEAD)
            const probe = await fetch(failedUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } });
            console.debug('Video probe response for', failedUrl, probe.status);
            if (probe.ok) return failedUrl;
        } catch (err) {
            console.debug('Probe failed for', failedUrl, err);
        }

        // If the current URL is relative, try absolute backend host on localhost:8000
        try {
            const backendHost = '';
            const candidate = failedUrl.startsWith('/') ? `${backendHost}${failedUrl}` : failedUrl;
            if (candidate !== failedUrl) {
                try {
                    const headResp2 = await fetch(candidate, { method: 'HEAD' });
                    if (headResp2.ok) return candidate;
                } catch (err) {
                    // HEAD failed, try ranged GET
                    try {
                        const probe2 = await fetch(candidate, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                        console.debug('Video probe response for fallback', candidate, probe2.status);
                        if (probe2.ok) return candidate;
                    } catch (err2) {
                        console.debug('Fallback probe failed for', candidate, err2);
                    }
                }
            }
        } catch (err) {
            console.warn('Error building fallback URL', err);
        }

        // If we still failed, try adding the user's configured data_directory
        try {
            const dataDirectory = (localStorage && localStorage.getItem) ? localStorage.getItem('toolkit_data_directory') : null;
            if (dataDirectory) {
                const sep = failedUrl.includes('?') ? '&' : '?';
                const candidateWithDataDir = `${failedUrl}${sep}data_directory=${encodeURIComponent(dataDirectory)}`;
                try {
                    const headResp3 = await fetch(candidateWithDataDir, { method: 'HEAD' });
                    if (headResp3.ok) return candidateWithDataDir;
                } catch (err) {
                    try {
                        const probe3 = await fetch(candidateWithDataDir, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                        console.debug('Video probe response for data_directory fallback', candidateWithDataDir, probe3.status);
                        if (probe3.ok) return candidateWithDataDir;
                    } catch (err3) {
                        console.debug('Data-directory fallback probe failed for', candidateWithDataDir, err3);
                    }
                }

                // Also try absolute backend host + data_directory param if failedUrl was relative
                const backendHost = '';
                const rel = failedUrl.startsWith('/') ? `${backendHost}${failedUrl}` : failedUrl;
                if (rel !== failedUrl) {
                    const sep2 = rel.includes('?') ? '&' : '?';
                    const candidateRelWithData = `${rel}${sep2}data_directory=${encodeURIComponent(dataDirectory)}`;
                    try {
                        const headResp4 = await fetch(candidateRelWithData, { method: 'HEAD' });
                        if (headResp4.ok) return candidateRelWithData;
                    } catch (err) {
                        try {
                            const probe4 = await fetch(candidateRelWithData, { method: 'GET', headers: { Range: 'bytes=0-0' } });
                            console.debug('Video probe response for rel+data_directory fallback', candidateRelWithData, probe4.status);
                            if (probe4.ok) return candidateRelWithData;
                        } catch (err4) {
                            console.debug('Rel data-directory fallback probe failed for', candidateRelWithData, err4);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Error probing data_directory fallbacks', err);
        }

        return null;
    };

    const handleVideoError = async (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        console.warn('Video error event (attempting fallbacks):', e);
        setVideoError('Unable to play video. Checking URL and attempting fallbacks...');

        const currentSrc = (e.target as HTMLVideoElement).currentSrc || videoUrl;
        const successful = await tryFallbacks(currentSrc);
        if (successful && videoRef.current) {
            videoRef.current.src = successful;
            videoRef.current.load();
            try {
                await videoRef.current.play();
            } catch (err) {
                console.warn('Autoplay prevented after fallback:', err);
            }
            setVideoError(null);
        } else {
            setVideoError('Video failed to load (404/403/CORS). Check the backend URL and CORS settings.');
        }
    };

    return (
        <div className="bg-gradient-to-br from-gray-950 to-black rounded-lg p-6 border border-yellow-500/20 shadow-lg">
            {/* Video Container */}
            <div
                className="mb-4 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-yellow-500/20"
                style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    maxHeight: '1080px'
                }}
            >
                <video
                    ref={videoRef}
                    src={videoUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        cursor: 'pointer'
                    }}
                    // Allow cross-origin requests when backend serves video from a different origin
                    crossOrigin="anonymous"
                    onError={handleVideoError}
                    onClick={togglePlay}
                />
            </div>

            {videoError && (
                <div className="mt-2 text-sm text-red-400 font-semibold">{videoError}</div>
            )}

            {/* Custom Controls */}
            <div className="space-y-4">
                {/* Time Display */}
                <div className="flex justify-between text-sm text-yellow-300/60 font-bold">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>

                {/* Progress Bar with Markers */}
                <div
                    ref={progressBarRef}
                    onClick={handleProgressBarClick}
                    className="relative w-full h-4 bg-gray-800 rounded cursor-pointer group border border-yellow-500/20"
                >
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />

                    {duration > 0 && filteredMarkers.map((marker) => {
                        const position = (marker.timestamp / duration) * 100;
                        return (
                            <button
                                key={marker.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    seekTo(marker.timestamp);
                                }}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 
                           text-2xl hover:scale-150 transition-transform 
                           cursor-pointer z-10"
                                style={{
                                    left: `${position}%`,
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                                }}
                                title={`${marker.label} (${formatTime(marker.timestamp)})`}
                            >
                                {marker.icon}
                            </button>
                        );
                    })}

                    <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full bg-yellow-500/10 rounded" />
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                        <button
                            onClick={togglePlay}
                            className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded-lg transition-all duration-300 font-black shadow-lg shadow-yellow-500/30"
                        >
                            {playing ? '⏸ Pause' : '▶ Play'}
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-yellow-300/60 text-sm font-bold">Speed:</span>
                            <div className="flex gap-1">
                                {playbackSpeeds.map((speed) => (
                                    <button
                                        key={speed}
                                        onClick={() => handlePlaybackRateChange(speed)}
                                        className={`px-3 py-2 rounded transition-all duration-300 text-sm font-black ${playbackRate === speed
                                            ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
                                            : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-300 hover:text-yellow-400 border border-yellow-500/20'
                                            }`}
                                    >
                                        {speed}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-yellow-300/60 text-sm font-bold">🔊</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="w-24 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                            <span className="text-yellow-300/60 text-sm w-10 font-bold">
                                {Math.round(volume * 100)}%
                            </span>
                        </div>
                    </div>

                    {/* Emotion Display Controls - Right Side */}
                    {markers.filter(m => m.type === 'emotion').length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-yellow-300/60 text-sm font-bold">Emotions:</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setEmotionDisplay('first10')}
                                    className={`px-3 py-2 rounded transition-all duration-300 text-sm font-black ${emotionDisplay === 'first10'
                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
                                        : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-300 hover:text-yellow-400 border border-yellow-500/20'
                                        }`}
                                >
                                    First 10
                                </button>
                                <button
                                    onClick={() => setEmotionDisplay('all')}
                                    className={`px-3 py-2 rounded transition-all duration-300 text-sm font-black ${emotionDisplay === 'all'
                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
                                        : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-300 hover:text-yellow-400 border border-yellow-500/20'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setEmotionDisplay('collapsed')}
                                    className={`px-3 py-2 rounded transition-all duration-300 text-sm font-black ${emotionDisplay === 'collapsed'
                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30'
                                        : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-300 hover:text-yellow-400 border border-yellow-500/20'
                                        }`}
                                >
                                    Hide
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Keyboard Hints and Neutral Toggle */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-xs text-yellow-300/60 font-semibold">
                        <kbd className="px-2 py-1 bg-gray-800 rounded border border-yellow-500/20">Space</kbd> Play/Pause •
                        <kbd className="px-2 py-1 bg-gray-800 rounded ml-2 border border-yellow-500/20">←</kbd> -5s •
                        <kbd className="px-2 py-1 bg-gray-800 rounded border border-yellow-500/20">→</kbd> +5s
                    </div>

                    {/* Neutral Emotion Toggle */}
                    {markers.filter(m => m.type === 'emotion').length > 0 && emotionDisplay !== 'collapsed' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeNeutral}
                                onChange={(e) => setIncludeNeutral(e.target.checked)}
                                className="w-4 h-4 text-yellow-500 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500 focus:ring-2"
                            />
                            <span className="text-gray-300 text-sm font-semibold">Show Neutral emotions</span>
                        </label>
                    )}
                </div>

                {/* Marker Legend */}
                {emotionMarkersForLegend.length > 0 && (
                    <div className="border-t border-yellow-500/20 pt-4">
                        <h3 className="text-white font-black mb-3">Emotion Markers</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {emotionMarkersForLegend.map((marker) => (
                                <button
                                    key={marker.id}
                                    onClick={() => seekTo(marker.timestamp)}
                                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-gray-900 to-black 
                           hover:border-yellow-500/40 rounded transition-all duration-300 text-left border border-yellow-500/20"
                                >
                                    <span className="text-xl">{marker.icon}</span>
                                    <div>
                                        <p className="text-white text-sm font-bold">{marker.label}</p>
                                        <p className="text-yellow-300/60 text-xs font-semibold">
                                            {formatTime(marker.timestamp)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {/* Reaction Markers Legend */}
                {reactionMarkersForLegend.length > 0 && (
                    <div className="border-t border-yellow-500/20 pt-4 mt-4">
                        <h3 className="text-white font-black mb-3">Reaction Markers</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {reactionMarkersForLegend.map((marker) => (
                                <button
                                    key={marker.id}
                                    onClick={() => seekTo(marker.timestamp)}
                                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-gray-900 to-black 
                           hover:border-yellow-500/40 rounded transition-all duration-300 text-left border border-yellow-500/20"
                                >
                                    <span className="text-xl">{marker.icon}</span>
                                    <div>
                                        <p className="text-white text-sm font-bold">{marker.label}</p>
                                        <p className="text-yellow-300/60 text-xs font-semibold">
                                            {formatTime(marker.timestamp)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoPlayer;