"use client";

import { useState } from "react";
import TeacherMain from "./TeacherMain";
import TeacherSettings from "./TeacherSettings";
import TeacherDashboard from "./TeacherDashboard";
import TeacherStudentView from "./TeacherStudentView";
import MathGame from "../MathGame";

type TeacherPhase = "game" | "main" | "classSettings" | "dashboard" | "studentView";

type Props = {
  onExit: () => void;
};

export default function TeacherApp({ onExit }: Props) {
  const [phase, setPhase] = useState<TeacherPhase>("game");

  if (phase === "classSettings") {
    return <TeacherSettings onBack={() => setPhase("main")} />;
  }
  if (phase === "dashboard") {
    return <TeacherDashboard onBack={() => setPhase("main")} />;
  }
  if (phase === "studentView") {
    return <TeacherStudentView onBack={() => setPhase("main")} />;
  }
  if (phase === "main") {
    return (
      <TeacherMain
        onGoClassSettings={() => setPhase("classSettings")}
        onGoDashboard={() => setPhase("dashboard")}
        onGoStudentView={() => setPhase("studentView")}
        onBack={() => setPhase("game")}
        onExit={onExit}
      />
    );
  }
  // phase === "game": 교사가 학생 화면을 보는 상태 (기본 진입)
  return (
    <MathGame
      onTeacherMenu={() => setPhase("main")}
      onExit={onExit}
    />
  );
}
