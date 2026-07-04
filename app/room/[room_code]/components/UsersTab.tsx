"use client";

import type { PresenceUser } from "../types";

type Props = {
  users: Map<string, PresenceUser>;
  currentUserId: string | undefined;
  isHost: boolean;
  isTransferringHost: boolean;
  onTransferHost: (userId: string) => void;
};

export function UsersTab({ users, currentUserId, isHost, isTransferringHost, onTransferHost }: Props) {
  return (
    <div className="space-y-2 pt-1">
      {users.size === 0 && <p className="text-[10px] text-zinc-600 text-center py-4">No users in room yet.</p>}
      {Array.from(users.values())
        .sort((a, b) => (b.is_host ? 1 : 0) - (a.is_host ? 1 : 0))
        .map((u) => (
          <div
            key={u.user_id}
            className={`flex items-center gap-3 p-2 rounded ${
              u.is_host ? "bg-pink-500/10 border border-pink-500/20" : "bg-zinc-800/50"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                u.is_host ? "bg-pink-500/30 text-pink-300" : "bg-zinc-700 text-zinc-300"
              }`}
            >
              {(u.display_name?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate font-medium">
                {u.display_name}
                {u.user_id === currentUserId && <span className="ml-1 text-zinc-500">(you)</span>}
              </p>
              {u.is_host && (
                <p className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">👑 Host</p>
              )}
            </div>
            {isHost && !u.is_host && (
              <button
                onClick={() => onTransferHost(u.user_id)}
                disabled={isTransferringHost}
                className="text-[10px] bg-white/5 border border-white/10 text-white px-2 py-1 rounded-xl hover:bg-white/10 disabled:opacity-50"
              >
                {isTransferringHost ? "Transferring…" : "Make Host"}
              </button>
            )}
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          </div>
        ))}
    </div>
  );
}