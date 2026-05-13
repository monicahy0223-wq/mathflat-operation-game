export type TextbookPublisher =
  | "교육부"
  | "아이스크림"
  | "동아출판"
  | "미래엔"
  | "비상교육"
  | "YBM"
  | "지학사"
  | "천재교과서(박)"
  | "천재교과서(한)"
  | "디딤돌"
  | "천재교육";

export type TextbookUnit = {
  id: string;
  title: string;
};

export type Textbook = {
  id: string;
  publisher: TextbookPublisher;
  name: string;
  grade: number;
  semester: number;
  units: TextbookUnit[];
};

export type StudentRecord = {
  id: string;
  name: string;
};

export type ClassInfo = {
  id: string;
  name: string;
  grade: number;
  semester: number;
  textbookId: string;
};

export type TeacherAppSettings = {
  activeClassId: string;
  classes: ClassInfo[];
  students: StudentRecord[];
};

// ── Textbook data ──────────────────────────────────────────────────────────────
import { getUnitsForTextbook } from "../lib/textbookUnits";

const PUB_SLUG: Record<TextbookPublisher, string> = {
  "교육부":         "edu",
  "아이스크림":     "icream",
  "동아출판":       "donga",
  "미래엔":         "miraen",
  "비상교육":       "visang",
  "YBM":            "ybm",
  "지학사":         "jihaksa",
  "천재교과서(박)": "chunjae-bak",
  "천재교과서(한)": "chunjae-han",
  "디딤돌":           "didimdon",
  "천재교육":       "chunjae-edu",
};

function makeTextbooks(grade: number, semester: number, publishers: TextbookPublisher[]): Textbook[] {
  return publishers.map((publisher) => {
    const slug = PUB_SLUG[publisher];
    const unitTitles = getUnitsForTextbook(grade, semester, publisher);
    return {
      id: `${slug}-${grade}-${semester}`,
      publisher,
      name: `${publisher} 수학 ${grade}-${semester}`,
      grade,
      semester,
      units: unitTitles.map((title, i) => ({ id: `${slug}-${grade}-${semester}-u${i + 1}`, title })),
    };
  });
}

const STANDARD_PUBLISHERS: TextbookPublisher[] = [
  "아이스크림", "동아출판", "미래엔", "비상교육", "YBM",
  "지학사", "천재교과서(박)", "천재교과서(한)", "디딤돌",
];

export const TEXTBOOK_OPTIONS: Textbook[] = [
  // 1–2학년: 교육부
  ...makeTextbooks(1, 1, ["교육부"]),
  ...makeTextbooks(1, 2, ["교육부"]),
  ...makeTextbooks(2, 1, ["교육부"]),
  ...makeTextbooks(2, 2, ["교육부"]),
  // 3학년
  ...makeTextbooks(3, 1, STANDARD_PUBLISHERS),
  ...makeTextbooks(3, 2, STANDARD_PUBLISHERS),
  // 4학년
  ...makeTextbooks(4, 1, STANDARD_PUBLISHERS),
  ...makeTextbooks(4, 2, STANDARD_PUBLISHERS),
  // 5학년
  ...makeTextbooks(5, 1, STANDARD_PUBLISHERS),
  ...makeTextbooks(5, 2, ["미래엔", "천재교과서(한)", "아이스크림", "천재교육"]),
  // 6학년
  ...makeTextbooks(6, 1, STANDARD_PUBLISHERS),
  ...makeTextbooks(6, 2, ["미래엔", "천재교과서(한)", "아이스크림", "천재교육", "디딤돌", "비상교육"]),
];

export function getTextbooksForGradeSemester(grade: number, semester: number): Textbook[] {
  return TEXTBOOK_OPTIONS.filter((t) => t.grade === grade && t.semester === semester);
}
