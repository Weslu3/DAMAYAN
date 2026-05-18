import { loadSession } from '../lib/session';

export type SystemPhase = 'BEFORE' | 'DURING' | 'AFTER';

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL ?? 'http://localhost:3001/api';

export async function getCurrentPhase(): Promise<{ currentPhase: SystemPhase; updatedAt: string }> {
  const response = await fetch(`${NEST_API_URL}/system-settings/phase`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch current system phase');
  }

  return response.json() as Promise<{ currentPhase: SystemPhase; updatedAt: string }>;
}

export async function triggerPhaseShift(
  newPhase: SystemPhase,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const session = loadSession();

  if (!session?.accessToken) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${NEST_API_URL}/system-settings/phase`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ newPhase }),
    });

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      throw new Error(data.message ?? 'Failed to update phase');
    }

    return { success: true, message: data.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error shifting phase:', message);
    return { success: false, error: message };
  }
}
