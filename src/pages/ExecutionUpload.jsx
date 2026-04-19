import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RefreshCw, UploadCloud, XCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { executionService } from '../services/executionService';
import ExecutionWizardStepper from '../components/executions/ExecutionWizardStepper';

const initialFileState = {
  file: null,
  uploading: false,
  uploaded: false,
  rowsDetected: null,
  columnsDetected: [],
  message: '',
  error: '',
};

const ExecutionUpload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const executionId = (searchParams.get('executionId') || '').trim();

  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [inputFileState, setInputFileState] = useState(initialFileState);
  const [questionsFileState, setQuestionsFileState] = useState(initialFileState);

  const hasBothSelected = Boolean(inputFileState.file) && Boolean(questionsFileState.file);
  const isUploadingAny = inputFileState.uploading || questionsFileState.uploading;

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
      message: '',
    }));
    setGlobalError('');
    setGlobalSuccess('');
  };

  const uploadBothFiles = async () => {
    if (!executionId) {
      setGlobalError('Missing execution id. Please create analysis again.');
      return;
    }

    if (!hasBothSelected) {
      setGlobalError('Please select both Input and Criteria files.');
      return;
    }

    const inputFile = inputFileState.file;
    const questionsFile = questionsFileState.file;
    if (!inputFile || !questionsFile) {
      setGlobalError('Please select both Input and Criteria files.');
      return;
    }

    setGlobalError('');
    setGlobalSuccess('');
    setInputFileState((current) => ({ ...current, uploading: true, error: '', message: '' }));
    setQuestionsFileState((current) => ({ ...current, uploading: true, error: '', message: '' }));

    try {
      // Single optimized API call - uploads both files and validates them
      const validationResult = await executionService.uploadBothFiles(executionId, inputFile, questionsFile);

      // Extract file-specific data from validation result
      const inputData = validationResult?.input_file || {};
      const questionsData = validationResult?.questions_file || {};

      const inputValid = inputData.valid !== false;
      const questionsValid = questionsData.valid !== false;

      setInputFileState((current) => ({
        ...current,
        uploading: false,
        uploaded: inputValid,
        rowsDetected: inputData.rows_detected ?? null,
        columnsDetected: Array.isArray(inputData.columns_detected) ? inputData.columns_detected : [],
        message: inputData.message || (inputValid ? 'File uploaded and validated successfully.' : ''),
        error: inputValid ? '' : (inputData.message || 'Validation failed'),
      }));
      
      setQuestionsFileState((current) => ({
        ...current,
        uploading: false,
        uploaded: questionsValid,
        rowsDetected: questionsData.rows_detected ?? null,
        columnsDetected: Array.isArray(questionsData.columns_detected) ? questionsData.columns_detected : [],
        message: questionsData.message || (questionsValid ? 'File uploaded and validated successfully.' : ''),
        error: questionsValid ? '' : (questionsData.message || 'Validation failed'),
      }));

      navigate(`/executions/create/validate?executionId=${executionId}`, {
        state: { validationResult },
      });
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to upload files.';
      setGlobalError(typeof message === 'string' ? message : 'Failed to upload files.');
      setInputFileState((current) => ({
        ...current,
        uploading: false,
        uploaded: false,
        rowsDetected: null,
        columnsDetected: [],
        message: '',
        error: '',
      }));
      setQuestionsFileState((current) => ({
        ...current,
        uploading: false,
        uploaded: false,
        rowsDetected: null,
        columnsDetected: [],
        message: '',
        error: '',
      }));
    }
  };

  const renderFileStatus = (fileState, fileTypeLabel) => (
    <div className="space-y-2 text-xs">
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
                  disabled={inputFileState.uploading}
                  onChange={(event) => handleFileSelection('input', event)}
                  className="border-slate-300 bg-white text-slate-800 file:cursor-pointer"
                />
                {renderFileStatus(inputFileState, 'Input file')}
              </div>

              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                <Label htmlFor="questionsFile" className="text-slate-700">
                  Upload Criteria / Questions CSV
                </Label>
                <Input
                  id="questionsFile"
                  name="questionsFile"
                  type="file"
                  accept=".csv"
                  disabled={questionsFileState.uploading}
                  onChange={(event) => handleFileSelection('questions', event)}
                  className="border-slate-300 bg-white text-slate-800 file:cursor-pointer"
                />
                {renderFileStatus(questionsFileState, 'Criteria file')}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/executions/create')}>
                Back
              </Button>
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!hasBothSelected || isUploadingAny}
                onClick={() => void uploadBothFiles()}
              >
                {isUploadingAny ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Uploading & Validating...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload & Validate Files
                  </>
                )}
              </Button>
            </div>
          </div>

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
