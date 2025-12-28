// Types pour le système de rapports Scrutix (Report Viewer)

export interface ReportViewerConfig {
  id: string;
  title: string;
  subtitle?: string;
  clientName: string;
  clientLogo?: string;
  auditorName: string;
  auditorLogo?: string;
  period: {
    start: Date;
    end: Date;
  };
  createdAt: Date;
  type: ReportType;
  status: 'draft' | 'review' | 'final';
  language: 'fr' | 'en';
  currency: 'XAF' | 'XOF' | 'EUR';
}

export type ReportType = 'audit' | 'summary' | 'detailed' | 'recovery' | 'custom';

export interface ReportCoverConfig {
  // Identité visuelle
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Logo et images
  logo?: string;
  backgroundImage?: string;
  watermark?: string;

  // Textes
  title: string;
  subtitle?: string;
  clientName: string;
  reference?: string;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'secret';

  // Informations additionnelles
  authorName?: string;
  authorTitle?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Date et période
  date: Date;
  period?: {
    start: Date;
    end: Date;
  };

  // Version
  version?: string;
}

export interface ReportBackCoverConfig {
  // Coordonnées
  companyName: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;

  // Légal
  legalMention?: string;
  disclaimer?: string;
  copyright?: string;

  // Réseaux sociaux
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };

  // Design
  showLogo: boolean;
  showQRCode: boolean;
  qrCodeUrl?: string;
  backgroundColor: string;
  textColor: string;
}

export interface ReportViewerSection {
  id: string;
  type: 'cover' | 'toc' | 'summary' | 'content' | 'table' | 'chart' | 'backcover';
  title?: string;
  pageNumber?: number;
  content?: any;
  visible: boolean;
}

export interface ReportComment {
  id: string;
  sectionId: string;
  pageNumber: number;
  author: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  resolved: boolean;
  replies?: ReportCommentReply[];
  position?: {
    x: number;
    y: number;
  };
}

export interface ReportCommentReply {
  id: string;
  author: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
}

export interface ReportTableData {
  id: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
  striped?: boolean;
  sortable?: boolean;
}

export interface ReportChartData {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'donut' | 'area';
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  colors?: string[];
  showLegend?: boolean;
  showValues?: boolean;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ReportStatistic {
  id: string;
  label: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: string;
  color?: string;
}

export interface ReportViewerPage {
  id: string;
  pageNumber: number;
  type: 'cover' | 'toc' | 'content' | 'chart' | 'table' | 'backcover';
  sections: ReportViewerSection[];
  header?: {
    show: boolean;
    title?: string;
    logo?: string;
  };
  footer?: {
    show: boolean;
    showPageNumber: boolean;
    text?: string;
  };
}

export interface FullReport {
  config: ReportViewerConfig;
  coverConfig: ReportCoverConfig;
  backCoverConfig: ReportBackCoverConfig;
  pages: ReportViewerPage[];
  comments: ReportComment[];
  statistics: ReportStatistic[];
  tables: ReportTableData[];
  charts: ReportChartData[];
}
