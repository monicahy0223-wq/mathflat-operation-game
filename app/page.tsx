"use client";

import { useState } from "react";
import ModeSelect from "../components/ModeSelect";
import MathGame from "../components/MathGame";
import TeacherApp from "../components/teacher/TeacherApp";

type AppMode = "select" | "student" | "teacher";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("select");

  if (mode === "select") {
    return <ModeSelect onSelect={(m) => setMode(m)} />;
  }
  if (mode === "teacher") {
    return <TeacherApp onExit={() => setMode("select")} />;
  }
  return <MathGame studentMode onExit={() => setMode("select")} />;
}
