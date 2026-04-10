import React, { useState } from 'react';
import { useDevices, useRooms, useDeviceAction } from '../hooks/useFibaro.ts';
import { categorizeDevice, isDeviceOn } from '../../shared/types.ts';
import DeviceCard from '../components/DeviceCard.tsx';
import { Lightbulb, AlertTriangle } from 'lucide-react';

export default function Lights() {
  const { data: devices = [], isLoading, isError } = useDevices();
  const { data: rooms = [] } = useRooms();
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const action = useDeviceAction();
  const [pendingOff, setPendingOff] = useState(false);
  const [offError, setOffError] = useState(false);

  const lightDevices = devices.filter(d => {
    const cat = categorizeDevice(d.type);
    return cat === 'light' || cat === 'dimmer';
  });

  const filtered = selectedRoom
    ? lightDevices.filter(d => d.roomID === selectedRoom)
    : lightDevices;

  const lightsOnCount = lightDevices.filter(d => isDeviceOn(d)).length;
  const filteredOnCount = filtered.filter(d => isDeviceOn(d)).length;

  const turnAllOff = () => {
    const onDevices = filtered.filter(d => isDeviceOn(d));
    if (onDevices.length === 0) return;
    setPendingOff(true);
    setOffError(false);
    let remaining = onDevices.length;
    onDevices.forEach(d =>
      action.mutate({ id: d.id, action: 'turnOff' }, {
        onError: () => setOffError(true),
        onSettled: () => {
          remaining--;
          if (remaining === 0) setPendingOff(false);
        },
      })
    );
  };

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="text-yellow-400" size={24} />
            Lights
          </h2>
          <p className="text-gray-400 text-sm mt-1">{lightsOnCount} of {lightDevices.length} on</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={turnAllOff}
            disabled={filteredOnCount === 0 || pendingOff}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
          >
            All Off
          </button>
          {offError && <span className="text-xs text-red-400">Some lights failed to turn off</span>}
        </div>
      </div>

      {/* Room filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedRoom(null)}
          className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
            selectedRoom === null ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All Rooms
        </button>
        {rooms.filter(r => lightDevices.some(d => d.roomID === r.id)).map(room => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              selectedRoom === room.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {room.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">No lights found</div>
      )}
    </div>
  );
}
