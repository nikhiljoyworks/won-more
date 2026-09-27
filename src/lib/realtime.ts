import { supabase } from './supabase';
import { Lead } from '../types';

/**
 * Synthesizes a gentle, pleasant notification chime using the native Web Audio API.
 * No external MP3 files, 0 network requests, works across desktop & mobile.
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: High crisp bell (D5: 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: Harmonic sparkle (A5: 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch {
    // Graceful fallback if audio is autoplay-blocked
  }
}

/**
 * Broadcast a new lead or status update to the merchant's private realtime channel.
 */
export async function broadcastShopLeadEvent(
  shopId: string,
  event: 'NEW_LEAD' | 'LEAD_STATUS_UPDATED',
  payload: {
    lead?: Lead;
    leadId?: string;
    status?: string;
  }
) {
  if (!shopId) return;

  try {
    const channelName = `shop-leads-${shopId}`;
    const existingChannel = supabase.getChannels().find(
      (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
    );

    if (existingChannel && existingChannel.state === 'joined') {
      await existingChannel.send({
        type: 'broadcast',
        event,
        payload,
      });
      return;
    }

    const channel = existingChannel || supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event,
          payload,
        });
      }
    });
  } catch (err) {
    console.warn('Realtime broadcast notification failed:', err);
  }
}

export interface RealtimeLeadCallbacks {
  onNewLead?: (lead: Lead) => void;
  onStatusUpdated?: (leadId: string, status: string) => void;
  onConnected?: () => void;
}

/**
 * Subscribes the merchant dashboard/leads view to real-time events for this shop.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToShopLeads(
  shopId: string,
  callbacks: RealtimeLeadCallbacks
): () => void {
  if (!shopId) return () => {};

  const channelName = `shop-leads-${shopId}`;
  
  // Clean up any stale channel with same topic to avoid duplicate listeners
  const existing = supabase.getChannels().find(
    (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
  );
  if (existing) {
    supabase.removeChannel(existing);
  }

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'NEW_LEAD' }, ({ payload }) => {
      if (payload?.lead) {
        callbacks.onNewLead?.(payload.lead as Lead);
      }
    })
    .on('broadcast', { event: 'LEAD_STATUS_UPDATED' }, ({ payload }) => {
      if (payload?.leadId && payload?.status) {
        callbacks.onStatusUpdated?.(payload.leadId, payload.status);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callbacks.onConnected?.();
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
