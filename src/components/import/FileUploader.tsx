import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, Image, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, Button, Progress, Alert } from '../ui';
import { ImportService } from '../../services';
import { ImportResult, Transaction } from '../../types';
import { formatFileSize } from '../../utils';

// Limite de taille de fichier (50 MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ImportInfo {
  transactions: Transaction[];
  fileName: string;
  fileType: 'csv' | 'excel' | 'pdf' | 'image';
  periodStart: Date;
  periodEnd: Date;
}

interface FileUploaderProps {
  onImportComplete: (info: ImportInfo) => void;
  clientId?: string;
  bankCode?: string;
  accountNumber?: string;
}

type FileStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

interface UploadedFile {
  file: File;
  status: FileStatus;
  progress: number;
  result?: ImportResult;
  error?: string;
}

export function FileUploader({ onImportComplete, clientId = 'default', bankCode = 'UNKNOWN', accountNumber = '' }: FileUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => {
      // Vérifier la taille du fichier immédiatement
      if (file.size > MAX_FILE_SIZE) {
        return {
          file,
          status: 'error' as FileStatus,
          progress: 100,
          error: `Fichier trop volumineux (${formatFileSize(file.size)}). Maximum: 50 MB`,
        };
      }
      return {
        file,
        status: 'idle' as FileStatus,
        progress: 0,
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);

    // Process each file (skip files already in error)
    for (let i = 0; i < newFiles.length; i++) {
      const uploadedFile = newFiles[i];

      // Skip files that already have errors (size exceeded)
      if (uploadedFile.status === 'error') continue;

      setFiles((prev) =>
        prev.map((f) =>
          f.file === uploadedFile.file ? { ...f, status: 'parsing', progress: 50 } : f
        )
      );

      try {
        const result = await ImportService.parseFile(uploadedFile.file, {
          clientId,
          bankCode,
          accountNumber,
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.file === uploadedFile.file
              ? {
                  ...f,
                  status: result.success ? 'success' : 'error',
                  progress: 100,
                  result,
                  error: result.errors.length > 0 ? result.errors[0].message : undefined,
                }
              : f
          )
        );

        if (result.success && result.transactions.length > 0) {
          // Extract period dates from transactions
          const dates = result.transactions.map(t => new Date(t.date));
          const periodStart = new Date(Math.min(...dates.map(d => d.getTime())));
          const periodEnd = new Date(Math.max(...dates.map(d => d.getTime())));

          // Determine file type
          const fileExt = uploadedFile.file.name.split('.').pop()?.toLowerCase();
          const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif'];
          const fileType: 'csv' | 'excel' | 'pdf' | 'image' =
            fileExt === 'csv' ? 'csv' :
            fileExt === 'pdf' ? 'pdf' :
            imageExts.includes(fileExt || '') ? 'image' : 'excel';

          onImportComplete({
            transactions: result.transactions,
            fileName: uploadedFile.file.name,
            fileType,
            periodStart,
            periodEnd,
          });
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === uploadedFile.file
              ? {
                  ...f,
                  status: 'error',
                  progress: 100,
                  error: error instanceof Error ? error.message : 'Erreur inconnue',
                }
              : f
          )
        );
      }
    }
  }, [clientId, bankCode, accountNumber, onImportComplete]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') return <FileText className="w-8 h-8 text-primary-500" />;
    if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="w-8 h-8 text-primary-500" />;
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif'].includes(ext || '')) {
      return <Image className="w-8 h-8 text-primary-500" />;
    }
    if (ext === 'pdf') return <FileText className="w-8 h-8 text-primary-500" />;
    return <FileText className="w-8 h-8 text-primary-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-colors cursor-pointer
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-primary-200 hover:border-primary-300'}
        `}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 text-primary-600" />
          </div>
          <p className="text-lg font-medium text-primary-900">
            Glissez-déposez vos fichiers ici
          </p>
          <p className="text-sm text-primary-500 mt-1">
            ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-primary-400 mt-3">
            Formats supportés: CSV, Excel (.xlsx, .xls), PDF, Images (JPG, PNG) avec OCR
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((uploadedFile, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center gap-4">
                {/* Icon */}
                {getFileIcon(uploadedFile.file)}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary-900 truncate">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-sm text-primary-500">
                    {formatFileSize(uploadedFile.file.size)}
                    {uploadedFile.result && uploadedFile.status === 'success' && (
                      <span className="ml-2 text-success">
                        {uploadedFile.result.importedRows} lignes importées
                      </span>
                    )}
                  </p>

                  {/* Progress */}
                  {(uploadedFile.status === 'uploading' || uploadedFile.status === 'parsing') && (
                    <Progress value={uploadedFile.progress} className="mt-2" size="sm" />
                  )}

                  {/* Error */}
                  {uploadedFile.status === 'error' && uploadedFile.error && (
                    <p className="text-sm text-error mt-1">{uploadedFile.error}</p>
                  )}
                </div>

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {uploadedFile.status === 'success' && (
                    <CheckCircle className="w-6 h-6 text-success" />
                  )}
                  {uploadedFile.status === 'error' && (
                    <AlertCircle className="w-6 h-6 text-error" />
                  )}
                  {(uploadedFile.status === 'uploading' || uploadedFile.status === 'parsing') && (
                    <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                  )}
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(uploadedFile.file)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {files.some((f) => f.status === 'success') && (
        <Alert variant="success" title="Import réussi">
          {files.filter((f) => f.status === 'success').length} fichier(s) importé(s) avec succès.
          Total:{' '}
          {files
            .filter((f) => f.result)
            .reduce((sum, f) => sum + (f.result?.importedRows || 0), 0)}{' '}
          transactions.
        </Alert>
      )}
    </div>
  );
}
