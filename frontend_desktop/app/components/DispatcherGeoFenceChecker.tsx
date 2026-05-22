'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

interface DispatcherGeoFenceCheckerProps {
  latitude: number;
  longitude: number;
  accessToken: string;
}

type CheckStatus = 'idle' | 'checking' | 'inside' | 'outside' | 'error';

const FENCE_OPTIONS = [
  { value: 'metro-manila', label: 'Metro Manila (Core Fence)' },
  { value: 'bulacan-danger-zone', label: 'Bulacan Lowland Flooding Zone' },
  { value: 'cavite-coastal-fence', label: 'Cavite Coastal Evac Sector' },
] as const;

export function DispatcherGeoFenceChecker({
  latitude,
  longitude,
  accessToken,
}: DispatcherGeoFenceCheckerProps) {
  const [fenceId, setFenceId] = useState<string>('metro-manila');
  const [status, setStatus] = useState<CheckStatus>('idle');

  const verifyFenceBoundaries = async () => {
    setStatus('checking');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${API_BASE_URL}/geo/admin/geofence-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ latitude, longitude, fenceId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        setStatus('error');
        return;
      }

      const data = (await response.json()) as {
        success: boolean;
        inside: boolean;
      };
      setStatus(data.inside ? 'inside' : 'outside');
    } catch {
      clearTimeout(timeout);
      setStatus('error');
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
      <h3 className="text-sm font-bold text-gray-800 mb-1">
        Geofence Boundary Audit
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Active Perimeter Zone
        </label>

        <select
          value={fenceId}
          onChange={(e) => {
            setFenceId(e.target.value);
            setStatus('idle');
          }}
          className="p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {FENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          onClick={verifyFenceBoundaries}
          disabled={status === 'checking'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs py-2 px-4 rounded transition-colors duration-150"
        >
          {status === 'checking' ? 'Checking…' : 'Run Geofence Test'}
        </button>

        {status === 'inside' && (
          <div className="p-2 text-xs rounded bg-green-50 text-green-800 font-semibold border border-green-200">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={14} /> Inside selected active response sector.
            </span>
          </div>
        )}
        {status === 'outside' && (
          <div className="p-2 text-xs rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={14} /> Out of bounds - coordinate falls outside this rescue envelope.
            </span>
          </div>
        )}
        {status === 'error' && (
          <div className="p-2 text-xs rounded bg-red-50 text-red-800 border border-red-200">
            <span className="inline-flex items-center gap-1">
              <ShieldAlert size={14} /> Service error - could not validate geofence boundaries.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
