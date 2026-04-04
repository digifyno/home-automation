import React, { useMemo } from 'react';
import { useDevices, useRooms, useWeather, useScenes } from '../hooks/useFibaro.ts';
import { categorizeDevice } from '../../shared/types.ts';
import { Lightbulb, Thermometer, Shield, Cloud, PlayCircle, AlertTriangle, Zap } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ icon, label, value, sub, color = 'text-blue-400' }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${color}`}>{icon}</div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: devices = [], isLoading: loadingDevices, isError } = useDevices();
  const { data: rooms = [] } = useRooms();
  const { data: weather } = useWeather();
  const { data: scenes = [] } = useScenes();

  const stats = useMemo(() => {
    const categories = devices.map(d => ({ device: d, cat: categorizeDevice(d.type) }));
    const lights = categories.filter(({ cat }) => cat === 'light' || cat === 'dimmer');
    const lightsOn = lights.filter(({ device: d }) => d.properties.value === true || d.properties.value === 1).length;
    const totalLights = lights.length;
    const safetyAlerts = categories.filter(({ cat, device: d }) =>
      cat === 'safety' && (d.properties.value === true || d.properties.value === 1)
    ).length;
    const offlineDevices = devices.filter(d => d.properties.dead).length;
    const totalPower = devices.reduce((sum, d) => sum + (d.properties.power ?? 0), 0);
    const thermostats = categories.filter(({ cat }) => cat === 'thermostat').map(({ device }) => device);
    const avgTemp = thermostats.length > 0
      ? (thermostats.reduce((s, d) => s + (typeof d.properties.value === 'number' ? d.properties.value : 0), 0) / thermostats.length).toFixed(1)
      : '--';
    return { lightsOn, totalLights, safetyAlerts, offlineDevices, totalPower, thermostats, avgTemp };
  }, [devices]);

  const { lightsOn, totalLights, safetyAlerts, offlineDevices, totalPower, thermostats, avgTemp } = stats;

  const roomStats = useMemo(() =>
    rooms.map(room => {
      const roomDevices = devices.filter(d => d.roomID === room.id);
      const roomLightsOn = roomDevices.filter(d => {
        const cat = categorizeDevice(d.type);
        return (cat === 'light' || cat === 'dimmer') && (d.properties.value === true || d.properties.value === 1);
      }).length;
      const roomTemp = roomDevices.find(d => categorizeDevice(d.type) === 'thermostat');
      return { room, roomDevices, roomLightsOn, roomTemp };
    }),
  [rooms, devices]);

  if (loadingDevices) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="text-red-400" size={32} />
        <p className="text-red-400 font-medium">Failed to load devices</p>
        <p className="text-gray-500 text-sm">Check that Fibaro HC3 is reachable</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">{rooms.length} rooms · {devices.length} devices</p>
      </div>

      {safetyAlerts > 0 && (
        <div className="mb-6 bg-red-900/30 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-400" size={20} />
          <div>
            <p className="text-red-300 font-medium">Safety Alert</p>
            <p className="text-red-400 text-sm">{safetyAlerts} safety sensor{safetyAlerts > 1 ? 's' : ''} triggered</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Lightbulb size={20} />}
          label="Lights On"
          value={`${lightsOn}/${totalLights}`}
          sub="devices active"
          color="text-yellow-400"
        />
        {weather && (
          <StatCard
            icon={<Cloud size={20} />}
            label="Temperature"
            value={`${weather.Temperature}°C`}
            sub={weather.WeatherCondition}
            color="text-blue-400"
          />
        )}
        <StatCard
          icon={<Thermometer size={20} />}
          label="Avg Indoor"
          value={`${avgTemp}°C`}
          sub={`${thermostats.length} thermostats`}
          color="text-orange-400"
        />
        <StatCard
          icon={<Zap size={20} />}
          label="Power Usage"
          value={`${totalPower.toFixed(0)}W`}
          sub="current consumption"
          color="text-green-400"
        />
        <StatCard
          icon={<Shield size={20} />}
          label="Safety"
          value={safetyAlerts === 0 ? 'OK' : `${safetyAlerts} alerts`}
          sub="security sensors"
          color={safetyAlerts > 0 ? 'text-red-400' : 'text-green-400'}
        />
        <StatCard
          icon={<PlayCircle size={20} />}
          label="Scenes"
          value={scenes.length}
          sub="available"
          color="text-purple-400"
        />
        {offlineDevices > 0 && (
          <StatCard
            icon={<AlertTriangle size={20} />}
            label="Offline"
            value={offlineDevices}
            sub="devices unreachable"
            color="text-red-400"
          />
        )}
      </div>

      {/* Rooms overview */}
      <h3 className="text-lg font-semibold text-white mb-4">Rooms</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roomStats.map(({ room, roomDevices, roomLightsOn, roomTemp }) => (
            <div key={room.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-white">{room.name}</h4>
                <span className="text-xs text-gray-400">{roomDevices.length} devices</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {roomLightsOn > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Lightbulb size={14} />
                    {roomLightsOn} on
                  </span>
                )}
                {roomTemp && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <Thermometer size={14} />
                    {typeof roomTemp.properties.value === 'number' ? `${roomTemp.properties.value}°C` : '--'}
                  </span>
                )}
                {roomDevices.every(d => !d.properties.dead) ? (
                  <span className="text-green-400 text-xs">All online</span>
                ) : (
                  <span className="text-red-400 text-xs">{roomDevices.filter(d => d.properties.dead).length} offline</span>
                )}
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}
