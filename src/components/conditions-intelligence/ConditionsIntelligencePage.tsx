// ============================================================================
// ATLASBANX — Conditions Intelligence
// ============================================================================
// Exploits the goldmine that nobody was looking at: every bank × every
// version of its tariff grid × every rubric. Surfaces:
//   1. Évolution intra-banque  — how a bank's tariffs changed over time
//   2. Benchmark inter-banques — quartile ranking by rubric
//   3. Comparaison zonale     — CEMAC (XAF) vs UEMOA (XOF) averages
//   4. Alertes de dérive       — rubrics that moved >X% between consecutive
//                                 grid versions for a given bank
//
// Data is read straight from useBankStore; no backend round-trip.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Search,
  X as XIcon,
  Layers,
  ArrowLeftRight,
  Globe,
  Zap,
  ChevronRight,
  Shield,
  ShoppingBag,
  LineChart as LineChartIcon,
  Sparkles,
  FileDown,
  Loader2,
  Send,
  Bot,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Badge, Input, Button } from '../ui';
import { useBankStore } from '../../store/bankStore';
import type { Bank, ConditionGrid } from '../../types';
import { formatCurrency } from '../../utils';
import {
  computeAggressiveness,
  computeCoverage,
  computeCostBasket,
  computeDistribution,
  detectOutliers,
  forecastBank,
  PROFILE_BASKETS,
  type ClientProfile,
  type RubricRef,
} from '../../services/conditionsAnalytics';
import { checkCohortCompliance } from '../../services/regulatoryCompliance';
import {
  generateExecutiveSummary,
  analyzeBenchmarkSection,
  answerNaturalLanguageQ,
  isLlmAvailable,
  type ExecutiveSummary,
  type SectionInsight,
  type NlqAnswer,
} from '../../services/proph3tBenchmark';
import { BenchmarkReportService } from '../../services/BenchmarkReportService';

// ───────────────────────────────────────────────────────────────────────────
// RUBRIC CATALOG — what we benchmark
// ───────────────────────────────────────────────────────────────────────────

interface RubricDef {
  /** Human label */
  label: string;
  /** Dot path inside ConditionGrid.conditions (legacy BankConditions shape) */
  path: string;
  /** Display unit */
  unit: 'FCFA' | '%' | 'jours';
  /** Category for grouping */
  category: 'compte' | 'cartes' | 'virements' | 'cheques' | 'credits' | 'ebanking';
  /** Lower-is-better (most fees) vs higher-is-better (rare; rates can swing either way) */
  betterWhen: 'lower' | 'higher';
}

const RUBRICS: RubricDef[] = [
  // Compte
  { label: 'Tenue de compte particulier',     path: 'accountFees.tenueCompte.particulier',   unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  { label: 'Tenue de compte professionnel',   path: 'accountFees.tenueCompte.professionnel', unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  { label: 'Tenue de compte entreprise',      path: 'accountFees.tenueCompte.entreprise',    unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  { label: 'Frais d’ouverture',               path: 'accountFees.fraisOuverture',            unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  { label: 'Frais de clôture',                path: 'accountFees.fraisCloture',              unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  { label: 'Attestation de solde',            path: 'accountFees.attestationSolde',          unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  { label: 'Relevé mensuel',                  path: 'accountFees.releveCompte.mensuel',      unit: 'FCFA', category: 'compte',   betterWhen: 'lower' },
  // Cartes
  { label: 'Carte Visa Classic',              path: 'cardFees.visaClassic',                  unit: 'FCFA', category: 'cartes',   betterWhen: 'lower' },
  { label: 'Carte Visa Gold',                 path: 'cardFees.visaGold',                     unit: 'FCFA', category: 'cartes',   betterWhen: 'lower' },
  { label: 'Carte GIMAC',                     path: 'cardFees.gimac',                        unit: 'FCFA', category: 'cartes',   betterWhen: 'lower' },
  { label: 'Opposition carte',                path: 'cardFees.opposition',                   unit: 'FCFA', category: 'cartes',   betterWhen: 'lower' },
  { label: 'Retrait DAB autre banque',        path: 'cardFees.retraitDabAutreBanque',        unit: 'FCFA', category: 'cartes',   betterWhen: 'lower' },
  // Virements
  { label: 'Commission virement interne',     path: 'transferFees.virementInterne.commission',       unit: '%',    category: 'virements', betterWhen: 'lower' },
  { label: 'Commission virement zone',        path: 'transferFees.virementCemacUemoa.commission',    unit: '%',    category: 'virements', betterWhen: 'lower' },
  { label: 'Commission virement intl',        path: 'transferFees.virementInternational.commission', unit: '%',    category: 'virements', betterWhen: 'lower' },
  { label: 'Frais SWIFT',                     path: 'transferFees.virementInternational.swift',      unit: 'FCFA', category: 'virements', betterWhen: 'lower' },
  // Chèques
  { label: 'Émission chéquier',               path: 'checkFees.chequierEmission',     unit: 'FCFA', category: 'cheques',  betterWhen: 'lower' },
  { label: 'Opposition chèque',               path: 'checkFees.oppositionCheque',     unit: 'FCFA', category: 'cheques',  betterWhen: 'lower' },
  { label: 'Chèque sans provision',           path: 'checkFees.chequeSansProvision',  unit: 'FCFA', category: 'cheques',  betterWhen: 'lower' },
  // Crédits & agios
  { label: 'Taux découvert autorisé',         path: 'creditFees.tauxDecouvertAutorise',        unit: '%',    category: 'credits',  betterWhen: 'lower' },
  { label: 'Taux découvert non autorisé',     path: 'creditFees.tauxDecouvertNonAutorise',     unit: '%',    category: 'credits',  betterWhen: 'lower' },
  { label: 'Commission de mouvement',         path: 'creditFees.commissionMouvement',          unit: '%',    category: 'credits',  betterWhen: 'lower' },
  { label: 'Taux usure légal',                path: 'creditFees.tauxUsureLegal',               unit: '%',    category: 'credits',  betterWhen: 'lower' },
  { label: 'Crédit conso (taux min)',         path: 'creditFees.creditConsoTauxMin',           unit: '%',    category: 'credits',  betterWhen: 'lower' },
  { label: 'Crédit immo (taux min)',          path: 'creditFees.creditImmoTauxMin',            unit: '%',    category: 'credits',  betterWhen: 'lower' },
  { label: 'Frais dossier crédit',            path: 'creditFees.fraisDossierCredit',           unit: 'FCFA', category: 'credits',  betterWhen: 'lower' },
  // E-Banking
  { label: 'Abonnement mensuel e-banking',    path: 'eBankingFees.abonnementMensuel',          unit: 'FCFA', category: 'ebanking', betterWhen: 'lower' },
  { label: 'SMS alerte (par message)',        path: 'eBankingFees.smsAlerte',                  unit: 'FCFA', category: 'ebanking', betterWhen: 'lower' },
];

const CATEGORY_LABEL: Record<RubricDef['category'], string> = {
  compte:    'Tenue de compte',
  cartes:    'Cartes',
  virements: 'Virements',
  cheques:   'Chèques',
  credits:   'Crédits & Agios',
  ebanking:  'E-Banking',
};

const CATEGORY_COLOR: Record<RubricDef['category'], string> = {
  compte:    'bg-blue-50 text-blue-700 border-blue-200',
  cartes:    'bg-violet-50 text-violet-700 border-violet-200',
  virements: 'bg-amber-50 text-amber-700 border-amber-200',
  cheques:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  credits:   'bg-rose-50 text-rose-700 border-rose-200',
  ebanking:  'bg-cyan-50 text-cyan-700 border-cyan-200',
};

// Drift threshold for the alerts panel
const DRIFT_PCT = 10;

// ───────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

function getRubricValue(grid: ConditionGrid, rubric: RubricDef): number | null {
  const raw = getByPath(grid.conditions, rubric.path);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

function formatRubric(value: number, rubric: RubricDef): string {
  if (rubric.unit === '%') return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`.replace(/ /g, ' ');
  if (rubric.unit === 'jours') return `${value} jour${value > 1 ? 's' : ''}`;
  return formatCurrency(value, 'XAF');
}

function getZone(b: Bank): 'CEMAC' | 'UEMOA' | null {
  if (b.zone === 'CEMAC' || b.zone === 'UEMOA') return b.zone;
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────────────

type SectionId = 'benchmark' | 'evolution' | 'zone' | 'drift' | 'compliance' | 'basket' | 'forecast' | 'proph3t';

export function ConditionsIntelligencePage() {
  const { banks } = useBankStore();
  const [section, setSection] = useState<SectionId>('benchmark');
  const [zoneFilter, setZoneFilter] = useState<'all' | 'CEMAC' | 'UEMOA'>('all');
  const [search, setSearch] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientProfile>('particulier_basique');
  const [isExportingReport, setIsExportingReport] = useState(false);
  const llmReady = isLlmAvailable();

  // ─── Filtered banks for the current zone selection ──────────────────────
  const scopedBanks = useMemo(() => {
    return banks.filter((b) => {
      if (!b.isActive) return false;
      if (zoneFilter === 'all') return true;
      return getZone(b) === zoneFilter;
    });
  }, [banks, zoneFilter]);

  // Bank picked for evolution view (defaults to first scoped one)
  const focusBank = useMemo(() => {
    if (selectedBankId) return banks.find((b) => b.id === selectedBankId) ?? null;
    return scopedBanks[0] ?? null;
  }, [banks, scopedBanks, selectedBankId]);

  // ─── Coverage stats for the header ──────────────────────────────────────
  const coverage = useMemo(() => {
    let totalGrids = 0;
    let banksWithGrid = 0;
    for (const b of scopedBanks) {
      const grids = b.conditionGrids ?? [];
      totalGrids += grids.length;
      if (grids.length > 0) banksWithGrid++;
    }
    return { totalGrids, banksWithGrid, totalBanks: scopedBanks.length };
  }, [scopedBanks]);

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="page-eyebrow mb-2">Intelligence tarifaire</p>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Conditions bancaires — Benchmark</h1>
          <p className="text-sm text-ink-500 mt-1">
            Analyse comparative de {coverage.totalGrids} grille{coverage.totalGrids > 1 ? 's' : ''} sur {coverage.banksWithGrid}/{coverage.totalBanks} banque{coverage.totalBanks > 1 ? 's' : ''} ·{' '}
            {RUBRICS.length} rubriques suivies
            {llmReady && (
              <Badge variant="success" className="ml-2 text-[10px]">
                <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
                Proph3t actif
              </Badge>
            )}
          </p>
        </div>
        <Button
          onClick={async () => {
            if (isExportingReport) return;
            setIsExportingReport(true);
            try {
              await BenchmarkReportService.download({
                banks: scopedBanks,
                rubrics: RUBRICS as RubricRef[],
                focusBankId: focusBank?.id,
                profile,
                auditId: `BENCH-${Date.now().toString(36).toUpperCase()}`,
              });
            } catch (err) {
              alert('Erreur lors de la génération du rapport : ' + (err instanceof Error ? err.message : 'inconnue'));
            } finally {
              setIsExportingReport(false);
            }
          }}
          disabled={isExportingReport || coverage.banksWithGrid === 0}
          size="sm"
        >
          {isExportingReport ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              Génération du PDF…
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4 mr-1.5" />
              Rapport expert PDF
            </>
          )}
        </Button>
      </div>

      {/* ─── TOOLBAR ─── */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-card bg-white/60 backdrop-blur border border-primary-200/60">
        {/* Section tabs */}
        <div className="flex flex-wrap bg-canvas-100 rounded-lg p-0.5">
          {([
            { id: 'proph3t',    label: 'Proph3t',         icon: Sparkles },
            { id: 'benchmark',  label: 'Benchmark',       icon: ArrowLeftRight },
            { id: 'evolution',  label: 'Évolution',       icon: TrendingUp },
            { id: 'zone',       label: 'CEMAC vs UEMOA',  icon: Globe },
            { id: 'drift',      label: 'Dérives',         icon: Zap },
            { id: 'compliance', label: 'Conformité',      icon: Shield },
            { id: 'basket',     label: 'Panier',          icon: ShoppingBag },
            { id: 'forecast',   label: 'Tendances',       icon: LineChartIcon },
          ] as Array<{ id: SectionId; label: string; icon: typeof TrendingUp }>).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSection(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  section === tab.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Zone filter */}
          <div className="flex bg-canvas-100 rounded-lg p-0.5">
            {(['all', 'CEMAC', 'UEMOA'] as const).map((z) => (
              <button
                key={z}
                onClick={() => setZoneFilter(z)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  zoneFilter === z ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {z === 'all' ? 'Toutes zones' : z}
              </button>
            ))}
          </div>

          {/* Rubric / bank search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
            <Input
              type="text"
              placeholder="Rubrique ou banque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-7 h-8 text-xs w-56"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── EMPTY STATE ─── */}
      {coverage.banksWithGrid === 0 ? (
        <Card>
          <CardBody className="p-12 text-center">
            <Layers className="w-12 h-12 text-ink-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-ink-900 mb-1">
              Aucune grille tarifaire enregistrée
            </p>
            <p className="text-sm text-ink-500 max-w-md mx-auto">
              Importe au moins une grille de conditions sur la page <strong>Banques & Conditions</strong>{' '}
              pour activer le benchmark, l'analyse d'évolution et les comparaisons zonales.
            </p>
          </CardBody>
        </Card>
      ) : section === 'proph3t' ? (
        <Proph3tInsightsPanel banks={scopedBanks} llmReady={llmReady} />
      ) : section === 'benchmark' ? (
        <BenchmarkSection banks={scopedBanks} search={search} />
      ) : section === 'evolution' ? (
        <EvolutionSection
          banks={scopedBanks}
          focusBank={focusBank}
          onSelectBank={setSelectedBankId}
          search={search}
        />
      ) : section === 'zone' ? (
        <ZoneCompareSection banks={banks.filter((b) => b.isActive)} search={search} />
      ) : section === 'drift' ? (
        <DriftSection banks={scopedBanks} search={search} />
      ) : section === 'compliance' ? (
        <ComplianceSection banks={scopedBanks} />
      ) : section === 'basket' ? (
        <BasketSection banks={scopedBanks} profile={profile} onProfileChange={setProfile} />
      ) : (
        <ForecastSection
          banks={scopedBanks}
          focusBank={focusBank}
          onSelectBank={setSelectedBankId}
        />
      )}
    </div>
  );
}

// ===========================================================================
// SECTION 1 — BENCHMARK INTER-BANQUES
// ===========================================================================

function BenchmarkSection({ banks, search }: { banks: Bank[]; search: string }) {
  // For each bank, take the active grid (or most recent)
  const benchData = useMemo(() => {
    return banks
      .map((b) => {
        const grids = b.conditionGrids ?? [];
        const grid =
          grids.find((g) => g.id === b.activeGridId) ??
          grids.find((g) => g.status === 'active') ??
          grids[0] ??
          null;
        return { bank: b, grid };
      })
      .filter((x) => x.grid);
  }, [banks]);

  const filteredRubrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RUBRICS;
    return RUBRICS.filter((r) =>
      r.label.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
    );
  }, [search]);

  if (benchData.length === 0) {
    return <EmptyHint message="Aucune banque scope ne dispose d'une grille pour le benchmark." />;
  }

  return (
    <div className="space-y-4">
      {/* Group rubrics by category */}
      {Object.keys(CATEGORY_LABEL).map((cat) => {
        const rubricsInCat = filteredRubrics.filter((r) => r.category === cat);
        if (rubricsInCat.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={CATEGORY_COLOR[cat as RubricDef['category']]}>
                  {CATEGORY_LABEL[cat as RubricDef['category']]}
                </Badge>
                <CardTitle className="text-sm">{rubricsInCat.length} rubriques</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-canvas-50 border-b border-primary-200/60">
                      <th className="text-left px-4 py-2.5 font-semibold text-ink-600 uppercase tracking-wider sticky left-0 bg-canvas-50">
                        Rubrique
                      </th>
                      {benchData.map(({ bank }) => (
                        <th key={bank.id} className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap">
                          <div className="font-semibold text-ink-900">{bank.code}</div>
                          <div className="text-[10px] text-ink-500 font-normal">{getZone(bank) ?? '—'}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-100/60">
                    {rubricsInCat.map((rubric) => {
                      const values = benchData
                        .map(({ bank, grid }) => ({
                          bank,
                          value: grid ? getRubricValue(grid, rubric) : null,
                        }));
                      const numerics = values.map((v) => v.value).filter((v): v is number => v !== null && v > 0);
                      const min = numerics.length ? Math.min(...numerics) : null;
                      const max = numerics.length ? Math.max(...numerics) : null;
                      const median = numerics.length ? quantile(numerics, 0.5) : null;

                      return (
                        <tr key={rubric.path} className="hover:bg-canvas-50/60">
                          <td className="px-4 py-2 sticky left-0 bg-white">
                            <div className="font-medium text-ink-800">{rubric.label}</div>
                            <div className="text-[10px] text-ink-400">
                              {numerics.length > 1 && median != null && (
                                <>Médiane : {formatRubric(median, rubric)}</>
                              )}
                            </div>
                          </td>
                          {values.map(({ bank, value }) => {
                            if (value === null) {
                              return (
                                <td key={bank.id} className="px-3 py-2 text-right text-ink-300">
                                  —
                                </td>
                              );
                            }
                            const isMin = min != null && value === min;
                            const isMax = max != null && value === max;
                            const tone = numerics.length > 1
                              ? rubric.betterWhen === 'lower'
                                ? isMin ? 'good' : isMax ? 'bad' : 'neutral'
                                : isMin ? 'bad' : isMax ? 'good' : 'neutral'
                              : 'neutral';
                            return (
                              <td key={bank.id} className={`px-3 py-2 text-right whitespace-nowrap font-medium tabular-nums ${
                                tone === 'good' ? 'text-emerald-700' :
                                tone === 'bad' ? 'text-red-700' :
                                'text-ink-700'
                              }`}>
                                {formatRubric(value, rubric)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

// ===========================================================================
// SECTION 2 — ÉVOLUTION INTRA-BANQUE
// ===========================================================================

function EvolutionSection({
  banks,
  focusBank,
  onSelectBank,
  search,
}: {
  banks: Bank[];
  focusBank: Bank | null;
  onSelectBank: (id: string) => void;
  search: string;
}) {
  const grids = useMemo(() => {
    if (!focusBank) return [];
    return [...(focusBank.conditionGrids ?? [])].sort(
      (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime(),
    );
  }, [focusBank]);

  const filteredRubrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RUBRICS;
    return RUBRICS.filter((r) => r.label.toLowerCase().includes(q));
  }, [search]);

  if (!focusBank) return <EmptyHint message="Aucune banque sélectionnable." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Bank picker */}
      <Card className="lg:col-span-1">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Banque suivie</CardTitle>
        </CardHeader>
        <CardBody className="p-0 max-h-[600px] overflow-y-auto">
          <div className="divide-y divide-primary-100/60">
            {banks.map((b) => {
              const gridCount = (b.conditionGrids ?? []).length;
              const isActive = focusBank.id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => onSelectBank(b.id)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-canvas-50 transition-colors ${
                    isActive ? 'bg-canvas-100 border-l-4 border-l-accent-500' : ''
                  }`}
                  disabled={gridCount === 0}
                >
                  <div className="text-sm font-medium text-ink-900 truncate">{b.name}</div>
                  <div className="text-[10px] text-ink-500 flex items-center gap-1.5 mt-0.5">
                    {getZone(b) ?? '—'}
                    <span className="text-ink-300">·</span>
                    <span className={gridCount === 0 ? 'text-ink-300' : ''}>
                      {gridCount} grille{gridCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Evolution table */}
      <Card className="lg:col-span-3">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">{focusBank.name}</CardTitle>
              <p className="text-xs text-ink-500 mt-0.5">
                {grids.length} grille{grids.length > 1 ? 's' : ''} chronologiques · de{' '}
                {grids.length > 0 ? formatDateShort(grids[0].effectiveDate) : '—'} à{' '}
                {grids.length > 0 ? formatDateShort(grids[grids.length - 1].effectiveDate) : '—'}
              </p>
            </div>
            <Badge variant="secondary">{getZone(focusBank) ?? '—'}</Badge>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {grids.length === 0 ? (
            <EmptyHint message="Aucune grille pour cette banque." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-canvas-50 border-b border-primary-200/60">
                    <th className="text-left px-4 py-2.5 font-semibold text-ink-600 uppercase tracking-wider sticky left-0 bg-canvas-50">
                      Rubrique
                    </th>
                    {grids.map((g, i) => (
                      <th key={g.id} className="text-right px-3 py-2.5 font-semibold text-ink-600 whitespace-nowrap">
                        <div className="text-ink-900">{formatDateShort(g.effectiveDate)}</div>
                        <div className="text-[10px] text-ink-400 font-normal">v{i + 1}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100/60">
                  {filteredRubrics.map((rubric) => {
                    const series = grids.map((g) => getRubricValue(g, rubric));
                    if (series.every((v) => v == null || v === 0)) return null;
                    return (
                      <tr key={rubric.path} className="hover:bg-canvas-50/60">
                        <td className="px-4 py-2 sticky left-0 bg-white">
                          <div className="font-medium text-ink-800">{rubric.label}</div>
                          <div className={`text-[10px] inline-flex items-center gap-1 px-1 rounded border ${CATEGORY_COLOR[rubric.category]}`}>
                            {CATEGORY_LABEL[rubric.category]}
                          </div>
                        </td>
                        {series.map((value, i) => {
                          if (value == null) {
                            return <td key={i} className="px-3 py-2 text-right text-ink-300">—</td>;
                          }
                          const prev = i > 0 ? series[i - 1] : null;
                          const delta = prev != null && prev !== 0 ? ((value - prev) / prev) * 100 : null;
                          return (
                            <td key={i} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                              <div className="font-medium text-ink-800">{formatRubric(value, rubric)}</div>
                              {delta != null && Math.abs(delta) > 0.5 && (
                                <div className={`text-[10px] inline-flex items-center gap-0.5 ${
                                  delta > 0 ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                  {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ===========================================================================
// SECTION 3 — CEMAC vs UEMOA
// ===========================================================================

function ZoneCompareSection({ banks, search }: { banks: Bank[]; search: string }) {
  const filteredRubrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RUBRICS;
    return RUBRICS.filter((r) => r.label.toLowerCase().includes(q));
  }, [search]);

  // Aggregate per zone using each bank's active/most-recent grid
  const aggregates = useMemo(() => {
    const buckets: Record<'CEMAC' | 'UEMOA', Map<string, number[]>> = {
      CEMAC: new Map(),
      UEMOA: new Map(),
    };
    for (const b of banks) {
      const zone = getZone(b);
      if (!zone) continue;
      const grids = b.conditionGrids ?? [];
      const grid = grids.find((g) => g.id === b.activeGridId) ?? grids.find((g) => g.status === 'active') ?? grids[0];
      if (!grid) continue;
      for (const rubric of filteredRubrics) {
        const v = getRubricValue(grid, rubric);
        if (v == null) continue;
        const arr = buckets[zone].get(rubric.path) ?? [];
        arr.push(v);
        buckets[zone].set(rubric.path, arr);
      }
    }
    return buckets;
  }, [banks, filteredRubrics]);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Médiane par zone monétaire</CardTitle>
        <p className="text-xs text-ink-500 mt-1">
          Comparaison des grilles actives des banques CEMAC (XAF) et UEMOA (XOF). Parité fixe 1:1 entre les deux francs.
        </p>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-canvas-50 border-b border-primary-200/60">
                <th className="text-left px-4 py-2.5 font-semibold text-ink-600 uppercase tracking-wider">Rubrique</th>
                <th className="text-right px-4 py-2.5 font-semibold text-ink-600 whitespace-nowrap">
                  <Badge variant="info">CEMAC</Badge>
                  <span className="block text-[10px] text-ink-500 mt-1 font-normal">Médiane · échantillon</span>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-ink-600 whitespace-nowrap">
                  <Badge variant="success">UEMOA</Badge>
                  <span className="block text-[10px] text-ink-500 mt-1 font-normal">Médiane · échantillon</span>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-ink-600 whitespace-nowrap">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100/60">
              {filteredRubrics.map((rubric) => {
                const cemacVals = aggregates.CEMAC.get(rubric.path) ?? [];
                const uemoaVals = aggregates.UEMOA.get(rubric.path) ?? [];
                if (cemacVals.length === 0 && uemoaVals.length === 0) return null;
                const cemacMed = cemacVals.length ? quantile(cemacVals, 0.5) : null;
                const uemoaMed = uemoaVals.length ? quantile(uemoaVals, 0.5) : null;
                const delta = cemacMed != null && uemoaMed != null && uemoaMed !== 0
                  ? ((cemacMed - uemoaMed) / uemoaMed) * 100 : null;
                return (
                  <tr key={rubric.path} className="hover:bg-canvas-50/60">
                    <td className="px-4 py-2">
                      <div className="font-medium text-ink-800">{rubric.label}</div>
                      <div className="text-[10px] text-ink-500">{CATEGORY_LABEL[rubric.category]}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {cemacMed != null ? (
                        <>
                          <div className="font-semibold text-ink-900">{formatRubric(cemacMed, rubric)}</div>
                          <div className="text-[10px] text-ink-500">n={cemacVals.length}</div>
                        </>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {uemoaMed != null ? (
                        <>
                          <div className="font-semibold text-ink-900">{formatRubric(uemoaMed, rubric)}</div>
                          <div className="text-[10px] text-ink-500">n={uemoaVals.length}</div>
                        </>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {delta != null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                          Math.abs(delta) < 1 ? 'text-ink-500' :
                          delta > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {Math.abs(delta) < 1 ? <Minus className="w-3 h-3" /> :
                           delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

// ===========================================================================
// SECTION 4 — DRIFT ALERTS
// ===========================================================================

function DriftSection({ banks, search }: { banks: Bank[]; search: string }) {
  // Detect grids that move >DRIFT_PCT% on any rubric vs the previous grid
  const drifts = useMemo(() => {
    const out: Array<{
      bank: Bank;
      from: ConditionGrid;
      to: ConditionGrid;
      rubric: RubricDef;
      fromVal: number;
      toVal: number;
      deltaPct: number;
    }> = [];
    for (const b of banks) {
      const grids = [...(b.conditionGrids ?? [])].sort(
        (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime(),
      );
      for (let i = 1; i < grids.length; i++) {
        const prev = grids[i - 1];
        const curr = grids[i];
        for (const rubric of RUBRICS) {
          const a = getRubricValue(prev, rubric);
          const c = getRubricValue(curr, rubric);
          if (a == null || c == null || a === 0) continue;
          const deltaPct = ((c - a) / a) * 100;
          if (Math.abs(deltaPct) >= DRIFT_PCT) {
            out.push({ bank: b, from: prev, to: curr, rubric, fromVal: a, toVal: c, deltaPct });
          }
        }
      }
    }
    return out.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  }, [banks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drifts;
    return drifts.filter(
      (d) =>
        d.rubric.label.toLowerCase().includes(q) ||
        d.bank.name.toLowerCase().includes(q),
    );
  }, [drifts, search]);

  if (drifts.length === 0) {
    return <EmptyHint message={`Aucune dérive >${DRIFT_PCT}% détectée entre les versions de grilles.`} />;
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <CardTitle className="text-sm">Dérives tarifaires détectées</CardTitle>
          </div>
          <Badge variant="warning">{filtered.length} alerte{filtered.length > 1 ? 's' : ''}</Badge>
        </div>
        <p className="text-xs text-ink-500 mt-1">
          Variation supérieure à {DRIFT_PCT}% entre deux versions consécutives d'une grille pour la même rubrique.
        </p>
      </CardHeader>
      <CardBody className="p-0">
        <div className="divide-y divide-primary-100/60">
          {filtered.slice(0, 30).map((d, i) => {
            const sev: 'critical' | 'high' | 'medium' =
              Math.abs(d.deltaPct) > 100 ? 'critical' :
              Math.abs(d.deltaPct) > 30 ? 'high' :
              'medium';
            const tone =
              sev === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
              sev === 'high' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-yellow-50 text-yellow-700 border-yellow-200';
            return (
              <div key={i} className="p-3 hover:bg-canvas-50/60 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${tone}`}>
                  {d.deltaPct > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900">{d.bank.name}</span>
                    <ChevronRight className="w-3 h-3 text-ink-300" />
                    <span className="text-sm text-ink-700">{d.rubric.label}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {formatDateShort(d.from.effectiveDate)} → {formatDateShort(d.to.effectiveDate)} ·{' '}
                    {formatRubric(d.fromVal, d.rubric)} → {formatRubric(d.toVal, d.rubric)}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <div className={`text-lg font-bold ${
                    d.deltaPct > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}>
                    {d.deltaPct > 0 ? '+' : ''}{d.deltaPct.toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-ink-500">{sev.toUpperCase()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ===========================================================================
// SHARED HELPERS
// ===========================================================================

function EmptyHint({ message }: { message: string }) {
  return (
    <Card>
      <CardBody className="p-8 text-center text-ink-500 text-sm">{message}</CardBody>
    </Card>
  );
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function formatDateShort(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

// ===========================================================================
// PROPH3T INSIGHTS PANEL — auto-generated executive summary + Q&A
// ===========================================================================

function Proph3tInsightsPanel({ banks, llmReady }: { banks: Bank[]; llmReady: boolean }) {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [insights, setInsights] = useState<Record<string, SectionInsight>>({});
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Array<{ q: string; a: NlqAnswer }>>([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const exec = await generateExecutiveSummary(banks, RUBRICS as RubricRef[]);
      if (cancelled) return;
      setSummary(exec);
      const sectionIds = ['benchmark', 'compliance', 'drift', 'basket'] as const;
      const results = await Promise.all(
        sectionIds.map((s) => analyzeBenchmarkSection(s, banks, RUBRICS as RubricRef[])),
      );
      if (cancelled) return;
      const map: Record<string, SectionInsight> = {};
      sectionIds.forEach((s, i) => { map[s] = results[i]; });
      setInsights(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [banks]);

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    const q = question.trim();
    const ans = await answerNaturalLanguageQ(q, banks, RUBRICS as RubricRef[]);
    setAnswers((prev) => [{ q, a: ans }, ...prev]);
    setQuestion('');
    setAsking(false);
  };

  return (
    <div className="space-y-4">
      {/* LLM status banner */}
      {!llmReady && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Bot className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Mode déterministe</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Proph3t (Ollama) n'est pas connecté. Les analyses sont générées par les calculs statistiques. Pour activer l'enrichissement IA, configure une instance dans <strong>Paramètres → Intelligence</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Executive summary */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-600" />
              <CardTitle className="text-sm">Synthèse exécutive Proph3t</CardTitle>
            </div>
            <Badge variant={summary?.source === 'llm' ? 'success' : 'secondary'}>
              {summary?.source === 'llm' ? 'IA enrichi' : 'Déterministe'}
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          {loading || !summary ? (
            <div className="flex items-center gap-2 text-ink-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyse en cours…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border-l-4 border-l-accent-500 bg-canvas-50 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-semibold">Verdict</p>
                <p className="text-base font-semibold text-ink-900 mt-1">{summary.headline}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-500 font-semibold mb-2">Faits clés</p>
                <ul className="space-y-1.5">
                  {summary.bullets.map((b, i) => (
                    <li key={i} className="text-sm text-ink-700 leading-relaxed flex gap-2">
                      <span className="text-accent-600 flex-shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-500 font-semibold mb-2">Recommandations</p>
                <div className="space-y-2">
                  {summary.recommendations.map((r, i) => (
                    <div key={i} className="rounded-lg bg-accent-50 border border-accent-200 p-3 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-md bg-ink-900 text-accent-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <p className="text-sm text-ink-800">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Per-section insights */}
      {!loading && Object.keys(insights).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(['benchmark', 'compliance', 'drift', 'basket'] as const).map((sec) => {
            const insight = insights[sec];
            if (!insight) return null;
            return (
              <Card key={sec}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm capitalize">
                      {sec === 'compliance' ? 'Conformité' :
                       sec === 'basket' ? 'Panier client' :
                       sec === 'drift' ? 'Dérives' :
                       'Benchmark'}
                    </CardTitle>
                    <Badge variant={insight.source === 'llm' ? 'success' : 'secondary'} className="text-[10px]">
                      {insight.source === 'llm' ? 'IA' : 'Det'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {insight.paragraphs.map((p, i) => (
                      <p key={i} className="text-sm text-ink-700 leading-relaxed">{p}</p>
                    ))}
                    {insight.actions.length > 0 && (
                      <div className="pt-2 border-t border-primary-100">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-semibold mb-1.5">Actions</p>
                        <ul className="space-y-1">
                          {insight.actions.map((a, i) => (
                            <li key={i} className="text-xs text-ink-600">{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Natural language Q&A */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-ink-700" />
            <CardTitle className="text-sm">Posez une question à Proph3t</CardTitle>
          </div>
          <p className="text-xs text-ink-500 mt-1">
            Ex. : « Quelle est la banque la moins chère pour une PME en zone UEMOA ? »
          </p>
        </CardHeader>
        <CardBody>
          <div className="flex gap-2 mb-3">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }}
              placeholder="Votre question…"
              disabled={asking}
              className="flex-1"
            />
            <Button onClick={handleAsk} disabled={asking || !question.trim()} size="sm">
              {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {answers.map((qa, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Q : {qa.q}</p>
                <div className="rounded-lg bg-canvas-50 border border-primary-100 p-3">
                  <p className="text-sm text-ink-800 whitespace-pre-wrap">{qa.a.answer}</p>
                  {qa.a.source === 'llm' && (
                    <Badge variant="success" className="mt-2 text-[9px]">
                      <Sparkles className="w-2 h-2 inline mr-0.5" />
                      Réponse IA
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {answers.length === 0 && (
              <p className="text-xs text-ink-400 italic text-center py-4">Aucune question posée pour le moment.</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ===========================================================================
// COMPLIANCE SECTION
// ===========================================================================

function ComplianceSection({ banks }: { banks: Bank[] }) {
  const reports = useMemo(() => checkCohortCompliance(banks), [banks]);

  if (reports.length === 0) {
    return <EmptyHint message="Aucune banque n'a de plafond réglementaire applicable documenté." />;
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const tone =
          r.score === 100 ? 'border-l-emerald-500' :
          r.score >= 70 ? 'border-l-amber-500' :
          'border-l-red-500';
        return (
          <Card key={r.bankId} className={`border-l-4 ${tone}`}>
            <CardBody>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-base font-semibold text-ink-900">{r.bankName}</p>
                  <p className="text-xs text-ink-500">
                    {r.zone ?? '—'} · {r.applicable} plafond(s) applicable(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold tabular-nums ${
                    r.score === 100 ? 'text-emerald-700' :
                    r.score >= 70 ? 'text-amber-700' :
                    'text-red-700'
                  }`}>
                    {r.score}<span className="text-sm text-ink-400">/100</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500">Conformité</p>
                </div>
              </div>

              {r.violations.length > 0 ? (
                <div className="border-t border-primary-100 pt-3 space-y-2">
                  {r.violations.map((v, i) => {
                    const sevColor =
                      v.limit.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                      v.limit.severity === 'high' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-yellow-50 text-yellow-700 border-yellow-200';
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <Badge variant="secondary" className={`${sevColor} flex-shrink-0`}>
                          {v.limit.severity === 'critical' ? 'CRITIQUE' : v.limit.severity === 'high' ? 'SÉVÈRE' : 'MÉDIUM'}
                        </Badge>
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-semibold text-ink-900">{v.limit.rubricLabel}</p>
                          <p className="text-ink-600 mt-0.5">
                            Plafond <strong>{v.limit.limit} {v.limit.unit}</strong> · observé <strong className="text-red-700">{v.observed} {v.limit.unit}</strong> · dépassement <strong className="text-red-700">+{v.breachPct.toFixed(0)} %</strong>
                          </p>
                          <p className="text-ink-500 mt-1 italic">{v.limit.rationale}</p>
                          <p className="text-[10px] text-ink-400 mt-0.5">Référence : {v.limit.reference}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 border-t border-primary-100 pt-3">
                  ✓ Aucun dépassement détecté sur les plafonds applicables.
                </p>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

// ===========================================================================
// BASKET SECTION (B2 + B6)
// ===========================================================================

function BasketSection({
  banks,
  profile,
  onProfileChange,
}: {
  banks: Bank[];
  profile: ClientProfile;
  onProfileChange: (p: ClientProfile) => void;
}) {
  const baskets = useMemo(() => computeCostBasket(banks, profile), [banks, profile]);
  const aggressiveness = useMemo(() => computeAggressiveness(banks, RUBRICS as RubricRef[]), [banks]);

  const cheapest = baskets[0];
  const dearest = baskets[baskets.length - 1];

  return (
    <div className="space-y-4">
      {/* Profile picker */}
      <Card>
        <CardBody>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-semibold mb-2">
            Profil de client-type
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PROFILE_BASKETS) as ClientProfile[]).map((p) => (
              <button
                key={p}
                onClick={() => onProfileChange(p)}
                className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${
                  profile === p ? 'bg-ink-900 text-white' : 'bg-canvas-100 text-ink-700 hover:bg-canvas-200'
                }`}
              >
                {PROFILE_BASKETS[p].label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Aggressiveness ranking */}
      {aggressiveness.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Indice d'agressivité tarifaire</CardTitle>
            <p className="text-xs text-ink-500 mt-1">
              % de rubriques où la banque est au-dessus du Q3 (cher) – % où elle est sous le Q1 (compétitif). Score &gt;0 = position chère, &lt;0 = compétitive.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-primary-100">
              {aggressiveness.map((s) => {
                const tone = s.score > 0.2 ? 'bg-red-500' : s.score < -0.2 ? 'bg-emerald-500' : 'bg-ink-300';
                const widthPct = Math.abs(s.score) * 50; // -1..1 → 0..50%
                return (
                  <div key={s.bankId} className="px-4 py-2.5 flex items-center gap-3 hover:bg-canvas-50">
                    <span className="text-sm font-medium text-ink-800 w-32 truncate">{s.bankName}</span>
                    <div className="flex-1 relative h-2 bg-canvas-100 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-ink-300" />
                      <div
                        className={`absolute inset-y-0 ${tone}`}
                        style={{
                          left: s.score >= 0 ? '50%' : `${50 - widthPct}%`,
                          width: `${widthPct}%`,
                        }}
                      />
                    </div>
                    <span className={`text-xs font-bold tabular-nums w-14 text-right ${
                      s.score > 0.2 ? 'text-red-700' : s.score < -0.2 ? 'text-emerald-700' : 'text-ink-600'
                    }`}>
                      {s.score > 0 ? '+' : ''}{s.score.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-ink-400 w-12 text-right">n={s.n}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Cost basket ranking */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            Panier annuel — {PROFILE_BASKETS[profile].label}
          </CardTitle>
          {cheapest && dearest && cheapest.bankId !== dearest.bankId && (
            <p className="text-xs text-ink-500 mt-1">
              Écart marché : <strong className="text-ink-900">{formatCurrency(dearest.totalAnnual - cheapest.totalAnnual, 'XAF')}</strong>{' '}
              ({((dearest.totalAnnual / Math.max(1, cheapest.totalAnnual) - 1) * 100).toFixed(0)} %) entre {cheapest.bankName} et {dearest.bankName}
            </p>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {baskets.length === 0 ? (
            <p className="px-4 py-8 text-center text-ink-500 text-sm">Aucune banque ne couvre assez de rubriques pour calculer ce panier.</p>
          ) : (
            <div className="divide-y divide-primary-100">
              {baskets.map((b, i) => (
                <div key={b.bankId} className="px-4 py-3 flex items-center gap-3 hover:bg-canvas-50">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-emerald-100 text-emerald-700' : i === baskets.length - 1 ? 'bg-red-100 text-red-700' : 'bg-canvas-100 text-ink-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{b.bankName}</p>
                    <p className="text-[11px] text-ink-500">
                      {b.zone ?? '—'} · couverture {(b.coverage * 100).toFixed(0)} %
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className={`text-sm font-bold ${
                      i === 0 ? 'text-emerald-700' : i === baskets.length - 1 ? 'text-red-700' : 'text-ink-900'
                    }`}>
                      {formatCurrency(b.totalAnnual, 'XAF')}
                    </p>
                    {i > 0 && cheapest && (
                      <p className="text-[10px] text-ink-400">
                        +{formatCurrency(b.totalAnnual - cheapest.totalAnnual, 'XAF')} vs n°1
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ===========================================================================
// FORECAST SECTION (B7)
// ===========================================================================

function ForecastSection({
  banks,
  focusBank,
  onSelectBank,
}: {
  banks: Bank[];
  focusBank: Bank | null;
  onSelectBank: (id: string) => void;
}) {
  const forecasts = useMemo(() => {
    if (!focusBank) return [];
    return forecastBank(focusBank, RUBRICS as RubricRef[])
      .filter((f) => f.cagrPct != null)
      .sort((a, b) => Math.abs(b.cagrPct ?? 0) - Math.abs(a.cagrPct ?? 0));
  }, [focusBank]);

  if (!focusBank) return <EmptyHint message="Aucune banque sélectionnable." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Banque suivie</CardTitle>
        </CardHeader>
        <CardBody className="p-0 max-h-[600px] overflow-y-auto">
          <div className="divide-y divide-primary-100/60">
            {banks.map((b) => {
              const gridCount = (b.conditionGrids ?? []).length;
              const isActive = focusBank.id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => onSelectBank(b.id)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-canvas-50 transition-colors ${
                    isActive ? 'bg-canvas-100 border-l-4 border-l-accent-500' : ''
                  }`}
                  disabled={gridCount < 2}
                >
                  <div className="text-sm font-medium text-ink-900 truncate">{b.name}</div>
                  <div className="text-[10px] text-ink-500 mt-0.5">
                    {gridCount < 2 ? 'historique insuffisant' : `${gridCount} versions`}
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{focusBank.name} — projections tarifaires</CardTitle>
            <Badge variant="warning">Indicatif</Badge>
          </div>
          <p className="text-xs text-ink-500 mt-1">
            Extrapolation linéaire sur l'historique des grilles. Signal de surveillance, non contractuel.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {forecasts.length === 0 ? (
            <p className="px-4 py-8 text-center text-ink-500 text-sm">
              Au moins 2 versions de grille sont nécessaires pour une projection.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-canvas-50 border-b border-primary-200/60">
                    <th className="text-left px-4 py-2.5 font-semibold text-ink-600 uppercase tracking-wider">Rubrique</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-ink-600">Actuel</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-ink-600">+6 mois</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-ink-600">+12 mois</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-ink-600">CAGR</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-ink-600">Risque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100/60">
                  {forecasts.map((f) => {
                    const last = f.history[f.history.length - 1].value;
                    const cagr = f.cagrPct ?? 0;
                    return (
                      <tr key={f.rubricPath} className="hover:bg-canvas-50/60">
                        <td className="px-4 py-2 font-medium text-ink-800">
                          {f.rubricLabel}
                          {f.seasonal && (
                            <Badge variant="warning" className="ml-1.5 text-[9px]">Saisonnier</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{last.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                          {f.forecast6m != null ? f.forecast6m.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                          {f.forecast12m != null ? f.forecast12m.toFixed(2) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${
                          cagr > 5 ? 'text-red-700' : cagr < -5 ? 'text-emerald-700' : 'text-ink-700'
                        }`}>
                          {cagr > 0 ? '+' : ''}{cagr.toFixed(1)} %
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              f.riskScore > 60 ? 'bg-red-500' : f.riskScore > 30 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            <span className="text-[11px] tabular-nums text-ink-600">{Math.round(f.riskScore)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
