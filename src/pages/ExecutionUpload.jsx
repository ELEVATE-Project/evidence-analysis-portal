import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RefreshCw, UploadCloud, XCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { executionService, getApiErrorMessage } from '../services/executionService';
import ExecutionWizardStepper from '../components/executions/ExecutionWizardStepper';

const initialFileState = {
  file: null,
  uploading: false,
  uploaded: false,
  rowsDetected: null,
  columnsDetected: [],
  message: '',
  error: '',
  existingFileName: '',
  existingUploaded: false,
  existingValidated: false,
};

const extractDisplayFileName = (filePath, fileType) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return '';
  }

  const rawName = filePath.split('/').pop() || '';
  const decodedName = decodeURIComponent(rawName);
  const prefix = `${fileType}_`;
  return decodedName.startsWith(prefix) ? decodedName.slice(prefix.length) : decodedName;
};

const ExecutionUpload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const executionId = (searchParams.get('executionId') || '').trim();

  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('');
  const [inputFileState, setInputFileState] = useState(initialFileState);
  const [questionsFileState, setQuestionsFileState] = useState(initialFileState);

  const hasAnyFileSelected = Boolean(inputFileState.file) || Boolean(questionsFileState.file);
  const hasInputAvailable = Boolean(inputFileState.file) || inputFileState.existingUploaded;
  const hasQuestionsAvailable = Boolean(questionsFileState.file) || questionsFileState.existingUploaded;
  const isUploadingAny = inputFileState.uploading || questionsFileState.uploading || submitting;
  const isEditableExecution = useMemo(() => {
    const normalizedStatus = `${executionStatus || ''}`.toLowerCase();
    if (!normalizedStatus) {
      return true;
    }
    return normalizedStatus === 'draft' || normalizedStatus === 'validated';
  }, [executionStatus]);

  const actionLabel = useMemo(() => {
    if (submitting) {
      return hasAnyFileSelected ? 'Uploading & Validating...' : 'Validating...';
    }
    return hasAnyFileSelected ? 'Upload Selected & Validate' : 'Continue with Existing Files';
  }, [hasAnyFileSelected, submitting]);

  const createStepPath = executionId ? `/executions/create?executionId=${executionId}` : '/executions/create';

  const hydrateExistingFiles = (execution) => {
    const inputStatus = execution?.input_file_status || {};
    const questionsStatus = execution?.questions_file_status || {};

    setInputFileState((current) => ({
      ...current,
      existingFileName: extractDisplayFileName(execution?.input_file_url, 'input'),
      existingUploaded: Boolean(execution?.input_file_url) || Boolean(inputStatus.uploaded),
      existingValidated: Boolean(inputStatus.validated),
      rowsDetected: typeof inputStatus.rows_detected === 'number' ? inputStatus.rows_detected : null,
      columnsDetected: Array.isArray(inputStatus.columns_detected) ? inputStatus.columns_detected : [],
      message: typeof inputStatus.message === 'string' ? inputStatus.message : '',
      error: '',
    }));

    setQuestionsFileState((current) => ({
      ...current,
      existingFileName: extractDisplayFileName(execution?.criterias_file_url || execution?.questions_file_url, 'questions'),
      existingUploaded: Boolean(execution?.criterias_file_url || execution?.questions_file_url) || Boolean(questionsStatus.uploaded),
      existingValidated: Boolean(questionsStatus.validated),
      rowsDetected: typeof questionsStatus.rows_detected === 'number' ? questionsStatus.rows_detected : null,
      columnsDetected: Array.isArray(questionsStatus.columns_detected) ? questionsStatus.columns_detected : [],
      message: typeof questionsStatus.message === 'string' ? questionsStatus.message : '',
      error: '',
    }));
  };

  useEffect(() => {
    if (!executionId) {
      return;
    }

    const loadExecution = async () => {
      setLoadingExecution(true);
      setGlobalError('');
      try {
        const execution = await executionService.getExecution(executionId);
        const normalizedStatus = `${execution?.status || ''}`.toLowerCase();
        setExecutionStatus(normalizedStatus);
        hydrateExistingFiles(execution);

        if (!['draft', 'validated'].includes(normalizedStatus)) {
          setGlobalError('Only draft or validated executions can be updated.');
        }
      } catch (error) {
        const message = error?.response?.data?.detail || error?.message || 'Failed to load execution details.';
        setGlobalError(typeof message === 'string' ? message : 'Failed to load execution details.');
      } finally {
        setLoadingExecution(false);
      }
    };

    void loadExecution();
  }, [executionId]);

  const handleFileSelection = (fileType, event) => {
    const selectedFile = event.target.files?.[0] || null;
    const setState = fileType === 'input' ? setInputFileState : setQuestionsFileState;
    setState((current) => ({
      ...current,
      file: selectedFile,
      uploaded: false,
      rowsDetected: null,
      columnsDetected: [],
      error: '',
      message: selectedFile
        ? `${current.existingUploaded ? 'Replacement selected' : 'Selected'}: ${selectedFile.name}`
        : '',
    }));
    setGlobalError('');
    setGlobalSuccess('');
  };

  const uploadSelectedFiles = async () => {
    const selectedInputFile = inputFileState.file;
    const selectedQuestionsFile = questionsFileState.file;

    if (selectedInputFile) {
      setInputFileState((current) => ({ ...current, uploading: true, error: '' }));
    }
    if (selectedQuestionsFile) {
      setQuestionsFileState((current) => ({ ...current, uploading: true, error: '' }));
    }

    try {
      const uploadPromises = [];
      if (selectedInputFile) {
        uploadPromises.push(
          executionService
            .directUploadExecutionFile(executionId, 'input', selectedInputFile)
            .then((result) => ({ fileType: 'input', result }))
        );
      }
      if (selectedQuestionsFile) {
        uploadPromises.push(
          executionService
            .directUploadExecutionFile(executionId, 'questions', selectedQuestionsFile)
            .then((result) => ({ fileType: 'questions', result }))
        );
      }

      const uploadResults = await Promise.all(uploadPromises);
      uploadResults.forEach((uploadResult) => {
        if (uploadResult.fileType === 'input') {
          setInputFileState((current) => ({
            ...current,
            uploaded: Boolean(uploadResult.result?.uploaded),
            rowsDetected: uploadResult.result?.rows_detected ?? null,
            columnsDetected: Array.isArray(uploadResult.result?.columns_detected) ? uploadResult.result.columns_detected : [],
            message: 'Input file replaced successfully.',
            error: '',
            existingFileName: selectedInputFile?.name || current.existingFileName,
            existingUploaded: true,
            existingValidated: false,
          }));
        } else {
          setQuestionsFileState((current) => ({
            ...current,
            uploaded: Boolean(uploadResult.result?.uploaded),
            rowsDetected: uploadResult.result?.rows_detected ?? null,
            columnsDetected: Array.isArray(uploadResult.result?.columns_detected)
              ? uploadResult.result.columns_detected
              : [],
            message: 'Criteria file replaced successfully.',
            error: '',
            existingFileName: selectedQuestionsFile?.name || current.existingFileName,
            existingUploaded: true,
            existingValidated: false,
          }));
        }
      });
    } finally {
      setInputFileState((current) => ({ ...current, uploading: false }));
      setQuestionsFileState((current) => ({ ...current, uploading: false }));
    }
  };

  const applyValidationState = (validationResult) => {
    const inputResult = validationResult?.input_file || {};
    const questionsResult = validationResult?.questions_file || {};

    setInputFileState((current) => ({
      ...current,
      existingUploaded: current.existingUploaded || Boolean(current.file),
      existingValidated: Boolean(inputResult.valid),
      rowsDetected: inputResult.rows_detected ?? current.rowsDetected,
      columnsDetected: Array.isArray(inputResult.columns_detected) ? inputResult.columns_detected : current.columnsDetected,
      message: inputResult.message || current.message,
      error: inputResult.valid === false ? (inputResult.message || 'Validation failed.') : '',
    }));

    setQuestionsFileState((current) => ({
      ...current,
      existingUploaded: current.existingUploaded || Boolean(current.file),
      existingValidated: Boolean(questionsResult.valid),
      rowsDetected: questionsResult.rows_detected ?? current.rowsDetected,
      columnsDetected: Array.isArray(questionsResult.columns_detected)
        ? questionsResult.columns_detected
        : current.columnsDetected,
      message: questionsResult.message || current.message,
      error: questionsResult.valid === false ? (questionsResult.message || 'Validation failed.') : '',
    }));
  };

  const handleProceed = async () => {
    if (!executionId) {
      setGlobalError('Missing execution id. Please create analysis again.');
      return;
    }

    if (!isEditableExecution) {
      setGlobalError('Only draft or validated executions can be updated.');
      return;
    }

    if (!hasInputAvailable || !hasQuestionsAvailable) {
      const missing = [];
      if (!hasInputAvailable) {
        missing.push('Input Data CSV');
      }
      if (!hasQuestionsAvailable) {
        missing.push('Criteria / Questions CSV');
      }
      setGlobalError(`Missing required file: ${missing.join(' and ')}.`);
      return;
    }

    setGlobalError('');
    setGlobalSuccess('');
    setSubmitting(true);

    try {
      if (hasAnyFileSelected) {
        try {
          await uploadSelectedFiles();
          setGlobalSuccess('Selected files uploaded. Running validation...');
        } catch (uploadError) {
          const uploadMessage = getApiErrorMessage(
            uploadError,
            'Unable to upload selected file(s). Please retry.'
          );

          if (inputFileState.file) {
            setInputFileState((current) => ({
              ...current,
              uploaded: false,
              rowsDetected: null,
              columnsDetected: [],
              message: '',
              error: uploadMessage,
            }));
          }
          if (questionsFileState.file) {
            setQuestionsFileState((current) => ({
              ...current,
              uploaded: false,
              rowsDetected: null,
              columnsDetected: [],
              message: '',
              error: uploadMessage,
            }));
          }

          setGlobalSuccess('');
          setGlobalError(`Upload failed: ${uploadMessage}`);
          return;
        }
      }

      try {
        const validationResult = await executionService.validateExecutionFiles(executionId);
        applyValidationState(validationResult);
        navigate(`/executions/create/validate?executionId=${executionId}`, {
          state: { validationResult },
        });
      } catch (validationError) {
        const validationMessage = getApiErrorMessage(
          validationError,
          'Unable to validate files. Please retry.'
        );
        setGlobalSuccess('');
        setGlobalError(`Validation failed: ${validationMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderExistingFileStatus = (fileState) => {
    if (!fileState.existingUploaded) {
      return null;
    }

    return (
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
        <div>
          <span className="font-medium text-slate-800">Current file:</span>{' '}
          {fileState.existingFileName || 'Already uploaded'}
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
            Uploaded
          </span>
          <span
            className={`rounded border px-2 py-0.5 text-[11px] ${
              fileState.existingValidated
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {fileState.existingValidated ? 'Validated' : 'Not validated'}
          </span>
        </div>
      </div>
    );
  };

  const renderFileStatus = (fileState, fileTypeLabel) => (
    <div className="space-y-2 text-xs">
      {renderExistingFileStatus(fileState)}

      {fileState.uploaded && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{fileState.message || `${fileTypeLabel} uploaded and validated`}</span>
          </div>
          {typeof fileState.rowsDetected === 'number' && <div className="mt-1">Rows detected: {fileState.rowsDetected}</div>}
          {fileState.columnsDetected.length > 0 && (
            <div className="mt-1 max-h-20 overflow-auto">
              <span className="font-medium">Columns: </span>
              {fileState.columnsDetected.join(', ')}
            </div>
          )}
        </div>
      )}

      {fileState.message && !fileState.uploaded && !fileState.error && (
        <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
          <span>{fileState.message}</span>
        </div>
      )}

      {fileState.error && (
        <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
          <div className="flex items-start gap-1">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-words">{fileState.error}</span>
          </div>
        </div>
      )}
    </div>
  );

  if (!executionId) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <ExecutionWizardStepper activeStep={2} />
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Missing execution id. Please complete Step 1 first.
            </div>
            <div>
              <Button type="button" onClick={() => navigate('/executions/create')}>
                Go To Create
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-6 p-6">
          <ExecutionWizardStepper activeStep={2} />

          <div>
            <h2 className="text-4xl font-semibold text-slate-900">Upload Files</h2>
          </div>

          {loadingExecution ? (
            <div className="rounded-md border border-slate-200 p-8">
              <div className="flex items-center justify-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm text-slate-600">Loading execution files...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-semibold text-slate-800">Step 2: Upload Files</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                  <Label htmlFor="inputFile" className="text-slate-700">
                    Upload Input Data CSV
                  </Label>
                  <Input
                    id="inputFile"
                    name="inputFile"
                    type="file"
                    accept=".csv"
                    disabled={inputFileState.uploading || submitting}
                    onChange={(event) => handleFileSelection('input', event)}
                    className="border-slate-300 bg-white text-slate-800 file:cursor-pointer"
                  />
                  {renderFileStatus(inputFileState, 'Input file')}
                </div>

                <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                  <Label htmlFor="questionsFile" className="text-slate-700">
                    Upload Criteria CSV
                  </Label>
                  <Input
                    id="questionsFile"
                    name="questionsFile"
                    type="file"
                    accept=".csv"
                    disabled={questionsFileState.uploading || submitting}
                    onChange={(event) => handleFileSelection('questions', event)}
                    className="border-slate-300 bg-white text-slate-800 file:cursor-pointer"
                  />
                  {renderFileStatus(questionsFileState, 'Criteria file')}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(createStepPath)}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={loadingExecution || isUploadingAny || !hasInputAvailable || !hasQuestionsAvailable || !isEditableExecution}
                  onClick={() => void handleProceed()}
                >
                  {isUploadingAny ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      {actionLabel}
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {actionLabel}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {globalError && (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          {globalSuccess && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {globalSuccess}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionUpload;
