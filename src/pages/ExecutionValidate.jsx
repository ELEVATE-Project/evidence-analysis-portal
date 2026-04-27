import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, PlayCircle, RefreshCw, Save, XCircle } from 'lucide-react';
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
      // Success message shown in the detailed banner above
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
      // Success message shown in the detailed banner above
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
      <Card className={`border-2 shadow-sm transition-all duration-200 ${
        isValid 
          ? 'border-emerald-200 bg-white hover:shadow-md' 
          : 'border-rose-200 bg-white'
      }`}>
        <CardContent className="p-5 space-y-4">
          {/* Header with title and status badge */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{sectionTitle}</h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                isValid
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}
            >
              {isValid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {isValid ? 'Validated' : 'Invalid'}
            </span>
          </div>

          {/* Validation message */}
          <div
            className={`rounded-lg border-2 p-4 ${
              isValid
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-rose-200 bg-rose-50/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {isValid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-medium leading-relaxed ${
                isValid ? 'text-emerald-900' : 'text-rose-900'
              }`}>
                {fileResult?.message || 'No validation details available yet.'}
              </p>
            </div>
          </div>

          {/* File statistics */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Rows:</span>
              <span className="font-mono text-blue-600">
                {rowsDetected !== null ? rowsDetected.toLocaleString() : '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Columns:</span>
              <span className="font-mono text-blue-600">{columns.length}</span>
            </div>
          </div>

          {/* CSV Preview Table */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Data Preview (First 10 Rows)</p>
            </div>
            {columns.length > 0 ? (
              <div className="overflow-x-auto bg-white">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 border-r border-slate-200">
                        #
                      </th>
                      {columns.map((column) => (
                        <th
                          key={`${sectionTitle}-head-${column}`}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.length > 0 ? (
                      previewRows.map((row, rowIndex) => (
                        <tr key={`${sectionTitle}-row-${rowIndex}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-4 py-3 text-xs font-medium text-slate-500 border-r border-slate-200 group-hover:bg-slate-50/50">
                            {rowIndex + 1}
                          </td>
                          {columns.map((column) => (
                            <td
                              key={`${sectionTitle}-cell-${rowIndex}-${column}`}
                              className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap min-w-[160px]"
                            >
                              {row?.[column] || <span className="text-slate-400">-</span>}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-sm text-slate-500">
                          No sample data rows available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500 bg-white">
                Preview unavailable until a valid header row is detected.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!executionId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <ExecutionWizardStepper activeStep={3} />
            
            <div className="rounded-lg border-2 border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-900">Missing Execution ID</p>
                  <p className="text-sm text-rose-700 mt-1">
                    Please complete the previous steps first to continue with validation.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <Button 
                type="button" 
                onClick={() => navigate('/executions/create')}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go To Create Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <ExecutionWizardStepper activeStep={3} />
          
          <div className="mt-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Validate & Run</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review and validate your uploaded files, then start the analysis when ready.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Validation Action Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">File Validation</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Click the button below to validate your uploaded files
              </p>
            </div>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              disabled={validationRunning || startingAnalysis}
              onClick={() => void runValidation(true)}
            >
              {validationRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Validate Files
                </>
              )}
            </Button>
          </div>

          {/* Success Banner */}
          {validationResult?.is_valid && (
            <div className="rounded-lg border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-50/50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-100 p-1">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-emerald-900">Validation Successful!</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    Both files have been validated successfully and are ready for processing. You can now start the analysis or save as draft.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Preview Sections */}
          {validationResult && (
            <div className="space-y-5 pt-2">
              {renderCsvPreviewSection(validationResult?.input_file, 'Input Data CSV')}
              {renderCsvPreviewSection(validationResult?.questions_file, 'Criteria / Questions CSV')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Section */}
      <Card className="border-2 border-slate-200 bg-slate-50 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/executions/create/upload?executionId=${executionId}`)}
              className="w-full border-slate-300 text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:shadow sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Upload
            </Button>
            
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                disabled={!canStartActions || validationRunning || startingAnalysis}
                onClick={() => navigate('/executions')}
                className="w-full border-slate-300 text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:shadow sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                Save as Draft
              </Button>
              <Button
                type="button"
                className="w-full bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg sm:w-auto"
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
        </CardContent>
      </Card>

      {/* Error and Success Messages */}
      {globalError && (
        <Card className="border-2 border-rose-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-900">{globalError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {globalSuccess && (
        <Card className="border-2 border-emerald-300 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-900">{globalSuccess}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExecutionValidate;
