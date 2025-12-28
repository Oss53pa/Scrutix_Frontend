import { useState } from 'react';
import {
  X,
  Save,
  Type,
  Table2,
  BarChart3,
  PieChart,
  TrendingUp,
  Bold,
  Italic,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  Heading1,
  Heading2,
  Brain,
  Sparkles,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../ui';
import type {
  ReportViewerSection,
  ReportTableData,
  ReportChartData,
} from '../../types';

interface ReportSectionEditorProps {
  section: ReportViewerSection | null;
  availableTables: ReportTableData[];
  availableCharts: ReportChartData[];
  onSave: (section: ReportViewerSection) => void;
  onClose: () => void;
  onAIAssist?: (prompt: string) => Promise<string[]>;
}

export function ReportSectionEditor({
  section,
  availableTables,
  availableCharts,
  onSave,
  onClose,
  onAIAssist,
}: ReportSectionEditorProps) {
  const [title, setTitle] = useState(section?.title || '');
  const [content, setContent] = useState(
    typeof section?.content === 'string' ? section.content : ''
  );
  const [sectionType, setSectionType] = useState(section?.type || 'content');
  const [selectedTableId, setSelectedTableId] = useState(
    section?.content?.tableId || ''
  );
  const [selectedChartId, setSelectedChartId] = useState(
    section?.content?.chartId || ''
  );

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAI, setShowAI] = useState(false);

  const handleSave = () => {
    const updatedSection: ReportViewerSection = {
      id: section?.id || `section-${Date.now()}`,
      type: sectionType,
      title,
      content:
        sectionType === 'table'
          ? { tableId: selectedTableId }
          : sectionType === 'chart'
          ? { chartId: selectedChartId }
          : content,
      visible: section?.visible ?? true,
    };
    onSave(updatedSection);
  };

  const handleAIRequest = async () => {
    if (!aiPrompt.trim() || !onAIAssist) return;
    setAiLoading(true);
    try {
      const suggestions = await onAIAssist(aiPrompt);
      setAiSuggestions(suggestions);
    } catch (error) {
      console.error('AI error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const insertAISuggestion = (text: string) => {
    setContent((prev) => (prev ? prev + '\n\n' + text : text));
    setAiSuggestions([]);
  };

  const insertFormatting = (format: string) => {
    const textarea = document.getElementById('section-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let newText = '';
    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'texte en gras'}**`;
        break;
      case 'italic':
        newText = `*${selectedText || 'texte en italique'}*`;
        break;
      case 'h1':
        newText = `# ${selectedText || 'Titre'}`;
        break;
      case 'h2':
        newText = `## ${selectedText || 'Sous-titre'}`;
        break;
      case 'list':
        newText = `\n- ${selectedText || 'Element de liste'}`;
        break;
      case 'numbered':
        newText = `\n1. ${selectedText || 'Element numerote'}`;
        break;
      default:
        newText = selectedText;
    }

    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900">
            {section ? 'Modifier la section' : 'Nouvelle section'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section type selector */}
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Type de section
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { type: 'content', label: 'Texte', icon: Type },
                { type: 'table', label: 'Tableau', icon: Table2 },
                { type: 'chart', label: 'Graphique', icon: BarChart3 },
                { type: 'summary', label: 'Statistiques', icon: TrendingUp },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setSectionType(type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                    sectionType === type
                      ? 'border-primary-900 bg-primary-50 text-primary-900'
                      : 'border-primary-200 hover:border-primary-300 text-primary-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-2">
              Titre de la section
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entrez le titre..."
              className="w-full px-4 py-2 border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Content based on type */}
          {sectionType === 'content' && (
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Contenu
              </label>

              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 p-2 bg-primary-50 rounded-t-lg border border-b-0 border-primary-200">
                <button
                  onClick={() => insertFormatting('h1')}
                  className="p-2 hover:bg-primary-200 rounded transition-colors"
                  title="Titre 1"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting('h2')}
                  className="p-2 hover:bg-primary-200 rounded transition-colors"
                  title="Titre 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-primary-300 mx-1" />
                <button
                  onClick={() => insertFormatting('bold')}
                  className="p-2 hover:bg-primary-200 rounded transition-colors"
                  title="Gras"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting('italic')}
                  className="p-2 hover:bg-primary-200 rounded transition-colors"
                  title="Italique"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-primary-300 mx-1" />
                <button
                  onClick={() => insertFormatting('list')}
                  className="p-2 hover:bg-primary-200 rounded transition-colors"
                  title="Liste"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting('numbered')}
                  className="p-2 hover:bg-primary-200 rounded transition-colors"
                  title="Liste numerotee"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>

                <div className="flex-1" />

                {/* AI Assist button */}
                <button
                  onClick={() => setShowAI(!showAI)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    showAI
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  <span className="text-sm">IA</span>
                </button>
              </div>

              {/* AI Assistant panel */}
              {showAI && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-x border-primary-200">
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAIRequest()}
                      placeholder="Demandez a l'IA de rediger du contenu..."
                      className="flex-1 px-3 py-2 text-sm border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAIRequest}
                      disabled={aiLoading || !aiPrompt.trim()}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {aiLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Quick prompts */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {[
                      'Introduction du rapport',
                      'Conclusion',
                      'Analyse des resultats',
                      'Recommandations',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setAiPrompt(`Redige ${prompt.toLowerCase()}`)}
                        className="px-2 py-1 text-xs bg-white border border-primary-200 rounded-full hover:bg-primary-50 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* AI Suggestions */}
                  {aiSuggestions.length > 0 && (
                    <div className="space-y-2">
                      {aiSuggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-primary-200 rounded-lg text-sm"
                        >
                          <p className="text-primary-700 mb-2">{suggestion}</p>
                          <button
                            onClick={() => insertAISuggestion(suggestion)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            + Inserer dans le contenu
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Text area */}
              <textarea
                id="section-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Redigez le contenu de la section...

Vous pouvez utiliser le format Markdown:
# Titre
## Sous-titre
**Gras** et *Italique*
- Liste a puces
1. Liste numerotee"
                className="w-full h-64 px-4 py-3 border border-primary-200 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm resize-y"
              />
            </div>
          )}

          {sectionType === 'table' && (
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Selectionner un tableau
              </label>
              {availableTables.length > 0 ? (
                <div className="space-y-2">
                  {availableTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTableId(table.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedTableId === table.id
                          ? 'border-primary-900 bg-primary-50'
                          : 'border-primary-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Table2 className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-primary-900">{table.title}</p>
                          <p className="text-sm text-primary-500">
                            {table.headers?.length || 0} colonnes, {table.rows?.length || 0} lignes
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-primary-200 rounded-lg">
                  <Table2 className="w-10 h-10 text-primary-300 mx-auto mb-2" />
                  <p className="text-primary-500">Aucun tableau disponible</p>
                  <p className="text-sm text-primary-400">
                    Lancez une analyse pour generer des tableaux
                  </p>
                </div>
              )}
            </div>
          )}

          {sectionType === 'chart' && (
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Selectionner un graphique
              </label>
              {availableCharts.length > 0 ? (
                <div className="space-y-2">
                  {availableCharts.map((chart) => (
                    <button
                      key={chart.id}
                      onClick={() => setSelectedChartId(chart.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedChartId === chart.id
                          ? 'border-primary-900 bg-primary-50'
                          : 'border-primary-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {chart.type === 'pie' || chart.type === 'donut' ? (
                          <PieChart className="w-5 h-5 text-green-600" />
                        ) : (
                          <BarChart3 className="w-5 h-5 text-green-600" />
                        )}
                        <div>
                          <p className="font-medium text-primary-900">{chart.title}</p>
                          <p className="text-sm text-primary-500">
                            Type: {chart.type} - {chart.data?.length || 0} donnees
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-primary-200 rounded-lg">
                  <BarChart3 className="w-10 h-10 text-primary-300 mx-auto mb-2" />
                  <p className="text-primary-500">Aucun graphique disponible</p>
                  <p className="text-sm text-primary-400">
                    Lancez une analyse pour generer des graphiques
                  </p>
                </div>
              )}
            </div>
          )}

          {sectionType === 'summary' && (
            <div className="p-6 bg-primary-50 rounded-lg border border-primary-200">
              <TrendingUp className="w-8 h-8 text-primary-600 mx-auto mb-3" />
              <p className="text-center text-primary-600">
                Cette section affichera automatiquement les statistiques cles de l'analyse.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-primary-200">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
