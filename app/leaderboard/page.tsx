"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { User, PostgrestError } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type PeriodKey = "today" | "monthly" | "yearly" | "alltime";

type ScoreEntry = {
  user_id: string;
  total_score: number;
  songs: number;
  added_by_name?: string | null;
};

type RankedEntry = ScoreEntry & {
  rank: number;
  displayName: string;
  isCurrentUser: boolean;
  subtitle: string;
};

const periodLabels: Record<PeriodKey, string> = {
  today: "Today",
  monthly: "Month",
  yearly: "Year",
  alltime: "All time",
};

export default function LeaderboardPage() {
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("today");
  const [entries, setEntries] = useState<RankedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient();
  }, []);

  // Fetch auth user once on mount. This avoids repeatedly calling
  // `supabase.auth.getUser()` inside the leaderboard load effect which
  // caused repeated loads (and thousands of requests) when the effect
  // re-ran after setting the user.
  useEffect(() => {
    let mounted = true;
    if (!supabase) return;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setCurrentUser(data.user);
      } catch (err) {
        // Non-fatal: user may be unauthenticated.
        console.warn("Could not get auth user for leaderboard:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Load leaderboard data; depends on `activePeriod` and `supabase` only.
  useEffect(() => {
    let ignore = false;

    const loadLeaderboard = async () => {
      if (!supabase) {
        if (!ignore) {
          setError("Supabase is not configured yet.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const now = new Date();
      const startDate = new Date(now);

      if (activePeriod === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (activePeriod === "monthly") {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
      } else if (activePeriod === "yearly") {
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
      }

      const query = supabase
        .from("scores")
        .select("user_id, total_score, added_by_name, created_at")
        .order("total_score", { ascending: false })
        .limit(50);

      if (activePeriod !== "alltime") {
        query.gte("created_at", startDate.toISOString()).lte("created_at", now.toISOString());
      }

      // Try selecting with `added_by_name` (newer schema). If the DB
      // doesn't have that column the request may 400 / PGRST204; in
      // that case retry without the column so older schemas still work.
      let data: Array<Record<string, unknown>> | null = null;
      let queryError: PostgrestError | Error | null = null;

      try {
        const res = await query;
        data = res.data;
        queryError = res.error;

        const looksLikeMissingColumn = !!queryError && (
          queryError.code === "PGRST204" ||
          /added_by_name/i.test(String((queryError as any).message || "")) ||
          ((queryError as any).status === 400 && /column/i.test(String((queryError as any).message || "")))
        );

        if (looksLikeMissingColumn) {
          console.warn("Leaderboard: 'added_by_name' not found or select rejected; retrying select without it.", queryError);
          const res2 = await supabase
            .from("scores")
            .select("user_id, total_score, created_at")
            .gte("created_at", startDate.toISOString())
            .lte("created_at", now.toISOString())
            .order("total_score", { ascending: false })
            .limit(50);
          data = res2.data;
          queryError = res2.error;
        }
        if (queryError && !looksLikeMissingColumn) {
          console.error("Leaderboard select error:", queryError);
        }
      } catch (err) {
        queryError = err as Error;
      }

      if (!ignore) {
        if (queryError) {
          setError("Unable to load leaderboard right now.");
          setEntries([]);
        } else {
          const grouped = new Map<string, ScoreEntry>();

          for (const item of data ?? []) {
            const userId = (item as any).user_id ?? "guest";
            const existing = grouped.get(userId as string);
            if (existing) {
              existing.total_score += Number((item as any).total_score ?? 0);
              existing.songs += 1;
              if (!existing.added_by_name && (item as any).added_by_name) {
                existing.added_by_name = (item as any).added_by_name;
              }
            } else {
              grouped.set(userId as string, {
                user_id: userId as string,
                total_score: Number((item as any).total_score ?? 0),
                songs: 1,
                added_by_name: (item as any).added_by_name ?? null,
              });
            }
          }

          const ranked = Array.from(grouped.values())
            .sort((a, b) => b.total_score - a.total_score)
            .map((entry, index) => {
              const isCurrent = entry.user_id === currentUser?.id;
              const fallbackName = entry.added_by_name
                ? entry.added_by_name
                : `Player ${entry.user_id.slice(0, 6).toUpperCase()}`;
              const currentUserName =
                currentUser?.user_metadata?.display_name ||
                currentUser?.user_metadata?.full_name ||
                currentUser?.user_metadata?.name ||
                currentUser?.email?.split("@")[0] ||
                "You";
              return {
                ...entry,
                rank: index + 1,
                displayName: isCurrent ? currentUserName : fallbackName,
                subtitle: isCurrent ? "You" : "Top performer",
                isCurrentUser: isCurrent,
              };
            });

          setEntries(ranked);
        }
        setLoading(false);
      }
    };

    void loadLeaderboard();

    return () => {
      ignore = true;
    };
  }, [activePeriod, supabase]);

  // When the current user becomes available later, recompute the display
  // names so the current user is highlighted without re-triggering a
  // full leaderboard fetch loop.
  useEffect(() => {
    if (!currentUser || entries.length === 0) return;
    setEntries((prev) =>
      prev.map((entry) => {
        const isCurrent = entry.user_id === currentUser.id;
        const currentUserName =
          currentUser.user_metadata?.display_name ||
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split("@")[0] ||
          "You";
        return {
          ...entry,
          isCurrentUser: isCurrent,
          displayName: isCurrent ? currentUserName : entry.displayName,
          subtitle: isCurrent ? "You" : entry.subtitle,
        };
      })
    );
  }, [currentUser]);

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_80px_rgba(255,0,128,0.08)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-pink-400">Leaderboard</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Be a top scorer</h1>
              <p className="mt-3 max-w-2xl text-sm text-zinc-400">
                Can you beat the highest scores? Join now and be a top scorer.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(periodLabels) as PeriodKey[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setActivePeriod(period)}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.25em] transition ${
                    activePeriod === period
                      ? "bg-pink-500 text-white"
                      : "border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {periodLabels[period]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-4 sm:p-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-400">Loading leaderboard…</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              No scores yet for {periodLabels[activePeriod].toLowerCase()}.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.user_id}
                  className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                    entry.isCurrentUser
                      ? "border-pink-500/30 bg-pink-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-base font-black text-pink-300">
                      #{entry.rank}
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-white truncate">{entry.displayName}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{entry.subtitle}</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-3xl font-black text-white">{entry.total_score}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
