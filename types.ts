
export interface AnalysisItem {
  page: number;
  problemId: number;
  title: string;
  content: string; // Markdown analysis for this specific problem
  scaffolding?: string; // 降階提問
  literacy?: string; // 素養提問
  visualCue: string; // Description of where to look in the image
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] normalized to 1000
}

export interface AnalysisResult {
  items: AnalysisItem[];
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

export interface UploadedFile {
  id: string;
  data: string; // base64
  mimeType: string;
}
