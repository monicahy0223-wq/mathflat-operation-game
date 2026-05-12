import type { TeacherAppSettings, ClassInfo, StudentRecord } from "../types/teacher";

const TEACHER_APP_KEY = "mathGameTeacherApp";
const SCHEMA_VERSION = 2; // bump when defaults change; triggers migration on stale saved data

const DEFAULT_CLASS: ClassInfo = {
  id: "class-1",
  name: "2학년 1반",
  grade: 2,
  textbookId: "visang",
};

// MathGame의 DEFAULT_STUDENTS(s0·s1·s2)와 동일한 id/name
const DEFAULT_STUDENTS: StudentRecord[] = [
  { id: "s0", name: "김민준" },
  { id: "s1", name: "이서연" },
  { id: "s2", name: "박지우" },
];

function makeDefaults(): TeacherAppSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeClassId: "class-1",
    classes: [{ ...DEFAULT_CLASS }],
    students: DEFAULT_STUDENTS.map((s) => ({ ...s })),
  } as TeacherAppSettings & { schemaVersion: number };
}

export function loadTeacherAppSettings(): TeacherAppSettings {
  if (typeof window === "undefined") return makeDefaults();
  try {
    const raw = localStorage.getItem(TEACHER_APP_KEY);
    if (!raw) {
      const d = makeDefaults();
      syncStudentsToGameList(d.students);
      saveTeacherAppSettings(d);
      return d;
    }
    const parsed = JSON.parse(raw) as TeacherAppSettings & { schemaVersion?: number };

    // ── 마이그레이션: 학생이 없는 이전 버전 데이터 복구 ──────────────────────
    const needsMigration =
      !parsed.schemaVersion ||
      parsed.schemaVersion < SCHEMA_VERSION ||
      !Array.isArray(parsed.students) ||
      parsed.students.length === 0;

    if (needsMigration) {
      const students =
        Array.isArray(parsed.students) && parsed.students.length > 0
          ? parsed.students
          : DEFAULT_STUDENTS.map((s) => ({ ...s }));
      const migrated = {
        ...parsed,
        schemaVersion: SCHEMA_VERSION,
        classes: parsed.classes?.length ? parsed.classes : [{ ...DEFAULT_CLASS }],
        activeClassId: parsed.activeClassId || "class-1",
        students,
      } as TeacherAppSettings & { schemaVersion: number };
      saveTeacherAppSettings(migrated);
      syncStudentsToGameList(migrated.students);
      return migrated;
    }

    if (!parsed.classes?.length) parsed.classes = [{ ...DEFAULT_CLASS }];
    if (!parsed.activeClassId) parsed.activeClassId = parsed.classes[0].id;
    return parsed;
  } catch {
    const d = makeDefaults();
    saveTeacherAppSettings(d);
    syncStudentsToGameList(d.students);
    return d;
  }
}

export function saveTeacherAppSettings(s: TeacherAppSettings): void {
  try { localStorage.setItem(TEACHER_APP_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Sync teacher student roster into the key MathGame reads for student selection. */
export function syncStudentsToGameList(students: StudentRecord[]): void {
  try {
    const list = students.map((s) => ({ id: s.id, name: s.name }));
    localStorage.setItem(
      "mathGameStudentList",
      JSON.stringify({ students: list, selectedId: list[0]?.id ?? "" })
    );
  } catch { /* ignore */ }
}

export function getActiveClass(settings: TeacherAppSettings): ClassInfo {
  return settings.classes.find((c) => c.id === settings.activeClassId) ?? settings.classes[0];
}

export function getActiveTextbookId(): string {
  const s = loadTeacherAppSettings();
  return getActiveClass(s).textbookId ?? "visang";
}
