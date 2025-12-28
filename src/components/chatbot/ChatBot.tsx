import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  HelpCircle,
  ChevronDown,
  Loader2,
  Upload,
  Search,
  BarChart3,
  FileBarChart,
  Settings,
  Users,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import { Button, Badge } from '../ui';
import { getClaudeService, ChatMessage, ClaudeService } from '../../services/ClaudeService';
import { useSettingsStore } from '../../store/settingsStore';

// Paloma - Jeune femme africaine professionnelle
function PalomaAvatar({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A0522D" />
          <stop offset="100%" stopColor="#8B4513" />
        </linearGradient>
        <linearGradient id="hairGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id="blazerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="100%" stopColor="#152238" />
        </linearGradient>
        <linearGradient id="glassesGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4a5568" />
          <stop offset="100%" stopColor="#2d3748" />
        </linearGradient>
      </defs>

      {/* Cheveux - coupe professionnelle avec volume */}
      <ellipse cx="32" cy="18" rx="18" ry="14" fill="url(#hairGradient)" />
      <ellipse cx="32" cy="20" rx="20" ry="12" fill="url(#hairGradient)" />

      {/* Volume cheveux côtés */}
      <ellipse cx="14" cy="26" rx="6" ry="10" fill="#1a1a1a" />
      <ellipse cx="50" cy="26" rx="6" ry="10" fill="#1a1a1a" />

      {/* Mèches structurées */}
      <path d="M18 12 Q22 8 28 10" stroke="#2a2a2a" strokeWidth="2" fill="none" />
      <path d="M36 10 Q42 8 46 12" stroke="#2a2a2a" strokeWidth="2" fill="none" />

      {/* Visage */}
      <ellipse cx="32" cy="34" rx="14" ry="16" fill="url(#skinGradient)" />

      {/* Oreilles */}
      <ellipse cx="17" cy="34" rx="2" ry="3" fill="url(#skinGradient)" />
      <ellipse cx="47" cy="34" rx="2" ry="3" fill="url(#skinGradient)" />

      {/* Boucles d'oreilles - perles élégantes */}
      <circle cx="17" cy="38" r="2" fill="#FFD700" />
      <circle cx="47" cy="38" r="2" fill="#FFD700" />

      {/* Yeux */}
      <ellipse cx="26" cy="32" rx="4" ry="3.5" fill="white" />
      <ellipse cx="38" cy="32" rx="4" ry="3.5" fill="white" />

      {/* Iris - regard intelligent */}
      <circle cx="26.5" cy="32" r="2.5" fill="#3D2314" />
      <circle cx="38.5" cy="32" r="2.5" fill="#3D2314" />

      {/* Pupilles */}
      <circle cx="26.5" cy="32" r="1.2" fill="#1a0f0a" />
      <circle cx="38.5" cy="32" r="1.2" fill="#1a0f0a" />

      {/* Reflets yeux */}
      <circle cx="27.5" cy="31" r="0.8" fill="white" />
      <circle cx="39.5" cy="31" r="0.8" fill="white" />

      {/* Lunettes professionnelles */}
      <rect x="20" y="28" width="12" height="9" rx="2" stroke="url(#glassesGradient)" strokeWidth="1.5" fill="none" />
      <rect x="34" y="28" width="12" height="9" rx="2" stroke="url(#glassesGradient)" strokeWidth="1.5" fill="none" />
      <path d="M32 31 L34 31" stroke="url(#glassesGradient)" strokeWidth="1.5" />
      <path d="M20 31 L17 30" stroke="url(#glassesGradient)" strokeWidth="1.5" />
      <path d="M46 31 L47 30" stroke="url(#glassesGradient)" strokeWidth="1.5" />

      {/* Sourcils expressifs */}
      <path d="M22 26 Q26 24 30 26" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M34 26 Q38 24 42 26" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Nez */}
      <path d="M32 35 L31 39 Q32 40 33 39 L32 35" fill="#8B4513" opacity="0.4" />

      {/* Joues subtiles */}
      <ellipse cx="22" cy="38" rx="2.5" ry="1.5" fill="#CD853F" opacity="0.3" />
      <ellipse cx="42" cy="38" rx="2.5" ry="1.5" fill="#CD853F" opacity="0.3" />

      {/* Lèvres - sourire professionnel */}
      <path d="M28 44 Q32 42.5 36 44" stroke="#A0522D" strokeWidth="0.8" fill="none" />
      <path d="M28 44 Q32 46 36 44" fill="#B5655D" />
      <path d="M29.5 44.5 Q32 45.5 34.5 44.5" stroke="#8B4040" strokeWidth="0.3" fill="none" />

      {/* Blazer professionnel */}
      <path d="M16 52 L20 48 Q32 46 44 48 L48 52 L50 62 L14 62 Z" fill="url(#blazerGradient)" />

      {/* Col blazer */}
      <path d="M24 48 L28 54 L32 50 L36 54 L40 48" stroke="#152238" strokeWidth="1" fill="#0f1a2a" />

      {/* Chemise blanche */}
      <path d="M28 50 L32 56 L36 50" fill="white" />
      <path d="M30 52 L32 55 L34 52" stroke="#e5e5e5" strokeWidth="0.5" fill="none" />

      {/* Boutons blazer */}
      <circle cx="32" cy="58" r="1" fill="#FFD700" />
    </svg>
  );
}

type TabType = 'help' | 'chat';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('help');
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');

  // Draggable state
  const [position, setPosition] = useState({ x: 24, y: 24 }); // Distance from bottom-right
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { claudeApi } = useSettingsStore();

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({
      x: e.clientX + position.x,
      y: e.clientY + position.y,
    });
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = dragStart.x - e.clientX;
    const newY = dragStart.y - e.clientY;

    // Constrain to viewport
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 80;

    setPosition({
      x: Math.max(16, Math.min(maxX, newX)),
      y: Math.max(16, Math.min(maxY, newY)),
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, activeTab]);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const claudeService = getClaudeService();

      if (!claudeService) {
        // Si pas de clé API, utiliser une réponse par défaut
        if (!claudeApi.apiKey) {
          const defaultResponse: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: `Pour utiliser le chat IA, veuillez configurer votre clé API Claude dans **Paramètres > Intelligence Artificielle**.

En attendant, voici quelques informations utiles:

**Scrutix** est un outil d'audit bancaire qui vous permet de:
- Importer et analyser vos relevés bancaires
- Détecter automatiquement les anomalies
- Générer des rapports d'audit professionnels
- Récupérer les frais bancaires injustifiés

Consultez l'onglet **Aide** pour plus de détails sur chaque fonctionnalité.`,
            timestamp: new Date(),
          };
          setChatHistory(prev => [...prev, defaultResponse]);
          return;
        }
        throw new Error('Service IA non initialisé');
      }

      const response = await claudeService.chat(
        userMessage.content,
        undefined,
        chatHistory
      );

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        tokensUsed: response.tokensUsed,
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la communication avec l\'IA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Prise en main rapide',
      icon: <Lightbulb className="w-5 h-5 text-amber-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p><strong>Bienvenue sur Scrutix !</strong> Outil d'audit bancaire pour experts-comptables.</p>
          <p className="font-medium text-primary-900">Workflow recommandé :</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li><strong>Clients</strong> → Créez une fiche client avec ses informations</li>
            <li><strong>Import</strong> → Sélectionnez le client, puis importez ses relevés</li>
            <li><strong>Analyse</strong> → Lancez la détection automatique des anomalies</li>
            <li><strong>Rapports</strong> → Générez un rapport d'audit professionnel</li>
          </ol>
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
            <strong>Astuce :</strong> Commencez par la page <em>Clients</em> pour créer votre premier dossier.
          </div>
        </div>
      ),
    },
    {
      id: 'clients',
      title: 'Étape 1 : Gestion des clients',
      icon: <Users className="w-5 h-5 text-blue-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Créer un nouveau client :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Cliquez sur <strong>« Nouveau client »</strong></li>
            <li>Renseignez : nom, code client, SIRET (optionnel)</li>
            <li>Ajoutez l'adresse et les coordonnées</li>
            <li>Enregistrez la fiche</li>
          </ol>
          <p className="font-medium text-primary-900 mt-3">Ajouter un compte bancaire :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Ouvrez la fiche du client</li>
            <li>Dans l'onglet <strong>« Comptes »</strong>, cliquez sur <strong>« + Compte »</strong></li>
            <li>Sélectionnez la banque (CEMAC ou UEMOA)</li>
            <li>Saisissez le numéro de compte (RIB)</li>
          </ol>
          <p className="text-primary-500 italic mt-2">📍 Menu latéral → Clients</p>
        </div>
      ),
    },
    {
      id: 'import',
      title: 'Étape 2 : Import des relevés',
      icon: <Upload className="w-5 h-5 text-green-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Procédure d'import :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Sélectionnez le <strong>client</strong> concerné</li>
            <li>Choisissez le <strong>compte bancaire</strong> (ou créez-en un)</li>
            <li>Glissez-déposez vos fichiers dans la zone d'import</li>
            <li>Attendez la fin du traitement</li>
          </ol>
          <p className="font-medium text-primary-900 mt-3">Formats acceptés :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>PDF</strong> — Relevés bancaires (OCR automatique)</li>
            <li><strong>CSV</strong> — Exports banque en ligne</li>
            <li><strong>Excel</strong> — Fichiers .xlsx et .xls</li>
          </ul>
          <p className="font-medium text-primary-900 mt-3">Banques supportées :</p>
          <p className="ml-2">SGBCI, BICICI, Ecobank, BOA, UBA, BGFI, Société Générale, Afriland First Bank...</p>
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
            <strong>Conseil :</strong> Importez au minimum 12 mois de relevés pour une analyse optimale.
          </div>
          <p className="text-primary-500 italic mt-2">📍 Menu latéral → Import</p>
        </div>
      ),
    },
    {
      id: 'analysis',
      title: 'Étape 3 : Analyse des anomalies',
      icon: <Search className="w-5 h-5 text-purple-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Lancer une analyse :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Accédez à la page <strong>Analyse</strong></li>
            <li>Sélectionnez la période à analyser</li>
            <li>Choisissez les détecteurs à activer</li>
            <li>Cliquez sur <strong>« Lancer l'analyse »</strong></li>
          </ol>
          <p className="font-medium text-primary-900 mt-3">Types d'anomalies détectées :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Doublons</strong> — Opérations facturées plusieurs fois</li>
            <li><strong>Frais fantômes</strong> — Frais sans opération associée</li>
            <li><strong>Surfacturation</strong> — Frais supérieurs aux conditions tarifaires</li>
            <li><strong>Erreurs d'agios</strong> — Calcul d'intérêts incorrect (ACT/360)</li>
          </ul>
          <p className="font-medium text-primary-900 mt-3">Niveaux de sévérité :</p>
          <div className="flex gap-2 flex-wrap ml-2">
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Critique &gt;50K</span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Haute &gt;20K</span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Moyenne &gt;5K</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Basse &lt;5K</span>
          </div>
          <p className="text-primary-500 italic mt-2">📍 Menu latéral → Analyse</p>
        </div>
      ),
    },
    {
      id: 'reports',
      title: 'Étape 4 : Génération de rapports',
      icon: <FileBarChart className="w-5 h-5 text-indigo-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Générer un rapport :</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Accédez à <strong>Rapports → Relevés</strong></li>
            <li>Trouvez le relevé analysé dans la table</li>
            <li>Cliquez sur l'icône <strong>🖨️ Générer</strong></li>
            <li>Choisissez le type de rapport</li>
            <li>Le PDF est téléchargé automatiquement</li>
          </ol>
          <p className="font-medium text-primary-900 mt-3">Types de rapports disponibles :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Audit complet</strong> — Rapport détaillé avec toutes les anomalies</li>
            <li><strong>Synthétique</strong> — Résumé exécutif pour la direction</li>
            <li><strong>Détaillé</strong> — Analyse approfondie par catégorie</li>
            <li><strong>Recouvrement</strong> — Lettre de réclamation pour la banque</li>
          </ul>
          <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs">
            <strong>Note :</strong> Les rapports générés sont consultables dans l'onglet « Rapports générés » et dans la fiche client.
          </div>
          <p className="text-primary-500 italic mt-2">📍 Menu latéral → Rapports</p>
        </div>
      ),
    },
    {
      id: 'dashboard',
      title: 'Tableau de bord',
      icon: <BarChart3 className="w-5 h-5 text-cyan-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Indicateurs affichés :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Clients actifs</strong> — Nombre de dossiers en cours</li>
            <li><strong>Anomalies détectées</strong> — Total et répartition par sévérité</li>
            <li><strong>Économies potentielles</strong> — Montant récupérable estimé</li>
            <li><strong>Économies confirmées</strong> — Montant effectivement récupéré</li>
          </ul>
          <p className="font-medium text-primary-900 mt-3">Graphiques disponibles :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Évolution mensuelle des analyses</li>
            <li>Répartition par type d'anomalie</li>
            <li>Top clients par économies générées</li>
          </ul>
          <p className="text-primary-500 italic mt-2">📍 Menu latéral → Tableau de bord</p>
        </div>
      ),
    },
    {
      id: 'settings',
      title: 'Paramètres',
      icon: <Settings className="w-5 h-5 text-gray-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Sections de configuration :</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>Organisation</strong> — Nom du cabinet, logo, coordonnées (pour les rapports)</li>
            <li><strong>Intelligence Artificielle</strong> — Clé API Claude pour analyses avancées</li>
            <li><strong>Seuils de détection</strong> — Personnaliser la sensibilité des algorithmes</li>
            <li><strong>Conditions tarifaires</strong> — Barèmes des banques pour détecter la surfacturation</li>
            <li><strong>Sauvegarde</strong> — Exporter/importer toutes les données</li>
          </ul>
          <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <strong>Important :</strong> Configurez les informations de votre cabinet avant de générer des rapports clients.
          </div>
          <p className="text-primary-500 italic mt-2">📍 Menu latéral → Paramètres</p>
        </div>
      ),
    },
    {
      id: 'tips',
      title: 'Bonnes pratiques',
      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
      content: (
        <div className="space-y-3 text-sm text-primary-700">
          <p className="font-medium text-primary-900">Pour une utilisation optimale :</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li><strong>12 mois minimum</strong> — Importez suffisamment de données pour détecter les récurrences</li>
            <li><strong>Vérifiez les anomalies</strong> — Confirmez ou rejetez chaque détection avant de générer un rapport</li>
            <li><strong>Activez l'IA</strong> — Les analyses Claude offrent des insights supplémentaires</li>
            <li><strong>Sauvegardez régulièrement</strong> — Exportez vos données via Paramètres → Sauvegarde</li>
            <li><strong>Ajustez les seuils</strong> — Adaptez la sensibilité selon le profil du client</li>
          </ul>
          <p className="font-medium text-primary-900 mt-3">Raccourcis utiles :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Clic sur une ligne de tableau → Détail</li>
            <li>Icône 👁️ → Prévisualiser</li>
            <li>Icône 🖨️ → Générer rapport</li>
            <li>Icône ➡️ → Accéder au client</li>
          </ul>
        </div>
      ),
    },
  ];

  const handleButtonClick = () => {
    if (!isDragging) {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Floating Paloma Robot */}
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onClick={handleButtonClick}
        className={`fixed z-50 transition-all duration-300 group ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        } ${isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-110'}`}
        style={{
          right: position.x,
          bottom: position.y,
        }}
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-indigo-400 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />

          {/* Robot */}
          <div className="relative bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl p-2 shadow-lg border-2 border-white/50 hover:shadow-xl transition-shadow">
            <PalomaAvatar size={52} />
          </div>

          {/* Name badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-white text-xs font-medium rounded-full shadow-md whitespace-nowrap">
            Paloma
          </div>

          {/* Tooltip on hover */}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            Aide & Chat IA
          </span>
        </div>
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
        style={{ transformOrigin: 'bottom right' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PalomaAvatar size={36} />
            <div>
              <span className="font-semibold">Paloma</span>
              <p className="text-xs text-indigo-200">Assistant Scrutix</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-indigo-100">
          <button
            onClick={() => setActiveTab('help')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'help'
                ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-primary-500 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Mode d'emploi
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-primary-500 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <PalomaAvatar size={18} />
            Chat Paloma
            {!claudeApi.apiKey && (
              <Badge variant="warning" className="text-xs px-1.5 py-0.5">!</Badge>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'help' ? (
            /* Help Content */
            <div className="h-full overflow-y-auto p-4 space-y-2">
              {helpSections.map((section) => (
                <div key={section.id} className="border border-primary-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {section.icon}
                      <span className="font-medium text-primary-900">{section.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-primary-400 transition-transform ${
                        expandedSection === section.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedSection === section.id && (
                    <div className="px-4 py-3 bg-primary-50 border-t border-primary-100">
                      {section.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Chat Content */
            <div className="h-full flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center py-8">
                    <div className="flex justify-center mb-3">
                      <PalomaAvatar size={64} />
                    </div>
                    <p className="text-indigo-600 font-medium mb-2">Bonjour ! Je suis Paloma</p>
                    <p className="text-sm text-primary-400">
                      Posez-moi des questions sur l'audit bancaire, l'analyse des anomalies, ou l'utilisation de Scrutix.
                    </p>
                    {!claudeApi.apiKey && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">Clé API non configurée</span>
                        </div>
                        <p className="text-xs text-amber-600 mt-1">
                          Configurez votre clé Claude dans Paramètres → IA pour des réponses personnalisées.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-primary-900 text-white rounded-br-md'
                          : 'bg-primary-100 text-primary-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-primary-300' : 'text-primary-400'
                      }`}>
                        {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-primary-100 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                        <span className="text-sm text-primary-600">Réflexion en cours...</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                      {error}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-primary-100 p-3">
                <div className="flex gap-2">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Posez votre question..."
                    className="flex-1 resize-none border border-primary-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={1}
                    style={{ maxHeight: '100px' }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || isLoading}
                    className="px-3"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-primary-400 mt-2 text-center">
                  Appuyez sur Entrée pour envoyer
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
