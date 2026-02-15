import { useState, useRef, useEffect } from 'react';
import {
  X,
  Landmark,
  Building2,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Percent,
  AlertTriangle,
  Settings,
  Upload,
  Trash2,
  Eye,
  FileUp,
  Loader2,
  MapPin,
  Sparkles,
  Plus,
  Save,
  ChevronDown,
  ChevronUp,
  Banknote,
  Receipt,
  Shield,
  Phone,
  Smartphone,
  Lock,
  Users,
  Building,
  Globe,
  Wallet,
} from 'lucide-react';
import { Button, Badge } from '../ui';
import type { Bank, BankConditions, ArchivedDocument } from '../../types';
import { AFRICAN_COUNTRIES, ZONE_CURRENCIES } from '../../types';
import { pdfExtractionService, type ExtractionResult } from '../../services/PdfExtractionService';
import { v4 as uuidv4 } from 'uuid';

// Types pour les frais personnalisés
interface CustomFee {
  id: string;
  label: string;
  amount: number;
  type: 'fixed' | 'percent';
  frequency: 'once' | 'monthly' | 'yearly' | 'per_operation';
  category: string;
}

// Determine zone from country code
function getZoneFromCountry(country: string): 'CEMAC' | 'UEMOA' | null {
  const cemacCountries = ['CM', 'CF', 'CG', 'GA', 'GQ', 'TD'];
  const uemoaCountries = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'];
  if (cemacCountries.includes(country)) return 'CEMAC';
  if (uemoaCountries.includes(country)) return 'UEMOA';
  return null;
}

interface BankConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bank: Bank | null;
  onSaveConditions: (bankId: string, conditions: Partial<BankConditions>) => void;
  onUploadDocument: (bankId: string, document: ArchivedDocument) => void;
}

type TabId = 'compte' | 'guichet' | 'cartes' | 'virements' | 'cheques' | 'credits' | 'ebanking' | 'divers' | 'documents';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'compte', label: 'Compte', icon: <Building2 className="w-4 h-4" /> },
  { id: 'guichet', label: 'Opérations guichet', icon: <Banknote className="w-4 h-4" /> },
  { id: 'cartes', label: 'Cartes', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'virements', label: 'Virements', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { id: 'cheques', label: 'Chèques', icon: <FileText className="w-4 h-4" /> },
  { id: 'credits', label: 'Crédits & Agios', icon: <Percent className="w-4 h-4" /> },
  { id: 'ebanking', label: 'E-Banking', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'divers', label: 'Divers', icon: <Settings className="w-4 h-4" /> },
  { id: 'documents', label: 'Documents', icon: <FileUp className="w-4 h-4" /> },
];

// Structure complète des conditions bancaires africaines
interface FullBankConditions {
  // Tenue de compte
  tenueCompte: {
    particulierLocal: number;
    particulierEtranger: number;
    professionnel: number;
    entreprise: number;
    association: number;
    compteEpargne: number;
    compteDevises: number;
  };
  ouvertureCompte: {
    particulier: number;
    entreprise: number;
    minimumDepot: number;
  };
  clotureCompte: {
    particulier: number;
    entreprise: number;
  };
  releves: {
    mensuelPapier: number;
    mensuelEmail: number;
    duplicata: number;
    releveAnnuel: number;
    attestationSolde: number;
    certificatNonEngagement: number;
    rib: number;
  };
  // Opérations au guichet
  guichet: {
    versementEspeces: number;
    versementEspecesCommission: number;
    retraitEspeces: number;
    retraitEspecesCommission: number;
    changeManuel: number;
    achatDevises: number;
    venteDevises: number;
  };
  // Cartes bancaires
  cartes: Array<{
    id: string;
    nom: string;
    type: 'debit' | 'credit' | 'prepaid';
    reseau: 'VISA' | 'MASTERCARD' | 'GIMAC' | 'GIM-UEMOA' | 'AUTRE';
    cotisationAnnuelle: number;
    fraisEmission: number;
    plafondRetraitJour: number;
    plafondPaiementJour: number;
    plafondRetraitMois: number;
    plafondPaiementMois: number;
    validiteAnnees: number;
  }>;
  fraisCartes: {
    retraitDabPropre: number;
    retraitDabAutre: number;
    retraitDabInternational: number;
    paiementTpePropre: number;
    paiementTpeAutre: number;
    paiementTpeInternational: number;
    paiementInternet: number;
    oppositionCarte: number;
    renouvellementAnticipe: number;
    codeOublie: number;
    carteCaptee: number;
    consultationSolde: number;
  };
  // Virements
  virements: {
    interneGratuit: boolean;
    interneFrais: number;
    nationalMemeBank: number;
    nationalAutreBank: number;
    nationalAutreBankCommission: number;
    zoneMonetaire: number;
    zoneMonetaireCommission: number;
    international: number;
    internationalCommission: number;
    swift: number;
    instantane: number;
    permanent: number;
    rejetVirement: number;
    recuVirement: number;
  };
  // Chèques
  cheques: {
    carnet25: number;
    carnet50: number;
    carnet100: number;
    chequeGuichet: number;
    chequeCertifie: number;
    chequeBanque: number;
    oppositionCheque: number;
    chequeImpaye: number;
    chequeRetourne: number;
    encaissementPlace: number;
    encaissementDeplacement: number;
    encaissementEtranger: number;
    encaissementEtrangerCommission: number;
  };
  // Crédits et agios
  credits: {
    decouvertAutorise: number;
    decouvertNonAutorise: number;
    commissionMouvement: number;
    commissionPlusForte: number;
    tauxUsure: number;
    fraisDossierCredit: number;
    creditConsommationMin: number;
    creditConsommationMax: number;
    creditImmobilierMin: number;
    creditImmobilierMax: number;
    creditPME: number;
    penaliteRetard: number;
  };
  // E-Banking
  ebanking: {
    abonnementMensuel: number;
    abonnementAnnuel: number;
    parOperation: number;
    virementEnLigne: number;
    consultationGratuite: boolean;
    smsAlerte: number;
    smsAlerteAbonnement: number;
    mobileBanking: number;
    ussd: number;
  };
  // Services divers
  divers: {
    coffrePetit: number;
    coffreMoyen: number;
    coffreGrand: number;
    assuranceCompte: number;
    garantieBancaire: number;
    garantieLocative: number;
    cautionMarche: number;
    lettreInjonction: number;
    saisieAttribution: number;
    mainLevee: number;
    procuration: number;
    successionFrais: number;
    successionCommission: number;
    avoirInactif: number;
    fraisInactivite: number;
    droitTimbre: number;
    tvaServices: number;
  };
  // Frais personnalisés
  customFees: CustomFee[];
  // Documents archivés
  documents: ArchivedDocument[];
}

// Valeurs par défaut
function getDefaultFullConditions(): FullBankConditions {
  return {
    tenueCompte: {
      particulierLocal: 2500,
      particulierEtranger: 5000,
      professionnel: 7500,
      entreprise: 15000,
      association: 5000,
      compteEpargne: 0,
      compteDevises: 10000,
    },
    ouvertureCompte: {
      particulier: 0,
      entreprise: 25000,
      minimumDepot: 50000,
    },
    clotureCompte: {
      particulier: 5000,
      entreprise: 10000,
    },
    releves: {
      mensuelPapier: 1000,
      mensuelEmail: 0,
      duplicata: 2500,
      releveAnnuel: 5000,
      attestationSolde: 5000,
      certificatNonEngagement: 10000,
      rib: 500,
    },
    guichet: {
      versementEspeces: 0,
      versementEspecesCommission: 0,
      retraitEspeces: 0,
      retraitEspecesCommission: 0.1,
      changeManuel: 2500,
      achatDevises: 0.5,
      venteDevises: 0.5,
    },
    cartes: [
      {
        id: uuidv4(),
        nom: 'VISA Classic',
        type: 'debit',
        reseau: 'VISA',
        cotisationAnnuelle: 25000,
        fraisEmission: 5000,
        plafondRetraitJour: 500000,
        plafondPaiementJour: 1000000,
        plafondRetraitMois: 5000000,
        plafondPaiementMois: 10000000,
        validiteAnnees: 3,
      },
      {
        id: uuidv4(),
        nom: 'VISA Gold',
        type: 'debit',
        reseau: 'VISA',
        cotisationAnnuelle: 75000,
        fraisEmission: 10000,
        plafondRetraitJour: 1000000,
        plafondPaiementJour: 3000000,
        plafondRetraitMois: 10000000,
        plafondPaiementMois: 30000000,
        validiteAnnees: 3,
      },
      {
        id: uuidv4(),
        nom: 'Carte GIMAC',
        type: 'debit',
        reseau: 'GIMAC',
        cotisationAnnuelle: 10000,
        fraisEmission: 2500,
        plafondRetraitJour: 300000,
        plafondPaiementJour: 500000,
        plafondRetraitMois: 3000000,
        plafondPaiementMois: 5000000,
        validiteAnnees: 2,
      },
    ],
    fraisCartes: {
      retraitDabPropre: 0,
      retraitDabAutre: 500,
      retraitDabInternational: 3000,
      paiementTpePropre: 0,
      paiementTpeAutre: 250,
      paiementTpeInternational: 1.5,
      paiementInternet: 1,
      oppositionCarte: 5000,
      renouvellementAnticipe: 10000,
      codeOublie: 2500,
      carteCaptee: 5000,
      consultationSolde: 200,
    },
    virements: {
      interneGratuit: true,
      interneFrais: 0,
      nationalMemeBank: 0,
      nationalAutreBank: 2500,
      nationalAutreBankCommission: 0.1,
      zoneMonetaire: 5000,
      zoneMonetaireCommission: 0.25,
      international: 15000,
      internationalCommission: 0.5,
      swift: 25000,
      instantane: 500,
      permanent: 2500,
      rejetVirement: 5000,
      recuVirement: 0,
    },
    cheques: {
      carnet25: 5000,
      carnet50: 8000,
      carnet100: 15000,
      chequeGuichet: 500,
      chequeCertifie: 5000,
      chequeBanque: 10000,
      oppositionCheque: 10000,
      chequeImpaye: 25000,
      chequeRetourne: 15000,
      encaissementPlace: 0,
      encaissementDeplacement: 2500,
      encaissementEtranger: 10000,
      encaissementEtrangerCommission: 0.5,
    },
    credits: {
      decouvertAutorise: 14.5,
      decouvertNonAutorise: 18,
      commissionMouvement: 0.025,
      commissionPlusForte: 0.05,
      tauxUsure: 27,
      fraisDossierCredit: 1,
      creditConsommationMin: 12,
      creditConsommationMax: 18,
      creditImmobilierMin: 8,
      creditImmobilierMax: 12,
      creditPME: 14,
      penaliteRetard: 2,
    },
    ebanking: {
      abonnementMensuel: 0,
      abonnementAnnuel: 0,
      parOperation: 0,
      virementEnLigne: 250,
      consultationGratuite: true,
      smsAlerte: 50,
      smsAlerteAbonnement: 1000,
      mobileBanking: 0,
      ussd: 100,
    },
    divers: {
      coffrePetit: 50000,
      coffreMoyen: 100000,
      coffreGrand: 200000,
      assuranceCompte: 2500,
      garantieBancaire: 1,
      garantieLocative: 25000,
      cautionMarche: 1,
      lettreInjonction: 15000,
      saisieAttribution: 25000,
      mainLevee: 15000,
      procuration: 5000,
      successionFrais: 50000,
      successionCommission: 0.5,
      avoirInactif: 10000,
      fraisInactivite: 5000,
      droitTimbre: 0,
      tvaServices: 19.25,
    },
    customFees: [],
    documents: [],
  };
}

export function BankConditionsModal({
  isOpen,
  onClose,
  bank,
  onSaveConditions,
}: BankConditionsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('compte');
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État local pour les conditions éditables
  const [conditions, setConditions] = useState<FullBankConditions>(getDefaultFullConditions());

  // Charger les conditions existantes quand la modal s'ouvre
  useEffect(() => {
    if (bank?.conditions) {
      // Fusionner avec les valeurs par défaut
      setConditions({
        ...getDefaultFullConditions(),
        ...bank.conditions,
        documents: bank.conditions.documents || [],
      } as FullBankConditions);
    } else {
      setConditions(getDefaultFullConditions());
    }
    setHasChanges(false);
  }, [bank, isOpen]);

  if (!isOpen || !bank) return null;

  const zone = bank.zone || getZoneFromCountry(bank.country);
  const currency = zone ? ZONE_CURRENCIES[zone] : { code: 'XAF', name: 'Franc CFA' };
  const countryName = AFRICAN_COUNTRIES[bank.country] || bank.country;

  // Fonction pour mettre à jour une valeur
  const updateValue = (path: string, value: string | number | boolean) => {
    setConditions(prev => {
      const newConditions = { ...prev };
      const keys = path.split('.');
      let current: Record<string, unknown> = newConditions as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      return newConditions;
    });
    setHasChanges(true);
  };

  // Ajouter une carte
  const addCard = () => {
    const newCard = {
      id: uuidv4(),
      nom: 'Nouvelle carte',
      type: 'debit' as const,
      reseau: 'VISA' as const,
      cotisationAnnuelle: 0,
      fraisEmission: 0,
      plafondRetraitJour: 0,
      plafondPaiementJour: 0,
      plafondRetraitMois: 0,
      plafondPaiementMois: 0,
      validiteAnnees: 2,
    };
    setConditions(prev => ({
      ...prev,
      cartes: [...prev.cartes, newCard],
    }));
    setHasChanges(true);
  };

  // Supprimer une carte
  const removeCard = (id: string) => {
    setConditions(prev => ({
      ...prev,
      cartes: prev.cartes.filter(c => c.id !== id),
    }));
    setHasChanges(true);
  };

  // Mettre à jour une carte
  const updateCard = (id: string, field: string, value: string | number) => {
    setConditions(prev => ({
      ...prev,
      cartes: prev.cartes.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }));
    setHasChanges(true);
  };

  // Ajouter un frais personnalisé
  const addCustomFee = () => {
    const newFee: CustomFee = {
      id: uuidv4(),
      label: 'Nouveau frais',
      amount: 0,
      type: 'fixed',
      frequency: 'once',
      category: activeTab,
    };
    setConditions(prev => ({
      ...prev,
      customFees: [...prev.customFees, newFee],
    }));
    setHasChanges(true);
  };

  // Supprimer un frais personnalisé
  const removeCustomFee = (id: string) => {
    setConditions(prev => ({
      ...prev,
      customFees: prev.customFees.filter(f => f.id !== id),
    }));
    setHasChanges(true);
  };

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Sauvegarder les conditions
  const handleSave = () => {
    onSaveConditions(bank.id, conditions as any);
    setHasChanges(false);
  };

  // Upload PDF
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) return;

    setIsUploading(true);
    setExtractionResult(null);

    try {
      const base64 = await fileToBase64(file);
      setIsExtracting(true);
      const result = await pdfExtractionService.extractFromFile(file);
      setExtractionResult(result);

      const document: ArchivedDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        type: 'conditions',
        uploadDate: new Date(),
        effectiveDate: new Date(),
        fileData: base64,
        fileSize: file.size,
        extractedAt: result.success ? new Date() : undefined,
        isActive: true,
      };

      setConditions(prev => ({
        ...prev,
        documents: [...prev.documents, document],
      }));
      setHasChanges(true);

    } catch (error) {
      console.error('Erreur upload:', error);
      setExtractionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        confidence: 0,
      });
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Supprimer un document
  const removeDocument = (id: string) => {
    setConditions(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== id),
    }));
    setHasChanges(true);
  };

  // Composant pour un champ éditable
  const EditableField = ({
    label,
    value,
    onChange,
    type = 'number',
    suffix = '',
    min,
    max,
    step,
  }: {
    label: string;
    value: number | string | boolean;
    onChange: (value: string | number | boolean) => void;
    type?: 'number' | 'percent' | 'text' | 'checkbox';
    suffix?: string;
    min?: number;
    max?: number;
    step?: number;
  }) => {
    if (type === 'checkbox') {
      return (
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-primary-700">{label}</span>
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
            className="w-5 h-5 rounded border-primary-300 text-primary-900 focus:ring-primary-500"
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between py-2 border-b border-primary-50">
        <span className="text-sm text-primary-700 flex-1">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value as number}
            onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step || (type === 'percent' ? 0.01 : 1)}
            className="w-28 px-2 py-1 text-right text-sm border border-primary-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
          <span className="text-xs text-primary-500 w-12">{suffix || (type === 'percent' ? '%' : currency.code)}</span>
        </div>
      </div>
    );
  };

  // Composant section pliable
  const CollapsibleSection = ({
    title,
    icon,
    children,
    id,
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    id: string;
  }) => {
    const isExpanded = expandedSections[id] !== false; // Par défaut ouvert

    return (
      <div className="border border-primary-200 rounded-lg overflow-hidden mb-4">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-3 bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-primary-900">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-primary-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-primary-500" />
          )}
        </button>
        {isExpanded && (
          <div className="p-4 bg-white">{children}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] max-w-7xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-primary-200 bg-primary-900 text-white rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{bank.name}</h2>
              <div className="flex items-center gap-3 text-sm text-primary-300">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {countryName}
                </span>
                <Badge variant={zone === 'CEMAC' ? 'info' : 'success'} className="text-xs">
                  {zone} - {currency.code}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="warning" className="animate-pulse">
                Modifications non sauvegardées
              </Badge>
            )}
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={!hasChanges}
              className="bg-white text-primary-900 hover:bg-primary-100"
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-primary-200 bg-primary-50">
          <div className="flex gap-1 px-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-900 text-primary-900 bg-white'
                    : 'border-transparent text-primary-500 hover:text-primary-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Onglet Compte */}
          {activeTab === 'compte' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="tenue"
                title="Frais de tenue de compte (mensuel)"
                icon={<Building2 className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Particulier résident"
                  value={conditions.tenueCompte.particulierLocal}
                  onChange={(v) => updateValue('tenueCompte.particulierLocal', v)}
                />
                <EditableField
                  label="Particulier non-résident"
                  value={conditions.tenueCompte.particulierEtranger}
                  onChange={(v) => updateValue('tenueCompte.particulierEtranger', v)}
                />
                <EditableField
                  label="Professionnel / Auto-entrepreneur"
                  value={conditions.tenueCompte.professionnel}
                  onChange={(v) => updateValue('tenueCompte.professionnel', v)}
                />
                <EditableField
                  label="Entreprise / Personne morale"
                  value={conditions.tenueCompte.entreprise}
                  onChange={(v) => updateValue('tenueCompte.entreprise', v)}
                />
                <EditableField
                  label="Association / ONG"
                  value={conditions.tenueCompte.association}
                  onChange={(v) => updateValue('tenueCompte.association', v)}
                />
                <EditableField
                  label="Compte épargne"
                  value={conditions.tenueCompte.compteEpargne}
                  onChange={(v) => updateValue('tenueCompte.compteEpargne', v)}
                />
                <EditableField
                  label="Compte devises"
                  value={conditions.tenueCompte.compteDevises}
                  onChange={(v) => updateValue('tenueCompte.compteDevises', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="ouverture"
                title="Ouverture de compte"
                icon={<Plus className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Frais ouverture particulier"
                  value={conditions.ouvertureCompte.particulier}
                  onChange={(v) => updateValue('ouvertureCompte.particulier', v)}
                />
                <EditableField
                  label="Frais ouverture entreprise"
                  value={conditions.ouvertureCompte.entreprise}
                  onChange={(v) => updateValue('ouvertureCompte.entreprise', v)}
                />
                <EditableField
                  label="Dépôt minimum initial"
                  value={conditions.ouvertureCompte.minimumDepot}
                  onChange={(v) => updateValue('ouvertureCompte.minimumDepot', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="cloture"
                title="Clôture de compte"
                icon={<X className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Clôture compte particulier"
                  value={conditions.clotureCompte.particulier}
                  onChange={(v) => updateValue('clotureCompte.particulier', v)}
                />
                <EditableField
                  label="Clôture compte entreprise"
                  value={conditions.clotureCompte.entreprise}
                  onChange={(v) => updateValue('clotureCompte.entreprise', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="releves"
                title="Relevés et attestations"
                icon={<FileText className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Relevé mensuel (papier)"
                  value={conditions.releves.mensuelPapier}
                  onChange={(v) => updateValue('releves.mensuelPapier', v)}
                />
                <EditableField
                  label="Relevé mensuel (email)"
                  value={conditions.releves.mensuelEmail}
                  onChange={(v) => updateValue('releves.mensuelEmail', v)}
                />
                <EditableField
                  label="Duplicata de relevé"
                  value={conditions.releves.duplicata}
                  onChange={(v) => updateValue('releves.duplicata', v)}
                />
                <EditableField
                  label="Relevé annuel"
                  value={conditions.releves.releveAnnuel}
                  onChange={(v) => updateValue('releves.releveAnnuel', v)}
                />
                <EditableField
                  label="Attestation de solde"
                  value={conditions.releves.attestationSolde}
                  onChange={(v) => updateValue('releves.attestationSolde', v)}
                />
                <EditableField
                  label="Certificat de non-engagement"
                  value={conditions.releves.certificatNonEngagement}
                  onChange={(v) => updateValue('releves.certificatNonEngagement', v)}
                />
                <EditableField
                  label="RIB / IBAN"
                  value={conditions.releves.rib}
                  onChange={(v) => updateValue('releves.rib', v)}
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet Guichet */}
          {activeTab === 'guichet' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="especes"
                title="Opérations en espèces"
                icon={<Banknote className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Versement espèces (frais fixes)"
                  value={conditions.guichet.versementEspeces}
                  onChange={(v) => updateValue('guichet.versementEspeces', v)}
                />
                <EditableField
                  label="Versement espèces (commission)"
                  value={conditions.guichet.versementEspecesCommission}
                  onChange={(v) => updateValue('guichet.versementEspecesCommission', v)}
                  type="percent"
                />
                <EditableField
                  label="Retrait espèces (frais fixes)"
                  value={conditions.guichet.retraitEspeces}
                  onChange={(v) => updateValue('guichet.retraitEspeces', v)}
                />
                <EditableField
                  label="Retrait espèces (commission)"
                  value={conditions.guichet.retraitEspecesCommission}
                  onChange={(v) => updateValue('guichet.retraitEspecesCommission', v)}
                  type="percent"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="change"
                title="Change manuel"
                icon={<Globe className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Frais fixes change"
                  value={conditions.guichet.changeManuel}
                  onChange={(v) => updateValue('guichet.changeManuel', v)}
                />
                <EditableField
                  label="Commission achat devises"
                  value={conditions.guichet.achatDevises}
                  onChange={(v) => updateValue('guichet.achatDevises', v)}
                  type="percent"
                />
                <EditableField
                  label="Commission vente devises"
                  value={conditions.guichet.venteDevises}
                  onChange={(v) => updateValue('guichet.venteDevises', v)}
                  type="percent"
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet Cartes */}
          {activeTab === 'cartes' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-primary-900">Cartes bancaires</h3>
                <Button onClick={addCard} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une carte
                </Button>
              </div>

              {conditions.cartes.map((card) => (
                <div key={card.id} className="border border-primary-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-primary-50">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-primary-600" />
                      <input
                        type="text"
                        value={card.nom}
                        onChange={(e) => updateCard(card.id, 'nom', e.target.value)}
                        className="font-medium text-primary-900 bg-transparent border-none focus:ring-0 p-0"
                      />
                      <Badge variant={card.type === 'credit' ? 'warning' : 'info'}>
                        {card.type === 'credit' ? 'Crédit' : card.type === 'prepaid' ? 'Prépayée' : 'Débit'}
                      </Badge>
                    </div>
                    <button
                      onClick={() => removeCard(card.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-primary-500 mb-1">Réseau</label>
                      <select
                        value={card.reseau}
                        onChange={(e) => updateCard(card.id, 'reseau', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-primary-200 rounded"
                      >
                        <option value="VISA">VISA</option>
                        <option value="MASTERCARD">MASTERCARD</option>
                        <option value="GIMAC">GIMAC</option>
                        <option value="GIM-UEMOA">GIM-UEMOA</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-primary-500 mb-1">Type</label>
                      <select
                        value={card.type}
                        onChange={(e) => updateCard(card.id, 'type', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-primary-200 rounded"
                      >
                        <option value="debit">Débit</option>
                        <option value="credit">Crédit</option>
                        <option value="prepaid">Prépayée</option>
                      </select>
                    </div>
                    <EditableField
                      label="Cotisation annuelle"
                      value={card.cotisationAnnuelle}
                      onChange={(v) => updateCard(card.id, 'cotisationAnnuelle', v)}
                    />
                    <EditableField
                      label="Frais d'émission"
                      value={card.fraisEmission}
                      onChange={(v) => updateCard(card.id, 'fraisEmission', v)}
                    />
                    <EditableField
                      label="Plafond retrait/jour"
                      value={card.plafondRetraitJour}
                      onChange={(v) => updateCard(card.id, 'plafondRetraitJour', v)}
                    />
                    <EditableField
                      label="Plafond paiement/jour"
                      value={card.plafondPaiementJour}
                      onChange={(v) => updateCard(card.id, 'plafondPaiementJour', v)}
                    />
                    <EditableField
                      label="Validité (années)"
                      value={card.validiteAnnees}
                      onChange={(v) => updateCard(card.id, 'validiteAnnees', v)}
                      suffix="ans"
                    />
                  </div>
                </div>
              ))}

              <CollapsibleSection
                id="fraisCartes"
                title="Frais liés aux cartes"
                icon={<Receipt className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Retrait DAB propre réseau"
                  value={conditions.fraisCartes.retraitDabPropre}
                  onChange={(v) => updateValue('fraisCartes.retraitDabPropre', v)}
                />
                <EditableField
                  label="Retrait DAB autre banque"
                  value={conditions.fraisCartes.retraitDabAutre}
                  onChange={(v) => updateValue('fraisCartes.retraitDabAutre', v)}
                />
                <EditableField
                  label="Retrait DAB international"
                  value={conditions.fraisCartes.retraitDabInternational}
                  onChange={(v) => updateValue('fraisCartes.retraitDabInternational', v)}
                />
                <EditableField
                  label="Paiement TPE propre réseau"
                  value={conditions.fraisCartes.paiementTpePropre}
                  onChange={(v) => updateValue('fraisCartes.paiementTpePropre', v)}
                />
                <EditableField
                  label="Paiement TPE autre banque"
                  value={conditions.fraisCartes.paiementTpeAutre}
                  onChange={(v) => updateValue('fraisCartes.paiementTpeAutre', v)}
                />
                <EditableField
                  label="Paiement TPE international"
                  value={conditions.fraisCartes.paiementTpeInternational}
                  onChange={(v) => updateValue('fraisCartes.paiementTpeInternational', v)}
                  type="percent"
                />
                <EditableField
                  label="Paiement internet"
                  value={conditions.fraisCartes.paiementInternet}
                  onChange={(v) => updateValue('fraisCartes.paiementInternet', v)}
                  type="percent"
                />
                <EditableField
                  label="Opposition sur carte"
                  value={conditions.fraisCartes.oppositionCarte}
                  onChange={(v) => updateValue('fraisCartes.oppositionCarte', v)}
                />
                <EditableField
                  label="Renouvellement anticipé"
                  value={conditions.fraisCartes.renouvellementAnticipe}
                  onChange={(v) => updateValue('fraisCartes.renouvellementAnticipe', v)}
                />
                <EditableField
                  label="Code PIN oublié"
                  value={conditions.fraisCartes.codeOublie}
                  onChange={(v) => updateValue('fraisCartes.codeOublie', v)}
                />
                <EditableField
                  label="Carte capturée"
                  value={conditions.fraisCartes.carteCaptee}
                  onChange={(v) => updateValue('fraisCartes.carteCaptee', v)}
                />
                <EditableField
                  label="Consultation solde DAB"
                  value={conditions.fraisCartes.consultationSolde}
                  onChange={(v) => updateValue('fraisCartes.consultationSolde', v)}
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet Virements */}
          {activeTab === 'virements' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="virInternes"
                title="Virements internes"
                icon={<ArrowLeftRight className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Virement interne gratuit"
                  value={conditions.virements.interneGratuit}
                  onChange={(v) => updateValue('virements.interneGratuit', v)}
                  type="checkbox"
                />
                {!conditions.virements.interneGratuit && (
                  <EditableField
                    label="Frais virement interne"
                    value={conditions.virements.interneFrais}
                    onChange={(v) => updateValue('virements.interneFrais', v)}
                  />
                )}
              </CollapsibleSection>

              <CollapsibleSection
                id="virNationaux"
                title="Virements nationaux"
                icon={<Building className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Même banque (agence différente)"
                  value={conditions.virements.nationalMemeBank}
                  onChange={(v) => updateValue('virements.nationalMemeBank', v)}
                />
                <EditableField
                  label="Autre banque (frais fixes)"
                  value={conditions.virements.nationalAutreBank}
                  onChange={(v) => updateValue('virements.nationalAutreBank', v)}
                />
                <EditableField
                  label="Autre banque (commission)"
                  value={conditions.virements.nationalAutreBankCommission}
                  onChange={(v) => updateValue('virements.nationalAutreBankCommission', v)}
                  type="percent"
                />
                <EditableField
                  label="Virement instantané"
                  value={conditions.virements.instantane}
                  onChange={(v) => updateValue('virements.instantane', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="virZone"
                title={`Virements zone ${zone || 'CEMAC/UEMOA'}`}
                icon={<Globe className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Frais fixes"
                  value={conditions.virements.zoneMonetaire}
                  onChange={(v) => updateValue('virements.zoneMonetaire', v)}
                />
                <EditableField
                  label="Commission"
                  value={conditions.virements.zoneMonetaireCommission}
                  onChange={(v) => updateValue('virements.zoneMonetaireCommission', v)}
                  type="percent"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="virInternational"
                title="Virements internationaux"
                icon={<Globe className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Frais fixes"
                  value={conditions.virements.international}
                  onChange={(v) => updateValue('virements.international', v)}
                />
                <EditableField
                  label="Commission"
                  value={conditions.virements.internationalCommission}
                  onChange={(v) => updateValue('virements.internationalCommission', v)}
                  type="percent"
                />
                <EditableField
                  label="Frais SWIFT"
                  value={conditions.virements.swift}
                  onChange={(v) => updateValue('virements.swift', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="virAutres"
                title="Autres virements"
                icon={<Settings className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Ordre permanent"
                  value={conditions.virements.permanent}
                  onChange={(v) => updateValue('virements.permanent', v)}
                />
                <EditableField
                  label="Rejet de virement"
                  value={conditions.virements.rejetVirement}
                  onChange={(v) => updateValue('virements.rejetVirement', v)}
                />
                <EditableField
                  label="Virement reçu"
                  value={conditions.virements.recuVirement}
                  onChange={(v) => updateValue('virements.recuVirement', v)}
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet Chèques */}
          {activeTab === 'cheques' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="carnets"
                title="Carnets de chèques"
                icon={<FileText className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Carnet 25 feuilles"
                  value={conditions.cheques.carnet25}
                  onChange={(v) => updateValue('cheques.carnet25', v)}
                />
                <EditableField
                  label="Carnet 50 feuilles"
                  value={conditions.cheques.carnet50}
                  onChange={(v) => updateValue('cheques.carnet50', v)}
                />
                <EditableField
                  label="Carnet 100 feuilles"
                  value={conditions.cheques.carnet100}
                  onChange={(v) => updateValue('cheques.carnet100', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="typesCheques"
                title="Types de chèques"
                icon={<Receipt className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Chèque de guichet"
                  value={conditions.cheques.chequeGuichet}
                  onChange={(v) => updateValue('cheques.chequeGuichet', v)}
                />
                <EditableField
                  label="Chèque certifié"
                  value={conditions.cheques.chequeCertifie}
                  onChange={(v) => updateValue('cheques.chequeCertifie', v)}
                />
                <EditableField
                  label="Chèque de banque"
                  value={conditions.cheques.chequeBanque}
                  onChange={(v) => updateValue('cheques.chequeBanque', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="incidentsCheques"
                title="Incidents sur chèques"
                icon={<AlertTriangle className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Opposition sur chèque"
                  value={conditions.cheques.oppositionCheque}
                  onChange={(v) => updateValue('cheques.oppositionCheque', v)}
                />
                <EditableField
                  label="Chèque impayé émis"
                  value={conditions.cheques.chequeImpaye}
                  onChange={(v) => updateValue('cheques.chequeImpaye', v)}
                />
                <EditableField
                  label="Chèque retourné"
                  value={conditions.cheques.chequeRetourne}
                  onChange={(v) => updateValue('cheques.chequeRetourne', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="encaissement"
                title="Encaissement de chèques"
                icon={<Wallet className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Encaissement sur place"
                  value={conditions.cheques.encaissementPlace}
                  onChange={(v) => updateValue('cheques.encaissementPlace', v)}
                />
                <EditableField
                  label="Encaissement déplacé"
                  value={conditions.cheques.encaissementDeplacement}
                  onChange={(v) => updateValue('cheques.encaissementDeplacement', v)}
                />
                <EditableField
                  label="Encaissement étranger (frais)"
                  value={conditions.cheques.encaissementEtranger}
                  onChange={(v) => updateValue('cheques.encaissementEtranger', v)}
                />
                <EditableField
                  label="Encaissement étranger (commission)"
                  value={conditions.cheques.encaissementEtrangerCommission}
                  onChange={(v) => updateValue('cheques.encaissementEtrangerCommission', v)}
                  type="percent"
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet Crédits */}
          {activeTab === 'credits' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="decouvert"
                title="Découverts"
                icon={<AlertTriangle className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Taux découvert autorisé (TEG)"
                  value={conditions.credits.decouvertAutorise}
                  onChange={(v) => updateValue('credits.decouvertAutorise', v)}
                  type="percent"
                />
                <EditableField
                  label="Taux découvert non autorisé"
                  value={conditions.credits.decouvertNonAutorise}
                  onChange={(v) => updateValue('credits.decouvertNonAutorise', v)}
                  type="percent"
                />
                <EditableField
                  label="Commission de mouvement"
                  value={conditions.credits.commissionMouvement}
                  onChange={(v) => updateValue('credits.commissionMouvement', v)}
                  type="percent"
                />
                <EditableField
                  label="Commission plus forte découverte"
                  value={conditions.credits.commissionPlusForte}
                  onChange={(v) => updateValue('credits.commissionPlusForte', v)}
                  type="percent"
                />
                <EditableField
                  label="Taux d'usure légal"
                  value={conditions.credits.tauxUsure}
                  onChange={(v) => updateValue('credits.tauxUsure', v)}
                  type="percent"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="credits"
                title="Crédits"
                icon={<Percent className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Frais de dossier crédit"
                  value={conditions.credits.fraisDossierCredit}
                  onChange={(v) => updateValue('credits.fraisDossierCredit', v)}
                  type="percent"
                />
                <EditableField
                  label="Crédit conso - taux min"
                  value={conditions.credits.creditConsommationMin}
                  onChange={(v) => updateValue('credits.creditConsommationMin', v)}
                  type="percent"
                />
                <EditableField
                  label="Crédit conso - taux max"
                  value={conditions.credits.creditConsommationMax}
                  onChange={(v) => updateValue('credits.creditConsommationMax', v)}
                  type="percent"
                />
                <EditableField
                  label="Crédit immobilier - taux min"
                  value={conditions.credits.creditImmobilierMin}
                  onChange={(v) => updateValue('credits.creditImmobilierMin', v)}
                  type="percent"
                />
                <EditableField
                  label="Crédit immobilier - taux max"
                  value={conditions.credits.creditImmobilierMax}
                  onChange={(v) => updateValue('credits.creditImmobilierMax', v)}
                  type="percent"
                />
                <EditableField
                  label="Crédit PME/TPE"
                  value={conditions.credits.creditPME}
                  onChange={(v) => updateValue('credits.creditPME', v)}
                  type="percent"
                />
                <EditableField
                  label="Pénalité de retard"
                  value={conditions.credits.penaliteRetard}
                  onChange={(v) => updateValue('credits.penaliteRetard', v)}
                  type="percent"
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet E-Banking */}
          {activeTab === 'ebanking' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="abonnement"
                title="Abonnements"
                icon={<Smartphone className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Abonnement mensuel"
                  value={conditions.ebanking.abonnementMensuel}
                  onChange={(v) => updateValue('ebanking.abonnementMensuel', v)}
                />
                <EditableField
                  label="Abonnement annuel"
                  value={conditions.ebanking.abonnementAnnuel}
                  onChange={(v) => updateValue('ebanking.abonnementAnnuel', v)}
                />
                <EditableField
                  label="Consultation gratuite"
                  value={conditions.ebanking.consultationGratuite}
                  onChange={(v) => updateValue('ebanking.consultationGratuite', v)}
                  type="checkbox"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="operations"
                title="Opérations en ligne"
                icon={<Globe className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Par opération"
                  value={conditions.ebanking.parOperation}
                  onChange={(v) => updateValue('ebanking.parOperation', v)}
                />
                <EditableField
                  label="Virement en ligne"
                  value={conditions.ebanking.virementEnLigne}
                  onChange={(v) => updateValue('ebanking.virementEnLigne', v)}
                />
                <EditableField
                  label="Mobile Banking"
                  value={conditions.ebanking.mobileBanking}
                  onChange={(v) => updateValue('ebanking.mobileBanking', v)}
                />
                <EditableField
                  label="USSD"
                  value={conditions.ebanking.ussd}
                  onChange={(v) => updateValue('ebanking.ussd', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="alertes"
                title="Alertes SMS"
                icon={<Phone className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Par SMS"
                  value={conditions.ebanking.smsAlerte}
                  onChange={(v) => updateValue('ebanking.smsAlerte', v)}
                />
                <EditableField
                  label="Abonnement SMS (mensuel)"
                  value={conditions.ebanking.smsAlerteAbonnement}
                  onChange={(v) => updateValue('ebanking.smsAlerteAbonnement', v)}
                />
              </CollapsibleSection>
            </div>
          )}

          {/* Onglet Divers */}
          {activeTab === 'divers' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <CollapsibleSection
                id="coffres"
                title="Location de coffres"
                icon={<Lock className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Coffre petit (annuel)"
                  value={conditions.divers.coffrePetit}
                  onChange={(v) => updateValue('divers.coffrePetit', v)}
                />
                <EditableField
                  label="Coffre moyen (annuel)"
                  value={conditions.divers.coffreMoyen}
                  onChange={(v) => updateValue('divers.coffreMoyen', v)}
                />
                <EditableField
                  label="Coffre grand (annuel)"
                  value={conditions.divers.coffreGrand}
                  onChange={(v) => updateValue('divers.coffreGrand', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="garanties"
                title="Garanties et cautions"
                icon={<Shield className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Assurance compte"
                  value={conditions.divers.assuranceCompte}
                  onChange={(v) => updateValue('divers.assuranceCompte', v)}
                />
                <EditableField
                  label="Garantie bancaire (commission)"
                  value={conditions.divers.garantieBancaire}
                  onChange={(v) => updateValue('divers.garantieBancaire', v)}
                  type="percent"
                />
                <EditableField
                  label="Garantie locative"
                  value={conditions.divers.garantieLocative}
                  onChange={(v) => updateValue('divers.garantieLocative', v)}
                />
                <EditableField
                  label="Caution marché (commission)"
                  value={conditions.divers.cautionMarche}
                  onChange={(v) => updateValue('divers.cautionMarche', v)}
                  type="percent"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="incidents"
                title="Incidents et contentieux"
                icon={<AlertTriangle className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Lettre d'injonction"
                  value={conditions.divers.lettreInjonction}
                  onChange={(v) => updateValue('divers.lettreInjonction', v)}
                />
                <EditableField
                  label="Saisie attribution"
                  value={conditions.divers.saisieAttribution}
                  onChange={(v) => updateValue('divers.saisieAttribution', v)}
                />
                <EditableField
                  label="Mainlevée"
                  value={conditions.divers.mainLevee}
                  onChange={(v) => updateValue('divers.mainLevee', v)}
                />
                <EditableField
                  label="Frais d'inactivité"
                  value={conditions.divers.fraisInactivite}
                  onChange={(v) => updateValue('divers.fraisInactivite', v)}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="succession"
                title="Succession et procurations"
                icon={<Users className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Procuration"
                  value={conditions.divers.procuration}
                  onChange={(v) => updateValue('divers.procuration', v)}
                />
                <EditableField
                  label="Succession (frais fixes)"
                  value={conditions.divers.successionFrais}
                  onChange={(v) => updateValue('divers.successionFrais', v)}
                />
                <EditableField
                  label="Succession (commission)"
                  value={conditions.divers.successionCommission}
                  onChange={(v) => updateValue('divers.successionCommission', v)}
                  type="percent"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="taxes"
                title="Taxes et timbres"
                icon={<Receipt className="w-5 h-5 text-primary-600" />}
              >
                <EditableField
                  label="Droit de timbre"
                  value={conditions.divers.droitTimbre}
                  onChange={(v) => updateValue('divers.droitTimbre', v)}
                />
                <EditableField
                  label="TVA sur services"
                  value={conditions.divers.tvaServices}
                  onChange={(v) => updateValue('divers.tvaServices', v)}
                  type="percent"
                />
              </CollapsibleSection>

              {/* Frais personnalisés */}
              <div className="border border-primary-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-primary-50">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary-600" />
                    <span className="font-medium text-primary-900">Frais personnalisés</span>
                  </div>
                  <Button onClick={addCustomFee} size="sm" variant="secondary">
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                {conditions.customFees.filter(f => f.category === activeTab).length > 0 && (
                  <div className="p-4 space-y-2">
                    {conditions.customFees
                      .filter(f => f.category === activeTab)
                      .map(fee => (
                        <div key={fee.id} className="flex items-center gap-2 p-2 bg-primary-50 rounded">
                          <input
                            type="text"
                            value={fee.label}
                            onChange={(e) => {
                              setConditions(prev => ({
                                ...prev,
                                customFees: prev.customFees.map(f =>
                                  f.id === fee.id ? { ...f, label: e.target.value } : f
                                ),
                              }));
                              setHasChanges(true);
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-primary-200 rounded"
                            placeholder="Libellé"
                          />
                          <input
                            type="number"
                            value={fee.amount}
                            onChange={(e) => {
                              setConditions(prev => ({
                                ...prev,
                                customFees: prev.customFees.map(f =>
                                  f.id === fee.id ? { ...f, amount: Number(e.target.value) } : f
                                ),
                              }));
                              setHasChanges(true);
                            }}
                            className="w-24 px-2 py-1 text-sm border border-primary-200 rounded text-right"
                          />
                          <span className="text-xs text-primary-500">{currency.code}</span>
                          <button
                            onClick={() => removeCustomFee(fee.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onglet Documents */}
          {activeTab === 'documents' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Zone d'upload */}
              <div
                onClick={() => !isUploading && !isExtracting && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isUploading || isExtracting
                    ? 'border-primary-400 bg-primary-50 cursor-wait'
                    : 'border-primary-300 hover:border-primary-400 hover:bg-primary-50'
                }`}
              >
                {isUploading || isExtracting ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
                    <p className="text-primary-700 font-medium">
                      {isExtracting ? 'Extraction des données...' : 'Téléchargement...'}
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-primary-900">
                      Importer un PDF de conditions bancaires
                    </p>
                    <p className="text-sm text-primary-500 mt-2">
                      Cliquez ou glissez-déposez un fichier PDF
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Résultat extraction */}
              {extractionResult && (
                <div className={`rounded-lg p-4 ${
                  extractionResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {extractionResult.success ? (
                      <Sparkles className="w-5 h-5 text-primary-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-primary-600" />
                    )}
                    <div>
                      <p className={`font-medium ${extractionResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {extractionResult.success ? 'Extraction réussie' : 'Erreur d\'extraction'}
                      </p>
                      {extractionResult.success && (
                        <p className="text-sm text-green-700">
                          Confiance: {extractionResult.confidence}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des documents */}
              <div>
                <h3 className="font-semibold text-primary-900 mb-4">Documents archivés</h3>
                {conditions.documents.length === 0 ? (
                  <div className="text-center py-8 text-primary-500">
                    <FileUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun document archivé</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conditions.documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary-600" />
                          <div>
                            <p className="font-medium text-primary-900">{doc.name}</p>
                            <p className="text-xs text-primary-500">
                              {new Date(doc.uploadDate).toLocaleDateString('fr-FR')} •{' '}
                              {(doc.fileSize / 1024).toFixed(0)} Ko
                              {doc.extractedAt && ' • Données extraites'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.fileData}
                            download={doc.name}
                            className="p-2 text-primary-600 hover:bg-primary-100 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => removeDocument(doc.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-primary-200 bg-primary-50 flex items-center justify-between">
          <p className="text-sm text-primary-500">
            Dernière modification: {bank.updatedAt ? new Date(bank.updatedAt).toLocaleDateString('fr-FR') : 'N/A'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
