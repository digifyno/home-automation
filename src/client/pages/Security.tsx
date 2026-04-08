import React from 'react';
import { useDevices, useRooms } from '../hooks/useFibaro.ts';
import { categorizeDevice, isDeviceOn } from '../../shared/types.ts';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';

export default function Security() {
  const { data: devices = [], isLoading, isError } = useDevices();
  const { data: rooms = [] } = useRooms();

  const safetyDevices = devices.filter(d => {
    const cat = categorizeDevice(d.type);
    return cat === 'safety' || cat === 'sensor';
  });

  const alerts = safetyDevices.filter(d => isDeviceOn(d));
  const tampered = safetyDevices.filter(d => d.properties.tampered);

  if (isLoading) {
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
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <Shield className="text-green-400" size={24} />
        Security
      </h2>

      {/* Status overview */}
      <div className={`rounded-xl p-5 border mb-6 ${
        alerts.length > 0 || tampered.length > 0
          ? 'bg-red-900/30 border-red-500/50'
          : 'bg-green-900/20 border-green-500/30'
      }`}>
        <div className="flex items-center gap-3">
          {alerts.length === 0 && tampered.length === 0 ? (
            <>
              <CheckCircle className="text-green-400" size={24} />
              <div>
                <p className="font-semibold text-green-300">All Clear</p>
                <p className="text-sm text-green-400">{safetyDevices.length} sensors monitored</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="text-red-400" size={24} />
              <div>
                <p className="font-semibold text-red-300">
                  {alerts.length} alert{alerts.length !== 1 ? 's' : ''} active
                </p>
                {tampered.length > 0 && (
                  <p className="text-sm text-red-400">{tampered.length} sensor{tampered.length !== 1 ? 's' : ''} tampered</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Device list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {safetyDevices.map(device => {
          const room = rooms.find(r => r.id === device.roomID);
          const triggered = isDeviceOn(device);
          return (
            <div
              key={device.id}
              className={`bg-gray-800 rounded-xl p-4 border ${
                triggered ? 'border-red-500/50' : device.properties.dead ? 'border-gray-600 opacity-60' : 'border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400">{room?.name}</p>
                  <p className="font-medium text-white mt-0.5">{device.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{device.type}</p>
                </div>
                <div className={`p-1.5 rounded-full ${triggered ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                  {triggered
                    ? <AlertTriangle size={16} className="text-red-400" />
                    : <CheckCircle size={16} className="text-green-400" />
                  }
                </div>
              </div>
              {device.properties.batteryLevel !== undefined && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Battery</span>
                    <span>{device.properties.batteryLevel}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={device.properties.batteryLevel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Battery level"
                    className="h-1.5 bg-gray-700 rounded-full overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        device.properties.batteryLevel > 50 ? 'bg-green-500' :
                        device.properties.batteryLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${device.properties.batteryLevel}%` }}
                    />
                  </div>
                </div>
              )}
              {device.properties.dead && (
                <p className="text-xs text-red-400 mt-2">Device offline</p>
              )}
              {device.properties.tampered && (
                <p className="text-xs text-yellow-400 mt-2">Tampered!</p>
              )}
            </div>
          );
        })}
      </div>

      {safetyDevices.length === 0 && (
        <div className="text-center py-12 text-gray-500">No security sensors found</div>
      )}
    </div>
  );
}
