import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { executionService } from '../services/executionService';
import ExecutionWizardStepper from '../components/executions/ExecutionWizardStepper';

const ExecutionRun = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const executionId = (searchParams.get('executionId') || '').trim();

  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [loadingExecution, setLoadingExecution] = useState(true);
  const [execution, setExecution] = useState(null);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  useEffect(() => {
    if (executionId) {
      void loadExecution();
    }
  }, [executionId]);

  const loadExecution = async () => {
    setLoadingExecution(true);
    try {
      const executionData = await executionService.getExecution(executionId);
      setExecution(executionData);
      
      // Check if files are validated
      if (executionData.status === 'draft') {
        setGlobalError('Files are not validated. Please upload and validate files before starting analysis.');
      }
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to load execution.';
      setGlobalError(typeof message === 'string' ? message : 'Failed to load execution.');
    } finally {
      setLoadingExecution(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!executionId) {
      setGlobalError('Missing execution id. Please complete previous steps first.');
      return;
    }

    setStartingAnalysis(true);
    setGlobalError('');
    setGlobalSuccess('');
    try {
      await executionService.startExecution(executionId);
      setGlobalSuccess('Analysis queued successfully. Processing has started.');
      setTimeout(() => {
        navigate('/executions');
      }, 1500);
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to start analysis.';
      setGlobalError(typeof message === 'string' ? message : 'Failed to start analysis.');
    } finally {
      setStartingAnalysis(false);
    }
  };

  if (!executionId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-4 sm:p-6">
            <ExecutionWizardStepper activeStep={4} />
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <span className="font-semibold">Missing execution id. </span>
              Please complete previous steps first.
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
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <ExecutionWizardStepper activeStep={4} />

          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Run Analysis</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review your execution details and start the analysis run when ready.
            </p>
          </div>

          {loadingExecution ? (
            <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-8">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-slate-600">Loading execution details...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Analysis Details</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Your files should already be uploaded and validated. Start the run to begin processing.
                </p>

                {execution && (
                  <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="font-medium text-slate-700">Analysis: </span>
                        <span className="text-slate-600">{execution.name}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-700">Status: </span>
                        <span className={`capitalize ${
                          execution.status === 'validated' ? 'text-emerald-600 font-medium' :
                          execution.status === 'draft' ? 'text-amber-600 font-medium' :
                          'text-slate-600'
                        }`}>
                          {execution.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(`/executions/create/upload?executionId=${executionId}`)}
                  className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Back To Upload
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
                  disabled={startingAnalysis || execution?.status !== 'validated'}
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
          )}

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
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionRun;
