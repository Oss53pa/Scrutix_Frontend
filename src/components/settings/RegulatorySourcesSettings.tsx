import { useState } from 'react';
import { BookOpen, Globe, Search, ExternalLink, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Button,
  Select,
  Input,
  Modal,
} from '../ui';
import { useSettingsStore, CustomRegulatorySource } from '../../store';
import { RegulatorySearchService, REGULATORY_SOURCES, SearchResult } from '../../services/RegulatorySearchService';

type CustomSourceFormData = Omit<CustomRegulatorySource, 'id' | 'createdAt'>;

const emptyFormData: CustomSourceFormData = {
  name: '',
  shortName: '',
  region: 'OTHER',
  type: 'other',
  baseUrl: '',
  searchUrl: '',
  description: '',
  enabled: true,
  country: '',
};

export function RegulatorySourcesSettings() {
  const {
    regulatorySources,
    updateRegulatorySources,
    toggleRegulatorySource,
    addCustomSource,
    updateCustomSource,
    deleteCustomSource,
    toggleCustomSource,
  } = useSettingsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Custom source modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editingSource, setEditingSource] = useState<CustomRegulatorySource | null>(null);
  const [formData, setFormData] = useState<CustomSourceFormData>(emptyFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    setEditingSource(null);
    setFormData(emptyFormData);
    setShowCustomModal(true);
  };

  const handleOpenEditModal = (source: CustomRegulatorySource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      shortName: source.shortName,
      region: source.region,
      type: source.type,
      baseUrl: source.baseUrl,
      searchUrl: source.searchUrl || '',
      description: source.description,
      enabled: source.enabled,
      country: source.country || '',
    });
    setShowCustomModal(true);
  };

  const handleSaveCustomSource = () => {
    if (!formData.name || !formData.shortName || !formData.baseUrl) return;

    if (editingSource) {
      updateCustomSource(editingSource.id, formData);
    } else {
      addCustomSource(formData);
    }

    setShowCustomModal(false);
    setFormData(emptyFormData);
    setEditingSource(null);
  };

  const handleDeleteSource = (id: string) => {
    deleteCustomSource(id);
    setDeleteConfirm(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Filtrer les sources actives
      const activeSourceIds = Object.entries(regulatorySources.sources)
        .filter(([_, enabled]) => enabled)
        .map(([id]) => id);

      const results = await RegulatorySearchService.search(searchQuery, {
        region: regulatorySources.region === 'all' ? undefined : regulatorySources.region,
        sourceIds: activeSourceIds,
        limit: 10,
      });

      setSearchResults(results);
      updateRegulatorySources({ lastSearchAt: new Date().toISOString() });
    } catch (error) {
      console.error('Erreur recherche:', error);
    } finally {
      setSearching(false);
    }
  };

  const getSourceIcon = (sourceId: string) => {
    const icons: Record<string, string> = {
      beac: '🏦',
      cobac: '📋',
      bceao: '🏛️',
      cb_umoa: '⚖️',
    };
    return icons[sourceId] || '📄';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      regulation: 'Reglement',
      circular: 'Circulaire',
      decision: 'Decision',
      report: 'Rapport',
      press: 'Communique',
      other: 'Document',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-green-600" />
          <CardTitle>Sources Reglementaires</CardTitle>
        </div>
        <CardDescription>
          References aux banques centrales et regulateurs CEMAC/UEMOA pour les analyses IA
        </CardDescription>
      </CardHeader>

      <CardBody className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-4 border border-primary-200 rounded-lg">
          <div>
            <p className="font-medium text-primary-900">Activer les references reglementaires</p>
            <p className="text-sm text-primary-500">
              L'IA citera les textes officiels dans ses analyses
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={regulatorySources.enableReferences}
              onChange={(e) => updateRegulatorySources({ enableReferences: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-primary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-primary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        {regulatorySources.enableReferences && (
          <>
            {/* Region Selection */}
            <Select
              label="Region"
              value={regulatorySources.region}
              onChange={(e) => updateRegulatorySources({ region: e.target.value as any })}
              options={[
                { value: 'all', label: 'Toutes les regions (CEMAC + UEMOA)' },
                { value: 'CEMAC', label: 'CEMAC uniquement' },
                { value: 'UEMOA', label: 'UEMOA uniquement' },
              ]}
            />

            {/* Sources */}
            <div>
              <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Sources actives
              </h4>

              {/* CEMAC Sources */}
              <div className="mb-4">
                <p className="text-xs font-medium text-primary-500 mb-2">CEMAC</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REGULATORY_SOURCES.filter(s => s.region === 'CEMAC').map((source) => (
                    <label
                      key={source.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        regulatorySources.sources[source.id as keyof typeof regulatorySources.sources]
                          ? 'border-green-500 bg-green-50'
                          : 'border-primary-200 hover:bg-primary-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={regulatorySources.sources[source.id as keyof typeof regulatorySources.sources]}
                        onChange={(e) => toggleRegulatorySource(source.id as any, e.target.checked)}
                        disabled={regulatorySources.region === 'UEMOA'}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getSourceIcon(source.id)}</span>
                          <span className="font-medium text-sm text-primary-900">{source.shortName}</span>
                        </div>
                        <p className="text-xs text-primary-500 mt-1">{source.name}</p>
                        <a
                          href={source.baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {source.baseUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* UEMOA Sources */}
              <div>
                <p className="text-xs font-medium text-primary-500 mb-2">UEMOA</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REGULATORY_SOURCES.filter(s => s.region === 'UEMOA').map((source) => (
                    <label
                      key={source.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        regulatorySources.sources[source.id as keyof typeof regulatorySources.sources]
                          ? 'border-green-500 bg-green-50'
                          : 'border-primary-200 hover:bg-primary-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={regulatorySources.sources[source.id as keyof typeof regulatorySources.sources]}
                        onChange={(e) => toggleRegulatorySource(source.id as any, e.target.checked)}
                        disabled={regulatorySources.region === 'CEMAC'}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getSourceIcon(source.id)}</span>
                          <span className="font-medium text-sm text-primary-900">{source.shortName}</span>
                        </div>
                        <p className="text-xs text-primary-500 mt-1">{source.name}</p>
                        <a
                          href={source.baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {source.baseUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Sources */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-primary-500">Sources personnalisees</p>
                  <Button variant="secondary" size="sm" onClick={handleOpenAddModal}>
                    <Plus className="w-3 h-3" />
                    Ajouter
                  </Button>
                </div>
                {regulatorySources.customSources.length === 0 ? (
                  <p className="text-xs text-primary-400 italic p-3 border border-dashed border-primary-200 rounded-lg text-center">
                    Aucune source personnalisee. Cliquez sur "Ajouter" pour en creer une.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {regulatorySources.customSources.map((source) => (
                      <div
                        key={source.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                          source.enabled
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-primary-200 bg-primary-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={source.enabled}
                          onChange={(e) => toggleCustomSource(source.id, e.target.checked)}
                          className="mt-1 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📌</span>
                            <span className="font-medium text-sm text-primary-900 truncate">{source.shortName}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-primary-200 text-primary-600 rounded">
                              {source.region}
                            </span>
                          </div>
                          <p className="text-xs text-primary-500 mt-1 truncate">{source.name}</p>
                          <p className="text-xs text-primary-400 mt-0.5 truncate">{source.description}</p>
                          <a
                            href={source.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                          >
                            {source.baseUrl} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleOpenEditModal(source)}
                            className="p-1 text-primary-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirm === source.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDeleteSource(source.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Confirmer"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-1 text-primary-400 hover:bg-primary-100 rounded"
                                title="Annuler"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(source.id)}
                              className="p-1 text-primary-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Test Search */}
            <div>
              <h4 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Tester la recherche
              </h4>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex: frais bancaires, taux d'interet, agios..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="primary" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                  {searching ? (
                    <span className="animate-spin">...</span>
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  <p className="text-xs text-primary-500">{searchResults.length} resultat(s) trouve(s)</p>
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 border border-primary-200 rounded-lg hover:bg-primary-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded">
                              {result.sourceName}
                            </span>
                            <span className="text-xs text-primary-400">
                              {getTypeLabel(result.type)}
                            </span>
                            <span className="text-xs text-primary-400">
                              Pertinence: {result.relevanceScore}%
                            </span>
                          </div>
                          <p className="text-sm font-medium text-primary-900">{result.title}</p>
                          <p className="text-xs text-primary-500 mt-1">{result.snippet}</p>
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>

      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-primary-400">
            Les references sont automatiquement ajoutees aux analyses IA
          </p>
          {regulatorySources.lastSearchAt && (
            <p className="text-xs text-primary-400">
              Derniere recherche: {new Date(regulatorySources.lastSearchAt).toLocaleString('fr-FR')}
            </p>
          )}
        </div>
      </CardFooter>

      {/* Modal for adding/editing custom sources */}
      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title={editingSource ? 'Modifier la source' : 'Ajouter une source personnalisee'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCustomModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveCustomSource}
              disabled={!formData.name || !formData.shortName || !formData.baseUrl}
            >
              <Save className="w-4 h-4" />
              {editingSource ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom complet *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Banque des Etats de l'Afrique Centrale"
            />
            <Input
              label="Nom court *"
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              placeholder="Ex: BEAC"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Region"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value as 'CEMAC' | 'UEMOA' | 'OTHER' })}
              options={[
                { value: 'CEMAC', label: 'CEMAC' },
                { value: 'UEMOA', label: 'UEMOA' },
                { value: 'OTHER', label: 'Autre' },
              ]}
            />
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomSourceFormData['type'] })}
              options={[
                { value: 'central_bank', label: 'Banque centrale' },
                { value: 'regulator', label: 'Regulateur' },
                { value: 'ministry', label: 'Ministere' },
                { value: 'professional', label: 'Ordre professionnel' },
                { value: 'other', label: 'Autre' },
              ]}
            />
          </div>
          <Input
            label="URL de base *"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder="https://www.example.org"
          />
          <Input
            label="URL de recherche (optionnel)"
            value={formData.searchUrl || ''}
            onChange={(e) => setFormData({ ...formData, searchUrl: e.target.value })}
            placeholder="https://www.example.org/search?q="
            helperText="L'URL de base pour les recherches, le terme sera ajoute a la fin"
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description de cette source reglementaire"
          />
          <Input
            label="Pays (optionnel)"
            value={formData.country || ''}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            placeholder="Ex: CM, SN, CI..."
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Activer cette source</span>
          </label>
        </div>
      </Modal>
    </Card>
  );
}
