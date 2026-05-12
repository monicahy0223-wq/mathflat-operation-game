export type TextbookPublisher = "비상교육" | "천재교육" | "미래엔" | "지학사";

export type Textbook = {
  id: string;
  publisher: TextbookPublisher;
  name: string;
  grade: number;
  semester: number;
};

export const TEXTBOOK_OPTIONS: Textbook[] = [
  { id: "visang",  publisher: "비상교육", name: "비상교육 수학 2-1", grade: 2, semester: 1 },
  { id: "chunjae", publisher: "천재교육", name: "천재교육 수학 2-1", grade: 2, semester: 1 },
  { id: "miraen",  publisher: "미래엔",   name: "미래엔 수학 2-1",   grade: 2, semester: 1 },
  { id: "jihaksa", publisher: "지학사",   name: "지학사 수학 2-1",   grade: 2, semester: 1 },
];

export type StudentRecord = {
  id: string;
  name: string;
};

export type ClassInfo = {
  id: string;
  name: string;
  grade: number;
  textbookId: string;
};

export type TeacherAppSettings = {
  activeClassId: string;
  classes: ClassInfo[];
  students: StudentRecord[];
};
