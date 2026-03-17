/**
 * @file Upload page — allows users to drag-and-drop or browse for a PDF invoice,
 * then upload it to the backend.  Includes a "Download sample" button that
 * generates a randomised demo invoice PDF client-side.
 */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Check, Download, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useUploadInvoice } from '@/hooks/use-invoice-mutations';
import { generateSampleInvoice } from '@/lib/generate-sample-invoice';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function UploadPage() {
  const { role, userId } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const uploadMutation = useUploadInvoice();

  // For uploaders: check that a full assignment chain exists (uploader→validator→approver)
  const { data: assignmentTree } = useQuery({
    queryKey: ['assignment-tree'],
    queryFn: () => adminApi.getAssignmentTree(),
    enabled: role === 'uploader',
  });

  const assignmentBlocked = role === 'uploader' && assignmentTree !== undefined && (() => {
    const tree = (assignmentTree as { data?: { approvers?: { validators?: { uploaderIds?: string[] }[] }[] } }).data;
    const uploaderFound = tree?.approvers?.some((approver) =>
      approver.validators?.some((validator) =>
        validator.uploaderIds?.includes(userId ?? '')
      )
    );
    return !uploaderFound;
  })();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    setFileError(null);
    uploadMutation.reset();

    if (rejectedFiles.length > 0) {
      setFileError('Only PDF files up to 10 MB are accepted');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      if (file.size > MAX_FILE_SIZE) {
        setFileError('Only PDF files up to 10 MB are accepted');
        return;
      }

      if (file.type !== 'application/pdf') {
        setFileError('Only PDF files up to 10 MB are accepted');
        return;
      }

      setSelectedFile(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    uploadMutation.reset();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await uploadMutation.mutateAsync({ file: selectedFile });
    } catch {
      // Error is already handled by the mutation's onError callback (toast).
      // Catching here prevents an unhandled promise rejection.
    }
  };

  const handleDownloadSample = async () => {
    setIsGenerating(true);
    try {
      await generateSampleInvoice();
    } finally {
      setIsGenerating(false);
    }
  };

  const isDisabled = !selectedFile || uploadMutation.isPending || !!assignmentBlocked;

  const buttonLabel = uploadMutation.isPending
    ? 'Uploading...'
    : uploadMutation.isError
    ? 'Upload failed — retry'
    : 'Upload Invoice';

  return (
    <AppShell title="Upload Invoice">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Assignment warning for unassigned uploaders */}
        {assignmentBlocked && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-300">You are not assigned to a validator</p>
              <p className="mt-1 text-sm text-amber-400/80">
                An admin must assign you to a validator (and that validator to an approver) before you can upload invoices. Contact your administrator.
              </p>
            </div>
          </motion.div>
        )}

        {/* Sample invoice download */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3"
        >
          <div>
            <p className="text-sm font-medium text-zinc-300">Need a test invoice?</p>
            <p className="text-xs text-zinc-500">Download a randomly generated PDF ready to upload</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSample}
            disabled={isGenerating}
            className="shrink-0 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            {isGenerating ? (
              <Spinner className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Download className="mr-2 h-3.5 w-3.5" />
            )}
            {isGenerating ? 'Generating...' : 'Download sample'}
          </Button>
        </motion.div>

        {/* File Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-50">
            Upload File
          </h2>

          <AnimatePresence mode="wait">
            {!selectedFile ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  {...getRootProps()}
                  className={cn(
                    'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
                    isDragActive
                      ? 'scale-[1.02] border-indigo-500 bg-indigo-950/30'
                      : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'
                  )}
                >
                  <input {...getInputProps()} />
                  <motion.div
                    animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800"
                  >
                    <Upload className={cn(
                      'h-8 w-8',
                      isDragActive ? 'text-indigo-400' : 'text-zinc-500'
                    )} />
                  </motion.div>
                  <p className="text-zinc-300">
                    {isDragActive
                      ? 'Drop your PDF here...'
                      : 'Drag & drop your PDF here or click to browse'}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    PDF only, max 10 MB
                  </p>
                </div>

                {fileError && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-sm text-rose-400"
                  >
                    {fileError}
                  </motion.p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
                  <FileText className="h-6 w-6 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-zinc-200">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="h-4 w-4 text-emerald-400" />
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Upload Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Button
            onClick={handleUpload}
            disabled={isDisabled}
            className={cn(
              'w-full py-6 text-lg text-white disabled:opacity-50',
              uploadMutation.isError
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            )}
          >
            {uploadMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-5 w-5" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                {buttonLabel}
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </AppShell>
  );
}
