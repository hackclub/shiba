import { useCallback, useEffect, useRef } from "react";

// Simple audio manager that preloads audio files and plays them instantly
export default function useAudioManager(fileNames = []) {
  const audioMapRef = useRef(new Map());
  const currentClipRef = useRef(null);

  // Preload provided files once mounted
  useEffect(() => {
    const uniqueNames = Array.from(new Set((fileNames || []).filter(Boolean)));
    uniqueNames.forEach((name) => {
      if (!audioMapRef.current.has(name)) {
        const audio = new Audio(`/${name}`);
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";
        try {
          audio.load();
        } catch (_) {
          // noop
        }
        audioMapRef.current.set(name, audio);
      }
    });
  }, [Array.isArray(fileNames) ? fileNames.join("|") : String(fileNames)]);

  const stopAll = useCallback(() => {
    audioMapRef.current.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {
        // ignore
      }
    });
  }, []);

  const play = useCallback((name) => {
    if (!name) return;
    const audio = audioMapRef.current.get(name);
    if (!audio) return;
    try {
      audio.currentTime = 0;
    } catch (_) {
      // ignore
    }
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay policies or not ready; ignore to avoid unhandled promise
      });
    }
  }, []);

  const playExclusive = useCallback(
    (name) => {
      stopAll();
      play(name);
    },
    [play, stopAll],
  );

  // Play background "clip" track, stopping only the previous clip, not SFX
  const playClip = useCallback(
    (name) => {
      if (!name) return;
      const previousName = currentClipRef.current;
      if (previousName && audioMapRef.current.has(previousName)) {
        const prevAudio = audioMapRef.current.get(previousName);
        try {
          prevAudio.pause();
          prevAudio.currentTime = 0;
        } catch (_) {
          // ignore
        }
      }
      currentClipRef.current = name;
      play(name);
    },
    [play],
  );

  return { play, playExclusive, playClip, stopAll };
}
