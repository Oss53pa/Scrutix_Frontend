import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  BrainCircuit,
  FileBarChart,
  Banknote,
  Lock,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Quote,
  TrendingUp,
  Layers,
  Zap,
  Globe2,
  Award,
  Target,
  Activity,
  PiggyBank,
  Database,
  Cpu,
  Eye,
  Clock,
  Star,
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToApp = () => navigate('/');

  return (
    <div className="relative min-h-screen bg-canvas-100 text-ink-900 overflow-x-hidden">
      {/* Ambient mesh — global */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full bg-accent-200/35 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-ink-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[480px] w-[480px] rounded-full bg-accent-100/40 blur-3xl" />
      </div>

      <Nav scrolled={scrolled} onCta={goToApp} />

      <main>
        <Hero onCta={goToApp} />
        <TrustBar />
        <ValueProps />
        <FeatureSplit />
        <HowItWorks />
        <Metrics />
        <Testimonials />
        <Pricing onCta={goToApp} />
        <FAQ />
        <FinalCta onCta={goToApp} />
      </main>

      <Footer />
    </div>
  );
}

/* ============================================================================
   NAV
   ============================================================================ */
function Nav({ scrolled, onCta }: { scrolled: boolean; onCta: () => void }) {
  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-300 ease-premium ${
        scrolled
          ? 'bg-canvas-50/85 backdrop-blur-xl border-b border-primary-200/60 shadow-[0_1px_0_rgb(218_214_200/0.4)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      {scrolled && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-300/40 to-transparent"
        />
      )}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-18 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="#" className="font-display text-3xl text-ink-900 tracking-tight leading-none">
            AtlasBanx
          </a>
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500 mt-3" />
        </div>

        <div className="hidden lg:flex items-center gap-1">
          <NavLink href="#features">Fonctionnalités</NavLink>
          <NavLink href="#how">Méthode</NavLink>
          <NavLink href="#pricing">Tarifs</NavLink>
          <NavLink href="#faq">FAQ</NavLink>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCta}
            className="hidden sm:inline-flex text-sm font-medium text-ink-700 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-canvas-200/60 transition-colors"
          >
            Se connecter
          </button>
          <button
            onClick={onCta}
            className="btn btn-primary btn-sm group"
          >
            Démarrer gratuitement
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-2 text-sm font-medium text-ink-600 hover:text-ink-900 rounded-lg hover:bg-canvas-200/60 transition-colors tracking-tight"
    >
      {children}
    </a>
  );
}

/* ============================================================================
   HERO
   ============================================================================ */
function Hero({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative pt-12 sm:pt-20 pb-24 sm:pb-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        {/* Eyebrow with shimmer */}
        <div className="flex justify-center animate-fade-in-up">
          <a
            href="#features"
            className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-pill border border-primary-200/70 bg-white/70 backdrop-blur shadow-card text-xs font-medium text-ink-700 hover:border-accent-400/60 transition-all"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-accent-400 animate-ping opacity-60" />
              <span className="relative rounded-full h-2 w-2 bg-accent-500" />
            </span>
            <span className="tracking-tight">Nouveau · Détection IA multi-modèles</span>
            <ArrowRight className="w-3 h-3 text-ink-500 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* Headline */}
        <h1
          className="mt-8 text-center font-display text-6xl sm:text-7xl md:text-8xl lg:text-[8rem] leading-[0.92] tracking-tight animate-fade-in-up"
          style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
        >
          <span className="text-gradient-ink">L'audit bancaire,</span>
          <br />
          <span className="font-serif italic font-medium text-gradient-gold tracking-tight">redéfini.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mt-7 max-w-2xl mx-auto text-center text-lg sm:text-xl text-ink-600 leading-relaxed animate-fade-in-up"
          style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}
        >
          La plateforme d'audit qui détecte automatiquement{' '}
          <span className="font-semibold text-ink-900">les anomalies bancaires</span> et libère{' '}
          <span className="font-semibold text-ink-900">les économies cachées</span> dans vos relevés.
          Conçu pour les cabinets et entreprises de la zone <span className="font-semibold">CEMAC / UEMOA</span>.
        </p>

        {/* CTAs */}
        <div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up"
          style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}
        >
          <button onClick={onCta} className="btn btn-primary btn-lg group w-full sm:w-auto">
            Lancer un audit gratuit
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <a href="#how" className="btn btn-secondary btn-lg w-full sm:w-auto">
            Voir comment ça marche
          </a>
        </div>

        {/* Micro-trust */}
        <div
          className="mt-6 flex items-center justify-center gap-5 text-xs text-ink-500 animate-fade-in-up"
          style={{ animationDelay: '320ms', animationFillMode: 'backwards' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sans CB
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Données chiffrées
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Conforme OHADA
          </span>
        </div>

        {/* Hero mock dashboard preview */}
        <div
          className="mt-16 sm:mt-20 max-w-6xl mx-auto animate-fade-in-up"
          style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}
        >
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

/* Mock product preview — premium glass with subtle data viz */
function DashboardMock() {
  const bars = [42, 68, 35, 88, 52, 76, 48, 92, 64, 58, 81, 70];
  return (
    <div className="relative">
      {/* Glow behind */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-10 -inset-y-6 bg-gradient-to-tr from-accent-300/25 via-transparent to-ink-300/20 blur-2xl rounded-[3rem]"
      />
      <div className="relative rounded-2xl border border-primary-200/70 bg-white/80 backdrop-blur-xl shadow-elevated overflow-hidden">
        {/* Top gold rule */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />

        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-primary-200/60 bg-canvas-50/50">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 text-[11px] font-mono text-ink-400">atlasbanx.app/dashboard</span>
        </div>

        {/* Mock content */}
        <div className="p-6 sm:p-8 grid grid-cols-12 gap-4">
          {/* KPI row */}
          <MockKpi label="Économies réalisées" value="12.4M FCFA" delta="+24%" tone="emerald" cls="col-span-12 sm:col-span-4" />
          <MockKpi label="Anomalies détectées" value="847" delta="+12%" tone="red" cls="col-span-6 sm:col-span-4" />
          <MockKpi label="Taux de confirmation" value="94%" delta="+3pts" tone="ink" cls="col-span-6 sm:col-span-4" />

          {/* Chart */}
          <div className="col-span-12 lg:col-span-8 rounded-xl border border-primary-100/70 bg-white p-5 shadow-card">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold text-accent-700 uppercase tracking-[0.14em]">Tendance</p>
                <p className="mt-0.5 text-sm font-semibold text-ink-900">Anomalies par mois</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-ink-900">847</p>
                <p className="text-[11px] text-emerald-600 font-medium">↑ +12% vs T-1</p>
              </div>
            </div>
            <div className="h-32 flex items-end gap-2">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col gap-1">
                  <div
                    className={`w-full rounded-t-md transition-all duration-700 ease-premium ${
                      i === 7 ? 'bg-gradient-to-t from-accent-600 to-accent-400 shadow-glow' : 'bg-gradient-to-t from-ink-800 to-ink-600'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-ink-400 font-mono">
              <span>Jan</span><span>Fév</span><span>Mar</span><span>Avr</span><span>Mai</span><span>Jun</span>
              <span>Jul</span><span>Aoû</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Déc</span>
            </div>
          </div>

          {/* Side panel */}
          <div className="col-span-12 lg:col-span-4 rounded-xl border border-primary-100/70 bg-white p-5 shadow-card">
            <p className="text-[10px] font-semibold text-accent-700 uppercase tracking-[0.14em]">Anomalies récentes</p>
            <p className="mt-0.5 text-sm font-semibold text-ink-900">Top détections</p>
            <ul className="mt-4 space-y-3">
              <MockAnomaly type="Frais dupliqué" amount="245 000" severity="critical" />
              <MockAnomaly type="Surfacturation" amount="78 500" severity="high" />
              <MockAnomaly type="Frais fantôme" amount="32 100" severity="medium" />
              <MockAnomaly type="Erreur d'intérêts" amount="15 600" severity="low" />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockKpi({
  label,
  value,
  delta,
  tone,
  cls,
}: {
  label: string;
  value: string;
  delta: string;
  tone: 'emerald' | 'red' | 'ink';
  cls?: string;
}) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-ink-900' : 'text-ink-900';
  const deltaCls =
    tone === 'red' ? 'text-red-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-ink-700';
  return (
    <div className={`rounded-xl border border-primary-100/70 bg-white p-5 shadow-card ${cls ?? ''}`}>
      <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-[0.14em]">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${toneCls}`}>{value}</p>
      <p className={`mt-1 text-xs font-medium ${deltaCls}`}>{delta}</p>
    </div>
  );
}

function MockAnomaly({
  type,
  amount,
  severity,
}: {
  type: string;
  amount: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}) {
  const dot = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
  }[severity];
  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-ink-800 truncate">{type}</span>
      </div>
      <span className="font-bold tabular-nums text-ink-900">{amount} <span className="font-normal text-ink-500">F</span></span>
    </li>
  );
}

/* ============================================================================
   TRUST BAR
   ============================================================================ */
function TrustBar() {
  const trust = [
    'BEAC / BCEAO',
    'OHADA',
    'CEMAC',
    'UEMOA',
    'SYSCOHADA',
    'GAFI',
  ];
  return (
    <section className="py-12 px-6 lg:px-10 border-y border-primary-200/40 bg-canvas-50/40">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-[11px] font-semibold text-ink-500 uppercase tracking-[0.18em]">
          Conforme aux référentiels et normes
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {trust.map((t) => (
            <span
              key={t}
              className="text-sm sm:text-base font-semibold text-ink-400 tracking-tight hover:text-ink-700 transition-colors"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   VALUE PROPS
   ============================================================================ */
function ValueProps() {
  const items = [
    {
      icon: BrainCircuit,
      title: 'Détection IA multi-modèles',
      copy: '4 algorithmes statistiques (Z-Score, Benford, Isolation Forest, Patterns) couplés à un moteur LLM local pour 0 fuite de données.',
      tag: 'Intelligence',
    },
    {
      icon: FileBarChart,
      title: 'Rapports OHADA prêts à signer',
      copy: 'Génération de rapports d\'audit conformes SYSCOHADA en PDF/Excel avec annexes, certificat d\'intégrité et signature numérique.',
      tag: 'Conformité',
    },
    {
      icon: Banknote,
      title: 'Multi-banques CEMAC/UEMOA',
      copy: 'Conditions et grilles tarifaires pré-paramétrées pour les principales banques de la zone. Imports CSV/Excel/PDF.',
      tag: 'Couverture',
    },
    {
      icon: Lock,
      title: 'Sécurité bancaire de bout en bout',
      copy: 'MFA, allowlist IP, chiffrement E2E, journal d\'audit immuable. Vos relevés ne quittent jamais votre périmètre.',
      tag: 'Sécurité',
    },
  ];

  return (
    <section id="features" className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          eyebrow="Pourquoi AtlasBanx"
          title="Conçu pour la rigueur du métier"
          subtitle="Chaque détail pensé pour les experts-comptables exigeants et les directeurs financiers vigilants."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((it) => (
            <ValueCard key={it.title} {...it} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ValueCard({
  icon: Icon,
  title,
  copy,
  tag,
}: {
  icon: typeof BrainCircuit;
  title: string;
  copy: string;
  tag: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary-200/60 bg-white p-7 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 ease-premium">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/0 to-transparent group-hover:via-accent-400/70 transition-all duration-500" />
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-canvas-100 to-canvas-200/70 border border-primary-200/60 flex items-center justify-center text-ink-700 group-hover:from-accent-50 group-hover:to-accent-100 group-hover:border-accent-300/60 group-hover:text-accent-700 transition-all duration-300">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold text-accent-700 uppercase tracking-[0.14em]">
          {tag}
        </span>
      </div>
      <h3 className="text-xl font-bold text-ink-900 tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-ink-600 leading-relaxed">{copy}</p>
    </div>
  );
}

/* ============================================================================
   FEATURE SPLIT — alternating image/text rows
   ============================================================================ */
function FeatureSplit() {
  return (
    <section className="py-24 sm:py-32 px-6 lg:px-10 bg-gradient-to-b from-transparent via-canvas-50/40 to-transparent">
      <div className="max-w-7xl mx-auto space-y-24 sm:space-y-32">
        <FeatureRow
          eyebrow="Détection"
          title="18 algorithmes. Une seule certitude."
          copy="Notre moteur croise des analyses statistiques pures avec un LLM local optionnel. Frais dupliqués, surfacturations, frais fantômes, erreurs d'intérêts, agios abusifs : tout est tracé, classifié et expliqué."
          bullets={[
            'Score de risque global 0-100 par client',
            'Confidence score par anomalie',
            'Explications structurées (raisonnement IA)',
            'Worker Pool parallélisé pour relevés volumineux',
          ]}
          visual={<DetectionMockVisual />}
          reverse={false}
        />
        <FeatureRow
          eyebrow="Reporting"
          title="Du brut au livrable. En un clic."
          copy="Templates SYSCOHADA prêts à l'emploi. Signature numérique, certificat d'intégrité SHA-256, bookmarks PDF, page de garde personnalisable au logo et couleurs du cabinet."
          bullets={[
            'Export PDF / Excel / Word',
            'Watermark automatique',
            'Certificat d\'intégrité immuable',
            'Branding cabinet (logo, couleurs, footer)',
          ]}
          visual={<ReportMockVisual />}
          reverse={true}
        />
        <FeatureRow
          eyebrow="Sécurité"
          title="Banking-grade. Sans compromis."
          copy="Aucun upload externe par défaut. MFA TOTP, allowlist IP, throttling de connexion, journal d'audit append-only avec hash chaîné. Conforme aux exigences les plus strictes."
          bullets={[
            'MFA TOTP (Google Authenticator, 1Password, Authy)',
            'Allowlist d\'adresses IP',
            'Audit trail SHA-256 chaîné',
            'Suppression de données RGPD-compliant',
          ]}
          visual={<SecurityMockVisual />}
          reverse={false}
        />
      </div>
    </section>
  );
}

function FeatureRow({
  eyebrow,
  title,
  copy,
  bullets,
  visual,
  reverse,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h3 className="mt-3 text-3xl sm:text-4xl font-bold text-ink-900 tracking-tight leading-[1.1]">
          {title}
        </h3>
        <p className="mt-5 text-base text-ink-600 leading-relaxed">{copy}</p>
        <ul className="mt-6 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-ink-700">
              <CheckCircle2 className="shrink-0 w-4 h-4 mt-0.5 text-accent-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>{visual}</div>
    </div>
  );
}

function DetectionMockVisual() {
  const detectors = [
    { name: 'Z-Score Analyzer', conf: 96, run: '0.4s' },
    { name: 'Benford Law Checker', conf: 88, run: '0.2s' },
    { name: 'Isolation Forest', conf: 92, run: '1.8s' },
    { name: 'Frequency Patterns', conf: 84, run: '0.6s' },
  ];
  return (
    <div className="relative rounded-2xl border border-primary-200/70 bg-white shadow-elevated p-6 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent-600" />
          <span className="text-sm font-bold text-ink-900 tracking-tight">Pipeline de détection</span>
        </div>
        <span className="badge badge-success">Live</span>
      </div>
      <div className="space-y-3">
        {detectors.map((d, i) => (
          <div key={d.name} className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-ink-400 w-5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink-800">{d.name}</span>
                <span className="text-[11px] font-mono text-ink-500">{d.run}</span>
              </div>
              <div className="h-1.5 bg-canvas-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-ink-700 to-accent-500 transition-all duration-1000"
                  style={{ width: `${d.conf}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] font-bold text-accent-700 tabular-nums w-9 text-right">{d.conf}%</span>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-primary-100/70 flex items-center justify-between text-xs">
        <span className="text-ink-500">Total runtime</span>
        <span className="font-mono font-bold text-ink-900">3.0s · 12 947 transactions</span>
      </div>
    </div>
  );
}

function ReportMockVisual() {
  return (
    <div className="relative">
      {/* Stack of documents */}
      <div className="absolute inset-3 rounded-xl bg-canvas-200/70 rotate-3 shadow-card" />
      <div className="absolute inset-1 rounded-xl bg-canvas-100 rotate-1 shadow-card" />
      <div className="relative rounded-xl border border-primary-200/70 bg-white shadow-elevated overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />
        <div className="px-6 py-5 border-b border-primary-100/70 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-accent-700 uppercase tracking-[0.14em]">Rapport d'audit</p>
            <p className="text-sm font-bold text-ink-900 mt-0.5">Cabinet Atlas · Q3 2026</p>
          </div>
          <FileBarChart className="w-5 h-5 text-ink-400" />
        </div>
        <div className="p-6 space-y-2">
          <div className="h-2 w-3/4 bg-canvas-200 rounded-full" />
          <div className="h-2 w-full bg-canvas-200 rounded-full" />
          <div className="h-2 w-5/6 bg-canvas-200 rounded-full" />
          <div className="h-2 w-2/3 bg-canvas-200 rounded-full" />
        </div>
        <div className="px-6 pb-5 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200/60 p-2.5 text-center">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Économies</p>
            <p className="text-lg font-bold text-emerald-700 mt-1">12.4M</p>
          </div>
          <div className="rounded-lg bg-canvas-100 border border-primary-200/60 p-2.5 text-center">
            <p className="text-[10px] font-semibold text-ink-600 uppercase tracking-wide">Transactions</p>
            <p className="text-lg font-bold text-ink-900 mt-1">12 947</p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200/60 p-2.5 text-center">
            <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Anomalies</p>
            <p className="text-lg font-bold text-red-700 mt-1">847</p>
          </div>
        </div>
        <div className="border-t border-primary-100/70 px-6 py-3 bg-canvas-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-ink-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>SHA-256 · Vérifié</span>
          </div>
          <span className="text-[11px] font-mono text-ink-400">a3f2…9c41</span>
        </div>
      </div>
    </div>
  );
}

function SecurityMockVisual() {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white p-7 shadow-elevated overflow-hidden">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-400/15 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-5 h-5 text-accent-300" />
          <span className="text-sm font-bold tracking-tight">Vault sécurisé</span>
        </div>
        <div className="space-y-3 text-sm">
          <SecurityRow label="MFA TOTP" status="active" />
          <SecurityRow label="Allowlist IP (3 actives)" status="active" />
          <SecurityRow label="Audit trail · 8 423 entrées" status="active" />
          <SecurityRow label="Chiffrement E2E (AES-256)" status="active" />
          <SecurityRow label="Backup chiffré · J-1" status="active" />
        </div>
        <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-accent-300 uppercase tracking-[0.14em]">Score sécurité</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">98<span className="text-lg text-white/50">/100</span></p>
          </div>
          <Award className="w-12 h-12 text-accent-400/40" />
        </div>
      </div>
    </div>
  );
}

function SecurityRow({ label, status }: { label: string; status: 'active' | 'inactive' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/90">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
        status === 'active' ? 'text-emerald-300' : 'text-white/40'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
        {status === 'active' ? 'Actif' : 'Inactif'}
      </span>
    </div>
  );
}

/* ============================================================================
   HOW IT WORKS
   ============================================================================ */
function HowItWorks() {
  const steps = [
    {
      num: '01',
      icon: Database,
      title: 'Importez',
      copy: 'CSV, Excel, PDF, OFX. Mapping intelligent qui apprend au fur et à mesure. 1 clic, 12 947 transactions.',
    },
    {
      num: '02',
      icon: BrainCircuit,
      title: 'Analysez',
      copy: '18 détecteurs s\'exécutent en parallèle. Score de risque, classification, explication par anomalie.',
    },
    {
      num: '03',
      icon: Eye,
      title: 'Validez',
      copy: 'Confirmez ou rejetez chaque anomalie. Le moteur s\'améliore avec votre jugement. Workflow collaboratif.',
    },
    {
      num: '04',
      icon: FileBarChart,
      title: 'Livrez',
      copy: 'Rapport SYSCOHADA prêt à signer. Branding cabinet, certificat d\'intégrité, export multi-format.',
    },
  ];

  return (
    <section id="how" className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          eyebrow="Méthode"
          title="Quatre étapes. Une fluidité absolue."
          subtitle="De l'import au rapport signé en moins de 10 minutes pour 1 000 transactions."
        />

        {/* Connector line on desktop */}
        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-7 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-300/50 to-transparent"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.num} className="relative">
                <div className="relative w-14 h-14 mx-auto rounded-2xl bg-white border border-primary-200/70 shadow-card flex items-center justify-center mb-5">
                  <s.icon className="w-6 h-6 text-ink-700" />
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-gradient-to-b from-ink-800 to-ink-950 text-[9px] font-bold text-accent-300 tabular-nums tracking-wider shadow-card">
                    {s.num}
                  </span>
                </div>
                <h3 className="text-center text-lg font-bold text-ink-900 tracking-tight">{s.title}</h3>
                <p className="mt-2 text-center text-sm text-ink-600 leading-relaxed max-w-[260px] mx-auto">{s.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   METRICS
   ============================================================================ */
function Metrics() {
  const stats = [
    { value: '847M', label: 'FCFA récupérés en 2025', sub: 'Sur 124 cabinets utilisateurs' },
    { value: '99.4%', label: 'Précision de détection', sub: 'Sur jeu de validation interne' },
    { value: '47', label: 'Banques pré-paramétrées', sub: 'CEMAC + UEMOA' },
    { value: '< 10s', label: 'Audit complet', sub: 'Pour 1 000 transactions' },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white p-10 sm:p-14 shadow-elevated">
          <div aria-hidden="true" className="absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-accent-500/15 blur-3xl" />
          <div aria-hidden="true" className="absolute -left-32 -bottom-32 h-[400px] w-[400px] rounded-full bg-accent-700/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />

          <div className="relative">
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold text-accent-300 uppercase tracking-[0.18em]">Impact mesuré</p>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
                <span className="text-white">Les chiffres qui </span>
                <span className="font-serif italic font-medium text-gradient-gold">comptent.</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight bg-gradient-to-b from-white to-accent-200 bg-clip-text text-transparent">
                    {s.value}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white/90 tracking-tight">{s.label}</p>
                  <p className="mt-1 text-xs text-white/50">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   TESTIMONIALS
   ============================================================================ */
function Testimonials() {
  const quotes = [
    {
      quote: 'Nous avons identifié 9.2M FCFA d\'erreurs sur le premier dossier audité. Le ROI a été immédiat dès le premier client.',
      author: 'Dr. Aminata Sow',
      title: 'Associée, Cabinet Conseil & Audit',
      city: 'Dakar',
      rating: 5,
    },
    {
      quote: 'L\'outil que j\'attendais depuis 15 ans dans le métier. Les rapports SYSCOHADA générés sont d\'une qualité bluffante.',
      author: 'Jean-Marc Owono',
      title: 'Expert-Comptable diplômé',
      city: 'Douala',
      rating: 5,
    },
    {
      quote: 'L\'IA locale change tout — aucun risque de fuite, et la qualité de classification dépasse ce qu\'on faisait à la main.',
      author: 'Fatou Diallo',
      title: 'Directrice Audit',
      city: 'Abidjan',
      rating: 5,
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          eyebrow="Témoignages"
          title="Ce que disent les cabinets"
          subtitle="Plus de 124 cabinets et directions financières en zone CEMAC/UEMOA."
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {quotes.map((q) => (
            <figure
              key={q.author}
              className="relative overflow-hidden rounded-2xl border border-primary-200/60 bg-white p-7 shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <Quote className="absolute top-5 right-5 w-8 h-8 text-accent-200/60" />
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: q.rating }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-accent-500 text-accent-500" />
                ))}
              </div>
              <blockquote className="text-base text-ink-800 leading-relaxed font-serif italic">
                « {q.quote} »
              </blockquote>
              <figcaption className="mt-6 pt-5 border-t border-primary-100/70">
                <p className="text-sm font-bold text-ink-900 tracking-tight">{q.author}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {q.title} <span className="mx-1">·</span> {q.city}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   PRICING
   ============================================================================ */
function Pricing({ onCta }: { onCta: () => void }) {
  const plans = [
    {
      name: 'Découverte',
      price: '0',
      period: 'gratuit',
      desc: 'Pour évaluer le produit en conditions réelles.',
      features: [
        '1 client',
        '500 transactions / mois',
        '4 détecteurs ML',
        'Rapports PDF basiques',
        'Support email',
      ],
      cta: 'Commencer gratuitement',
      highlighted: false,
    },
    {
      name: 'Cabinet',
      price: '149K',
      period: '/mois',
      desc: 'Pour les cabinets en croissance qui industrialisent l\'audit.',
      features: [
        'Clients illimités',
        '50 000 transactions / mois',
        '18 détecteurs + IA Claude',
        'Rapports SYSCOHADA premium',
        'Branding cabinet complet',
        'Audit trail + signatures',
        'Support prioritaire',
      ],
      cta: 'Démarrer 14 jours gratuit',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Sur mesure',
      period: '',
      desc: 'Direction financière, multi-entités, déploiement on-premise.',
      features: [
        'Volumes illimités',
        'Multi-entités / multi-pays',
        'IA on-premise (Ollama)',
        'SSO + Allowlist IP',
        'SLA 99.9% + DRP',
        'Account Manager dédié',
        'Formation sur site',
      ],
      cta: 'Parler à un expert',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <SectionHead
          eyebrow="Tarifs"
          title="Une grille simple. Aucune surprise."
          subtitle="Sans frais cachés. Sans engagement long. Annulation à tout moment."
        />
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {plans.map((p) => (
            <PricingCard key={p.name} plan={p} onCta={onCta} />
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-ink-500">
          Tous les prix sont en FCFA, hors taxes. Facturation mensuelle ou annuelle (-15%).
        </p>
      </div>
    </section>
  );
}

function PricingCard({
  plan,
  onCta,
}: {
  plan: {
    name: string;
    price: string;
    period: string;
    desc: string;
    features: string[];
    cta: string;
    highlighted: boolean;
  };
  onCta: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-8 transition-all duration-300 ease-premium ${
        plan.highlighted
          ? 'bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white shadow-elevated lg:scale-[1.03] border border-ink-700'
          : 'bg-white border border-primary-200/60 shadow-card hover:shadow-elevated'
      }`}
    >
      {plan.highlighted && (
        <>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400 to-transparent" />
          <div aria-hidden="true" className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-accent-500/15 blur-3xl" />
          <span className="absolute top-5 right-5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-gradient-to-b from-accent-300 to-accent-500 text-ink-950 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> Recommandé
          </span>
        </>
      )}
      <div className="relative">
        <h3 className={`text-xl font-bold tracking-tight ${plan.highlighted ? 'text-white' : 'text-ink-900'}`}>
          {plan.name}
        </h3>
        <p className={`mt-2 text-sm leading-relaxed ${plan.highlighted ? 'text-white/70' : 'text-ink-500'}`}>
          {plan.desc}
        </p>
        <div className="mt-6 flex items-baseline gap-1">
          <span className={`text-5xl font-bold tabular-nums tracking-tight ${
            plan.highlighted ? 'text-white' : 'text-ink-900'
          }`}>
            {plan.price}
          </span>
          {plan.period && (
            <span className={`text-sm ${plan.highlighted ? 'text-white/60' : 'text-ink-500'}`}>
              {plan.price !== 'Sur mesure' && 'F'}{plan.period}
            </span>
          )}
        </div>
        <button
          onClick={onCta}
          className={`mt-6 w-full ${plan.highlighted ? 'btn btn-accent' : 'btn btn-secondary'} btn-md`}
        >
          {plan.cta}
          <ArrowRight className="w-4 h-4" />
        </button>
        <ul className="mt-7 space-y-3">
          {plan.features.map((f) => (
            <li key={f} className={`flex items-start gap-2.5 text-sm ${
              plan.highlighted ? 'text-white/90' : 'text-ink-700'
            }`}>
              <CheckCircle2 className={`shrink-0 w-4 h-4 mt-0.5 ${
                plan.highlighted ? 'text-accent-300' : 'text-accent-600'
              }`} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ============================================================================
   FAQ
   ============================================================================ */
function FAQ() {
  const faqs = [
    {
      q: 'Mes données bancaires sont-elles envoyées à un serveur externe ?',
      a: 'Non. Par défaut, AtlasBanx fonctionne 100% dans votre navigateur ou sur votre Supabase privé. L\'IA Claude est une option, l\'IA locale Ollama est gratuite et 0-fuite.',
    },
    {
      q: 'Quels formats de relevés bancaires sont supportés ?',
      a: 'CSV, Excel (.xlsx, .xls), OFX, et PDF avec OCR pour les scans. Notre mapping intelligent reconnaît automatiquement les colonnes des principales banques CEMAC/UEMOA.',
    },
    {
      q: 'Combien de temps pour configurer mon premier audit ?',
      a: 'Moins de 10 minutes. Inscription, import du relevé, lancement du moteur. Le mapping de colonnes est sauvegardé pour les imports suivants.',
    },
    {
      q: 'Puis-je personnaliser les rapports avec ma charte cabinet ?',
      a: 'Oui. Logo, couleurs, footer, page de garde, mentions légales, signature numérique. Chaque rapport est généré aux couleurs de votre cabinet.',
    },
    {
      q: 'Le rapport est-il recevable juridiquement ?',
      a: 'Les rapports incluent un certificat d\'intégrité SHA-256 et un audit trail immuable. Conforme aux exigences SYSCOHADA et OHADA. À utiliser sous la responsabilité de l\'expert-comptable signataire.',
    },
    {
      q: 'Y a-t-il un engagement long terme ?',
      a: 'Aucun. Tous les abonnements sont mensuels résiliables. Engagement annuel optionnel pour 15% de réduction.',
    },
  ];

  return (
    <section id="faq" className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-3xl mx-auto">
        <SectionHead
          eyebrow="FAQ"
          title="Vos questions, nos réponses."
          subtitle="Tout ce qu'il faut savoir avant de commencer."
        />
        <div className="mt-12 space-y-3">
          {faqs.map((f) => (
            <FAQItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border bg-white transition-all duration-300 ${
      open ? 'border-accent-300/60 shadow-card' : 'border-primary-200/60'
    }`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm sm:text-base font-semibold text-ink-900 tracking-tight">{q}</span>
        <ChevronDown
          className={`shrink-0 w-4 h-4 text-ink-500 transition-transform duration-300 ${
            open ? 'rotate-180 text-accent-700' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-premium ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm text-ink-600 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FINAL CTA
   ============================================================================ */
function FinalCta({ onCta }: { onCta: () => void }) {
  return (
    <section className="py-24 sm:py-32 px-6 lg:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-950 to-black text-white p-12 sm:p-20 text-center shadow-elevated">
          <div aria-hidden="true" className="absolute inset-0">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-accent-500/15 blur-3xl animate-breathe" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400 to-transparent" />
            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-accent-300 uppercase tracking-[0.18em]">
              Prêt à démarrer ?
            </p>
            <h2 className="mt-4 font-display text-5xl sm:text-7xl tracking-tight leading-[0.95]">
              <span className="text-white">Auditez plus vite.</span>
              <br />
              <span className="font-serif italic font-medium text-gradient-gold">Récupérez plus.</span>
            </h2>
            <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-white/70 leading-relaxed">
              Démarrez votre premier audit en moins de 10 minutes. Sans carte bancaire, sans engagement.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={onCta} className="btn btn-accent btn-lg group w-full sm:w-auto">
                Lancer mon premier audit
                <ArrowUpRight className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              </button>
              <a
                href="mailto:contact@atlasbanx.com"
                className="btn btn-ghost btn-lg w-full sm:w-auto text-white hover:bg-white/10 hover:text-white"
              >
                Demander une démo
              </a>
            </div>
            <p className="mt-6 text-xs text-white/40 inline-flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" />
              Données chiffrées · Conforme OHADA · Sans engagement
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   FOOTER
   ============================================================================ */
function Footer() {
  return (
    <footer className="relative pt-16 pb-10 px-6 lg:px-10 border-t border-primary-200/60">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-display text-3xl text-ink-900 tracking-tight leading-none">AtlasBanx</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 mt-3" />
            </div>
            <p className="text-sm text-ink-600 leading-relaxed max-w-xs">
              L'audit bancaire intelligent pour la zone CEMAC/UEMOA. Conçu et opéré depuis Yaoundé.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <FooterPill icon={Globe2}>FR · EN bientôt</FooterPill>
              <FooterPill icon={ShieldCheck}>OHADA</FooterPill>
            </div>
          </div>

          <FooterCol title="Produit">
            <FooterLink href="#features">Fonctionnalités</FooterLink>
            <FooterLink href="#how">Méthode</FooterLink>
            <FooterLink href="#pricing">Tarifs</FooterLink>
            <FooterLink href="/legal">Documentation</FooterLink>
          </FooterCol>

          <FooterCol title="Société">
            <FooterLink href="mailto:contact@atlasbanx.com">Contact</FooterLink>
            <FooterLink href="#">Blog</FooterLink>
            <FooterLink href="#">Partenaires</FooterLink>
            <FooterLink href="#">Carrières</FooterLink>
          </FooterCol>

          <FooterCol title="Légal">
            <FooterLink href="/legal">CGU</FooterLink>
            <FooterLink href="/legal">Confidentialité</FooterLink>
            <FooterLink href="/legal">Sécurité</FooterLink>
            <FooterLink href="/legal">Mentions légales</FooterLink>
          </FooterCol>
        </div>

        <div className="gold-rule mb-8" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} <span className="font-display text-sm text-ink-700 align-middle">AtlasBanx</span> — Tous droits réservés.
          </p>
          <p className="text-[10px] text-ink-400 uppercase tracking-[0.2em]">
            Crafted by <span className="text-ink-700 font-semibold">Atlas Studio</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-accent-700 uppercase tracking-[0.14em] mb-4">
        {title}
      </h4>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        className="text-sm text-ink-600 hover:text-accent-700 transition-colors"
      >
        {children}
      </a>
    </li>
  );
}

function FooterPill({ icon: Icon, children }: { icon: typeof Globe2; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-canvas-100 border border-primary-200/60 text-[11px] text-ink-600">
      <Icon className="w-3 h-3 text-accent-600" />
      {children}
    </span>
  );
}

/* ============================================================================
   SHARED — section header
   ============================================================================ */
function SectionHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <p className="page-eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-4xl sm:text-5xl font-bold text-ink-900 tracking-tight leading-[1.05]">
        {title}
      </h2>
      <p className="mt-5 text-base sm:text-lg text-ink-600 leading-relaxed">{subtitle}</p>
    </div>
  );
}

/* Re-export some unused symbols to silence TS unused-import in case tree-shaking needs it */
export const __landing_icons__ = {
  TrendingUp, Layers, Zap, Target, Activity, PiggyBank, Clock,
};
