/**
 * @module AtlasBanx
 * @file src/components/import/ImportWizard.tsx
 * @description Wizard d'import en 4 étapes :
 *   1. Source — choix du type de fichier (PDF, CSV, Excel) + banque
 *   2. Upload — drag & drop + prévisualisation
 *   3. Validation — vérification données, mapping colonnes (CSV/Excel)
 *   4. Confirmation — résumé avant import final
 * @author Atlas Studio
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Upload, FileCheck, Settings2, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, Button, Select, Input, Alert, StepProgress } from '../ui';
import { FileSecurityValidator } from '../../security';
import type { ImportWizardStep } from '../../import/types';

interface ImportWizardProps {
  onImportComplete?: (result: { transactionCount: number; fileName: string }) => void;
  onCancel?: () => void;
}

const STEPS: Array<{ id: ImportWizardStep; label: string; icon: typeof Upload }> = [
  { id: 'source', label: 'Source', icon: Settings2 },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'validation', label: 'Validation', icon: FileCheck },
  { id: 'confirmation', label: 'Confirmation', icon: CheckCircle2 },
];

const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF (relevé bancaire)' },
  { value: 'csv', label: 'CSV (export comptable)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
];

export function ImportWizard({ onCancel }: ImportWizardProps) {
  const [step, setStep] = useState<ImportWizardStep>('source');
  const [fileType, setFileType] = useState('pdf');
  const [bankCode, setBankCode] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = useCallback(() => {
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next.id);
  }, [currentIndex]);

  const goBack = useCallback(() => {
    const prev = STEPS[currentIndex - 1];
    if (prev) setStep(prev.id);
  }, [currentIndex]);

  const handleFileDrop = useCallback(
    async (newFiles: File[]) => {
      setValidationErrors([]);
      const errors: string[] = [];

      for (const file of newFiles) {
        const result = await FileSecurityValidator.validate(file);
        if (!result.valid) {
          errors.push(`${file.name}: ${result.reason}`);
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }
      setFiles((prev) => [...prev, ...newFiles]);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFiles = Array.from(e.dataTransfer.files);
      void handleFileDrop(droppedFiles);
    },
    [handleFileDrop],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files ? Array.from(e.target.files) : [];
      void handleFileDrop(selected);
    },
    [handleFileDrop],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Assistant d'import
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {/* Stepper */}
          <StepProgress
            steps={STEPS.map((s) => s.label)}
            currentStep={currentIndex}
          />

          {/* Step 1: Source */}
          {step === 'source' && (
            <div className="space-y-4">
              <Select
                label="Type de fichier"
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                options={FILE_TYPE_OPTIONS}
              />
              {fileType === 'pdf' && (
                <Input
                  label="Code banque (optionnel)"
                  placeholder="Ex: SGBCI, BOA, ECOBANK..."
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  helperText="Aide l'OCR à identifier le format du relevé. Laissez vide pour détection automatique."
                />
              )}
              <div className="flex justify-end gap-2">
                {onCancel && (
                  <Button variant="secondary" onClick={onCancel}>Annuler</Button>
                )}
                <Button variant="primary" onClick={goNext}>
                  Suivant <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-primary-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <Upload className="w-10 h-10 text-primary-400 mx-auto mb-3" />
                <p className="text-sm text-primary-700 mb-1">
                  Glissez vos fichiers ici ou{' '}
                  <label className="text-primary-900 font-medium underline cursor-pointer">
                    parcourir
                    <input
                      type="file"
                      multiple
                      accept={fileType === 'pdf' ? '.pdf' : fileType === 'csv' ? '.csv' : '.xlsx,.xls'}
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-xs text-primary-500">
                  Max 50 MB par fichier. Plusieurs fichiers acceptés.
                </p>
              </div>

              {validationErrors.length > 0 && (
                <Alert variant="error" title="Fichiers refusés">
                  <ul className="list-disc pl-4">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-sm">{err}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-primary-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{f.name}</span>
                        <span className="text-xs text-primary-500">
                          ({(f.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      >
                        Retirer
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="secondary" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Précédent
                </Button>
                <Button variant="primary" onClick={goNext} disabled={files.length === 0}>
                  Suivant <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Validation */}
          {step === 'validation' && (
            <div className="space-y-4">
              <Alert variant="info" title="Vérification">
                {fileType === 'csv' || fileType === 'xlsx' ? (
                  <p>
                    Configurez le mapping des colonnes vers les champs AtlasBanx.
                    Cette configuration sera sauvegardée pour les prochains imports.
                  </p>
                ) : (
                  <p>
                    Le moteur OCR va extraire les transactions du relevé PDF.
                    Les résultats seront vérifiables à l'étape suivante.
                  </p>
                )}
              </Alert>

              {(fileType === 'csv' || fileType === 'xlsx') && (
                <div className="grid grid-cols-2 gap-3">
                  {['date', 'description', 'debit', 'credit'].map((field) => (
                    <Input
                      key={field}
                      label={`Colonne "${field}"`}
                      placeholder={`Nom de la colonne ${field}`}
                    />
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="secondary" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Précédent
                </Button>
                <Button variant="primary" onClick={goNext}>
                  Suivant <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirmation' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-semibold text-primary-800">Résumé de l'import</span>
                </div>
                <div className="text-sm text-primary-700 space-y-1">
                  <div><strong>Fichiers :</strong> {files.length} fichier(s)</div>
                  <div><strong>Type :</strong> {fileType.toUpperCase()}</div>
                  {bankCode && <div><strong>Banque :</strong> {bankCode}</div>}
                  <div><strong>Taille totale :</strong> {(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)} KB</div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Précédent
                </Button>
                <Button variant="primary">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Lancer l'import
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
