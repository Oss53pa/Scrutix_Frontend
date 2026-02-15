import { useState } from 'react';
import {
  Plus,
  Table2,
  BarChart3,
  FileText,
  Image,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  PieChart,
  TrendingUp,
  AreaChart,
  Brain,
  Sparkles,
  Loader2,
  Send,
  RefreshCw,
  Copy,
  Check,
  Pencil,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button, Badge } from '../ui';
import { ReportSectionEditor } from './ReportSectionEditor';
import type {
  FullReport,
  ReportViewerSection,
} from '../../types';

interface ReportContentEditorProps {
  report: FullReport;
  currentPage: number;
  onUpdateReport: (report: FullReport) => void;
  onNavigateToPage: (pageIndex: number) => void;
  readOnly?: boolean;
}

type ContentType = 'text' | 'table' | 'chart' | 'image' | 'statistics';

interface AIAssistantState {
  isOpen: boolean;
  isLoading: boolean;
  prompt: string;
  suggestions: string[];
  selectedSection: string | null;
}

export function ReportContentEditor({
  report,
  currentPage,
  onUpdateReport,
  onNavigateToPage,
  readOnly = false,
}: ReportContentEditorProps) {
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [aiState, setAIState] = useState<AIAssistantState>({
    isOpen: true, // Ouvert par défaut
    isLoading: false,
    prompt: '',
    suggestions: [],
    selectedSection: null,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Section editor state
  const [editingSection, setEditingSection] = useState<{
    pageId: string;
    section: ReportViewerSection | null;
  } | null>(null);

  // Toggle page expansion
  const togglePage = (pageId: string) => {
    setExpandedPages((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  };

  // Open section editor for new section
  const openNewSection = (pageId: string) => {
    setEditingSection({
      pageId,
      section: null,
    });
  };

  // Open section editor for existing section
  const openEditSection = (pageId: string, section: ReportViewerSection) => {
    setEditingSection({
      pageId,
      section,
    });
  };

  // Save section from editor
  const saveSection = (section: ReportViewerSection) => {
    if (!editingSection) return;

    const updatedPages = report.pages.map((page) => {
      if (page.id === editingSection.pageId) {
        // Check if we're editing existing or adding new
        const existingIndex = page.sections.findIndex((s) => s.id === section.id);
        if (existingIndex >= 0) {
          // Update existing
          const newSections = [...page.sections];
          newSections[existingIndex] = section;
          return { ...page, sections: newSections };
        } else {
          // Add new
          return { ...page, sections: [...page.sections, section] };
        }
      }
      return page;
    });

    onUpdateReport({
      ...report,
      pages: updatedPages,
    });
    setEditingSection(null);
  };

  // Add new section to a page (legacy - now opens editor)
  const _addSection = (pageId: string, type: ContentType) => {
    const newSection: ReportViewerSection = {
      id: `section-${Date.now()}`,
      type: type === 'text' ? 'content' : type === 'statistics' ? 'summary' : type,
      title: getDefaultTitle(type),
      content: getDefaultContent(type),
      visible: true,
    };

    setEditingSection({
      pageId,
      section: newSection,
    });
  };

  // Remove section
  const removeSection = (pageId: string, sectionId: string) => {
    const updatedPages = report.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          sections: page.sections.filter((s) => s.id !== sectionId),
        };
      }
      return page;
    });

    onUpdateReport({
      ...report,
      pages: updatedPages,
    });
  };

  // Toggle section visibility
  const toggleSectionVisibility = (pageId: string, sectionId: string) => {
    const updatedPages = report.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          sections: page.sections.map((s) =>
            s.id === sectionId ? { ...s, visible: !s.visible } : s
          ),
        };
      }
      return page;
    });

    onUpdateReport({
      ...report,
      pages: updatedPages,
    });
  };

  // Get default title for content type
  const getDefaultTitle = (type: ContentType): string => {
    switch (type) {
      case 'text':
        return 'Nouvelle section';
      case 'table':
        return 'Tableau de donnees';
      case 'chart':
        return 'Graphique';
      case 'image':
        return 'Illustration';
      case 'statistics':
        return 'Statistiques cles';
      default:
        return 'Section';
    }
  };

  // Get default content for type
  const getDefaultContent = (type: ContentType): string | { tableId: string } | { chartId: string } | Record<string, never> => {
    switch (type) {
      case 'text':
        return 'Saisissez votre texte ici...';
      case 'table':
        return { tableId: 'new-table' };
      case 'chart':
        return { chartId: 'new-chart' };
      case 'statistics':
        return {};
      default:
        return '';
    }
  };

  // Get icon for section type
  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'table':
        return <Table2 className="w-4 h-4" />;
      case 'chart':
        return <BarChart3 className="w-4 h-4" />;
      case 'summary':
        return <TrendingUp className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // AI Assistant functions
  const handleAIRequest = async () => {
    if (!aiState.prompt.trim()) return;

    setAIState((prev) => ({ ...prev, isLoading: true }));

    // Simulate AI response (in production, this would call the Claude API)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const suggestions = generateAISuggestions(aiState.prompt);

    setAIState((prev) => ({
      ...prev,
      isLoading: false,
      suggestions,
    }));
  };

  // Generate AI suggestions based on prompt
  const generateAISuggestions = (prompt: string): string[] => {
    // This is a placeholder - in production, this would use the Claude API
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('introduction') || lowerPrompt.includes('sommaire')) {
      return [
        `Ce rapport presente une analyse approfondie des frais bancaires pour la periode consideree. L'objectif est d'identifier les anomalies de facturation et les opportunites d'optimisation des couts bancaires.`,
        `Dans le cadre de notre mission d'audit bancaire, nous avons procede a l'examen systematique des releves de compte et des conditions tarifaires appliquees. Ce document synthetise nos observations et recommandations.`,
        `L'analyse des operations bancaires constitue un enjeu majeur pour la maitrise des couts financiers. Ce rapport detaille les ecarts constates entre les conditions negociees et les frais effectivement preleves.`,
      ];
    }

    if (lowerPrompt.includes('conclusion') || lowerPrompt.includes('recommandation')) {
      return [
        `En conclusion, l'audit revele des opportunites significatives d'optimisation des frais bancaires. Nous recommandons d'engager des negociations avec les etablissements concernes pour obtenir le remboursement des surfacturations identifiees.`,
        `Les anomalies detectees representent un montant considerable qui justifie une action rapide aupres des banques. La mise en place d'un suivi regulier permettra d'eviter la recurrence de ces ecarts.`,
        `Au regard des constats effectues, il apparait essentiel de revoir les conventions bancaires en vigueur et de mettre en place des controles systematiques des prelevements de frais.`,
      ];
    }

    if (lowerPrompt.includes('anomalie') || lowerPrompt.includes('ecart')) {
      return [
        `L'analyse a mis en evidence plusieurs categories d'anomalies: surfacturations par rapport aux conditions negociees, doublons de prelevement, et application de taux non conformes aux conventions en vigueur.`,
        `Les ecarts constates concernent principalement les frais de tenue de compte, les commissions de mouvement et les agios appliques aux facilites de caisse. Ces anomalies resultent d'erreurs de parametrage ou de modifications unilaterales des conditions.`,
        `La repartition des anomalies par type revele une concentration sur les operations internationales et les frais de change, ou les marges appliquees depassent frequemment les conditions contractuelles.`,
      ];
    }

    // Default suggestions
    return [
      `L'analyse des donnees financieres permet d'identifier les axes d'amelioration et les economies potentielles realisables.`,
      `Les observations formulees dans ce rapport s'appuient sur l'examen exhaustif des pieces justificatives mises a disposition.`,
      `Cette section presente les elements cles issus de notre analyse et les actions recommandees pour optimiser la gestion des frais bancaires.`,
    ];
  };

  // Copy suggestion to clipboard
  const copySuggestion = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(`suggestion-${index}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Insert suggestion into section
  const _insertSuggestion = (text: string, pageId: string, sectionId: string) => {
    const updatedPages = report.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          sections: page.sections.map((s) =>
            s.id === sectionId ? { ...s, content: text } : s
          ),
        };
      }
      return page;
    });

    onUpdateReport({
      ...report,
      pages: updatedPages,
    });
  };

  // Available charts from report
  const availableCharts = report.charts || [];
  // Available tables from report
  const availableTables = report.tables || [];

  return (
    <div className="flex flex-col h-full">
      {/* Sommaire / Table of Contents */}
      <div className="p-4 border-b border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Sommaire du rapport
        </h3>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {/* Cover page */}
          <button
            onClick={() => onNavigateToPage(0)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              currentPage === 0
                ? 'bg-primary-100 text-primary-900 font-medium'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            Page de garde
          </button>

          {/* Content pages */}
          {report.pages.map((page, index) => (
            <div key={page.id}>
              <button
                onClick={() => onNavigateToPage(index + 1)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                  currentPage === index + 1
                    ? 'bg-primary-100 text-primary-900 font-medium'
                    : 'text-primary-600 hover:bg-primary-50'
                }`}
              >
                <span className="truncate">
                  {page.sections[0]?.title || `Page ${index + 1}`}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {page.sections.length}
                </Badge>
              </button>
            </div>
          ))}

          {/* Back cover */}
          <button
            onClick={() => onNavigateToPage(report.pages.length + 1)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              currentPage === report.pages.length + 1
                ? 'bg-primary-100 text-primary-900 font-medium'
                : 'text-primary-600 hover:bg-primary-50'
            }`}
          >
            Couverture arriere
          </button>
        </div>
      </div>

      {/* Content Structure */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="font-semibold text-primary-900 mb-3 flex items-center gap-2">
          <Table2 className="w-4 h-4" />
          Structure des pages
        </h3>

        <div className="space-y-2">
          {report.pages.map((page, pageIndex) => (
            <div key={page.id} className="border border-primary-200 rounded-lg overflow-hidden">
              {/* Page header */}
              <button
                onClick={() => togglePage(page.id)}
                className="w-full px-3 py-2 bg-primary-50 flex items-center justify-between text-sm hover:bg-primary-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedPages[page.id] ? (
                    <ChevronDown className="w-4 h-4 text-primary-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-primary-500" />
                  )}
                  <span className="font-medium text-primary-900">
                    Page {pageIndex + 1}: {page.sections[0]?.title || 'Sans titre'}
                  </span>
                </div>
                <Badge variant="secondary">{page.sections.length} sections</Badge>
              </button>

              {/* Page sections */}
              {expandedPages[page.id] && (
                <div className="p-2 space-y-1">
                  {page.sections.map((section) => (
                    <div
                      key={section.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm group ${
                        section.visible ? 'bg-white hover:bg-primary-50' : 'bg-primary-50 opacity-60'
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-primary-300 cursor-move" />
                      {getSectionIcon(section.type)}
                      <span className="flex-1 truncate text-primary-700">{section.title}</span>

                      {!readOnly && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditSection(page.id, section)}
                            className="p-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => toggleSectionVisibility(page.id, section.id)}
                            className={`p-1 rounded transition-colors ${
                              section.visible
                                ? 'text-primary-600 hover:bg-primary-50'
                                : 'text-primary-400 hover:bg-primary-100'
                            }`}
                            title={section.visible ? 'Masquer' : 'Afficher'}
                          >
                            {section.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => removeSection(page.id, section.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add section button */}
                  {!readOnly && (
                    <div className="pt-2 border-t border-primary-100 mt-2">
                      <button
                        onClick={() => openNewSection(page.id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary-900 hover:bg-primary-800 rounded-lg transition-colors text-white"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter une section
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Available data elements */}
        <div className="mt-6 pt-4 border-t border-primary-200">
          <h4 className="font-medium text-primary-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Elements disponibles
          </h4>

          {/* Charts */}
          {availableCharts.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-primary-500 uppercase mb-2">Graphiques</p>
              <div className="space-y-1">
                {availableCharts.map((chart) => (
                  <div
                    key={chart.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-primary-50 rounded text-sm"
                  >
                    {chart.type === 'pie' || chart.type === 'donut' ? (
                      <PieChart className="w-4 h-4 text-primary-600" />
                    ) : chart.type === 'area' ? (
                      <AreaChart className="w-4 h-4 text-primary-600" />
                    ) : (
                      <BarChart3 className="w-4 h-4 text-primary-600" />
                    )}
                    <span className="text-primary-700 truncate">{chart.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tables */}
          {availableTables.length > 0 && (
            <div>
              <p className="text-xs text-primary-500 uppercase mb-2">Tableaux</p>
              <div className="space-y-1">
                {availableTables.map((table) => (
                  <div
                    key={table.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-primary-50 rounded text-sm"
                  >
                    <Table2 className="w-4 h-4 text-primary-600" />
                    <span className="text-primary-700 truncate">{table.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableCharts.length === 0 && availableTables.length === 0 && (
            <p className="text-sm text-primary-400 italic">
              Aucun element disponible. Lancez une analyse pour generer des donnees.
            </p>
          )}
        </div>
      </div>

      {/* AI Assistant Section */}
      <div className="border-t border-primary-200">
        <button
          onClick={() => setAIState((prev) => ({ ...prev, isOpen: !prev.isOpen }))}
          className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary-600" />
            <span className="font-medium text-primary-900">Assistant IA</span>
          </div>
          <Sparkles className="w-4 h-4 text-primary-500" />
        </button>

        {aiState.isOpen && (
          <div className="p-4 bg-gradient-to-b from-primary-50/50 to-white space-y-3">
            <p className="text-xs text-primary-500">
              Demandez a l'IA de vous aider a rediger le contenu du rapport
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiState.prompt}
                onChange={(e) => setAIState((prev) => ({ ...prev, prompt: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAIRequest()}
                placeholder="Ex: Redige une introduction pour ce rapport..."
                className="flex-1 px-3 py-2 text-sm border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleAIRequest}
                disabled={aiState.isLoading || !aiState.prompt.trim()}
                className="bg-primary-600 hover:bg-primary-700"
              >
                {aiState.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-1">
              {['Introduction', 'Conclusion', 'Recommandations', 'Analyse des ecarts'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setAIState((prev) => ({ ...prev, prompt: `Redige ${prompt.toLowerCase()} du rapport` }));
                  }}
                  className="px-2 py-1 text-xs bg-white border border-primary-200 rounded-full hover:bg-primary-50 transition-colors text-primary-600"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* AI Suggestions */}
            {aiState.suggestions.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-primary-500 font-medium">Suggestions:</p>
                {aiState.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white border border-primary-200 rounded-lg text-sm text-primary-700"
                  >
                    <p className="mb-2">{suggestion}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copySuggestion(suggestion, index)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-100 hover:bg-primary-200 rounded transition-colors text-primary-600"
                      >
                        {copiedId === `suggestion-${index}` ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copie!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copier
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleAIRequest}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section Editor Modal */}
      {editingSection && (
        <ReportSectionEditor
          section={editingSection.section}
          availableTables={availableTables}
          availableCharts={availableCharts}
          onSave={saveSection}
          onClose={() => setEditingSection(null)}
          onAIAssist={async (prompt) => {
            // Use the same AI generation logic
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return generateAISuggestions(prompt);
          }}
        />
      )}
    </div>
  );
}
