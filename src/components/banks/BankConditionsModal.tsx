import { useState, useRef, useEffect, useMemo } from 'react';
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
import { getDocumentEngine, type ExtractionReport } from '../../extraction';
import { extractConditions } from '../../extraction/conditions';
import { setByPath } from '../../extraction/normalize';
import { ExtractionReportPanel } from './ExtractionReportPanel';
import {
  ImportVerificationModal,
  buildConditionsPayload,
  type CommitArgs,
  type CommitResult,
  type VerificationPayload,
} from '../import-verification';
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

/**
 * Translate FieldRegistry keys (used by the extractor + verification modal)
 * into the form-state paths used by this editor. The two structures grew
 * apart: the FieldRegistry maps to the legacy BankConditions shape
 * (accountFees / cardFees / …) while this editor uses a richer
 * FullBankConditions shape (tenueCompte / fraisCartes / …).
 *
 * Any FieldRegistry key not listed here falls through verbatim — that's the
 * desired behaviour for keys that already match the form (e.g. cheques.*).
 */
const REGISTRY_TO_FORM_PATH: Record<string, string> = {
  // Tenue de compte
  'accountFees.tenueCompte.particulier':     'tenueCompte.particulierLocal',
  'accountFees.tenueCompte.professionnel':   'tenueCompte.professionnel',
  'accountFees.tenueCompte.entreprise':      'tenueCompte.entreprise',
  // Ouverture / clôture
  'accountFees.fraisOuverture':              'ouvertureCompte.particulier',
  'accountFees.fraisCloture':                'clotureCompte.particulier',
  'accountFees.fraisInactivite':             'divers.fraisInactivite',
  // Relevés et attestations
  'accountFees.releveCompte.mensuel':        'releves.mensuelPapier',
  'accountFees.releveCompte.duplicata':      'releves.duplicata',
  'accountFees.attestationSolde':            'releves.attestationSolde',
  'accountFees.lettreInjonction':            'divers.lettreInjonction',
  // Crédits & agios
  'creditFees.tauxDecouvertAutorise':        'credits.decouvertAutorise',
  'creditFees.tauxDecouvertNonAutorise':     'credits.decouvertNonAutorise',
  'creditFees.commissionMouvement':          'credits.commissionMouvement',
  'creditFees.commissionPlusForteDecouverte':'credits.commissionPlusForte',
  'creditFees.tauxUsureLegal':               'credits.tauxUsure',
  'creditFees.fraisDossierCredit':           'credits.fraisDossierCredit',
  'creditFees.creditConsoTauxMin':           'credits.creditConsommationMin',
  'creditFees.creditConsoTauxMax':           'credits.creditConsommationMax',
  'creditFees.creditImmoTauxMin':            'credits.creditImmobilierMin',
  'creditFees.creditImmoTauxMax':            'credits.creditImmobilierMax',
  // Cartes — flat fees on fraisCartes (not the per-card array)
  'cardFees.opposition':                     'fraisCartes.oppositionCarte',
  'cardFees.retraitDabAutreBanque':          'fraisCartes.retraitDabAutre',
  // Virements
  'transferFees.virementInterne.commission':       'virements.interneFrais',
  'transferFees.virementCemacUemoa.commission':    'virements.zoneMonetaireCommission',
  'transferFees.virementInternational.commission': 'virements.internationalCommission',
  'transferFees.virementInternational.swift':      'virements.swift',
  // Chèques
  'checkFees.chequierEmission':              'cheques.carnet25',
  'checkFees.oppositionCheque':              'cheques.oppositionCheque',
  'checkFees.chequeSansProvision':           'cheques.chequeImpaye',
  // E-Banking
  'eBankingFees.abonnementMensuel':          'ebanking.abonnementMensuel',
  'eBankingFees.smsAlerte':                  'ebanking.smsAlerte',
  'eBankingFees.virementEnLigne':            'ebanking.virementEnLigne',
  'eBankingFees.mobileBanking':              'ebanking.mobileBanking',
  'eBankingFees.ussd':                       'ebanking.ussd',
  // Guichet — opérations en espèces et change manuel
  'cashOperations.versementEspeces':           'guichet.versementEspeces',
  'cashOperations.versementEspecesCommission': 'guichet.versementEspecesCommission',
  'cashOperations.retraitEspeces':             'guichet.retraitEspeces',
  'cashOperations.retraitEspecesCommission':   'guichet.retraitEspecesCommission',
  'cashOperations.changeManuel':               'guichet.changeManuel',
  'cashOperations.achatDevises':               'guichet.achatDevises',
  'cashOperations.venteDevises':               'guichet.venteDevises',
  // Cartes — opérations détaillées
  'cardFees.retraitDabPropre':              'fraisCartes.retraitDabPropre',
  'cardFees.retraitDabInternational':       'fraisCartes.retraitDabInternational',
  'cardFees.paiementTpePropre':             'fraisCartes.paiementTpePropre',
  'cardFees.paiementTpeInternational':      'fraisCartes.paiementTpeInternational',
  'cardFees.paiementInternet':              'fraisCartes.paiementInternet',
  'cardFees.codeOublie':                    'fraisCartes.codeOublie',
  'cardFees.consultationSolde':             'fraisCartes.consultationSolde',
  // Virements — flux nationaux
  'transferFees.virementNationalAutreBanque': 'virements.nationalAutreBank',
  'transferFees.virementInstantane':          'virements.instantane',
  'transferFees.virementPermanent':           'virements.permanent',
  'transferFees.rejetVirement':               'virements.rejetVirement',
  // Chèques — opérations détaillées
  'checkFees.chequeCertifie':       'cheques.chequeCertifie',
  'checkFees.chequeBanque':         'cheques.chequeBanque',
  'checkFees.encaissementPlace':    'cheques.encaissementPlace',
  'checkFees.encaissementEtranger': 'cheques.encaissementEtranger',
  // Divers
  'miscFees.coffrePetit':       'divers.coffrePetit',
  'miscFees.garantieBancaire':  'divers.garantieBancaire',
  'miscFees.successionFrais':   'divers.successionFrais',
  'miscFees.procurationCompte': 'divers.procuration',
  'miscFees.assuranceCompte':   'divers.assuranceCompte',
  'miscFees.droitTimbre':       'divers.droitTimbre',

  // ─── COMPLÉTUDE 100% ───
  // Account fees — variantes
  'accountFees.tenueCompte.particulierEtranger': 'tenueCompte.particulierEtranger',
  'accountFees.tenueCompte.association':         'tenueCompte.association',
  'accountFees.tenueCompte.compteEpargne':       'tenueCompte.compteEpargne',
  'accountFees.tenueCompte.compteDevises':       'tenueCompte.compteDevises',
  'accountFees.fraisOuvertureEntreprise':        'ouvertureCompte.entreprise',
  'accountFees.minimumDepot':                    'ouvertureCompte.minimumDepot',
  'accountFees.fraisClotureEntreprise':          'clotureCompte.entreprise',
  'accountFees.releveCompte.mensuelEmail':       'releves.mensuelEmail',
  'accountFees.releveCompte.annuel':             'releves.releveAnnuel',
  'accountFees.certificatNonEngagement':         'releves.certificatNonEngagement',
  'accountFees.rib':                             'releves.rib',
  // Cartes — variantes
  'cardFees.paiementTpeAutre':       'fraisCartes.paiementTpeAutre',
  'cardFees.renouvellementAnticipe': 'fraisCartes.renouvellementAnticipe',
  'cardFees.carteCaptee':            'fraisCartes.carteCaptee',
  // Virements — variantes
  'transferFees.virementNationalMemeBank':              'virements.nationalMemeBank',
  'transferFees.virementNationalAutreBanqueCommission': 'virements.nationalAutreBankCommission',
  'transferFees.virementZoneMonetaire':                 'virements.zoneMonetaire',
  'transferFees.virementInternationalFraisFixes':       'virements.international',
  'transferFees.recuVirement':                          'virements.recuVirement',
  // Chèques — variantes
  'checkFees.carnet50':                       'cheques.carnet50',
  'checkFees.carnet100':                      'cheques.carnet100',
  'checkFees.chequeGuichet':                  'cheques.chequeGuichet',
  'checkFees.chequeRetourne':                 'cheques.chequeRetourne',
  'checkFees.encaissementDeplacement':        'cheques.encaissementDeplacement',
  'checkFees.encaissementEtrangerCommission': 'cheques.encaissementEtrangerCommission',
  // Crédits — variantes
  'creditFees.creditPME':       'credits.creditPME',
  'creditFees.penaliteRetard':  'credits.penaliteRetard',
  // E-Banking — variantes
  'eBankingFees.abonnementAnnuel':      'ebanking.abonnementAnnuel',
  'eBankingFees.parOperation':          'ebanking.parOperation',
  'eBankingFees.smsAlerteAbonnement':   'ebanking.smsAlerteAbonnement',
  // Divers — variantes
  'miscFees.coffreMoyen':           'divers.coffreMoyen',
  'miscFees.coffreGrand':           'divers.coffreGrand',
  'miscFees.garantieLocative':      'divers.garantieLocative',
  'miscFees.cautionMarche':         'divers.cautionMarche',
  'miscFees.saisieAttribution':     'divers.saisieAttribution',
  'miscFees.mainLevee':             'divers.mainLevee',
  'miscFees.successionCommission':  'divers.successionCommission',
  'miscFees.avoirInactif':          'divers.avoirInactif',
  'miscFees.tvaServices':           'divers.tvaServices',
};

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
  const [extractionReport, setExtractionReport] = useState<ExtractionReport | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<{ stage: string; pct: number; message: string } | null>(null);
  // ⚠ hasChanges N'EST PLUS un useState — c'est un *computed value* dérivé
  // du diff conditions ↔ baseline. Aucun setState concurrent ne peut plus
  // l'écraser : la valeur est recalculée à chaque render. Le seul moyen
  // de "saver" (= rendre le bouton désactivé) est de mettre à jour
  // `baseline` (le state ci-dessous) — ce qui ne se produit qu'au mount
  // pour une nouvelle banque, ou explicitement après un Save.
  const [baseline, setBaseline] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Verification modal — opens after extraction so the user can review the
  // raw label/value pairs and validate before they're applied to the form.
  const [verification, setVerification] = useState<{
    file: File;
    payload: VerificationPayload;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État local pour les conditions éditables
  const [conditions, setConditions] = useState<FullBankConditions>(getDefaultFullConditions());

  // ⚠ Approche définitive : la baseline est un state, le dirty flag est
  // computed à chaque render via useMemo. Aucun useEffect, aucun
  // setState n'intervient sur le dirty flag — il EST le diff,
  // littéralement.
  const lastInitBankIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !bank) {
      if (!isOpen) lastInitBankIdRef.current = null;
      return;
    }
    if (lastInitBankIdRef.current === bank.id) return;
    lastInitBankIdRef.current = bank.id;

    let initial: FullBankConditions;
    if (bank.conditions) {
      initial = {
        ...getDefaultFullConditions(),
        ...bank.conditions,
        documents: bank.conditions.documents || [],
      } as FullBankConditions;
    } else {
      initial = getDefaultFullConditions();
    }
    setConditions(initial);
    setBaseline(serializeForDiff(initial));
  }, [bank, isOpen]);

  // hasChanges est COMPUTED, pas un state. Rien ne peut l'écraser.
  const hasChanges = useMemo(() => {
    if (!isOpen || !bank) return false;
    if (!baseline) return false;
    return serializeForDiff(conditions) !== baseline;
  }, [conditions, baseline, isOpen, bank]);

  // Diagnostic — expose state to window for debugging.
  // Open the console and inspect `window.__atlasbanx_modal` to see why
  // the Save button is in its current state.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const current = serializeForDiff(conditions);
      (window as unknown as Record<string, unknown>).__atlasbanx_modal = {
        bankId: bank?.id ?? null,
        bankName: bank?.name ?? null,
        isOpen,
        baselineLength: baseline.length,
        currentLength: current.length,
        baselineSample: baseline.slice(0, 200),
        currentSample: current.slice(0, 200),
        match: current === baseline,
        hasChanges,
        conditionsDocCount: conditions.documents.length,
      };
    }
  }, [conditions, baseline, hasChanges, isOpen, bank]);

  // No-op stub for code paths that still call setHasChanges — retained
  // for ergonomic compatibility. The dirty flag derives from the data;
  // these calls are now informational hints (not authoritative).
  const setHasChanges = (_v: boolean): void => {
    // Intentional no-op. The diff drives the UI, not imperative flags.
  };
  void setHasChanges; // keep referenced for legacy call sites

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
    // Re-baseline → diff devient 0 → hasChanges devient false → bouton désactivé.
    setBaseline(serializeForDiff(conditions));
  };

  // Upload document — PDF goes through the verification modal so the user
  // can review the extracted label/value pairs before they're applied.
  // Excel / image still use the legacy engine flow.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so re-uploading the same file fires onChange
    e.target.value = '';

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    setIsUploading(true);
    setExtractionReport(null);
    setExtractionProgress(null);

    try {
      // ─── PDF route: verification modal (split-screen review) ─────────
      if (isPdf && bank) {
        setIsExtracting(true);
        setExtractionProgress({ stage: 'load', pct: 0, message: 'Chargement du PDF…' });
        const result = await extractConditions(file, {
          bankCode: bank.code,
          onProgress: (p) => setExtractionProgress(p),
        });

        if (result.rawPairs.length === 0) {
          setIsExtracting(false);
          setIsUploading(false);
          setExtractionProgress(null);
          alert('Aucune condition n\'a pu être extraite du document. Vérifie le format du PDF.');
          return;
        }

        const payload = buildConditionsPayload({
          fileName: file.name,
          bankCode: bank.code,
          pairs: result.rawPairs,
          matches: result.matches,
        });

        setVerification({ file, payload });
        setIsExtracting(false);
        setIsUploading(false);
        setExtractionProgress(null);
        return;
      }

      // ─── Non-PDF route: legacy engine (Excel, CSV, image) ────────────
      const base64 = await fileToBase64(file);
      setIsExtracting(true);

      const engine = getDocumentEngine();
      const report = await engine.extract(file, {
        bankCode: bank?.code,
        onProgress: (p) => setExtractionProgress(p),
      });
      setExtractionReport(report);

      const document: ArchivedDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        type: 'conditions',
        uploadDate: new Date(),
        effectiveDate: new Date(),
        fileData: base64,
        fileSize: file.size,
        extractedAt: report.success && report.stats.extracted > 0 ? new Date() : undefined,
        isActive: true,
      };

      setConditions(prev => ({
        ...prev,
        documents: [...prev.documents, document],
      }));
      setHasChanges(true);

    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'extraction du document. Veuillez réessayer.');
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  };

  // Commit handler for the verification modal — apply the validated rubrics
  // into the conditions form and archive the source document.
  const handleVerifiedConditionsCommit = async (
    _args: CommitArgs,
    commit: CommitResult,
  ): Promise<void> => {
    if (!verification) return;
    const { file } = verification;

    // Mark dirty IMMEDIATELY — going through the import flow at all is
    // a user-confirmed intent to mutate the grid. We fire setHasChanges
    // first, then again at the end as a belt-and-braces guarantee.
    setHasChanges(true);

    // Apply each validated rubric into the conditions form via setByPath.
    const values: Record<string, number | string> = {};
    if (commit.conditions) {
      for (const [rubricKey, val] of Object.entries(commit.conditions)) {
        if (val.qualitative && val.value === 0) continue;
        values[rubricKey] = val.value;
      }
    }
    const mappedCount = Object.keys(values).length;
    if (mappedCount > 0) {
      handleApplyExtraction(values); // sets hasChanges(true) too
    }

    // Archive the source document so it's listed in the Documents tab.
    let archiveError: unknown = null;
    try {
      const base64 = await fileToBase64(file);
      const document: ArchivedDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        type: 'conditions',
        uploadDate: new Date(),
        effectiveDate: new Date(),
        fileData: base64,
        fileSize: file.size,
        extractedAt: new Date(),
        isActive: true,
      };
      setConditions(prev => ({
        ...prev,
        documents: [...prev.documents, document],
      }));
    } catch (err) {
      archiveError = err;
      console.warn('[BankConditionsModal] failed to archive source document:', err);
    }

    // Belt-and-braces: re-fire setHasChanges(true) AFTER all awaits to
    // guarantee the final state is dirty regardless of React batching.
    setHasChanges(true);

    // Close the verification modal first — keeps the UI snappy.
    setVerification(null);

    // Defer the alert to the next tick so it doesn't block the React
    // commit phase. Using setTimeout(_, 0) keeps the alert async to React.
    if (mappedCount === 0 && !archiveError) {
      setTimeout(() => {
        alert(
          'Aucune rubrique n\'a été automatiquement mappée — le document a été archivé. '
          + 'Tu peux saisir les valeurs manuellement dans les onglets ci-dessus, '
          + 'puis cliquer sur Enregistrer.'
        );
      }, 0);
    }
    if (archiveError) {
      setTimeout(() => {
        alert('Le document n\'a pas pu être archivé. Détail : ' + (archiveError instanceof Error ? archiveError.message : 'inconnu'));
      }, 0);
    }
  };

  /**
   * Write the extracted values into the conditions form. Only fields with
   * a non-default strategy get applied — defaults are skipped to preserve
   * any manual edits the user has made.
   */
  const handleApplyExtraction = (values: Record<string, number | string | boolean | null>) => {
    setConditions(prev => {
      // Deep clone — we use setByPath which mutates
      const next = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
      for (const [rawKey, value] of Object.entries(values)) {
        if (value === null || value === undefined) continue;
        // Translate FieldRegistry keys (e.g. accountFees.tenueCompte.particulier)
        // into the modal's form-state paths (e.g. tenueCompte.particulierLocal).
        // Without this step, setByPath wrote to a parallel object structure
        // that no form field reads from — values silently disappeared.
        const formPath = REGISTRY_TO_FORM_PATH[rawKey] ?? rawKey;
        setByPath(next, formPath, value);
      }
      return next as typeof prev;
    });
    setHasChanges(true);
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
              <h2 className="text-xl font-bold !text-white">{bank.name}</h2>
              <div className="flex items-center gap-3 text-sm text-white/80">
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
                      Importer un document de conditions tarifaires
                    </p>
                    <p className="text-sm text-primary-500 mt-2">
                      PDF · Excel · Image — extraction automatique multi-format
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.tiff,.bmp,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Progress en cours d'extraction */}
              {isExtracting && extractionProgress && (
                <div className="rounded-lg p-4 bg-canvas-50 border border-primary-200/60 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-accent-600 animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-ink-900 truncate">
                        {extractionProgress.message}
                      </p>
                      <p className="text-xs text-ink-500 tabular-nums shrink-0 ml-2">
                        {Math.round(extractionProgress.pct * 100)}%
                      </p>
                    </div>
                    <div className="h-1.5 bg-canvas-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-ink-700 to-accent-500 transition-all duration-300 ease-premium"
                        style={{ width: `${Math.round(extractionProgress.pct * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rapport d'extraction premium */}
              {extractionReport && !isExtracting && (
                <ExtractionReportPanel
                  report={extractionReport}
                  onApply={handleApplyExtraction}
                />
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
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-primary-500">
              Dernière modification: {(() => {
                if (!bank.updatedAt) return 'N/A';
                const d = new Date(bank.updatedAt);
                return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('fr-FR');
              })()}
            </p>
            {/* Visual diagnostic — surfaces why the Save button is in its
                current state. Tells the user "you have N pending changes"
                or "no pending changes" so the disabled state is never
                a mystery. */}
            <p className="text-[11px] text-primary-400 font-mono">
              {(() => {
                const current = serializeForDiff(conditions);
                const baselineLen = baseline.length;
                const currentLen = current.length;
                const diff = baselineLen === 0
                  ? 'État initial — aucun changement à sauvegarder'
                  : currentLen === baselineLen && current === baseline
                    ? 'Aucune modification depuis le dernier chargement'
                    : `Changements détectés : ${Math.abs(currentLen - baselineLen)} octets de diff`;
                return `${hasChanges ? '⬤' : '○'} ${diff}`;
              })()}
            </p>
          </div>
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

      {/* Conditions verification modal — opens after PDF extraction in the
          Documents tab so the user can review pairs before applying them */}
      {verification && (
        <ImportVerificationModal
          open
          file={verification.file}
          initialPayload={verification.payload}
          onCommit={handleVerifiedConditionsCommit}
          onCancel={() => setVerification(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// DIFF-BASED DIRTY FLAG HELPER
// ============================================================================
// Stable JSON serialization of the conditions blob, used to compare current
// state against the baseline snapshot. Document `fileData` (base64 PDF) is
// excluded — its presence doesn't matter for dirtiness, only the doc list.
function serializeForDiff(c: FullBankConditions): string {
  const stripped = {
    ...c,
    documents: c.documents.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      fileSize: d.fileSize,
      // Date objects don't survive JSON identity — convert to ISO
      uploadDate: d.uploadDate ? new Date(d.uploadDate).toISOString() : null,
      effectiveDate: d.effectiveDate ? new Date(d.effectiveDate).toISOString() : null,
      extractedAt: d.extractedAt ? new Date(d.extractedAt).toISOString() : null,
      isActive: d.isActive,
      // Note: fileData (base64) intentionally omitted — not relevant for diff
    })),
  };
  try {
    return JSON.stringify(stripped, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    });
  } catch {
    return '';
  }
}
