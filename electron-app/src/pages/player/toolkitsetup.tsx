import React, { useState, useEffect, useRef } from 'react';
import { getUser } from '../../utils/auth';
import { toolkitAPI } from '../../services/api';
import {API_BASE_URL} from '../../services/api';
/**
 * ToolkitSetup
 * ------------
 * Page to configure the local analysis toolkit used by the Electron app.
 * Responsibilities:
 * - Load/save toolkit / OBS / Tobii paths from the server-side config
 * - Allow browsing for files via backend endpoints
 * - Auto-detect the toolkit data directory (next to main.bat)
 * - Start/stop the toolkit and auxiliary apps (OBS, Tobii)
 *
 * Notes:
 * - Persisted values are saved both in the project database (toolkitAPI)
 *   and in localStorage for backwards compatibility with older pages.
 */
const ToolkitSetup: React.FC = () => {
  // Existing state
  const [obsInstalled, setObsInstalled] = useState(true);
  const [setupComplete, setSetupComplete] = useState(true);
  const [toolkitRunning, setToolkitRunning] = useState(false);
  const [obsConnected, setObsConnected] = useState(true);
  const user = getUser();
  const [gameDetected, setGameDetected] = useState('Not Selected');
  const [sessionTime, setSessionTime] = useState(0);
  const [recording, setRecording] = useState('Standby');

  // Toolkit STATE
  const [toolkitPath, setToolkitPath] = useState<string>('');
  const [fullToolkitPath, setFullToolkitPath] = useState<string>('');
  const [pathError, setPathError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // OBS STATE
  const [obsPath, setObsPath] = useState<string>('');
  const [fullObsPath, setFullObsPath] = useState<string>('');
  const [obsError, setObsError] = useState<string>('');

  // TOBII STATE
  const [tobiiPath, setTobiiPath] = useState<string>('');
  const [fullTobiiPath, setFullTobiiPath] = useState<string>('');
  const [tobiiError, setTobiiError] = useState<string>('');

  // DATA DIRECTORY STATE
  const [dataDirectory, setDataDirectory] = useState<string>('');
  const [fullDataDirectory, setFullDataDirectory] = useState<string>('');
  const [dataError, setDataError] = useState<string>('');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load toolkit configuration from database on mount
  // This reads any previously saved paths and sets local and persisted
  // state so other pages can immediately find the data directory.
  useEffect(() => {
    const loadToolkitConfig = async () => {
      try {
        const config = await toolkitAPI.getConfig();

        if (config.toolkit_path) {
          setFullToolkitPath(config.toolkit_path);
          const fileName = config.toolkit_path.split('\\').pop() || config.toolkit_path.split('/').pop() || '';
          setToolkitPath(fileName);
        }

        if (config.obs_path) {
          setFullObsPath(config.obs_path);
          const fileName = config.obs_path.split('\\').pop() || config.obs_path.split('/').pop() || '';
          setObsPath(fileName);
        }

        if (config.tobii_path) {
          setFullTobiiPath(config.tobii_path);
          const fileName = config.tobii_path.split('\\').pop() || config.tobii_path.split('/').pop() || '';
          setTobiiPath(fileName);
        }

        if (config.data_directory) {
          setFullDataDirectory(config.data_directory);
          const folderName = config.data_directory.split('\\').pop() || config.data_directory.split('/').pop() || '';
          setDataDirectory(folderName);
          // Also keep it in localStorage for backwards compatibility
          localStorage.setItem('toolkit_data_directory', config.data_directory);
        }
      } catch (error: any) {
        // If config doesn't exist (404), that's fine - user hasn't set it up yet
        if (error.response?.status !== 404) {
          console.error('Error loading toolkit config:', error);
        }
      }
    };

    if (user) {
      loadToolkitConfig();
    }
  }, [user]);

  // Persist configuration to the server-side DB via toolkitAPI
  // This keeps a canonical record of user configuration across sessions.
  const saveConfigToDatabase = async (updates: {
    toolkit_path?: string;
    obs_path?: string;
    tobii_path?: string;
    data_directory?: string;
  }) => {
    try {
      await toolkitAPI.saveConfig(updates);
    } catch (error) {
      console.error('Error saving toolkit config:', error);
    }
  };

  // Open file selection for the toolkit main file (via backend file dialog)
  const handleBrowseClick = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/toolkit/select-file`);
      const data = await response.json();

      if (data.success && data.filePath) {
        setFullToolkitPath(data.filePath);
        const fileName = data.filePath.split('\\').pop() || data.filePath.split('/').pop() || '';
        setToolkitPath(fileName);
        setPathError('');

        // Save to database
        await saveConfigToDatabase({ toolkit_path: data.filePath });
      } else if (!data.success && data.message) {
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
      setPathError('Could not open file dialog. Make sure the backend server is running.');
    }
  };

  // Launch the Tobii Eye Tracker Manager for manual recalibration
  // Backend will attempt to open the provided Tobii path.
  const handleRecalibrate = async () => {
    if (!fullTobiiPath) {
      setTobiiError('Please set Tobii Eye Tracker Manager path first');
      return;
    }

    try {
      const tobiiResponse = await fetch(`${API_BASE_URL}/api/toolkit/start-tobii`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tobiiPath: fullTobiiPath }),
      });
      const tobiiData = await tobiiResponse.json();

      if (tobiiResponse.ok) {
        setTobiiError('');
        // Optional: show success message
      } else {
        setTobiiError(tobiiData.detail || 'Failed to open Tobii Eye Tracker Manager');
      }
    } catch (error) {
      console.error('Error opening Tobii for recalibration:', error);
      setTobiiError('Could not connect to backend. Make sure FastAPI server is running on port 8000');
    }
  };

  // Browse for OBS Studio executable using backend file picker
  const handleObsBrowseClick = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/toolkit/select-obs`);
      const data = await response.json();

      if (data.success && data.filePath) {
        setFullObsPath(data.filePath);
        const fileName = data.filePath.split('\\').pop() || data.filePath.split('/').pop() || '';
        setObsPath(fileName);
        setObsError('');

        // Save to database
        await saveConfigToDatabase({ obs_path: data.filePath });
      } else if (!data.success && data.message) {
      }
    } catch (error) {
      console.error('Error opening OBS dialog:', error);
      setObsError('Could not open file dialog. Make sure the backend server is running.');
    }
  };

  // Browse for Tobii Eye Tracker Manager executable using backend picker
  const handleTobiiBrowseClick = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/toolkit/select-tobii`);
      const data = await response.json();

      if (data.success && data.filePath) {
        setFullTobiiPath(data.filePath);
        const fileName = data.filePath.split('\\').pop() || data.filePath.split('/').pop() || '';
        setTobiiPath(fileName);
        setTobiiError('');

        // Save to database
        await saveConfigToDatabase({ tobii_path: data.filePath });
      } else if (!data.success && data.message) {
      }
    } catch (error) {
      console.error('Error opening Tobii dialog:', error);
      setTobiiError('Could not open file dialog. Make sure the backend server is running.');
    }
  };

  // Support manual typing/pasting of the toolkit path (main.bat)
  // When a path is accepted we attempt to auto-detect the data directory.
  const handlePathInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value.replace(/"/g, '');
    setFullToolkitPath(path);
    if (path.endsWith('.bat')) {
      setToolkitPath(path.split('\\').pop() || path.split('/').pop() || path);
      setPathError('');

      // Save to database
      saveConfigToDatabase({ toolkit_path: path });
    }
  };

  // Handle manual path input for OBS
  const handleObsPathInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value.replace(/"/g, '');
    setFullObsPath(path);
    if (path.endsWith('.exe')) {
      setObsPath(path.split('\\').pop() || path.split('/').pop() || path);
      setObsError('');

      // Save to database
      saveConfigToDatabase({ obs_path: path });
    }
  };

  // Handle manual path input for Tobii
  const handleTobiiPathInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value.replace(/"/g, '');
    setFullTobiiPath(path);
    if (path.endsWith('.exe')) {
      setTobiiPath(path.split('\\').pop() || path.split('/').pop() || path);
      setTobiiError('');

      // Save to database
      saveConfigToDatabase({ tobii_path: path });
    }
  };

  // Start / Stop the toolkit process (and optionally OBS/Tobii) by calling
  // backend endpoints. The function toggles between start and stop.
  const handleStartToolkit = async () => {
    if (!toolkitRunning) {
      if (!fullToolkitPath) {
        setPathError('Please select the main.bat file');
        return;
      }

      setIsProcessing(true);

      try {
        // Start OBS first if path is provided
        if (fullObsPath) {
          const obsResponse = await fetch(`${API_BASE_URL}/api/toolkit/start-obs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ obsPath: fullObsPath }),
          });
          const obsData = await obsResponse.json();
          if (!obsResponse.ok) {
            console.warn('OBS start warning:', obsData.detail);
          }
        }

        // Start Tobii if path is provided
        if (fullTobiiPath) {
          const tobiiResponse = await fetch(`${API_BASE_URL}/api/toolkit/start-tobii`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tobiiPath: fullTobiiPath }),
          });
          const tobiiData = await tobiiResponse.json();
          if (!tobiiResponse.ok) {
            console.warn('Tobii start warning:', tobiiData.detail);
          }
        }

        // Then start the toolkit
        const response = await fetch(`${API_BASE_URL}/api/toolkit/start-toolkit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batPath: fullToolkitPath }),
        });

        const data = await response.json();
        setIsProcessing(false);

        if (response.ok && data.success) {
          setToolkitRunning(true);
          setPathError('');
        } else {
          setPathError(data.detail || data.error || 'Failed to start toolkit');
        }
      } catch (error) {
        setIsProcessing(false);
        setPathError('Could not connect to backend. Make sure FastAPI server is running on port 8000');
        console.error('Error:', error);
      }
    } else {
      // Stop toolkit
      try {
        await fetch(`${API_BASE_URL}/api/toolkit/stop-toolkit`, {
          method: 'POST',
        });
        setToolkitRunning(false);
      } catch (error) {
        console.error('Error stopping toolkit:', error);
      }
    }
  };

  // Select the toolkit main file and auto-detect the data directory
  // (data folder expected next to main.bat). Persists discovery to DB.
  const handleDataDirectoryBrowseClick = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/toolkit/select-file`);
      const data = await response.json();

      if (data.success && data.filePath) {
        setFullToolkitPath(data.filePath);
        const fileName = data.filePath.split('\\').pop() || data.filePath.split('/').pop() || '';
        setToolkitPath(fileName);
        setPathError('');

        // AUTO-DETECT DATA DIRECTORY
        // Get the directory containing main.bat
        const pathParts = data.filePath.split(/[\\\/]/); // Split by both \ and /
        pathParts.pop(); // Remove the filename (main.bat)
        const baseDirectory = pathParts.join('/'); // Rejoin to get directory path

        // Data folder is in the same directory as main.bat
        const dataDirectoryPath = `${baseDirectory}/data`;

        // Set data directory automatically
        setFullDataDirectory(dataDirectoryPath);
        localStorage.setItem('toolkit_data_directory', dataDirectoryPath);
        setDataDirectory('data');
        setDataError('');

        // Save both toolkit path and data directory to database
        await saveConfigToDatabase({
          toolkit_path: data.filePath,
          data_directory: dataDirectoryPath
        });


      } else if (!data.success && data.message) {
      }
    } catch (error) {
      console.error('Error opening file dialog:', error);
      setPathError('Could not open file dialog. Make sure the backend server is running.');
    }
  };

  const handleDataDirectoryInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value.replace(/"/g, '');
    setFullToolkitPath(path);
    if (path.endsWith('.bat')) {
      setToolkitPath(path.split('\\').pop() || path.split('/').pop() || path);
      setPathError('');

      // AUTO-DETECT DATA DIRECTORY for manual input too
      const pathParts = path.split(/[\\\/]/);
      pathParts.pop(); // Remove filename
      const baseDirectory = pathParts.join('/');
      const dataDirectoryPath = `${baseDirectory}/data`;

      setFullDataDirectory(dataDirectoryPath);
      localStorage.setItem('toolkit_data_directory', dataDirectoryPath);
      setDataDirectory('data');
      setDataError('');

      // Save both toolkit path and data directory to database
      saveConfigToDatabase({
        toolkit_path: path,
        data_directory: dataDirectoryPath
      });

    }
  };

  useEffect(() => {
    if (user) {
      const lastGame = localStorage.getItem(`user_${user.id}_lastGame`);

      if (lastGame === 'valorant') {
        setGameDetected('Valorant');
      } else if (lastGame === 'lol') {
        setGameDetected('League of Legends');
      } else {
        setGameDetected('Not Selected');
      }
    }
  }, [user]);

  // Existing timer logic
  useEffect(() => {
    if (toolkitRunning) {
      setRecording('Recording');
      intervalRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecording('Standby');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [toolkitRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-br from-black via-gray-900 to-yellow-900/10 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔧</span>
          <h2 className="text-sm font-bold text-yellow-300/60 uppercase tracking-wider">
            TOOLKIT SETUP
          </h2>
        </div>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 mb-2">Toolkit Setup</h1>
        <p className="text-yellow-300/60 font-semibold">Configure your game analysis toolkit</p>
      </div>

      {/* OBS Alert */}
      <div className="mb-8 bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-yellow-500/20 rounded flex items-center justify-center flex-shrink-0">
          <span className="text-yellow-500 text-xl">🖥️</span>
        </div>
        <div>
          <h3 className="text-yellow-400 font-black mb-1">OBS AND TOBII APP SUGGESTED!!</h3>
          <p className="text-yellow-300/80 text-sm font-semibold">
            Make sure OBS Studio and Tobii Pro Eye Tracker Manager is installed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* COMBINED SETUP CARD */}
          <div className="bg-gradient-to-br from-gray-950 to-black border-2 border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                  <span className="text-xl">⚙️</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">CONFIGURATION</h3>
                  <p className="text-yellow-300/60 text-sm font-semibold">Setup all required paths</p>
                </div>
              </div>
              <span className={`px-4 py-1 ${obsPath && tobiiPath && toolkitPath ? 'bg-green-500' : (obsPath || tobiiPath || toolkitPath) ? 'bg-yellow-500' : 'bg-gray-700'} text-black text-sm font-black rounded-full flex items-center gap-2`}>
                <span>{obsPath && tobiiPath && toolkitPath ? '✓' : '○'}</span>
                {obsPath && tobiiPath && toolkitPath ? 'COMPLETE' : (obsPath || tobiiPath || toolkitPath) ? 'IN PROGRESS' : 'NOT STARTED'}
              </span>
            </div>

            {/* OBS Section */}
            <div className="mb-6 pb-6 border-b border-yellow-500/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🖥️</span>
                <h4 className="text-white font-bold">OBS Studio</h4>
                <span className={`ml-auto px-3 py-0.5 ${obsPath ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-400'} text-xs font-black rounded-full`}>
                  {obsPath ? 'SET' : 'NOT SET'}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={fullObsPath}
                  onChange={handleObsPathInput}
                  placeholder="Select OBS Studio executable or paste path here"
                  className="flex-1 px-3 py-2 bg-black/50 border border-yellow-500/20 rounded text-white placeholder-gray-500 text-sm focus:border-yellow-500 focus:outline-none"
                />
                <button
                  onClick={handleObsBrowseClick}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded font-black transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm shadow-lg shadow-yellow-500/30"
                >
                  <span>📁</span> Browse
                </button>
              </div>
              {obsPath && (
                <p className="text-green-400 text-xs font-bold">✓ {obsPath}</p>
              )}
              {obsError && (
                <p className="text-red-400 text-xs font-bold">⚠ {obsError}</p>
              )}
              {!obsPath && !obsError && (
                <a href="https://obsproject.com/" target='_blank' className="text-yellow-400 text-xs hover:underline font-semibold">
                  🔗 Where to install OBS Studio?
                </a>
              )}
            </div>

            {/* Tobii Section */}
            <div className="mb-6 pb-6 border-b border-yellow-500/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">👁️</span>
                <h4 className="text-white font-bold">Tobii Eye Tracker</h4>
                <span className={`ml-auto px-3 py-0.5 ${tobiiPath ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-400'} text-xs font-black rounded-full`}>
                  {tobiiPath ? 'SET' : 'NOT SET'}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={fullTobiiPath}
                  onChange={handleTobiiPathInput}
                  placeholder="Select Tobii Eye Tracker Manager or paste path here"
                  className="flex-1 px-3 py-2 bg-black/50 border border-yellow-500/20 rounded text-white placeholder-gray-500 text-sm focus:border-yellow-500 focus:outline-none"
                />
                <button
                  onClick={handleTobiiBrowseClick}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded font-black transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm shadow-lg shadow-yellow-500/30"
                >
                  <span>📁</span> Browse
                </button>
              </div>
              {tobiiPath && (
                <p className="text-green-400 text-xs font-bold">✓ {tobiiPath}</p>
              )}
              {tobiiError && (
                <p className="text-red-400 text-xs font-bold">⚠ {tobiiError}</p>
              )}
              {!tobiiPath && !tobiiError && (
                <a href="https://www.tobii.com/products/software/applications-and-developer-kits/tobii-pro-eye-tracker-manager#downloads" target='_blank' className="text-yellow-400 text-xs hover:underline font-semibold">
                  🔗 Where to install Tobii Eye Tracker Manager?
                </a>
              )}
            </div>

            {/* Toolkit Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📁</span>
                <h4 className="text-white font-bold">Toolkit Main File</h4>
                <span className={`ml-auto px-3 py-0.5 ${toolkitPath ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-400'} text-xs font-black rounded-full`}>
                  {toolkitPath ? 'SET' : 'NOT SET'}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={fullToolkitPath}
                  onChange={handlePathInput}
                  placeholder="Select main.bat file or paste path here"
                  className="flex-1 px-3 py-2 bg-black/50 border border-yellow-500/20 rounded text-white placeholder-gray-500 text-sm focus:border-yellow-500 focus:outline-none"
                />
                <button
                  onClick={handleDataDirectoryBrowseClick}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black rounded font-black transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm shadow-lg shadow-yellow-500/30"
                >
                  <span>📁</span> Browse
                </button>
              </div>
              {toolkitPath && (
                <p className="text-green-400 text-xs font-bold">✓ {toolkitPath}</p>
              )}
              {pathError && (
                <p className="text-red-400 text-xs font-bold">⚠ {pathError}</p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${obsPath && tobiiPath && toolkitPath ? 'bg-gradient-to-r from-green-500 to-emerald-500' : (obsPath || tobiiPath || toolkitPath) ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-gray-700'} transition-all duration-300`}
                  style={{
                    width: obsPath && tobiiPath && toolkitPath ? '100%' :
                      (obsPath && tobiiPath) || (obsPath && toolkitPath) || (tobiiPath && toolkitPath) ? '66%' :
                        obsPath || tobiiPath || toolkitPath ? '33%' : '0%'
                  }}>
                </div>
              </div>
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full ${obsPath ? 'bg-green-500' : 'bg-gray-700'}`}></div>
                <div className={`w-2 h-2 rounded-full ${tobiiPath ? 'bg-green-500' : 'bg-gray-700'}`}></div>
                <div className={`w-2 h-2 rounded-full ${toolkitPath ? 'bg-green-500' : 'bg-gray-700'}`}></div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-950 to-black border-2 border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                  <span className="text-xl">▶️</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">RUNNING STATUS</h3>
                  <p className="text-yellow-300/60 text-sm font-semibold">
                    {toolkitRunning ? 'Toolkit is running' : 'Toolkit is not running'}
                  </p>
                </div>
              </div>
              <span
                className={`px-4 py-1 ${toolkitRunning ? 'bg-green-500' : 'bg-red-500'
                  } text-white text-sm font-black rounded-full flex items-center gap-2`}
              >
                <span>{toolkitRunning ? '✓' : '✗'}</span> {toolkitRunning ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>

            <div className="mb-4">
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${toolkitRunning
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gray-700'
                    } transition-all duration-300`}
                  style={{ width: toolkitRunning ? '100%' : '0%' }}
                ></div>
              </div>
              <div className="flex gap-1 mt-2">
                <div
                  className={`w-2 h-2 rounded-full ${toolkitRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-700'
                    }`}
                ></div>
                <div
                  className={`w-2 h-2 rounded-full ${toolkitRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-700'
                    }`}
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className={`w-2 h-2 rounded-full ${toolkitRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-700'
                    }`}
                  style={{ animationDelay: '0.4s' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Control Panel & Live Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <h3 className="text-white font-black text-center mb-6">CONTROL PANEL</h3>

            <div className="space-y-3">
              <button
                onClick={handleStartToolkit}
                disabled={isProcessing || (!toolkitPath && !toolkitRunning)}
                className={`w-full py-3 rounded-lg font-black tracking-wide transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${toolkitRunning
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30'
                  : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black shadow-lg shadow-yellow-500/30'
                  }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span> STARTING...
                  </span>
                ) : toolkitRunning ? (
                  'STOP TOOLKIT'
                ) : (
                  'START TOOLKIT'
                )}
              </button>

              <div className="relative group">
                <button
                  onClick={handleRecalibrate}
                  disabled={!fullTobiiPath}
                  className="w-full py-3 bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg font-black tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-500/20"
                >
                  <span>🖥️</span> RECALIBRATE
                </button>
                {!fullTobiiPath && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-950 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-yellow-500/30 shadow-lg">
                    Please set Tobii Eye Tracker Manager path first
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-950 to-black border border-yellow-500/20 rounded-xl p-6 shadow-lg">
            <h3 className="text-white font-black text-center mb-6">LIVE INFORMATION</h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-yellow-300/60 font-semibold">Status:</span>
                <span
                  className={`font-black ${toolkitRunning ? 'text-green-400' : 'text-red-400'
                    }`}
                >
                  {toolkitRunning ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-yellow-300/60 font-semibold">OBS Connection:</span>
                <span
                  className={`font-black ${obsConnected ? 'text-green-400' : 'text-red-400'
                    }`}
                >
                  {obsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-yellow-300/60 font-semibold">Recording:</span>
                <span className="text-white font-black">{recording}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-yellow-300/60 font-semibold">Game Detected:</span>
                <span className={`font-black ${gameDetected === 'Valorant' ? 'text-red-400' :
                  gameDetected === 'League of Legends' ? 'text-yellow-400' :
                    'text-gray-400'
                  }`}>
                  {gameDetected}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-yellow-300/60 font-semibold">Session Time:</span>
                <span className="text-white font-black font-mono">
                  {formatTime(sessionTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolkitSetup;