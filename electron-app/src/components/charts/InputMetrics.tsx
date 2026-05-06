import React, { useEffect, useState } from 'react';
import api from '../../services/api';


interface InputMetricsProps {
  filename: string;
}

const InputMetrics: React.FC<InputMetricsProps> = ({ filename }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/biometrics/match/${filename}`);
        setMetrics(response.data.input_analysis);
      } catch (error) {
        console.error('Error fetching input data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filename]);

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 animate-pulse">
        <div className="h-64 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!metrics || metrics.error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <p className="text-gray-400">No input data available</p>
      </div>
    );
  }

  // Valorant ability priority order
  const valorantAbilityOrder = ['Q', 'E', 'C', 'X'];
  const weaponOrder = ['1', '2', '3', '4', '5'];

  // Separate abilities and weapons
  const abilities = valorantAbilityOrder
    .filter(key => metrics.ability_usage?.[key])
    .map(key => ({
      key: key,
      label: key === 'C' ? 'C - Ability 1' :
        key === 'Q' ? 'Q - Ability 2' :
          key === 'E' ? 'E - Signature' :
            key === 'X' ? 'X - Ultimate' : key,
      count: metrics.ability_usage[key],
      isAbility: true
    }));

  const weapons = weaponOrder
    .filter(key => metrics.ability_usage?.[key])
    .map(key => ({
      key: key,
      label: key === '1' ? '1 - Primary' :
        key === '2' ? '2 - Secondary' :
          key === '3' ? '3 - Melee' :
            key === '4' ? '4 - Spike' :
              key === '5' ? '5 - Other' : key,
      count: metrics.ability_usage[key],
      isAbility: false
    }));

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h4 className="text-white font-semibold text-lg mb-6">Input Activity Analysis</h4>

       <div className="grid grid-cols-4 gap-4 mb-6">
  {/* APM */}
  <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 group hover:border-purple-500 transition-colors">
    <p className="text-gray-400 text-xs mb-2">APM</p>
    <p className="text-3xl font-bold text-purple-400">{metrics.apm}</p>
    <p className="text-gray-500 text-xs mt-1">Actions/min</p>
    <div className="mt-2 w-full h-3 bg-gray-800 rounded-full shadow-inner">
      <div
        className="bg-gradient-to-r from-purple-500 to-purple-700 h-3 rounded-full transition-all duration-500"
        style={{ width: `${Math.min((metrics.apm / 300) * 100, 100)}%` }} // scale APM up to 300
      ></div>
    </div>
  </div>

  {/* Key Presses */}
  <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 group hover:border-green-500 transition-colors">
    <p className="text-gray-400 text-xs mb-2">Key Presses</p>
    <p className="text-2xl font-bold text-green-400">{metrics.total_key_presses.toLocaleString()}</p>
    <p className="text-gray-500 text-xs mt-1">Total</p>
    <div className="mt-2 w-full h-3 bg-gray-800 rounded-full shadow-inner">
      <div
        className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
        style={{ width: `${Math.min((metrics.total_key_presses / 2000) * 100, 100)}%` }}
      ></div>
    </div>
  </div>

  {/* Mouse Clicks */}
  <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 group hover:border-blue-500 transition-colors">
    <p className="text-gray-400 text-xs mb-2">Mouse Clicks</p>
    <p className="text-2xl font-bold text-blue-400">{metrics.total_mouse_clicks.toLocaleString()}</p>
    <p className="text-gray-500 text-xs mt-1">Total</p>
    <div className="mt-2 w-full h-3 bg-gray-800 rounded-full shadow-inner">
      <div
        className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500"
        style={{ width: `${Math.min((metrics.total_mouse_clicks / 3000) * 100, 100)}%` }}
      ></div>
    </div>
  </div>

  {/* Clicks per Minute */}
  <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 group hover:border-yellow-500 transition-colors">
    <p className="text-gray-400 text-xs mb-2">Clicks/Min</p>
    <p className="text-2xl font-bold text-yellow-400">{metrics.clicks_per_minute}</p>
    <p className="text-gray-500 text-xs mt-1">Fire rate</p>
    <div className="mt-2 w-full h-3 bg-gray-800 rounded-full shadow-inner">
      <div
        className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 rounded-full transition-all duration-500"
        style={{ width: `${Math.min((metrics.clicks_per_minute / 100) * 100, 100)}%` }}
      ></div>
    </div>
  </div>
</div>

      {/* Valorant Abilities Section */}
      {abilities.length > 0 && (
        <div className="mb-6">
  <h5 className="text-white font-semibold mb-4 flex items-center gap-2 text-lg">
    <span className="text-purple-400 animate-pulse">⚡</span>
    Valorant Abilities
  </h5>
  <div className="space-y-4">
    {abilities.map((ability) => {
      const totalAbilities = abilities.reduce((sum, a) => sum + a.count, 0);
      const percentage = totalAbilities > 0 ? (ability.count / totalAbilities) * 100 : 0;

      // Color gradient for Q/E/C, special for X
      const barColor = ability.key === 'X' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-purple-500 to-purple-700';

      return (
        <div key={ability.key} className="group">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${ability.key === 'X' ? 'text-yellow-400' : 'text-purple-400'} group-hover:scale-110 transition-transform`}>
                {ability.key}
              </span>
              <span className="text-gray-300 text-sm">{ability.label.split(' - ')[1]}</span>
            </div>
            <span className="text-gray-400 text-xs">{Math.round(percentage)}%</span>
          </div>
          <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden shadow-inner">
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

      {/* Weapon/Utility Section */}
      {weapons.length > 0 && (
        <div className="mb-6">
          <h5 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="text-blue-400">🔫</span>
            Weapons & Equipment
          </h5>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {weapons.map((weapon) => (
              <div key={weapon.key} className="bg-gray-900 p-3 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl font-bold text-blue-400">{weapon.key}</span>
                  <span className="text-white font-semibold">{weapon.count}</span>
                </div>
                <p className="text-gray-400 text-xs">{weapon.label.split(' - ')[1]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="space-y-2">
        {metrics.apm > 150 && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">
              ✅ High APM ({metrics.apm}) - Active and engaged playstyle
            </p>
          </div>
        )}

        {metrics.apm < 100 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ Low APM ({metrics.apm}) - May be too passive
            </p>
          </div>
        )}

        {/* Ultimate usage check */}
        {metrics.ability_usage?.X !== undefined && metrics.ability_usage.X < 15 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm">
              ⚠️ Low ultimate usage ({metrics.ability_usage.X} times) - Consider using ult more frequently
            </p>
          </div>
        )}

        {/* High ability usage praise */}
        {(metrics.ability_usage?.Q > 50 || metrics.ability_usage?.E > 50 || metrics.ability_usage?.C > 30) && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">
              ✅ Good utility usage - Actively using abilities (Q: {metrics.ability_usage.Q}, E: {metrics.ability_usage.E}, C: {metrics.ability_usage.C})
            </p>
          </div>
        )}

        <p className="text-gray-500 text-xs text-center mt-4">
          Match duration: ~{metrics.duration_minutes} minutes
        </p>
      </div>
    </div>
  );
};

export default InputMetrics;