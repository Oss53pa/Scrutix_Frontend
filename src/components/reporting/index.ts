// Reporting Components - Scrutix Report Viewer System

// Main viewer
export { ReportViewer } from './ReportViewer';

// Page components
export { ReportCoverPage } from './ReportCoverPage';
export { ReportBackCover } from './ReportBackCover';
export { ReportContentPage } from './ReportContentPage';

// Data visualization
export { ReportTable } from './ReportTable';
export { ReportChart } from './ReportChart';

// Sidebar components
export { ReportCommentsSidebar } from './ReportCommentsSidebar';
export { ReportCoverEditor } from './ReportCoverEditor';
export { ReportContentEditor } from './ReportContentEditor';
export { ReportSectionEditor } from './ReportSectionEditor';

// Scrutix-specific report generator
export { generateScrutixAuditReport, useScrutixAuditReport } from './ScrutixAuditReport';
