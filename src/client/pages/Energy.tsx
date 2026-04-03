import React from 'react';
import { useDevices, useRooms } from '../hooks/useFibaro.ts';
import { categorizeDevice } from '../../shared/types.ts';
import { Zap } from 'lucide-react';

export default function Energy() {
  const { data: devices = [], isLoading } = useDevices();
  const { data: rooms = [] } = useRooms();

  const powerDevices = devices.filter(d => d.properties.power !== undefined && d.properties.power > 0);
  const energyMeters = devices.filter(d => categorizeDevice(d.type) === 'energy');
  const totalPower = powerDevices.reduce((sum, d) => sum + (d.properties.power ?? 0), 0);

  // Top consumers sorted
  const sorted = [...powerDevices].sort((a, b) => (b.properties.power ?? 0) - (a.properties.power ?? 0));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <Zap className="text-green-400" size={24} />
        Energy
      </h2>

      {/* Total power card */}
      <div className="bg-gradient-to-br from-green-900/30 to-green-800/10 border border-green-700/30 rounded-xl p-6 mb-6">
        <p className="text-sm text-green-300 mb-1">Total Consumption</p>
        <p className="text-4xl font-bold text-white">{totalPower.toFixed(0)} <span className="text-xl text-gray-400">W</span></p>
        <p className="text-sm text-gray-400 mt-1">{powerDevices.length} active devices</p>
      </div>

      {/* Top consumers */}
      {sorted.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Active Consumers</h3>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {sorted.map((device, i) => {
              const room = rooms.find(r => r.id === device.roomID);
              const power = device.properties.power ?? 0;
              const pct = totalPower > 0 ? (power / totalPower) * 100 : 0;
              return (
                <div key={device.id} className={`p-4 ${i < sorted.length - 1 ? 'border-b border-gray-700' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-white text-sm">{device.name}</p>
                      <p className="text-xs text-gray-400">{room?.name}</p>
                    </div>
                    <span className="text-green-400 font-medium">{power.toFixed(1)} W</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Energy meters */}
      {energyMeters.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Energy Meters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {energyMeters.map(device => {
              const room = rooms.find(r => r.id === device.roomID);
              return (
                <div key={device.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <p className="text-xs text-gray-400">{room?.name}</p>
                  <p className="font-medium text-white mt-1">{device.name}</p>
                  <div className="mt-3 flex gap-4">
                    {device.properties.power !== undefined && (
                      <div>
                        <p className="text-2xl font-bold text-green-400">{device.properties.power.toFixed(1)}</p>
                        <p className="text-xs text-gray-400">Watts</p>
                      </div>
                    )}
                    {device.properties.energy !== undefined && (
                      <div>
                        <p className="text-2xl font-bold text-blue-400">{device.properties.energy.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">kWh</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {powerDevices.length === 0 && energyMeters.length === 0 && (
        <div className="text-center py-12 text-gray-500">No energy data available</div>
      )}
    </div>
  );
}
