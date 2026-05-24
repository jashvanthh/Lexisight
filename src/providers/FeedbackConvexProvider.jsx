import { createContext, useContext } from 'react'
import { CONVEX_FEEDBACK_ENABLED, useFeedbackConvexLive } from '../hooks/useFeedbackConvex.js'
import {
  recordFeedbackLocal,
  applyRuntimeCorrection,
  getFeedbackStats,
} from '../services/feedbackStore.js'

function createLocalFeedbackApi() {
  return {
    recordFeedback: async (entry) => recordFeedbackLocal(entry),
    applyRuntimeCorrection,
    convexReady: false,
    remoteOverrides: [],
    statsByMode: null,
    localStats: getFeedbackStats(),
  }
}

const FeedbackApiContext = createContext(createLocalFeedbackApi())

/** Safe hook — local ✓/✗ always works; cloud sync only when VITE_CONVEX_FEEDBACK=true. */
export function useFeedbackConvex() {
  return useContext(FeedbackApiContext)
}

function FeedbackConvexLoader({ children }) {
  const api = useFeedbackConvexLive()
  return <FeedbackApiContext.Provider value={api}>{children}</FeedbackApiContext.Provider>
}

export function FeedbackConvexProvider({ children }) {
  if (!CONVEX_FEEDBACK_ENABLED) {
    return (
      <FeedbackApiContext.Provider value={createLocalFeedbackApi()}>
        {children}
      </FeedbackApiContext.Provider>
    )
  }

  return <FeedbackConvexLoader>{children}</FeedbackConvexLoader>
}
