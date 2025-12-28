import { useState, useRef, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  Share2,
  MessageSquare,
  Edit3,
  Eye,
  Maximize2,
  Minimize2,
  FileText,
  Settings,
  Palette,
  LayoutGrid,
  List,
  BookOpen,
} from 'lucide-react';
import { Button, Badge } from '../ui';
import { ReportCoverPage } from './ReportCoverPage';
import { ReportBackCover } from './ReportBackCover';
import { ReportContentPage } from './ReportContentPage';
import { ReportCommentsSidebar } from './ReportCommentsSidebar';
import { ReportCoverEditor } from './ReportCoverEditor';
import { ReportContentEditor } from './ReportContentEditor';
import type {
  FullReport,
  ReportComment,
  ReportCoverConfig,
  ReportBackCoverConfig,
} from '../../types';

interface ReportViewerProps {
  report: FullReport;
  onClose: () => void;
  onSave?: (report: FullReport) => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  readOnly?: boolean;
}

type ViewMode = 'single' | 'double' | 'scroll';
type SidebarTab = 'content' | 'comments' | 'cover' | 'settings';

export function ReportViewer({
  report,
  onClose,
  onSave,
  onExportPDF,
  onExportExcel,
  readOnly = false,
}: ReportViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('content');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [editingBackCover, setEditingBackCover] = useState(false);

  // Local state for editable report
  const [localReport, setLocalReport] = useState<FullReport>(report);
  const [comments, setComments] = useState<ReportComment[]>(report.comments || []);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate total pages (cover + content + backcover)
  const totalPages = localReport.pages.length + 2; // +2 for cover and backcover

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentPage((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoom((prev) => Math.min(prev + 10, 200));
      } else if (e.key === '-') {
        setZoom((prev) => Math.max(prev - 10, 50));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages, isFullscreen, onClose]);

  // Handle fullscreen
  useEffect(() => {
    if (isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  // Navigation
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  // Zoom controls
  const zoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const resetZoom = () => setZoom(100);

  // Comment handlers
  const addComment = (comment: Omit<ReportComment, 'id' | 'createdAt'>) => {
    const newComment: ReportComment = {
      ...comment,
      id: `comment-${Date.now()}`,
      createdAt: new Date(),
      resolved: false,
    };
    setComments((prev) => [...prev, newComment]);
  };

  const resolveComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
    );
  };

  const deleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  // Cover config update
  const updateCoverConfig = (config: Partial<ReportCoverConfig>) => {
    setLocalReport((prev) => ({
      ...prev,
      coverConfig: { ...prev.coverConfig, ...config },
    }));
  };

  const updateBackCoverConfig = (config: Partial<ReportBackCoverConfig>) => {
    setLocalReport((prev) => ({
      ...prev,
      backCoverConfig: { ...prev.backCoverConfig, ...config },
    }));
  };

  // Render current page content
  const renderPageContent = () => {
    if (currentPage === 0) {
      // Cover page
      return (
        <ReportCoverPage
          config={localReport.coverConfig}
          onEdit={readOnly ? undefined : () => setEditingCover(true)}
        />
      );
    } else if (currentPage === totalPages - 1) {
      // Back cover
      return (
        <ReportBackCover
          config={localReport.backCoverConfig}
          onEdit={readOnly ? undefined : () => setEditingBackCover(true)}
        />
      );
    } else {
      // Content pages
      const pageIndex = currentPage - 1;
      const page = localReport.pages[pageIndex];
      if (!page) return null;

      return (
        <ReportContentPage
          page={page}
          report={localReport}
          pageNumber={currentPage}
          totalPages={totalPages}
        />
      );
    }
  };

  // Get page label
  const getPageLabel = () => {
    if (currentPage === 0) return 'Page de garde';
    if (currentPage === totalPages - 1) return 'Couverture arrière';
    return `Page ${currentPage}`;
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-primary-950 flex flex-col ${
        isFullscreen ? '' : ''
      }`}
    >
      {/* Header Toolbar */}
      <div className="flex-shrink-0 h-14 bg-primary-900 border-b border-primary-700 flex items-center justify-between px-4">
        {/* Left: Title and info */}
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary-800 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="border-l border-primary-700 pl-4">
            <h2 className="text-white font-semibold truncate max-w-md">
              {localReport.config.title}
            </h2>
            <p className="text-primary-400 text-xs">{localReport.config.clientName}</p>
          </div>
          <Badge
            variant={
              localReport.config.status === 'final'
                ? 'success'
                : localReport.config.status === 'review'
                ? 'warning'
                : 'info'
            }
          >
            {localReport.config.status === 'final'
              ? 'Final'
              : localReport.config.status === 'review'
              ? 'En révision'
              : 'Brouillon'}
          </Badge>
        </div>

        {/* Center: Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="p-2 hover:bg-primary-800 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-1.5 bg-primary-800 rounded-lg text-white text-sm min-w-[140px] text-center">
            {getPageLabel()} ({currentPage + 1} / {totalPages})
          </div>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
            className="p-2 hover:bg-primary-800 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={zoomOut}
              className="p-2 hover:bg-primary-800 rounded transition-colors text-white"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 hover:bg-primary-800 rounded transition-colors text-white text-sm min-w-[50px]"
            >
              {zoom}%
            </button>
            <button
              onClick={zoomIn}
              className="p-2 hover:bg-primary-800 rounded transition-colors text-white"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* View mode */}
          <div className="flex items-center border-l border-primary-700 pl-2 mr-2">
            <button
              onClick={() => setViewMode('single')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'single'
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-400 hover:bg-primary-800 hover:text-white'
              }`}
              title="Vue simple"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('double')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'double'
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-400 hover:bg-primary-800 hover:text-white'
              }`}
              title="Vue double"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('scroll')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'scroll'
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-400 hover:bg-primary-800 hover:text-white'
              }`}
              title="Vue défilement"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-primary-800 rounded transition-colors text-white"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-2 rounded transition-colors ${
              showSidebar
                ? 'bg-primary-700 text-white'
                : 'text-primary-400 hover:bg-primary-800 hover:text-white'
            }`}
            title="Panneau latéral"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <div className="border-l border-primary-700 pl-2 flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportPDF}
              className="bg-primary-800 text-white border-primary-700 hover:bg-primary-700"
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportExcel}
              className="bg-primary-800 text-white border-primary-700 hover:bg-primary-700"
            >
              <Download className="w-4 h-4 mr-1" />
              Excel
            </Button>
            <button
              onClick={() => window.print()}
              className="p-2 hover:bg-primary-800 rounded transition-colors text-white"
              title="Imprimer"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page thumbnails (left sidebar) */}
        <div className="w-20 bg-primary-900 border-r border-primary-700 overflow-y-auto py-2">
          {/* Cover */}
          <button
            onClick={() => goToPage(0)}
            className={`w-full p-2 ${
              currentPage === 0 ? 'bg-primary-700' : 'hover:bg-primary-800'
            }`}
          >
            <div className="w-14 h-20 mx-auto bg-white rounded shadow-sm flex items-center justify-center text-xs text-primary-400">
              Garde
            </div>
            <p className="text-xs text-primary-400 mt-1 text-center">1</p>
          </button>

          {/* Content pages */}
          {localReport.pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => goToPage(index + 1)}
              className={`w-full p-2 ${
                currentPage === index + 1 ? 'bg-primary-700' : 'hover:bg-primary-800'
              }`}
            >
              <div className="w-14 h-20 mx-auto bg-white rounded shadow-sm flex items-center justify-center text-xs text-primary-400">
                {page.type}
              </div>
              <p className="text-xs text-primary-400 mt-1 text-center">{index + 2}</p>
            </button>
          ))}

          {/* Back cover */}
          <button
            onClick={() => goToPage(totalPages - 1)}
            className={`w-full p-2 ${
              currentPage === totalPages - 1 ? 'bg-primary-700' : 'hover:bg-primary-800'
            }`}
          >
            <div className="w-14 h-20 mx-auto bg-primary-800 rounded shadow-sm flex items-center justify-center text-xs text-primary-400">
              Fin
            </div>
            <p className="text-xs text-primary-400 mt-1 text-center">{totalPages}</p>
          </button>
        </div>

        {/* Main viewing area */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto bg-primary-800 flex items-center justify-center p-8"
        >
          <div
            className="bg-white shadow-2xl transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center center',
              width: '210mm',
              minHeight: '297mm',
            }}
          >
            {renderPageContent()}
          </div>
        </div>

        {/* Right sidebar */}
        {showSidebar && (
          <div className="w-[420px] bg-white border-l border-primary-200 flex flex-col">
            {/* Sidebar tabs */}
            <div className="flex-shrink-0 border-b border-primary-200">
              <div className="flex">
                <button
                  onClick={() => setSidebarTab('content')}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${
                    sidebarTab === 'content'
                      ? 'border-primary-900 text-primary-900'
                      : 'border-transparent text-primary-500 hover:text-primary-700'
                  }`}
                >
                  <BookOpen className="w-4 h-4 inline mr-0.5" />
                  Contenu
                </button>
                <button
                  onClick={() => setSidebarTab('comments')}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${
                    sidebarTab === 'comments'
                      ? 'border-primary-900 text-primary-900'
                      : 'border-transparent text-primary-500 hover:text-primary-700'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 inline mr-0.5" />
                  Notes
                </button>
                <button
                  onClick={() => setSidebarTab('cover')}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${
                    sidebarTab === 'cover'
                      ? 'border-primary-900 text-primary-900'
                      : 'border-transparent text-primary-500 hover:text-primary-700'
                  }`}
                >
                  <Palette className="w-4 h-4 inline mr-0.5" />
                  Design
                </button>
                <button
                  onClick={() => setSidebarTab('settings')}
                  className={`flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${
                    sidebarTab === 'settings'
                      ? 'border-primary-900 text-primary-900'
                      : 'border-transparent text-primary-500 hover:text-primary-700'
                  }`}
                >
                  <Settings className="w-4 h-4 inline mr-0.5" />
                  Options
                </button>
              </div>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'content' && (
                <ReportContentEditor
                  report={localReport}
                  currentPage={currentPage}
                  onUpdateReport={setLocalReport}
                  onNavigateToPage={goToPage}
                  readOnly={readOnly}
                />
              )}

              {sidebarTab === 'comments' && (
                <ReportCommentsSidebar
                  comments={comments}
                  currentPage={currentPage}
                  onAddComment={addComment}
                  onResolveComment={resolveComment}
                  onDeleteComment={deleteComment}
                  readOnly={readOnly}
                />
              )}

              {sidebarTab === 'cover' && (
                <ReportCoverEditor
                  coverConfig={localReport.coverConfig}
                  backCoverConfig={localReport.backCoverConfig}
                  onUpdateCover={updateCoverConfig}
                  onUpdateBackCover={updateBackCoverConfig}
                  readOnly={readOnly}
                />
              )}

              {sidebarTab === 'settings' && (
                <div className="p-4 space-y-4">
                  <h3 className="font-semibold text-primary-900">Options du rapport</h3>
                  {/* Settings content */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm text-primary-700">Afficher les numéros de page</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm text-primary-700">Inclure la table des matières</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm text-primary-700">Inclure les graphiques</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm text-primary-700">Inclure les annexes</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar footer */}
            {!readOnly && (
              <div className="flex-shrink-0 p-4 border-t border-primary-200">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => onSave?.({ ...localReport, comments })}
                >
                  Enregistrer les modifications
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
