export interface HandbookLink {
  label: string;
  route: string;
  note: string;
}

export interface HandbookScenario {
  title: string;
  summary: string;
  steps: string[];
  route?: string;
}

export interface HandbookGalleryItem {
  title: string;
  description: string;
  image: string;
  route?: string;
}

export interface HandbookVideo {
  title: string;
  description: string;
  src: string;
  poster: string;
}

export interface HandbookWorkflowStage {
  title: string;
  description: string;
  steps: string[];
  successSignal: string;
  route?: string;
}

export interface HandbookPitfall {
  title: string;
  detail: string;
}

export interface HandbookFaqItem {
  question: string;
  answer: string;
}

export interface HandbookPlaybook {
  headline: string;
  stages: HandbookWorkflowStage[];
  pitfalls: HandbookPitfall[];
  faq: HandbookFaqItem[];
}

export interface HandbookConfig {
  title: string;
  subtitle: string;
  summary: string;
  focusLabel: string;
  focusValue: string;
  heroImage: string;
  heroAlt: string;
  guardrails: string[];
  scenarios: HandbookScenario[];
  quickLinks: HandbookLink[];
  gallery: HandbookGalleryItem[];
  videos: HandbookVideo[];
  deepDive?: HandbookLink;
}

const INTERNAL_IMAGE_BASE = '/assets/internal-handbook/images';
const INTERNAL_VIDEO_BASE = '/assets/internal-handbook/videos';
const TEACHER_IMAGE_BASE = '/assets/teacher-docs/assets';
const TEACHER_VIDEO_BASE = '/assets/teacher-docs/videos';

export const internalImage = (name: string) => `${INTERNAL_IMAGE_BASE}/${name}.webp`;
export const internalVideo = (name: string) => `${INTERNAL_VIDEO_BASE}/${name}.webm`;
export const teacherImage = (name: string) => `${TEACHER_IMAGE_BASE}/${name}.webp`;
export const teacherVideo = (name: string) => `${TEACHER_VIDEO_BASE}/${name}.webm`;
