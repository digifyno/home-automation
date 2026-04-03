import React from 'react';
import { useDevices, useRooms, useWeather } from '../hooks/useFibaro.ts';
import { categorizeDevice } from '../../shared/types.ts';
import { Thermometer, Droplets, Wind, Cloud } from 'lucide-react';

export default function Climate() {
  const { data: devices = [], isLoading } = useDevices();
  const { data: rooms = [] } = useRooms();
  const { data: weather } = useWeather();

  const thermostats = devices.filter(d => categorizeDevice(d.type) === 'thermostat');
  const tempSensors = devices.filter(d => d.type.includes('temperatureSensor') || d.type.includes('Temperature'));
  const humiditySensors = devices.filter(d => d.type.includes('humiditySensor') || d.type.includes('Humidity'));

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
        <Thermometer className="text-orange-400" size={24} />
        Climate
      </h2>

      {/* Outdoor weather */}
      {weather && (
        <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 rounded-xl p-6 border border-blue-700/30 mb-6">
          <h3 className="text-sm text-blue-300 mb-4 flex items-center gap-2">
            <Cloud size={16} />
            Outdoor
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-3xl font-bold text-white">{weather.Temperature}°C</p>
              <p className="text-sm text-blue-300 mt-1">Temperature</p>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="text-blue-400" size={20} />
              <div>
                <p className="text-xl font-bold text-white">{weather.Humidity}%</p>
                <p className="text-sm text-gray-400">Humidity</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="text-blue-400" size={20} />
              <div>
                <p className="text-xl font-bold text-white">{weather.Wind} km/h</p>
                <p className="text-sm text-gray-400">Wind</p>
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{weather.WeatherCondition}</p>
              <p className="text-sm text-gray-400">Condition</p>
            </div>
          </div>
        </div>
      )}

      {/* Thermostats */}
      {thermostats.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Thermostats</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {thermostats.map(device => {
              const room = rooms.find(r => r.id === device.roomID);
              return (
                <div key={device.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <p className="text-sm text-gray-400">{room?.name ?? 'Unknown room'}</p>
                  <p className="font-medium text-white mt-1">{device.name}</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-3xl font-bold text-orange-400">
                      {typeof device.properties.value === 'number' ? device.properties.value : '--'}°C
                    </span>
                    {device.properties.targetLevel !== undefined && (
                      <span className="text-sm text-gray-400 mb-1">→ {device.properties.targetLevel}°C</span>
                    )}
                  </div>
                  {device.properties.dead && (
                    <p className="text-xs text-red-400 mt-2">Offline</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Temperature sensors */}
      {tempSensors.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Temperature Sensors</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tempSensors.map(device => {
              const room = rooms.find(r => r.id === device.roomID);
              return (
                <div key={device.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400">{room?.name}</p>
                  <p className="text-sm font-medium text-white mt-1 truncate">{device.name}</p>
                  <p className="text-2xl font-bold text-blue-400 mt-2">
                    {typeof device.properties.value === 'number' ? device.properties.value : '--'}°C
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Humidity sensors - rendered to avoid unused variable warning */}
      {humiditySensors.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Humidity Sensors</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {humiditySensors.map(device => {
              const room = rooms.find(r => r.id === device.roomID);
              return (
                <div key={device.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400">{room?.name}</p>
                  <p className="text-sm font-medium text-white mt-1 truncate">{device.name}</p>
                  <p className="text-2xl font-bold text-blue-400 mt-2">
                    {typeof device.properties.value === 'number' ? device.properties.value : '--'}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {thermostats.length === 0 && tempSensors.length === 0 && (
        <div className="text-center py-12 text-gray-500">No climate devices found</div>
      )}
    </div>
  );
}
