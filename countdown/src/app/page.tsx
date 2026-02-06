"use client";

import { useState, useEffect } from "react";
import { DateTime } from "luxon";

export default function CountdownPage() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = DateTime.now();
      let target = now.setZone("America/Los_Angeles").set({
        weekday: 1,
        hour: 16,
        minute: 30,
        second: 0,
        millisecond: 0,
      });

      if (now > target) {
        target = target.plus({ weeks: 1 });
      }

      const diff = target
        .diff(now, ["days", "hours", "minutes", "seconds"])
        .toObject();

      setTimeLeft({
        days: Math.floor(diff.days ?? 0),
        hours: Math.floor(diff.hours ?? 0),
        minutes: Math.floor(diff.minutes ?? 0),
        seconds: Math.floor(diff.seconds ?? 0),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <img src="/image.png" style={{ width: "300px" }} />
      <div className="text-white text-9xl font-mono mt-6">
        {timeLeft.days}:{timeLeft.hours.toString().padStart(2, "0")}:
        {timeLeft.minutes.toString().padStart(2, "0")}:
        {timeLeft.seconds.toString().padStart(2, "0")}
      </div>
    </div>
  );
}
