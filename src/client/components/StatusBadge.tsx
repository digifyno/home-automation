import React from 'react';

interface Props {
  status: 'online' | 'offline' | 'warning';
  label?: string;
}

const colors = {
  online: 'bg-green-400',
  offline: 'bg-red-400',
  warning: 'bg-yellow-400',
};

export default function StatusBadge({ status, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      {label ?? status}
    </span>
  );
}
