import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, PlayCircle, RefreshCw, Save, XCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { executionService } from '../services/executionService';
import ExecutionWizardStepper from '../components/executions/ExecutionWizardStepper';

const ExecutionValidate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const executionId = (searchParams.get('executionId') || '').trim();
  const routeValidationResult = location.state?.validationResult || null;

  const [validationRunning, setValidationRunning] = useState(false);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [validationResult, setValidationResult] = useState(routeValidationResult);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  const canStartActions = useMemo(() => Boolean(validationResult?.is_valid), [validationResult]);

  const runValidation = useCallback(async (showSpinner = true) => {
    if (!executionId) {
      setGlobalError('Missing execution id. Please complete Step 1 first.');
      return;
    }

    if (showSpinner) {
      setValidationRunning(true);
    }
    setGlobalError('');
    setGlobalSuccess('');
    try {
      const result = await executionService.validateExecutionFiles(executionId);
      setValidationResult(result);
      if (result?.is_valid) {
        setGlobalSuccess('Both files are valid. You can start analysis or save as draft.');
      } else {
        setGlobalError('');
      }
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Validation failed.';
      setGlobalError(typeof message === 'string' ? message : 'Validation failed.');
      setValidationResult(null);
    } finally {
      setValidationRunning(false);
    }
  }, [executionId]);

  useEffect(() => {
    if (!executionId) {
      return;
    }

    const resultExecutionId = `${routeValidationResult?.execution_id || ''}`.trim();
    if (routeValidationResult && resultExecutionId === executionId) {
      setValidationResult(routeValidationResult);
      setGlobalError('');
      setGlobalSuccess(routeValidationResult?.is_valid ? 'Both files are valid. You can start analysis or save as draft.' : '');
      return;
    }

    void runValidation(false);
  }, [executionId, routeValidationResult, runValidation]);

  const handleStartAnalysis = async () => {
    if (!executionId || !canStartActions) {
      return;
    }

    setStartingAnalysis(true);
    setGlobalError('');
    setGlobalSuccess('');
    try {
      await executionService.startExecution(executionId);
      setGlobalSuccess('Analysis queued successfully. Redirecting to analyses...');
      setTimeout(() => {
        navigate('/executions');
      }, 1000);
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to start analysis.';
      setGlobalError(typeof message === 'string' ? message : 'Failed to start analysis.');
    } finally {
      setStartingAnalysis(false);
    }
  };

  const renderCsvPreviewSection = (fileResult, sectionTitle) => {
    const isValid = Boolean(fileResult?.valid);
    const columns = Array.isArray(fileResult?.columns_detected) ? fileResult.columns_detected : [];
    const previewRows = Array.isArray(fileResult?.preview_rows) ? fileResult.preview_rows.slice(0, 10) : [];
    const rowsDetected = typeof fileResult?.rows_detected === 'number' ? fileResult.rows_detected : null;

    return (
      <section
        className={`space-y-3 rounded-md border bg-white p-4 text-sm ${
          isValid
            ? 'border-emerald-200'
            : 'border-rose-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-slate-900">{sectionTitle}</h4>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
              isValid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {isValid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {isValid ? 'Valid' : 'Invalid'}
          </span>
        </div>

        <div
          className={`rounded-md border px-3 py-2 ${
            isValid
              ? 'border-slate-200 bg-slate-50'
              : 'border-rose-200 bg-rose-50'
          }`}
        >
          <p className={`text-xs sm:text-sm ${isValid ? 'text-slate-700' : 'text-rose-700'}`}>
            {fileResult?.message || 'No validation details available yet.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span>
            <span className="font-medium text-slate-700">Rows detected:</span>{' '}
            {rowsDetected !== null ? rowsDetected : '-'}
          </span>
          <span>
            <span className="font-medium text-slate-700">Columns detected:</span> {columns.length}
          </span>
        </div>

        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700">CSV Preview (First 10 Rows)</p>
          </div>
          {columns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-max w-full divide-y divide-slate-200 text-xs text-slate-700">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700">#</th>
                    {columns.map((column) => (
                      <th
                        key={`${sectionTitle}-head-${column}`}
                        className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.length > 0 ? (
                    previewRows.map((row, rowIndex) => (
                      <tr key={`${sectionTitle}-row-${rowIndex}`} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{rowIndex + 1}</td>
                        {columns.map((column) => (
                          <td
                            key={`${sectionTitle}-cell-${rowIndex}-${column}`}
                            className="min-w-[140px] break-words px-3 py-2 text-slate-700"
                          >
                            {row?.[column] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-3 py-3 text-slate-500">
                        No sample data rows available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-slate-500">
              Preview unavailable until a valid header row is detected.
            </div>
          )}
        </div>
      </section>
    );
  };

  if (!executionId) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-4 p-6">
            <ExecutionWizardStepper activeStep={3} />
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Missing execution id. Please complete previous steps first.
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
          <ExecutionWizardStepper activeStep={3} />

          <div>
            <h2 className="text-4xl font-semibold text-slate-900">Validate Files</h2>
          </div>

          <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-sm font-semibold text-slate-800">Step 3: Validate Files</h3>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={validationRunning || startingAnalysis}
                onClick={() => void runValidation(true)}
              >
                {validationRunning ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate Uploaded Files'
                )}
              </Button>
            </div>

            {validationResult && (
              <div className="space-y-3">
                {validationResult.is_valid && (
                  <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Both files passed validation.
                  </div>
                )}

                <div className="space-y-4">
                  {renderCsvPreviewSection(validationResult?.input_file, 'Input Data CSV')}
                  {renderCsvPreviewSection(validationResult?.questions_file, 'Criteria / Questions CSV')}
                </div>

              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/executions/create/upload?executionId=${executionId}`)}
              >
                Back To Upload
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canStartActions || validationRunning || startingAnalysis}
                  onClick={() => navigate('/executions')}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!canStartActions || validationRunning || startingAnalysis}
                  onClick={() => void handleStartAnalysis()}
                >
                  {startingAnalysis ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start Analysis
                    </>
                  )}
                </Button>
              </div>
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

export default ExecutionValidate;
