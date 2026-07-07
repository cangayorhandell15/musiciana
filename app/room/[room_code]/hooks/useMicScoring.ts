import { useState, useRef } from "react";
// 💡 PAHAYAG SA ERROR 1: Kung iba ang folder ng supabase client mo, baguhin lang ang string na ito.
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export function useMicScoring() {
  const [isSinging, setIsSinging] = useState(false);
  // ✨ BAGONG STATE: Para malaman ng UI kung may gumaganang mic o wala
  const [hasMic, setHasMic] = useState<boolean | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sessionPitchScoresRef = useRef<number[]>([]);
  const sessionRhythmScoresRef = useRef<number[]>([]);
  const previousEnergyRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);


 // 1. Simulan ang pakikinig sa mic ng Host kapag nag-play ang video
async function startHostMicrophone() {
  try {
    // Humingi ng permiso sa microphone gamit ang basic configuration
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,  // ❌ I-OFF para hindi pumasok sa Call Mode ang CP
        noiseSuppression: false,   // ❌ I-OFF para maging pure audio data lang ang pasok
        autoGainControl: false     // ❌ I-OFF para hindi baguhin ng CP ang volume ng mic
      } 
    });
    
    micStreamRef.current = stream;
    setHasMic(true);
    // ... ang natitirang bahagi ng code mo ay pareho pa rin

      // FIX sa error sa 'any': Ginamitan ng explicit standard types para sa older webkit browsers
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("Web Audio API is not supported in this browser");
        return;
      }
      
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsSinging(true);
      sessionPitchScoresRef.current = [];
      sessionRhythmScoresRef.current = [];
      previousEnergyRef.current = 0;

      console.log("🎤 Host microphone successfully connected and analyzing pitch...");

      // Realtime detection loop
      const trackPitch = () => {
        if (!analyserRef.current || !audioContextRef.current) return;

        const buffer = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(buffer);

        const pitch = autoCorrelate(buffer, audioContextRef.current.sampleRate);
        const rms = getRMS(buffer);
        const energy = rms;
        const hasValidVoice = energy >= 0.006;

        if (hasValidVoice) {
          console.log(`Pitch Detected: ${Math.round(pitch)} Hz  |  RMS: ${rms.toFixed(4)}`);

          const normalizedRms = Math.min(1, Math.max(0, (energy - 0.006) / 0.18));
          const pitchScore = Math.round(1 + normalizedRms * 99);

          const energyDelta = energy - previousEnergyRef.current;
          const motion = Math.min(1, Math.abs(energyDelta) / 0.08);
          const stability = Math.min(1, energy / 0.2);
          const rhythmScore = Math.round(1 + Math.min(1, stability * 0.5 + motion * 0.5) * 99);

          previousEnergyRef.current = energy;
          sessionPitchScoresRef.current.push(pitchScore);
          sessionRhythmScoresRef.current.push(rhythmScore);
        } else {
          previousEnergyRef.current = energy;
        }

        animationFrameIdRef.current = requestAnimationFrame(trackPitch);
      };

      animationFrameIdRef.current = requestAnimationFrame(trackPitch);
    } catch (err: unknown) {
      // 🛡️ I-check kung ito ba ay isang valid Error object bago basahin ang .name
      if (err instanceof Error) {
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setHasMic(false);
          console.warn("⚠️ [useMicScoring] Walang physical microphone na nakasaksak sa device na ito. Scoring is disabled.");
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setHasMic(false);
          console.warn("⚠️ [useMicScoring] Hinarangan ng user ang microphone access.");
        } else {
          console.error("Failed to access host microphone due to an unexpected error:", err.message);
        }
      } else {
        // Fallback para sa mga rare cases kung saan ang na-throw ay hindi Error instance
        console.error("An unknown error occurred:", err);
      }
    }
  }

  // 2. Patayin ang mic at i-save ang final calculated score sa Supabase
  async function stopHostMicrophoneAndSave(currentSong: {
    room_code: string;
    video_id: string;
    title: string;
    added_by: string; // Ang UUID ng user na nag-queue
    added_by_name?: string | null;
  }) {
    setIsSinging(false);

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    const pitchScores = sessionPitchScoresRef.current;
    const rhythmScores = sessionRhythmScoresRef.current;
    const averagePitchScore =
      pitchScores.length > 0
        ? Math.round(pitchScores.reduce((acc, score) => acc + score, 0) / pitchScores.length)
        : 0;
    const averageRhythmScore =
      rhythmScores.length > 0
        ? Math.round(rhythmScores.reduce((acc, score) => acc + score, 0) / rhythmScores.length)
        : 0;
    const totalScore = pitchScores.length > 0 || rhythmScores.length > 0
      ? Math.round((averagePitchScore + averageRhythmScore) / 2)
      : 0;

    console.log(
      `🏆 Final Score Computed: ${totalScore} (pitch ${averagePitchScore}, rhythm ${averageRhythmScore}) para kay User ID: ${currentSong.added_by}`
    );

    if (!hasMic || totalScore === 0) {
      console.log("ℹ️ No microphone input or zero score. Skipping Supabase save.");
      return totalScore;
    }

    if (!currentSong.added_by) {
      console.error("Hindi mai-save ang score dahil walang valid na 'added_by' user ID.");
      return totalScore;
    }

    // Prepare payload and attempt insert. If the DB doesn't have the
    // `added_by_name` column (schema mismatch), retry without it.
    const scorePayload: Record<string, unknown> = {
      room_code: currentSong.room_code,
      video_id: currentSong.video_id,
      title: currentSong.title,
      user_id: currentSong.added_by,
      added_by_name: currentSong.added_by_name ?? null,
      pitch_score: averagePitchScore,
      rhythm_score: averageRhythmScore,
      total_score: totalScore,
    };

    const { error } = await supabase.from("scores").insert([scorePayload]);

    if (!error) {
      console.log("🚀 Score record updated successfully in Supabase!");
    } else if (error?.code === "PGRST204" && typeof error.message === "string" && error.message.includes("added_by_name")) {
      // Supabase says the column is missing in its schema cache.
      console.warn("Supabase missing 'added_by_name' column — retrying insert without it.");
      const fallbackPayload = { ...scorePayload };
      // remove the optional column for fallback
       
      delete (fallbackPayload as Record<string, unknown>).added_by_name;

      const { error: retryErr } = await supabase.from("scores").insert([fallbackPayload]);
      if (!retryErr) {
        console.log("🚀 Score record saved (without added_by_name) in Supabase.");
      } else {
        console.error("Error inserting score to Supabase on retry:", retryErr);
      }
    } else {
      console.error("Error inserting score to Supabase:", error);
    }

    return totalScore;
  }

  function getRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const value = buffer[i];
      sum += value * value;
    }
    return Math.sqrt(sum / buffer.length);
  }

  // Siyentipikong pag-compute ng pitch frequency (Hz) base sa sound waves
  function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    let SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Masyadong mahina ang sound input

    let r1 = 0, r2 = SIZE - 1;
    const thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = SIZE - 1; i >= SIZE / 2; i--) {
      if (Math.abs(buffer[i]) < thres) { r2 = i; break; }
    }

    const slicedBuffer = buffer.slice(r1, r2);
    SIZE = slicedBuffer.length;

    const c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) {
        c[i] = c[i] + slicedBuffer[j] * slicedBuffer[j + i];
      }
    }

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    const T0 = maxpos;
    return sampleRate / T0;
  }

  // ✨ Idinagdag si hasMic sa return para magamit mo sa UI kung gusto mo magpakita ng notice!
  return { startHostMicrophone, stopHostMicrophoneAndSave, isSinging, hasMic };
}