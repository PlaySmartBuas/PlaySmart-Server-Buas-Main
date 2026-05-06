import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface GazeMetricsProps {
  filename: string;
}

const GazeMetrics: React.FC<GazeMetricsProps> = ({ filename }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/biometrics/match/${filename}`);
        setMetrics(response.data.gaze_analysis);
      } catch (error) {
        console.error('Error fetching gaze data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filename]);

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 animate-pulse">
        <div className="h-48 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!metrics || metrics.error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <p className="text-gray-400">No gaze data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h4 className="text-white font-semibold text-lg mb-6">Eye Tracking Metrics</h4>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Screen Coverage */}
        <div className="bg-gray-900 p-4 rounded-lg text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-blue-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">👁️</span>
          </div>
          <p className="text-gray-400 text-xs mb-2">Screen Coverage</p>
          <p className="text-3xl font-bold text-white mb-1">
            {metrics.screen_coverage_percentage}%
          </p>
          <p className="text-gray-500 text-xs">Area scanned</p>
        </div>

        {/* Minimap Checks */}
        <div className="bg-gray-900 p-4 rounded-lg text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-purple-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🗺️</span>
          </div>
          <p className="text-gray-400 text-xs mb-2">Minimap Checks</p>
          <p className="text-3xl font-bold text-white mb-1">
            {metrics.minimap_checks_per_minute}
          </p>
          <p className="text-gray-500 text-xs">per minute</p>
        </div>

        {/* Center Focus */}
        <div className="bg-gray-900 p-4 rounded-lg text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-gray-400 text-xs mb-2">Center Focus</p>
          <p className="text-3xl font-bold text-white mb-1">
            {metrics.center_focus_percentage}%
          </p>
          <p className="text-gray-500 text-xs">Crosshair area</p>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-4 space-y-2">
        {metrics.screen_coverage_percentage > 65 && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">
              ✅ Good screen coverage ({metrics.screen_coverage_percentage}%) - Strong peripheral awareness
            </p>
          </div>
        )}
        
        {metrics.minimap_checks_per_minute < 5 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ Low minimap checks ({metrics.minimap_checks_per_minute}/min) - Aim for 6-8/min
            </p>
          </div>
        )}

        {metrics.center_focus_percentage > 55 && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              💡 High crosshair focus ({metrics.center_focus_percentage}%) - Good aim discipline
            </p>
          </div>
        )}
      </div>

      <p className="text-gray-500 text-xs mt-4 text-center">
        Based on {metrics.total_gaze_points.toLocaleString()} gaze data points
      </p>
    </div>
  );
};

export default GazeMetrics;