"use client";

import { useState } from "react";
import { getTextbooksForGradeSemester, TEXTBOOK_OPTIONS } from "../../types/teacher";
import type { TeacherAppSettings, ClassInfo, StudentRecord } from "../../types/teacher";
import { loadTeacherAppSettings, saveTeacherAppSettings, syncStudentsToGameList, getActiveClass } from "../../lib/teacherStorage";

type Props = {
  onBack: () => void;
};

type Tab = "class" | "students";

export default function TeacherSettings({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>("class");
  const [settings, setSettings] = useState<TeacherAppSettings>(() => loadTeacherAppSettings());
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [pendingClass, setPendingClass] = useState<ClassInfo | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const activeClass = getActiveClass(settings);
  const displayClass = isEditingClass && pendingClass ? pendingClass : activeClass;
  const filteredTextbooks = getTextbooksForGradeSemester(displayClass.grade, displayClass.semester);
  const selectedTextbook = TEXTBOOK_OPTIONS.find((t) => t.id === displayClass.textbookId);

  function persist(next: TeacherAppSettings) {
    setSettings(next);
    saveTeacherAppSettings(next);
    syncStudentsToGameList(next.students);
  }

  function updateClass(patch: Partial<ClassInfo>) {
    persist({
      ...settings,
      classes: settings.classes.map((c) => c.id === activeClass.id ? { ...c, ...patch } : c),
    });
  }

  function startEditing() {
    setPendingClass({ ...activeClass });
    setIsEditingClass(true);
  }

  function finishEditing() {
    if (pendingClass) updateClass(pendingClass);
    setIsEditingClass(false);
    setPendingClass(null);
  }

  function cancelEditing() {
    setIsEditingClass(false);
    setPendingClass(null);
  }

  function switchTab(t: Tab) {
    cancelEditing();
    setTab(t);
  }

  function selectGrade(grade: number) {
    if (!pendingClass) return;
    const suffix = pendingClass.name.replace(/^\d+학년\s*(?:\d+학기\s*)?/, "").trim() || "1반";
    setPendingClass({ ...pendingClass, grade, textbookId: "", name: `${grade}학년 ${pendingClass.semester}학기 ${suffix}` });
  }

  function selectSemester(semester: number) {
    if (!pendingClass) return;
    const suffix = pendingClass.name.replace(/^\d+학년\s*(?:\d+학기\s*)?/, "").trim() || "1반";
    setPendingClass({ ...pendingClass, semester, textbookId: "", name: `${pendingClass.grade}학년 ${semester}학기 ${suffix}` });
  }

  function selectTextbook(textbookId: string) {
    if (!pendingClass) return;
    setPendingClass({ ...pendingClass, textbookId });
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

  const SELECTED_STYLE = {
    background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
    border: "2px solid #3b82f6",
    color: "#fff",
    boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
  };
  const UNSELECTED_STYLE = {
    background: "rgba(255,255,255,0.06)",
    border: "2px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)",
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 50%,#0d2a4a 100%)", color: "#e2e8f0" }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors font-bold text-lg leading-none">←</button>
        <h1 className="font-black text-white text-xl">학급 관리</h1>
      </div>

      {/* 탭 — 콘텐츠와 동일한 너비 제한 */}
      <div className="flex-shrink-0 w-full">
        <div className="flex gap-2 px-3 pt-4 pb-2 max-w-2xl mx-auto w-full">
          {(["class", "students"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
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
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto px-3 py-4 flex flex-col gap-5 max-w-2xl w-full mx-auto">

        {/* ── 학급 설정 탭 ── */}
        {tab === "class" && (
          <>
            {/* 학급 정보 요약 */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider">학급 정보</h2>
                {!isEditingClass && (
                  <button
                    onClick={startEditing}
                    className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                  >
                    편집
                  </button>
                )}
              </div>
              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-white text-xl">{displayClass.name}</div>
                    <div className="text-sky-300 text-sm mt-0.5 font-bold">
                      {displayClass.grade}학년 {displayClass.semester}학기
                    </div>
                    <div className="text-slate-400 text-sm mt-0.5">
                      {selectedTextbook?.name ?? "교과서 미선택"}
                    </div>
                  </div>
                  <div className="flex text-right self-center gap-1">
                    <div className="font-black text-emerald-400 text-3xl">{settings.students.length}</div>
                    <div className="text-slate-400 text-xs self-center">명</div>
                  </div>
                </div>
              </div>
            </section>

            {/* 편집 영역 */}
            {isEditingClass && (
              <>
                {/* 학년 선택 */}
                <section>
                  <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider mb-3">학년 선택</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <button
                        key={g}
                        onClick={() => selectGrade(g)}
                        className="rounded-2xl py-3 font-black text-sm transition-all active:scale-95"
                        style={displayClass.grade === g ? SELECTED_STYLE : UNSELECTED_STYLE}
                      >
                        {g}학년
                      </button>
                    ))}
                  </div>
                </section>

                {/* 학기 선택 */}
                <section>
                  <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider mb-3">학기 선택</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => selectSemester(s)}
                        className="rounded-2xl py-3 font-black text-sm transition-all active:scale-95"
                        style={displayClass.semester === s ? SELECTED_STYLE : UNSELECTED_STYLE}
                      >
                        {s}학기
                      </button>
                    ))}
                  </div>
                </section>

                {/* 교과서 선택 */}
                <section>
                  <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider mb-3">
                    교과서 선택
                    <span className="text-slate-400 font-normal normal-case ml-2 text-xs">
                      {displayClass.grade}학년 {displayClass.semester}학기 · {filteredTextbooks.length}종
                    </span>
                  </h2>
                  {filteredTextbooks.length === 0 ? (
                    <div className="rounded-2xl p-6 text-center text-slate-500 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)" }}>
                      해당 학년/학기의 교과서 정보가 없습니다
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {filteredTextbooks.map((tb) => {
                        const selected = displayClass.textbookId === tb.id;
                        return (
                          <button
                            key={tb.id}
                            onClick={() => selectTextbook(tb.id)}
                            className="rounded-2xl p-3 text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-1"
                            style={{
                              background: selected ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "rgba(255,255,255,0.06)",
                              border: `2px solid ${selected ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                              boxShadow: selected ? "0 4px 16px rgba(59,130,246,0.4)" : "none",
                              minHeight: 64,
                            }}
                          >
                            <div className="font-black text-white text-xs leading-tight">{tb.publisher}</div>
                            {selected && <div className="text-blue-200 text-xs font-bold">✓</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 단원 목차 */}
                {selectedTextbook && (
                  <section>
                    <h2 className="font-black text-sky-300 text-xs uppercase tracking-wider mb-3">
                      단원 목차
                      <span className="text-slate-400 font-normal normal-case ml-2 text-xs">
                        {selectedTextbook.name}
                      </span>
                    </h2>
                    {selectedTextbook.units.length === 0 ? (
                      <div className="rounded-2xl p-6 text-center text-slate-500 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)" }}>
                        단원 정보 준비 중...
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {selectedTextbook.units.map((unit, idx) => (
                          <div
                            key={unit.id}
                            className="rounded-2xl px-4 py-3 flex items-center gap-3"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            <div
                              className="rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                              style={{ width: 34, height: 34, background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}
                            >
                              {idx + 1}
                            </div>
                            <span className="flex-1 text-white font-semibold text-sm">{unit.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* 완료 버튼 */}
                <button
                  onClick={finishEditing}
                  className="w-full rounded-2xl py-3.5 font-black text-sm transition-all active:scale-95 text-white"
                  style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}
                >
                  완료
                </button>
              </>
            )}
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
