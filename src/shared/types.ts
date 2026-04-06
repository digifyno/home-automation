export interface FibaroDevice {
  id: number;
  name: string;
  type: string;
  roomID: number;
  parentId: number;
  enabled: boolean;
  visible: boolean;
  properties: {
    value: boolean | number | string;
    unit?: string;
    dead: boolean;
    batteryLevel?: number;
    tampered?: boolean;
    lastBreached?: number;
    power?: number;
    energy?: number;
    color?: string;
    mode?: number;
    targetLevel?: number;
  };
  interfaces: string[];
}

export interface FibaroRoom {
  id: number;
  name: string;
  sectionID: number;
  icon: string;
  defaultSensor: number;
  defaultThermostat: number;
  sortOrder: number;
}

export interface FibaroScene {
  id: number;
  name: string;
  roomID: number;
  type: string;
  runConfig: string;
  enabled: boolean;
  isRunning: boolean;
}

export interface FibaroWeather {
  Temperature: number;
  Humidity: number;
  Wind: number;
  WeatherCondition: string;
  ConditionCode: number;
}

export interface FibaroEnergyDevice {
  id: number;
  name?: string;
  value: number;           // cumulative kWh
  unit?: string;
  roomID?: number;
}

export type DeviceCategory = 'light' | 'dimmer' | 'thermostat' | 'sensor' | 'safety' | 'energy' | 'shutter' | 'other';

export function categorizeDevice(type: string): DeviceCategory {
  if (type.includes('dimmer') || type.includes('colorController')) return 'dimmer';
  if (type.includes('Switch') || type.includes('powerSwitch')) return 'light';
  if (type.includes('hvacSystem')) return 'thermostat';
  if (type.includes('smokeDetector') || type.includes('coDetector') || type.includes('floodSensor')) return 'safety';
  if (type.includes('electricMeter')) return 'energy';
  if (type.includes('Sensor') || type.includes('Detector')) return 'sensor';
  if (type.includes('shutter') || type.includes('cover')) return 'shutter';
  return 'other';
}

export function isDeviceOn(device: FibaroDevice): boolean {
  const v = device.properties.value;
  return v === true || (typeof v === 'number' && v > 0) || v === 'true';
}
