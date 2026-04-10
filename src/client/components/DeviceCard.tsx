import React from 'react';
import { Lightbulb, Thermometer, Shield, Zap, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { FibaroDevice, categorizeDevice, isDeviceOn } from '../../shared/types.ts';
import { useDeviceAction } from '../hooks/useFibaro.ts';

interface Props {
  device: FibaroDevice;
}

function DeviceIcon({ type }: { type: string }) {
  const cat = categorizeDevice(type);
  const icons = {
    light: <Lightbulb size={18} />,
    dimmer: <Lightbulb size={18} />,
    thermostat: <Thermometer size={18} />,
    sensor: <Shield size={18} />,
    safety: <AlertTriangle size={18} />,
    energy: <Zap size={18} />,
    shutter: <ToggleLeft size={18} />,
    other: <Zap size={18} />,
  };
  return icons[cat];
}

export default function DeviceCard({ device }: Props) {
  const action = useDeviceAction();
  const isOn = isDeviceOn(device);
  const isDead = device.properties.dead;
  const cat = categorizeDevice(device.type);
  const isToggleable = cat === 'light' || cat === 'dimmer';

  const toggle = () => {
    if (!isToggleable) return;
    action.mutate({ id: device.id, action: isOn ? 'turnOff' : 'turnOn' });
  };

  return (
    <div
      className={`bg-gray-800 rounded-xl p-4 border transition-colors ${
        isDead
          ? 'border-red-900 opacity-60'
          : isOn
          ? 'border-blue-500/30'
          : 'border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${isOn ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
          <DeviceIcon type={device.type} />
        </div>
        {isToggleable && (
          <button
            onClick={toggle}
            disabled={action.isPending || isDead}
            aria-label={isOn ? `Turn off ${device.name}` : `Turn on ${device.name}`}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isOn ? <ToggleRight size={24} className="text-blue-400" /> : <ToggleLeft size={24} />}
          </button>
        )}
      </div>
      {action.isError && (
        <p className="text-xs text-red-400 mt-1">Action failed</p>
      )}
      <div className="mt-3">
        <p className="text-sm font-medium text-white truncate">{device.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isDead ? (
            <span className="text-red-400">Offline</span>
          ) : typeof device.properties.value === 'number' && device.properties.unit ? (
            `${device.properties.value} ${device.properties.unit}`
          ) : isOn ? (
            'On'
          ) : (
            'Off'
          )}
        </p>
        {device.properties.batteryLevel !== undefined && (
          <p className="text-xs text-gray-500 mt-1">Battery: {device.properties.batteryLevel}%</p>
        )}
        {device.properties.power !== undefined && (
          <p className="text-xs text-yellow-400 mt-1">{device.properties.power}W</p>
        )}
      </div>
    </div>
  );
}
