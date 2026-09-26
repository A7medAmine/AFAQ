import { api } from './db'

export const CAMPAIGN_STATUS = {
  queued: { tone: 'wait', label: 'Queued' },
  sending: { tone: 'signal', label: 'Sending' },
  sent: { tone: 'ok', label: 'Sent' },
  partial: { tone: 'wait', label: 'Partly sent' },
  failed: { tone: 'fault', label: 'Failed' },
}

/**
 * Drive a campaign to the end, one server batch at a time. Serverless
 * functions stop when they respond, so the console is what keeps the send
 * going; if the tab closes, the campaign waits in the queue and "Resume" on
 * the Email page picks it up where it stopped.
 *
 * @returns the final campaign row, or `{ error }` on the first failed batch.
 */
export async function runCampaign(campaignId, { onProgress, signal } = {}) {
  for (;;) {
    if (signal?.aborted) return { aborted: true }
    const { ok, data, message } = await api(`/api/email/campaigns/${campaignId}/process`, { method: 'POST', signal })
    if (!ok) return { error: message }
    onProgress?.(data)
    if (!data.remaining) return data
  }
}
