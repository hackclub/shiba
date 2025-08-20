import { useCallback, useEffect, useRef, useState } from "react";

// Simple audio manager that preloads audio files and plays them instantly
export default function useAudioManager(fileNames = []) {
  const audioMapRef = useRef(new Map());
  const [isMuted, setIsMuted] = useState(false);

  // Initialize with localStorage mute preference if available
  useEffect(() => {
    try {
      const savedMute = localStorage.getItem('shibaAudioMuted');
      if (savedMute === 'true') {
        setIsMuted(true);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Preload audio files
  useEffect(() => {
    const audioMap = audioMapRef.current;
    fileNames.forEach(fileName => {
      if (!audioMap.has(fileName)) {
        const audio = new Audio(`/${fileName}`);
        audio.preload = 'auto';
        audioMap.set(fileName, audio);
      }
    });
    
    // Cleanup
    return () => {
      audioMap.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      audioMap.clear();
    };
  }, [fileNames]);

  // Toggle mute state and save preference
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newState = !prev;
      try {
        localStorage.setItem('shibaAudioMuted', String(newState));
      } catch (e) {
        // Ignore localStorage errors
      }
      return newState;
    });
  }, []);

  // Play sound if not muted
  const play = useCallback((fileName) => {
    if (isMuted) return;
    
    const audioMap = audioMapRef.current;
    const audio = audioMap.get(fileName);
    if (audio) {
      // Reset and play
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Ignore play errors
        });
      }
    }
  }, [isMuted]);

  // For longer game clip audio that might overlap
  const playClip = useCallback((fileName) => {
    if (isMuted) return;
    
    const audioMap = audioMapRef.current;
    // Stop all other clips first
    audioMap.forEach(audio => {
      if (audio.duration > 4) { // Assume clips are longer than 4s
        audio.pause();
        audio.currentTime = 0;
      }
    });
    
    // Play the new clip
    const audio = audioMap.get(fileName);
    if (audio) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Ignore play errors
        });
      }
    }
  }, [isMuted]);

  // Stop all audio
  const stopAll = useCallback(() => {
    const audioMap = audioMapRef.current;
    audioMap.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, []);

  return { play, playClip, stopAll, isMuted, toggleMute };
}
