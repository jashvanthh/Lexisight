import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const modeValidator = v.union(
  v.literal("letter"),
  v.literal("word"),
  v.literal("number"),
);

const OVERRIDE_MIN_VOTES = 2;

/** Submit ✓/✗ feedback for letter, word, or number mode. */
export const submit = mutation({
  args: {
    mode: modeValidator,
    predicted: v.string(),
    isCorrect: v.boolean(),
    correctLabel: v.union(v.string(), v.null()),
    confidence: v.union(v.number(), v.null()),
    topK: v.optional(
      v.array(
        v.object({
          label: v.string(),
          confidence: v.number(),
        }),
      ),
    ),
    userId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const topK = (args.topK || []).slice(0, 4);

    const eventId = await ctx.db.insert("feedbackEvents", {
      mode: args.mode,
      predicted: args.predicted,
      isCorrect: args.isCorrect,
      correctLabel: args.correctLabel,
      confidence: args.confidence,
      topK,
      userId: args.userId ?? null,
      createdAt: now,
    });

    if (
      !args.isCorrect &&
      args.correctLabel &&
      args.correctLabel !== args.predicted
    ) {
      const existing = await ctx.db
        .query("feedbackOverrides")
        .withIndex("by_key", (q) =>
          q
            .eq("mode", args.mode)
            .eq("predicted", args.predicted)
            .eq("correctLabel", args.correctLabel),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          votes: existing.votes + 1,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("feedbackOverrides", {
          mode: args.mode,
          predicted: args.predicted,
          correctLabel: args.correctLabel,
          votes: 1,
          updatedAt: now,
        });
      }
    }

    return { eventId, ok: true };
  },
});

/** Runtime correction hints (votes >= threshold). */
export const getOverrides = query({
  args: {
    mode: v.optional(modeValidator),
    minVotes: v.optional(v.number()),
  },
  handler: async (ctx, { mode, minVotes }) => {
    const threshold = minVotes ?? OVERRIDE_MIN_VOTES;
    let rows;

    if (mode) {
      rows = await ctx.db
        .query("feedbackOverrides")
        .withIndex("by_mode", (q) => q.eq("mode", mode))
        .collect();
    } else {
      rows = await ctx.db.query("feedbackOverrides").collect();
    }

    return rows
      .filter((r) => r.votes >= threshold)
      .map((r) => ({
        key: `${r.mode}:${r.predicted}->${r.correctLabel}`,
        mode: r.mode,
        predicted: r.predicted,
        correctLabel: r.correctLabel,
        votes: r.votes,
        updatedAt: r.updatedAt,
      }));
  },
});

/** Recent feedback events (optional filter by mode). */
export const listRecent = query({
  args: {
    mode: v.optional(modeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { mode, limit }) => {
    const cap = Math.min(limit ?? 50, 200);
    let events;

    if (mode) {
      events = await ctx.db
        .query("feedbackEvents")
        .withIndex("by_mode_created", (q) => q.eq("mode", mode))
        .order("desc")
        .take(cap);
    } else {
      events = await ctx.db.query("feedbackEvents").order("desc").take(cap);
    }

    return events;
  },
});

/** Stats per mode for letter / word / number. */
export const statsByMode = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("feedbackEvents").collect();
    const modes = ["letter", "word", "number"];
    const out = {};

    for (const m of modes) {
      const subset = events.filter((e) => e.mode === m);
      const correct = subset.filter((e) => e.isCorrect).length;
      out[m] = {
        total: subset.length,
        correct,
        incorrect: subset.length - correct,
      };
    }

    return out;
  },
});
