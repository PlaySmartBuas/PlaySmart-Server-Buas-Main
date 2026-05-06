import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'; // `npm install recharts` [if import shows error{remember to be in electron-app directory}]
import api from '../../services/api';
interface EmotionPieChartProps {
  filename: string;
}

const EmotionPieChart: React.FC<EmotionPieChartProps> = ({ filename }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dominantEmotion, setDominantEmotion] = useState('Unknown');
  const [dominantPercentage, setDominantPercentage] = useState(0);

  // State to toggle visibility of each emotion
  const [includedEmotions, setIncludedEmotions] = useState<Record<string, boolean>>({
    Neutral: true,
    Happiness: true,
    Anger: true,
    Sadness: true,
    Surprise: true,
    Disgust: true,
    Fear: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/biometrics/match/${filename}`);
        const emotionData = response.data.emotion_analysis;

        setData(emotionData.chart_data || []);
        setDominantEmotion(emotionData.dominant_emotion);
        setDominantPercentage(emotionData.dominant_percentage);
      } catch (error) {
        console.error('Error fetching emotion data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filename]);

  const COLORS = {
    Neutral: '#60A5FA',
    Happiness: '#34D399',
    Anger: '#EF4444',
    Sadness: '#A78BFA',
    Surprise: '#FBBF24',
    Disgust: '#F97316',
    Fear: '#9CA3AF'
  };

  const getColor = (name: string) => COLORS[name as keyof typeof COLORS] || '#6B7280';

  // Filter data based on includedEmotions state
  const filteredData = data.filter((d) => includedEmotions[d.name] && d.value > 0);

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 animate-pulse">
        <div className="h-80 bg-gray-700 rounded"></div>
      </div>
    );
  }

  const toggleEmotion = (name: string) => {
    setIncludedEmotions((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-white font-semibold text-lg">Emotion Distribution</h4>
          <p className="text-gray-400 text-sm">During gameplay session</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Dominant</p>
          <p className="text-xl font-bold" style={{ color: getColor(dominantEmotion) }}>
            {dominantEmotion}
          </p>
          <p className="text-gray-500 text-xs">{dominantPercentage}%</p>
        </div>
      </div>

      {/* ✅ Toggle buttons for every emotion */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.keys(COLORS).map((emotion) => (
          <label key={emotion} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includedEmotions[emotion]}
              onChange={() => toggleEmotion(emotion)}
              className="accent-blue-500 cursor-pointer"
            />
            <span className="text-gray-300 text-sm">{emotion}</span>
          </label>
        ))}
      </div>

      {/* Pie Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {filteredData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Insight Message */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-400 text-sm">
          💡 Player maintains {dominantEmotion.toLowerCase()} state {dominantPercentage}% of the time — 
          {dominantPercentage > 80 ? ' Excellent emotional control' : ' Good consistency'}
        </p>
      </div>
    </div>
  );
};

export default EmotionPieChart;