export type Room = {
  room_code: string;
  host_id: string;
  current_video_id?: string | null;
  is_playing?: boolean;
};

export type QueueEntry = {
  id: string;
  room_code: string;
  video_id: string;
  title: string;
  thumbnail?: string | null;
  added_by?: string | null;
  added_by_name?: string | null; // NEW: persisted name, see NOTES.md
  created_at?: string;
};

export type PresenceUser = {
  user_id: string;
  email: string;
  display_name: string;
  is_host: boolean;
};

export type YouTubeVideo = {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: {
      default: { url: string };
    };
  };
};

export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// ─── YouTube IFrame Player API types (minimal) ──────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          host?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface YTPlayerInstance {
  destroy: () => void;
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  loadVideoById: (videoId: string) => void;
}