// NEW CODE — Convex schema for WebRTC calling rooms and signaling
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Rooms table — stores active call rooms
  rooms: defineTable({
    roomCode: v.string(),        // Short unique code for sharing (e.g., "abc123")
    ownerId: v.string(),         // Clerk user ID of room creator
    ownerName: v.string(),       // Display name of room creator
    participants: v.array(       // Array of users currently in the room
      v.object({
        userId: v.string(),
        userName: v.string(),
        joinedAt: v.number(),
      })
    ),
    status: v.string(),          // "waiting" | "active" | "ended"
    createdAt: v.number(),
  })
    .index("by_roomCode", ["roomCode"])
    .index("by_ownerId", ["ownerId"])
    .index("by_status", ["status"]),

  // Signals table — WebRTC SDP offers/answers and ICE candidates
  signals: defineTable({
    roomId: v.id("rooms"),       // Reference to rooms table
    fromUserId: v.string(),      // Clerk user ID of signal sender
    type: v.string(),            // "offer" | "answer" | "ice-candidate"
    data: v.string(),            // JSON-stringified SDP or ICE candidate
    createdAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_type", ["roomId", "type"]),

  // Sign captions — text-only sync for sign language mode (no media/landmarks)
  signCaptions: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    stable: v.string(),
    interim: v.string(),
    updatedAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_userId", ["roomId", "userId"]),

  // User feedback on letter / word / number predictions (Translator ✓/✗)
  feedbackEvents: defineTable({
    mode: v.union(v.literal("letter"), v.literal("word"), v.literal("number")),
    predicted: v.string(),
    isCorrect: v.boolean(),
    correctLabel: v.union(v.string(), v.null()),
    confidence: v.union(v.number(), v.null()),
    topK: v.array(
      v.object({
        label: v.string(),
        confidence: v.number(),
      }),
    ),
    userId: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_mode", ["mode"])
    .index("by_mode_created", ["mode", "createdAt"]),

  // Aggregated corrections when users mark a prediction wrong
  feedbackOverrides: defineTable({
    mode: v.union(v.literal("letter"), v.literal("word"), v.literal("number")),
    predicted: v.string(),
    correctLabel: v.string(),
    votes: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mode", ["mode"])
    .index("by_mode_predicted", ["mode", "predicted"])
    .index("by_key", ["mode", "predicted", "correctLabel"]),
});
