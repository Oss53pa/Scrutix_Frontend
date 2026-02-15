import { useState, useMemo, useRef } from 'react';
import {
  Landmark, Plus, Search, X, Globe, Upload, Eye, History, Filter,
  CheckCircle2, Archive, Calendar, FileText, Loader2, ChevronRight,
  Building2, MoreVertical, Trash2, Pencil, Download, AlertCircle,
  Clock, Shield, RotateCcw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Input, Select, Badge } from '../ui';
import { useBankStore } from '../../store/bankStore';
import { useClientStore } from '../../store/clientStore';
import { BankConditionsModal } from './BankConditionsModal';
import { BankFormModal } from './BankFormModal';
import type { Bank, ConditionGrid, MonetaryZone } from '../../types';
import { CEMAC_COUNTRIES, UEMOA_COUNTRIES, AFRICAN_COUNTRIES } from '../../types';
import { formatCurrency } from '../../utils';
import { pdfExtractionService } from '../../services/PdfExtractionService';
import { v4 as uuidv4 } from 'uuid';

type ViewMode = 'banks' | 'grids';

function getZoneFromCountry(country: string): MonetaryZone | null {
  if (country in CEMAC_COUNTRIES) return 'CEMAC';
  if (country in UEMOA_COUNTRIES) return 'UEMOA';
  return null;
}

export function BanksPage() {
  const {
    banks,
    addBank,
    updateBank,
    deleteBank,
    selectedBankId,
    setSelectedBank,
    getAllGrids,
    getActiveGrid,
    addConditionGrid,
    archiveConditionGrid,
    deleteConditionGrid,
    setActiveGrid,
  } = useBankStore();
  const { clients } = useClientStore();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('banks');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState<MonetaryZone | 'all'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  // Modal states
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [showConditions, setShowConditions] = useState(false);
  const [viewingGrid, setViewingGrid] = useState<ConditionGrid | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingBankId, setUploadingBankId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected bank
  const selectedBank = useMemo(() => {
    return selectedBankId ? banks.find(b => b.id === selectedBankId) : null;
  }, [banks, selectedBankId]);

  // Bank grids
  const selectedBankGrids = useMemo(() => {
    if (!selectedBank) return [];
    return getAllGrids(selectedBank.id);
  }, [selectedBank, getAllGrids]);

  const activeGrid = useMemo(() => {
    if (!selectedBank) return null;
    return getActiveGrid(selectedBank.id);
  }, [selectedBank, getActiveGrid]);

  // Filtered banks
  const filteredBanks = useMemo(() => {
    let result = banks;

    if (zoneFilter !== 'all') {
      result = result.filter(
        (bank) => bank.zone === zoneFilter || getZoneFromCountry(bank.country) === zoneFilter
      );
    }

    if (countryFilter !== 'all') {
      result = result.filter((bank) => bank.country === countryFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (bank) =>
          bank.name.toLowerCase().includes(term) ||
          bank.code.toLowerCase().includes(term) ||
          AFRICAN_COUNTRIES[bank.country]?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [banks, zoneFilter, countryFilter, searchTerm]);

  // All grids for grid history view
  const allGrids = useMemo(() => {
    let grids: (ConditionGrid & { bankName: string; bankCountry: string })[] = [];

    banks.forEach(bank => {
      const bankGrids = getAllGrids(bank.id);
      bankGrids.forEach(grid => {
        grids.push({
          ...grid,
          bankName: bank.name,
          bankCountry: bank.country,
        });
      });
    });

    // Apply filters
    if (zoneFilter !== 'all') {
      grids = grids.filter(g => getZoneFromCountry(g.bankCountry) === zoneFilter);
    }
    if (countryFilter !== 'all') {
      grids = grids.filter(g => g.bankCountry === countryFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      grids = grids.filter(g =>
        g.name.toLowerCase().includes(term) ||
        g.bankName.toLowerCase().includes(term)
      );
    }

    // Sort by date (most recent first)
    return grids.sort((a, b) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );
  }, [banks, getAllGrids, zoneFilter, countryFilter, searchTerm]);

  // Available countries for filter
  const availableCountries = useMemo(() => {
    if (zoneFilter === 'CEMAC') return CEMAC_COUNTRIES;
    if (zoneFilter === 'UEMOA') return UEMOA_COUNTRIES;
    return AFRICAN_COUNTRIES;
  }, [zoneFilter]);

  // Get client count for a bank
  const getClientCount = (bankCode: string) => {
    return clients.filter((c) => c.accounts.some((a) => a.bankCode === bankCode)).length;
  };

  // Handle PDF upload and extraction
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, bankId: string) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) return;

    const bank = banks.find(b => b.id === bankId);
    if (!bank) return;

    setIsUploading(true);
    setUploadingBankId(bankId);

    try {
      // Extract data from PDF
      const result = await pdfExtractionService.extractFromFile(file);

      // Create new grid with extracted data
      const newGrid: Omit<ConditionGrid, 'id' | 'createdAt' | 'updatedAt'> = {
        bankId,
        name: `Conditions ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
        version: new Date().toISOString().slice(0, 7),
        effectiveDate: new Date(),
        status: 'active',
        conditions: {
          id: uuidv4(),
          bankCode: bank.code,
          bankName: bank.name,
          country: bank.country,
          currency: bank.zone === 'UEMOA' ? 'XOF' : 'XAF',
          effectiveDate: new Date(),
          fees: result.data?.fees || [],
          interestRates: result.data?.interestRates || [],
          isActive: true,
          documents: [{
            id: uuidv4(),
            name: file.name,
            type: 'conditions',
            uploadDate: new Date(),
            effectiveDate: new Date(),
            fileSize: file.size,
            extractedAt: new Date(),
            isActive: true,
          }],
        },
        sourceDocument: {
          id: uuidv4(),
          name: file.name,
          type: 'conditions',
          uploadDate: new Date(),
          effectiveDate: new Date(),
          fileSize: file.size,
          extractedAt: new Date(),
          isActive: true,
        },
      };

      // Archive current active grid and add new one
      if (activeGrid) {
        archiveConditionGrid(bankId, activeGrid.id);
      }

      const createdGrid = addConditionGrid(bankId, newGrid);
      setActiveGrid(bankId, createdGrid.id);

      // Open conditions modal to review/edit
      setSelectedBank(bankId);
      setShowConditions(true);

    } catch (error) {
      console.error('Erreur extraction PDF:', error);
      alert('Erreur lors de l\'extraction des conditions. Veuillez reessayer.');
    } finally {
      setIsUploading(false);
      setUploadingBankId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveBank = (data: Partial<Bank>) => {
    if (editingBank) {
      updateBank(editingBank.id, data);
    } else {
      addBank({ ...data, conditions: null, isActive: true } as Omit<Bank, 'id'>);
    }
    setShowAddBank(false);
    setEditingBank(null);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: ConditionGrid['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Active</Badge>;
      case 'archived':
        return <Badge variant="secondary" className="flex items-center gap-1"><Archive className="w-3 h-3" />Archivee</Badge>;
      case 'draft':
        return <Badge variant="warning" className="flex items-center gap-1"><FileText className="w-3 h-3" />Brouillon</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact Header with Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-primary-100">
        {/* Left: Title + View Toggle */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-primary-900">Banques</h1>

          {/* View Mode Toggle */}
          <div className="flex bg-primary-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('banks')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'banks' ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-900'
              }`}
            >
              <Landmark className="w-3 h-3" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('grids')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'grids' ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-900'
              }`}
            >
              <History className="w-3 h-3" />
              Grilles
            </button>
          </div>

          {/* Zone badges as quick filters */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setZoneFilter(zoneFilter === 'CEMAC' ? 'all' : 'CEMAC')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                zoneFilter === 'CEMAC'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              CEMAC {banks.filter(b => b.zone === 'CEMAC' || getZoneFromCountry(b.country) === 'CEMAC').length}
            </button>
            <button
              onClick={() => setZoneFilter(zoneFilter === 'UEMOA' ? 'all' : 'UEMOA')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                zoneFilter === 'UEMOA'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              UEMOA {banks.filter(b => b.zone === 'UEMOA' || getZoneFromCountry(b.country) === 'UEMOA').length}
            </button>
            <span className="text-xs text-primary-400 px-1">
              {allGrids.filter(g => g.status === 'active').length} grilles
            </span>
          </div>
        </div>

        {/* Right: Filters + Actions */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-sm w-32 sm:w-44"
            />
          </div>

          {/* Zone Filter (mobile) */}
          <Select
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value as MonetaryZone | 'all');
              setCountryFilter('all');
            }}
            className="h-9 text-sm w-28 md:hidden"
          >
            <option value="all">Zone</option>
            <option value="CEMAC">CEMAC</option>
            <option value="UEMOA">UEMOA</option>
          </Select>

          {/* Country Filter */}
          <Select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-9 text-sm w-36"
          >
            <option value="all">Tous les pays</option>
            {Object.entries(availableCountries).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </Select>

          {(zoneFilter !== 'all' || countryFilter !== 'all' || searchTerm) && (
            <button
              className="p-1.5 text-primary-400 hover:text-primary-600"
              onClick={() => {
                setZoneFilter('all');
                setCountryFilter('all');
                setSearchTerm('');
              }}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <Button size="sm" className="h-9 text-sm px-3" onClick={() => setShowAddBank(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Banque
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'banks' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bank List */}
          <Card className="lg:col-span-1">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm">Banques ({filteredBanks.length})</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-primary-100 max-h-[calc(100vh-180px)] overflow-y-auto">
                {filteredBanks.map((bank) => {
                  const zone = bank.zone || getZoneFromCountry(bank.country);
                  const bankGrids = getAllGrids(bank.id);
                  const bankActiveGrid = getActiveGrid(bank.id);

                  return (
                    <div
                      key={bank.id}
                      onClick={() => setSelectedBank(bank.id)}
                      className={`px-3 py-2 cursor-pointer transition-colors ${
                        selectedBankId === bank.id ? 'bg-primary-100' : 'hover:bg-primary-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-primary-100`}>
                            <Landmark className={`w-3.5 h-3.5 text-primary-600`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary-900 truncate">{bank.name}</p>
                            <p className="text-[10px] text-primary-500 truncate">
                              {AFRICAN_COUNTRIES[bank.country]} • {bank.code}
                              {bankActiveGrid && <span className="text-primary-600 ml-1">• Grille</span>}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-primary-300 flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}

                {filteredBanks.length === 0 && (
                  <div className="p-6 text-center">
                    <Landmark className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                    <p className="text-xs text-primary-500">Aucune banque</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Bank Detail & Grid Viewer */}
          <div className="lg:col-span-2 space-y-3">
            {selectedBank ? (
              <>
                {/* Compact Bank Header */}
                <div className="flex items-center justify-between bg-white rounded-lg border border-primary-200 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-100">
                      <Landmark className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-primary-900">{selectedBank.name}</h2>
                      <p className="text-xs text-primary-500">
                        {AFRICAN_COUNTRIES[selectedBank.country]} • {selectedBank.code} •{' '}
                        <span className="text-primary-600">
                          {selectedBank.zone === 'UEMOA' || getZoneFromCountry(selectedBank.country) === 'UEMOA' ? 'XOF' : 'XAF'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf"
                      onChange={(e) => handlePdfUpload(e, selectedBank.id)}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading && uploadingBankId === selectedBank.id}
                    >
                      {isUploading && uploadingBankId === selectedBank.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3 mr-1" />
                      )}
                      PDF
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => setShowConditions(true)}>
                      <Pencil className="w-3 h-3 mr-1" />
                      Editer
                    </Button>
                  </div>
                </div>

                {/* Active Grid Viewer */}
                {activeGrid ? (
                  <Card>
                    <CardHeader className="py-2 px-3"
                      action={
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="text-[10px] py-0">Active</Badge>
                          <span className="text-xs text-primary-400">v{activeGrid.version}</span>
                        </div>
                      }
                    >
                      <CardTitle className="text-sm">{activeGrid.name}</CardTitle>
                    </CardHeader>
                    <CardBody className="p-3 pt-0">
                      <div className="space-y-3">
                        {/* Grid Info */}
                        <div className="flex items-center gap-4 text-xs text-primary-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(activeGrid.effectiveDate)}
                          </span>
                          {activeGrid.expirationDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Exp: {formatDate(activeGrid.expirationDate)}
                            </span>
                          )}
                          {activeGrid.sourceDocument && (
                            <span className="flex items-center gap-1 truncate">
                              <FileText className="w-3 h-3" />
                              {activeGrid.sourceDocument.name}
                            </span>
                          )}
                        </div>

                        {/* Fees Table */}
                        {activeGrid.conditions.fees.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-primary-700 mb-1">Frais bancaires</h4>
                            <div className="border border-primary-200 rounded overflow-hidden max-h-48 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-primary-50 sticky top-0">
                                  <tr>
                                    <th className="text-left px-2 py-1 font-medium text-primary-500">Service</th>
                                    <th className="text-right px-2 py-1 font-medium text-primary-500">Montant</th>
                                    <th className="text-right px-2 py-1 font-medium text-primary-500 w-16">Type</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-primary-100">
                                  {activeGrid.conditions.fees.slice(0, 15).map((fee, idx) => (
                                    <tr key={idx} className="hover:bg-primary-50">
                                      <td className="px-2 py-1 truncate max-w-[200px]">{fee.name}</td>
                                      <td className="px-2 py-1 text-right font-medium">
                                        {fee.type === 'percentage'
                                          ? `${fee.percentage}%`
                                          : formatCurrency(fee.amount, 'XAF')}
                                      </td>
                                      <td className="px-2 py-1 text-right text-primary-400">
                                        {fee.type === 'fixed' ? 'Fixe' : fee.type === 'percentage' ? '%' : 'Palier'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {activeGrid.conditions.fees.length > 15 && (
                                <div className="px-2 py-1 bg-primary-50 text-xs text-primary-500 text-center">
                                  +{activeGrid.conditions.fees.length - 15} autres
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Interest Rates */}
                        {activeGrid.conditions.interestRates.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-primary-700 mb-1">Taux d'interet</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {activeGrid.conditions.interestRates.map((rate, idx) => (
                                <div key={idx} className="p-2 border border-primary-200 rounded text-center">
                                  <p className="text-[10px] text-primary-500">
                                    {rate.type === 'overdraft' ? 'Decouvert' :
                                     rate.type === 'authorized' ? 'Autorise' :
                                     rate.type === 'unauthorized' ? 'Non autorise' : 'Epargne'}
                                  </p>
                                  <p className="text-lg font-bold text-primary-900">
                                    {(rate.rate * 100).toFixed(1)}%
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeGrid.conditions.fees.length === 0 && activeGrid.conditions.interestRates.length === 0 && (
                          <div className="text-center py-4">
                            <AlertCircle className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                            <p className="text-xs text-primary-500">Aucune condition</p>
                            <Button size="sm" variant="secondary" className="mt-2 h-7 text-xs" onClick={() => setShowConditions(true)}>
                              Configurer
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ) : selectedBank.conditions ? (
                  <Card className="p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                    <p className="text-sm text-primary-700 font-medium">Conditions non versionnees</p>
                    <p className="text-xs text-primary-500 mb-3">Importez un PDF pour versionner</p>
                    <Button size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </Card>
                ) : (
                  <Card className="p-6 text-center">
                    <FileText className="w-10 h-10 text-primary-300 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-primary-900 mb-1">Aucune grille</h3>
                    <p className="text-xs text-primary-500 mb-3">Importez un PDF ou saisissez manuellement</p>
                    <div className="flex justify-center gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-3 h-3 mr-1" />
                        PDF
                      </Button>
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setShowConditions(true)}>
                        Manuel
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Grid History for selected bank */}
                {selectedBankGrids.length > 1 && (
                  <Card>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs">Historique ({selectedBankGrids.length})</CardTitle>
                    </CardHeader>
                    <CardBody className="p-0">
                      <div className="divide-y divide-primary-100 max-h-32 overflow-y-auto">
                        {selectedBankGrids.filter(g => g.id !== activeGrid?.id).map((grid) => (
                          <div
                            key={grid.id}
                            className="px-3 py-1.5 flex items-center justify-between hover:bg-primary-50"
                          >
                            <div className="flex items-center gap-2">
                              {getStatusBadge(grid.status)}
                              <div>
                                <p className="text-xs font-medium text-primary-900">{grid.name}</p>
                                <p className="text-[10px] text-primary-500">
                                  v{grid.version} • {formatDate(grid.effectiveDate)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                className="p-1 text-primary-400 hover:text-primary-600"
                                onClick={() => {
                                  setViewingGrid(grid);
                                  setShowConditions(true);
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {grid.status !== 'active' && (
                                <button
                                  className="p-1 text-primary-500 hover:text-primary-600"
                                  onClick={() => setActiveGrid(selectedBank.id, grid.id)}
                                  title="Activer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-8 text-center">
                <Landmark className="w-10 h-10 text-primary-300 mx-auto mb-2" />
                <p className="text-sm text-primary-500">Selectionnez une banque</p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Grid History Table View */
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Grilles ({allGrids.length})</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {allGrids.length > 0 ? (
              <div className="overflow-x-auto max-h-[calc(100vh-180px)]">
                <table className="w-full text-xs">
                  <thead className="bg-primary-50 border-b border-primary-200 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-primary-500">Banque</th>
                      <th className="text-left px-2 py-1.5 font-medium text-primary-500">Grille</th>
                      <th className="text-left px-2 py-1.5 font-medium text-primary-500">Ver.</th>
                      <th className="text-left px-2 py-1.5 font-medium text-primary-500">Date</th>
                      <th className="text-left px-2 py-1.5 font-medium text-primary-500">Statut</th>
                      <th className="text-left px-2 py-1.5 font-medium text-primary-500">Pays</th>
                      <th className="text-right px-2 py-1.5 font-medium text-primary-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-100">
                    {allGrids.map((grid) => (
                      <tr key={grid.id} className="hover:bg-primary-50">
                        <td className="px-2 py-1.5">
                          <span className="font-medium text-primary-900">{grid.bankName}</span>
                        </td>
                        <td className="px-2 py-1.5 text-primary-700 truncate max-w-[120px]">{grid.name}</td>
                        <td className="px-2 py-1.5 text-primary-500">v{grid.version}</td>
                        <td className="px-2 py-1.5 text-primary-600">
                          {formatDate(grid.effectiveDate)}
                        </td>
                        <td className="px-2 py-1.5">{getStatusBadge(grid.status)}</td>
                        <td className="px-2 py-1.5 text-primary-600">
                          {AFRICAN_COUNTRIES[grid.bankCountry]}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              className="p-1 text-primary-400 hover:text-primary-600"
                              onClick={() => {
                                const bank = banks.find(b => b.id === grid.bankId);
                                if (bank) {
                                  setSelectedBank(bank.id);
                                  setViewingGrid(grid);
                                  setShowConditions(true);
                                }
                              }}
                              title="Voir"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {grid.status !== 'active' && (
                              <button
                                className="p-1 text-primary-500 hover:text-primary-600"
                                onClick={() => setActiveGrid(grid.bankId, grid.id)}
                                title="Activer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              className="p-1 text-red-400 hover:text-red-600"
                              onClick={() => {
                                if (confirm('Supprimer?')) {
                                  deleteConditionGrid(grid.bankId, grid.id);
                                }
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <History className="w-10 h-10 text-primary-300 mx-auto mb-2" />
                <p className="text-sm text-primary-500">Aucune grille</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Modals */}
      <BankFormModal
        isOpen={showAddBank || !!editingBank}
        onClose={() => {
          setShowAddBank(false);
          setEditingBank(null);
        }}
        onSave={handleSaveBank}
        bank={editingBank}
      />

      <BankConditionsModal
        isOpen={showConditions}
        onClose={() => {
          setShowConditions(false);
          setViewingGrid(null);
        }}
        bank={selectedBank}
        onSaveConditions={(bankId, conditions) => {
          // Update via store
        }}
        onUploadDocument={(bankId, document) => {
          // Handle document
        }}
      />
    </div>
  );
}
