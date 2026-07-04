import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Room, QueueEntry, PresenceUser } from "../types";

/**
 * Everything related to: fetching the room + queue, subscribing to
 * postgres_changes + presence, the heartbeat ping, auto-deleting an
 * empty room, and host transfer.
 *
 * This is the "server state" half of the page. The YouTube player and
 * the search/recommendations UI don't belong here on purpose — keeping
 * this hook only about room/queue/presence data makes it testable on
 * its own.
 */
export function useRoomRealtime(roomCode: string, onHostTransferred?: () => void) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [room, setRoom] = useState<Room | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isTransferringHost, setIsTransferringHost] = useState(false);

  // Derived, not stored: isHost is always exactly this comparison, so
  // keeping it as separate state just invited an extra effect + extra
  // render to keep the two in sync.
  const isHost = Boolean(currentUser?.id && room?.host_id && currentUser.id === room.host_id);

  const queueRef = useRef<QueueEntry[]>([]);
  const emptyRoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const refreshQueue = useCallback(async () => {
    if (!roomCode) return;
    const { data } = await supabase
      .from("queue")
      .select("*")
      .eq("room_code", roomCode)
      .order("created_at", { ascending: true });

    if (data) setQueue(data);
  }, [roomCode, supabase]);

  const transferHost = useCallback(
    async (newHostId: string) => {
      if (!roomCode || !room?.host_id || room.host_id === newHostId) return;
      if (!isHost) return;
      setIsTransferringHost(true);

      const { error } = await supabase
        .from("rooms")
        .update({ host_id: newHostId })
        .eq("room_code", roomCode);

      if (error) {
        console.error("Host transfer failed:", error);
      } else {
        setRoom((prev) => (prev ? { ...prev, host_id: newHostId } : prev));
        setUsers((prev) => {
          const next = new Map(prev);
          next.forEach((user, id) => {
            next.set(id, { ...user, is_host: id === newHostId });
          });
          return next;
        });
        onHostTransferred?.();
      }

      setIsTransferringHost(false);
    },
    [roomCode, room, supabase, isHost, onHostTransferred]
  );

  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      setCurrentUser(user);

      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", roomCode)
        .single();

      const { data: queueData } = await supabase
        .from("queue")
        .select("*")
        .eq("room_code", roomCode)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (roomData) setRoom(roomData);
      if (queueData) setQueue(queueData);

      const channel = supabase.channel(`room:${roomCode}`, {
        config: { presence: { key: user?.id ?? "anon" } },
      });

      activeChannel = channel;

      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const newEntry = payload.new as QueueEntry;
          setQueue((prev) => {
            if (prev.find((s) => String(s.id) === String(newEntry.id))) return prev;
            return [...prev, newEntry];
          });
        }
      );

      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const updatedEntry = payload.new as QueueEntry;
          setQueue((prev) => {
            const exists = prev.some((s) => String(s.id) === String(updatedEntry.id));
            if (!exists) {
              void refreshQueue();
              return prev;
            }
            return prev.map((s) => (String(s.id) === String(updatedEntry.id) ? updatedEntry : s));
          });
        }
      );

      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const oldEntry = payload.old as Pick<QueueEntry, "id"> | null;
          if (!oldEntry?.id) {
            void refreshQueue();
            return;
          }
          setQueue((prev) => prev.filter((s) => String(s.id) !== String(oldEntry.id)));
        }
      );

      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const newRoom = payload.new as Room;
          setRoom((prevRoom) => {
            const videoChanged =
              (prevRoom?.current_video_id ?? null) !== (newRoom?.current_video_id ?? null);
            if (videoChanged) {
              // para maiwasan ang UI locking/race conditions kapag nag-playNext ka.
              if (currentUser?.id !== newRoom.host_id) {
                onHostTransferred?.();
              }
              void refreshQueue();
            }
            return newRoom;
          });
        }
      );

      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rooms", filter: `room_code=eq.${roomCode}` },
        () => {
          router.push("/dashboard");
        }
      );

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          user_id: string;
          email: string;
          display_name: string;
          is_host: boolean;
        }>();

        const map = new Map<string, PresenceUser>();
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => map.set(p.user_id, p));
        });
        setUsers(map);

        const totalUsers = Object.values(state).flat().length;
        if (totalUsers === 0) {
          if (!emptyRoomTimerRef.current) {
            emptyRoomTimerRef.current = setTimeout(async () => {
              const latestState = channel.presenceState();
              const latestCount = Object.values(latestState).flat().length;
              if (latestCount === 0) {
                try {
                  await fetch("/api/delete-room", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ room_code: roomCode }),
                  });
                  console.log(`[auto-delete] Room ${roomCode} deleted.`);
                } catch (err) {
                  console.error("[auto-delete] Failed:", err);
                }
              }
              emptyRoomTimerRef.current = null;
            }, 5000);
          }
        } else if (emptyRoomTimerRef.current) {
          clearTimeout(emptyRoomTimerRef.current);
          emptyRoomTimerRef.current = null;
        }
      });

      channel.on("presence", { event: "join" }, ({ newPresences }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          newPresences.forEach((p) => {
            const presence = p as unknown as PresenceUser;
            next.set(presence.user_id, presence);
          });
          return next;
        });
      });

      channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          leftPresences.forEach((p) => {
            const presence = p as unknown as PresenceUser;
            next.delete(presence.user_id);
          });

          const hostStillPresent = room?.host_id ? next.has(room.host_id) : false;
          if (!hostStillPresent && room?.host_id && next.size > 0) {
            const nextHost = Array.from(next.values())[0];
            void transferHost(nextHost.user_id);
          }

          return next;
        });
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user && roomData && isMounted) {
          await channel.track({
            user_id: user.id,
            email: user.email || "",
            display_name:
              user.user_metadata?.display_name ||
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              (user.email
                ? user.email
                    .split("@")[0]
                    .replace(/[._\-+]/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())
                : "Guest"),
            is_host: user.id === roomData.host_id,
          });

          const upsertPresence = async () => {
            const { error } = await supabase.from("room_presence").upsert({
              room_code: roomCode,
              user_id: user.id,
              last_seen_at: new Date().toISOString(),
            });
            if (error) console.error("[heartbeat] failed:", error.message);
          };

          await upsertPresence();
          heartbeatInterval = setInterval(upsertPresence, 30000);
        }
      });
    };

    fetchData();

    return () => {
      isMounted = false;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (emptyRoomTimerRef.current) {
        clearTimeout(emptyRoomTimerRef.current);
        emptyRoomTimerRef.current = null;
      }
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, supabase, router]);

  const leaveRoom = useCallback(async () => {
    if (isHost && room?.host_id) {
      const otherUsers = Array.from(users.values()).filter((u) => u.user_id !== currentUser?.id);
      if (otherUsers.length > 0) {
        await transferHost(otherUsers[0].user_id);
      }
    }
    router.push("/dashboard");
  }, [isHost, room?.host_id, users, currentUser?.id, transferHost, router]);

  return {
    supabase,
    room,
    setRoom,
    isHost,
    queue,
    setQueue,
    queueRef,
    users,
    currentUser,
    isTransferringHost,
    transferHost,
    refreshQueue,
    leaveRoom,
  };
}