import { useState } from 'react';
import {
  Building2, Mail, MapPin, FileText,
  Save, RotateCcw, Upload, Eye, EyeOff, Send, CheckCircle, AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Button, Input, Select } from '../ui';
import { useSettingsStore } from '../../store';
import { AFRICAN_COUNTRIES } from '../../types';

interface Props {
  onSave?: () => void;
}

type TabType = 'organisation' | 'email';

export function OrganizationSettings({ onSave }: Props) {
  const { organization, updateOrganization, resetOrganization } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabType>('organisation');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleChange = (field: string, value: string | number | boolean) => {
    updateOrganization({ [field]: value });
  };

  const handleSave = () => {
    onSave?.();
  };

  const handleReset = () => {
    if (confirm('Voulez-vous vraiment reinitialiser les informations de l\'organisation ?')) {
      resetOrganization();
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateOrganization({ logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestEmail = async () => {
    if (!organization.senderEmail || !organization.smtpHost) {
      setEmailTestResult({
        success: false,
        message: 'Veuillez configurer l\'email et le serveur SMTP d\'abord.',
      });
      return;
    }

    setTestingEmail(true);
    setEmailTestResult(null);

    setTimeout(() => {
      setTestingEmail(false);
      if (organization.smtpHost && organization.smtpUser && organization.smtpPassword) {
        setEmailTestResult({
          success: true,
          message: 'Configuration SMTP enregistree. Le test d\'envoi necessite un serveur backend.',
        });
      } else {
        setEmailTestResult({
          success: false,
          message: 'Veuillez remplir tous les champs SMTP pour tester l\'envoi.',
        });
      }
    }, 1500);
  };

  const countryOptions = Object.entries(AFRICAN_COUNTRIES).map(([code, name]) => ({
    value: code,
    label: name,
  }));

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary-200">
        <button
          onClick={() => setActiveTab('organisation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'organisation'
              ? 'border-primary-900 text-primary-900'
              : 'border-transparent text-primary-500 hover:text-primary-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Organisation
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'email'
              ? 'border-primary-900 text-primary-900'
              : 'border-transparent text-primary-500 hover:text-primary-700'
          }`}
        >
          <Mail className="w-4 h-4" />
          Email & Documents
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'organisation' ? (
        <div className="space-y-4">
          {/* Informations du cabinet */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Informations du cabinet
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Nom du cabinet"
                  value={organization.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Cabinet ABC Audit"
                  className="h-9 text-sm"
                />
                <Input
                  label="Raison sociale"
                  value={organization.legalName}
                  onChange={(e) => handleChange('legalName', e.target.value)}
                  placeholder="Ex: ABC AUDIT SARL"
                  className="h-9 text-sm"
                />
              </div>

              {/* Logo */}
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-primary-600 mb-1">Logo</label>
                  <div className="flex items-center gap-3">
                    {organization.logo ? (
                      <div className="relative">
                        <img src={organization.logo} alt="Logo" className="w-14 h-14 object-contain border rounded-lg bg-white" />
                        <button onClick={() => updateOrganization({ logo: null })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600">X</button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 border-2 border-dashed border-primary-300 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary-300" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        {organization.logo ? 'Changer' : 'Telecharger'}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <Input
                    label="Telephone"
                    value={organization.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+237 6XX XXX XXX"
                    className="h-9 text-sm"
                  />
                  <Input
                    label="Site web"
                    value={organization.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://www.exemple.com"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Adresse */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Adresse
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Input
                label="Adresse"
                value={organization.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Rue, numero, quartier..."
                className="h-9 text-sm"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Ville"
                  value={organization.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Ex: Douala"
                  className="h-9 text-sm"
                />
                <Input
                  label="Code postal"
                  value={organization.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  placeholder="Ex: BP 1234"
                  className="h-9 text-sm"
                />
                <Select
                  label="Pays"
                  value={organization.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  options={countryOptions}
                  className="h-9 text-sm"
                />
              </div>
            </CardBody>
          </Card>

          {/* Identifiants legaux */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Identifiants legaux
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="RCCM"
                  value={organization.rccm}
                  onChange={(e) => handleChange('rccm', e.target.value)}
                  placeholder="RC/DLA/20XX/X/XXXX"
                  helperText="Registre du Commerce"
                  className="h-9 text-sm"
                />
                <Input
                  label="NIF / NIU"
                  value={organization.nif}
                  onChange={(e) => handleChange('nif', e.target.value)}
                  placeholder="XXXXXXXXXXXXXXXXX"
                  helperText="Numero d'Identification Fiscale"
                  className="h-9 text-sm"
                />
                <Input
                  label="SIRET (si applicable)"
                  value={organization.siret}
                  onChange={(e) => handleChange('siret', e.target.value)}
                  placeholder="XXX XXX XXX XXXXX"
                  helperText="Optionnel"
                  className="h-9 text-sm"
                />
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Configuration email */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Configuration email
              </CardTitle>
              <CardDescription className="text-xs">
                Configurez l'adresse email pour l'envoi automatique des rapports et factures
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Email expediteur"
                  type="email"
                  value={organization.senderEmail}
                  onChange={(e) => handleChange('senderEmail', e.target.value)}
                  placeholder="contact@cabinet.com"
                  className="h-9 text-sm"
                />
                <Input
                  label="Nom expediteur"
                  value={organization.senderName}
                  onChange={(e) => handleChange('senderName', e.target.value)}
                  placeholder="Cabinet ABC Audit"
                  className="h-9 text-sm"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-primary-700 mb-3">Configuration SMTP</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Serveur SMTP"
                    value={organization.smtpHost}
                    onChange={(e) => handleChange('smtpHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="h-9 text-sm"
                  />
                  <Input
                    label="Port SMTP"
                    type="number"
                    value={organization.smtpPort.toString()}
                    onChange={(e) => handleChange('smtpPort', parseInt(e.target.value) || 587)}
                    placeholder="587"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Input
                    label="Utilisateur SMTP"
                    value={organization.smtpUser}
                    onChange={(e) => handleChange('smtpUser', e.target.value)}
                    placeholder="votre-email@gmail.com"
                    className="h-9 text-sm"
                  />
                  <div className="relative">
                    <Input
                      label="Mot de passe SMTP"
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={organization.smtpPassword}
                      onChange={(e) => handleChange('smtpPassword', e.target.value)}
                      placeholder="Mot de passe ou cle d'application"
                      className="h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-8 text-primary-400 hover:text-primary-600"
                    >
                      {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    id="smtpSecure"
                    checked={organization.smtpSecure}
                    onChange={(e) => handleChange('smtpSecure', e.target.checked)}
                    className="rounded border-primary-300 w-4 h-4"
                  />
                  <label htmlFor="smtpSecure" className="text-sm text-primary-600">
                    Utiliser une connexion securisee (TLS/SSL)
                  </label>
                </div>
              </div>

              {/* Test email */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                  >
                    {testingEmail ? (
                      <>
                        <span className="animate-spin">...</span>
                        Test...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Tester la configuration
                      </>
                    )}
                  </Button>
                  {emailTestResult && (
                    <div className={`flex items-center gap-2 text-xs ${emailTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {emailTestResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {emailTestResult.message}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Pied de page documents */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Pied de page des documents</CardTitle>
              <CardDescription className="text-xs">
                Texte qui apparaitra en bas des rapports et factures
              </CardDescription>
            </CardHeader>
            <CardBody>
              <textarea
                value={organization.footerText}
                onChange={(e) => handleChange('footerText', e.target.value)}
                placeholder="Ex: Document genere par Scrutix. Pour toute question, contactez-nous..."
                className="w-full h-20 px-3 py-2 text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </CardBody>
          </Card>
        </div>
      )}

      {/* Credits + Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-primary-100">
        <div className="text-xs text-primary-400">
          <span>{organization.developedBy}</span> • <span>Scrutix v1.0</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
            Reinitialiser
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
