import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'; // `npm install recharts` [if import shows error{remember to be in electron-app directory}]
import api from '../../services/api';

interface WASDChartProps {
  filename: string;
}

const WASDChart: React.FC<WASDChartProps> = ({ filename }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPresses, setTotalPresses] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/biometrics/match/${filename}`);
        const inputData = response.data.input_analysis;
        const wasd = inputData.wasd_distribution;
        
        const chartData = [
          { key: 'W (Forward)', count: wasd.W.count, percentage: wasd.W.percentage, color: '#3B82F6' },
          { key: 'A (Left)', count: wasd.A.count, percentage: wasd.A.percentage, color: '#8B5CF6' },
          { key: 'D (Right)', count: wasd.D.count, percentage: wasd.D.percentage, color: '#8B5CF6' },
          { key: 'S (Back)', count: wasd.S.count, percentage: wasd.S.percentage, color: '#FBBF24' },
        ];
        
        const total = wasd.W.count + wasd.A.count + wasd.S.count + wasd.D.count;
        
        setData(chartData);
        setTotalPresses(total);
      } catch (error) {
        console.error('Error fetching WASD data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filename]);

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 animate-pulse">
        <div className="h-80 bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-white font-semibold text-lg">Movement Pattern (WASD)</h4>
          <p className="text-gray-400 text-sm">Keyboard input distribution</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Total Presses</p>
          <p className="text-2xl font-bold text-white">{totalPresses.toLocaleString()}</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="key" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '0.5rem'
            }}
            formatter={(value: any, name: string) => {
              if (name === 'percentage') return `${value}%`;
              return value;
            }}
          />
          <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.key} className="bg-gray-900 p-3 rounded text-center">
            <p className="text-gray-400 text-xs mb-1">{item.key}</p>
            <p className="text-white font-bold">{item.count.toLocaleString()}</p>
            <p className="text-gray-500 text-xs">{item.percentage}%</p>
          </div>
        ))}
      </div>

      {data.find(d => d.key === 'W (Forward)')?.percentage > 35 && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ W-key dominant ({data.find(d => d.key === 'W (Forward)')?.percentage}%) - Aggressive playstyle
          </p>
        </div>
      )}

      {Math.abs((data.find(d => d.key === 'A (Left)')?.percentage || 0) - 
                (data.find(d => d.key === 'D (Right)')?.percentage || 0)) < 5 && (
        <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400 text-sm">
            ✅ Balanced strafing (A/D equal) - Good movement mechanics
          </p>
        </div>
      )}
    </div>
  );
};

export default WASDChart;