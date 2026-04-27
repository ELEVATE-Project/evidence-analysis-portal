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
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header with title and status badge */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">{sectionTitle}</h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold self-start ${
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
            className={`rounded-md border px-3 py-2.5 text-sm ${
              isValid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {fileResult?.message || 'No validation details available yet.'}
          </div>

          {/* File statistics */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500">Rows:</span>
              <span className="font-semibold text-blue-600">
                {rowsDetected !== null ? rowsDetected.toLocaleString() : '-'}
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-500">Columns:</span>
              <span className="font-semibold text-blue-600">{columns.length}</span>
            </div>
          </div>

          {/* Desktop CSV Preview Table */}
          <div className="hidden md:block overflow-x-auto rounded-md border border-slate-200 bg-white">
            {columns.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 font-semibold border-r border-slate-200">
                      #
                    </th>
                    {columns.map((column) => (
                      <th
                        key={`${sectionTitle}-head-${column}`}
                        className="px-3 py-2.5 font-semibold whitespace-nowrap"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previewRows.length > 0 ? (
                    previewRows.map((row, rowIndex) => (
                      <tr key={`${sectionTitle}-row-${rowIndex}`} className="hover:bg-slate-50 transition-colors duration-150">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-slate-500 font-medium border-r border-slate-200 hover:bg-slate-50 transition-colors">
                          {rowIndex + 1}
                        </td>
                        {columns.map((column) => (
                          <td
                            key={`${sectionTitle}-cell-${rowIndex}-${column}`}
                            className="px-3 py-2.5 text-slate-700 whitespace-nowrap min-w-[140px]"
                          >
                            {row?.[column] || <span className="text-slate-400">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-sm text-slate-500">
                        No sample data rows available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                Preview unavailable until a valid header row is detected.
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {columns.length > 0 && previewRows.length > 0 ? (
              previewRows.map((row, rowIndex) => (
                <div
                  key={`${sectionTitle}-mobile-row-${rowIndex}`}
                  className="rounded-md border border-slate-200 bg-white p-3 space-y-2 hover:bg-slate-50 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-800">Row {rowIndex + 1}</span>
                  </div>
                  {columns.map((column) => (
                    <div key={`${sectionTitle}-mobile-cell-${rowIndex}-${column}`} className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-500">{column}</span>
                      <span className="text-sm text-slate-700 break-words">{row?.[column] || '-'}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-500">
                  {columns.length === 0 ? 'Preview unavailable until a valid header row is detected.' : 'No sample data rows available.'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!executionId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-4 sm:p-6">
            <ExecutionWizardStepper activeStep={3} />
            
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <span className="font-semibold">Missing execution id. </span>
              Please complete the previous steps first to continue with validation.
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <ExecutionWizardStepper activeStep={3} />
          
          <div className="mt-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Validate & Run</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review and validate your uploaded files, then start the analysis when ready.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Validation Action Section */}
      <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800">File Validation</h3>
              <p className="text-sm text-slate-600 mt-0.5">
                Click the button below to validate your uploaded files
              </p>
            </div>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
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
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <span className="font-semibold">Validation successful! </span>
              Both files have been validated successfully and are ready for processing. You can now start the analysis or save as draft.
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
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:justify-between rounded-md border border-slate-200 bg-slate-50 p-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/executions/create/upload?executionId=${executionId}`)}
          className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Upload
        </Button>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canStartActions || validationRunning || startingAnalysis}
            onClick={() => navigate('/executions')}
            className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Save className="mr-2 h-4 w-4" />
            Save as Draft
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
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

      {/* Error and Success Messages */}
      {globalError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <span className="font-semibold">Error: </span>
          {globalError}
        </div>
      )}

      {globalSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <span className="font-semibold">Success: </span>
          {globalSuccess}
        </div>
      )}
    </div>
  );
};

export default ExecutionValidate;
