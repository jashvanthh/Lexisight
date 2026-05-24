import { useCallback, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useUser } from '@clerk/clerk-react'
import { api } from '../../convex/_generated/api'
import {
  recordFeedbackLocal,
  setRemoteOverrides,
  applyRuntimeCorrection,
  getFeedbackStats,
} from '../services/feedbackStore.js'

const VALID_MODES = new Set(['letter', 'word', 'number'])

/**
 * Opt-in only — set VITE_CONVEX_FEEDBACK=true in .env AFTER `npm run convex:deploy`.
 * Default off so missing feedback:* functions never crash the app.
 */
export const CONVEX_FEEDBACK_ENABLED = import.meta.env.VITE_CONVEX_FEEDBACK === 'true'

function normalizeMode(mode) {
  return VALID_MODES.has(mode) ? mode : 'word'
}

/**
 * Live Convex sync for Translator feedback (letter, word, number).
 * Wrapped by FeedbackConvexProvider — use `useFeedbackConvex` from the provider in pages.
 */
export function useFeedbackConvexLive() {
  const { user } = useUser()
  const submitMutation = useMutation(api.feedback.submit)
  const remoteOverrides = useQuery(
    api.feedback.getOverrides,
    CONVEX_FEEDBACK_ENABLED ? { minVotes: 2 } : 'skip',
  )
  const statsByMode = useQuery(
    api.feedback.statsByMode,
    CONVEX_FEEDBACK_ENABLED ? {} : 'skip',
  )

  useEffect(() => {
    if (remoteOverrides) {
      setRemoteOverrides(remoteOverrides)
    }
  }, [remoteOverrides])

  const recordFeedback = useCallback(
    async (entry) => {
      const mode = normalizeMode(entry.mode)
      const row = recordFeedbackLocal({ ...entry, mode })

      if (!CONVEX_FEEDBACK_ENABLED) {
        return row
      }

      try {
        await submitMutation({
          mode,
          predicted: entry.predicted,
          isCorrect: !!entry.isCorrect,
          correctLabel: entry.isCorrect ? entry.predicted : entry.correctLabel || null,
          confidence: entry.confidence ?? null,
          topK: entry.topK?.slice(0, 4) || [],
          userId: user?.id ?? null,
        })
      } catch (e) {
        console.warn('[useFeedbackConvex] Convex submit failed, kept local copy', e)
      }

      return row
    },
    [submitMutation, user?.id],
  )

  return {
    recordFeedback,
    applyRuntimeCorrection,
    statsByMode: statsByMode ?? null,
    remoteOverrides: remoteOverrides ?? [],
    localStats: getFeedbackStats(),
    convexReady: CONVEX_FEEDBACK_ENABLED && remoteOverrides !== undefined,
  }
}

export { applyRuntimeCorrection, getFeedbackStats }
