import React, { useState } from 'react';
import { useScenes, useSceneExecute } from '../hooks/useFibaro.ts';
import { PlayCircle, Loader2, AlertTriangle } from 'lucide-react';

export default function Scenes() {
  const { data: scenes = [], isLoading, isError } = useScenes();
  const execute = useSceneExecute();
  const [pendingScenes, setPendingScenes] = useState<Set<number>>(new Set());
  const [errorScenes, setErrorScenes] = useState<Set<number>>(new Set());

  const handleExecute = (id: number) => {
    setPendingScenes(prev => new Set(prev).add(id));
    setErrorScenes(prev => { const s = new Set(prev); s.delete(id); return s; });
    execute.mutate(id, {
      onSettled: () => {
        setPendingScenes(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      onError: () => setErrorScenes(prev => new Set(prev).add(id)),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div role="status" aria-label="Loading" className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="text-red-400" size={32} />
        <p className="text-red-400 font-medium">Failed to load scenes</p>
        <p className="text-gray-500 text-sm">Check that Fibaro HC3 is reachable</p>
      </div>
    );
  }

  const enabledScenes = scenes.filter(s => s.enabled);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <PlayCircle className="text-purple-400" size={24} />
        Scenes
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {enabledScenes.map(scene => (
          <div key={scene.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${scene.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">{scene.isRunning ? 'Running' : scene.type}</span>
              </div>
              <p className="font-medium text-white">{scene.name}</p>
            </div>
            {errorScenes.has(scene.id) && (
              <p className="text-xs text-red-400 mt-3">Scene failed to run</p>
            )}
            <button
              onClick={() => handleExecute(scene.id)}
              disabled={pendingScenes.has(scene.id)}
              aria-label={`Run ${scene.name}`}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
            >
              {pendingScenes.has(scene.id) ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              Run Scene
            </button>
          </div>
        ))}
      </div>

      {enabledScenes.length === 0 && (
        <div className="text-center py-12 text-gray-500">No scenes available</div>
      )}
    </div>
  );
}
