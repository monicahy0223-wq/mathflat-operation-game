"use client";

import { useState } from "react";
import { TEXTBOOK_OPTIONS } from "../../types/teacher";
import type { TeacherAppSettings, StudentRecord } from "../../types/teacher";
import { loadTeacherAppSettings, saveTeacherAppSettings, syncStudentsToGameList, getActiveClass } from "../../lib/teacherStorage";

type Props = {
  onBack: () => void;
};

type Tab = "class" | "students";

export default function TeacherSettings({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>("class");
  const [settings, setSettings] = useState<TeacherAppSettings>(() => loadTeacherAppSettings());
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const activeClass = getActiveClass(settings);
  const selectedTextbook = TEXTBOOK_OPTIONS.find((t) => t.id === activeClass.textbookId);

  function persist(next: TeacherAppSettings) {
    setSettings(next);
    saveTeacherAppSettings(next);
    syncStudentsToGameList(next.students);
  }

  function selectTextbook(textbookId: string) {
    persist({ ...settings, classes: settings.classes.map((c) => c.id === activeClass.id ? { ...c, textbookId } : c) });
  }

  function addStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    persist({ ...settings, students: [...settings.students, { id: `student-${Date.now()}`, name }] });
    setNewStudentName("");
    setAddingStudent(false);
  }

  function updateStudent(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    persist({ ...settings, students: settings.students.map((s) => s.id === id ? { ...s, name: trimmed } : s) });
    setEditingStudent(null);
  }

  function deleteStudent(id: string) {
    persist({ ...settings, students: settings.students.filter((s) => s.id !== id) });
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#0d2a4a 100%)", color: "#e2e8f0" }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors font-bold text-lg leading-none">←</button>
        <h1 className="font-black text-white text-xl">학급 관리</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 px-5 pt-4 pb-2 flex-shrink-0">
        {(["class", "students"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-2xl py-2.5 font-black text-sm transition-all active:scale-95"
            style={{
              background: tab === t ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "rgba(255,255,255,0.06)",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.45)",
              border: `1.5px solid ${tab === t ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {t === "class" ? "📚 학급 설정" : "👦 학생 목록"}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-5 max-w-xl w-full mx-auto">

        {/* ── 학급 설정 탭 ── */}
        {tab === "class" && (
          <>
            <section>
              <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider mb-3">교과서 선택</h2>
              <div className="grid grid-cols-2 gap-2">
                {TEXTBOOK_OPTIONS.map((tb) => {
                  const selected = activeClass.textbookId === tb.id;
                  return (
                    <button
                      key={tb.id}
                      onClick={() => selectTextbook(tb.id)}
                      className="rounded-2xl p-4 text-left transition-all active:scale-95"
                      style={{
                        background: selected ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "rgba(255,255,255,0.06)",
                        border: `2px solid ${selected ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                        boxShadow: selected ? "0 4px 16px rgba(59,130,246,0.4)" : "none",
                      }}
                    >
                      <div className="font-black text-white text-sm">{tb.publisher}</div>
                      <div className="text-slate-300 text-xs mt-0.5">{tb.name}</div>
                      {selected && <div className="mt-2 text-blue-200 text-xs font-bold">✓ 선택됨</div>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider mb-3">학급 정보</h2>
              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-white text-xl">{activeClass.name}</div>
                    <div className="text-slate-400 text-sm mt-1">{selectedTextbook?.name ?? "교과서 미선택"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-400 text-3xl">{settings.students.length}</div>
                    <div className="text-slate-400 text-xs">명</div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── 학생 목록 탭 ── */}
        {tab === "students" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider">학생 목록</h2>
              <button
                onClick={() => { setAddingStudent(true); setNewStudentName(""); }}
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
              >
                + 추가
              </button>
            </div>

            {addingStudent && (
              <div className="flex gap-2 mb-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="학생 이름"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addStudent(); if (e.key === "Escape") { setAddingStudent(false); setNewStudentName(""); } }}
                  className="flex-1 rounded-xl px-4 py-2 text-sm font-medium outline-none"
                  style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
                />
                <button onClick={addStudent} className="rounded-xl px-3 py-2 text-sm font-bold text-white" style={{ background: "#059669" }}>추가</button>
                <button onClick={() => { setAddingStudent(false); setNewStudentName(""); }} className="rounded-xl px-3 py-2 text-sm font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>취소</button>
              </div>
            )}

            {settings.students.length === 0 && !addingStudent ? (
              <div className="rounded-2xl p-8 text-center text-slate-500 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)" }}>
                학생을 추가해주세요
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {settings.students.map((student, idx) => (
                  <div key={student.id} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0" style={{ width: 34, height: 34, background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>
                      {idx + 1}
                    </div>
                    {editingStudent?.id === student.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingStudent.name}
                        onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") updateStudent(student.id, editingStudent.name); if (e.key === "Escape") setEditingStudent(null); }}
                        className="flex-1 rounded-lg px-2 py-1 text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}
                      />
                    ) : (
                      <span className="flex-1 text-white font-semibold text-sm">{student.name}</span>
                    )}
                    <div className="flex gap-1 flex-shrink-0">
                      {editingStudent?.id === student.id ? (
                        <>
                          <button onClick={() => updateStudent(student.id, editingStudent.name)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: "#059669" }}>저장</button>
                          <button onClick={() => setEditingStudent(null)} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingStudent({ ...student })} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>수정</button>
                          <button onClick={() => deleteStudent(student.id)} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>삭제</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
