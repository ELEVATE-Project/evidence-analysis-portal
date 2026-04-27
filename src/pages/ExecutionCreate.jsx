import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ENV } from '../config/env';
import { entityService, executionService } from '../services/executionService';
import ExecutionWizardStepper from '../components/executions/ExecutionWizardStepper';

const DEFAULT_CSV_TYPE_ID = ENV.DEFAULT_CSV_TYPE_ID;

const ExecutionCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const executionIdFromUrl = searchParams.get('executionId');

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [stateError, setStateError] = useState('');
  const [districtError, setDistrictError] = useState('');
  const [creatingAnalysis, setCreatingAnalysis] = useState(false);
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [executionId, setExecutionId] = useState(executionIdFromUrl || '');
  const [isEditMode, setIsEditMode] = useState(false);
  const [prefillLoaded, setPrefillLoaded] = useState(false);

  const [formValues, setFormValues] = useState({
    name: '',
    stateId: '',
    stateName: '',
    districtId: '',
    districtName: '',
  });

  const stateOptionMap = useMemo(() => new Map(states.map((stateItem) => [stateItem.id, stateItem])), [states]);
  const districtOptionMap = useMemo(
    () => new Map(districts.map((districtItem) => [districtItem.id, districtItem])),
    [districts]
  );

  const loadStates = async () => {
    setStatesLoading(true);
    setStateError('');
    try {
      const stateItems = await entityService.getStates();
      setStates(stateItems);
    } catch (error) {
      setStates([]);
      setStateError(error?.message || 'Unable to load states. Please try again.');
    } finally {
      setStatesLoading(false);
    }
  };

  const loadDistricts = async (stateId) => {
    if (!stateId) {
      setDistricts([]);
      return;
    }
    setDistrictsLoading(true);
    setDistrictError('');
    try {
      const districtItems = await entityService.getDistricts(stateId);
      setDistricts(districtItems);
    } catch (error) {
      setDistricts([]);
      setDistrictError(error?.message || 'Unable to load districts for selected state.');
    } finally {
      setDistrictsLoading(false);
    }
  };

  useEffect(() => {
    void loadStates();
  }, []);

  useEffect(() => {
    if (executionIdFromUrl) {
      void loadExecution(executionIdFromUrl);
      return;
    }
    setIsEditMode(false);
    setExecutionId('');
    setPrefillLoaded(false);
    setFormValues({
      name: '',
      stateId: '',
      stateName: '',
      districtId: '',
      districtName: '',
    });
  }, [executionIdFromUrl]);

  const loadExecution = async (id) => {
    setLoadingExecution(true);
    setGlobalError('');
    setPrefillLoaded(false);
    setIsEditMode(false);
    setDistricts([]);
    try {
      const execution = await executionService.getExecution(id);
      
      if (!['draft', 'validated'].includes((execution.status || '').toLowerCase())) {
        setGlobalError('Only draft or validated executions can be edited.');
        return;
      }

      setIsEditMode(true);
      setExecutionId(id);
      setFormValues({
        name: execution.name || '',
        stateId: '',
        stateName: execution.state || '',
        districtId: '',
        districtName: execution.district || '',
      });
      setPrefillLoaded(true);
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to load execution.';
      setGlobalError(typeof message === 'string' ? message : 'Failed to load execution.');
    } finally {
      setLoadingExecution(false);
    }
  };

  useEffect(() => {
    if (!isEditMode || !prefillLoaded || !formValues.stateName || formValues.stateId || states.length === 0) {
      return;
    }

    const matchingState = states.find((stateItem) => stateItem.name === formValues.stateName);
    if (!matchingState) {
      return;
    }

    setFormValues((current) => ({
      ...current,
      stateId: matchingState.id,
      stateName: matchingState.name,
    }));
    void loadDistricts(matchingState.id);
  }, [formValues.stateId, formValues.stateName, isEditMode, prefillLoaded, states]);

  // Effect to set district ID after districts are loaded
  useEffect(() => {
    if (isEditMode && formValues.districtName && districts.length > 0 && !formValues.districtId) {
      const matchingDistrict = districts.find(d => d.name === formValues.districtName);
      if (matchingDistrict) {
        setFormValues(prev => ({
          ...prev,
          districtId: matchingDistrict.id,
        }));
      }
    }
  }, [districts, formValues.districtName, isEditMode, formValues.districtId]);

  const handleTextChange = (event) => {
    const { name, value } = event.target;
    setGlobalError('');
    setGlobalSuccess('');
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleStateChange = (event) => {
    const selectedStateId = event.target.value;
    const selectedState = stateOptionMap.get(selectedStateId);

    setGlobalError('');
    setGlobalSuccess('');
    setDistrictError('');
    setDistricts([]);
    setFormValues((current) => ({
      ...current,
      stateId: selectedStateId,
      stateName: selectedState?.name || '',
      districtId: '',
      districtName: '',
    }));

    if (selectedStateId) {
      void loadDistricts(selectedStateId);
    }
  };

  const handleDistrictChange = (event) => {
    const selectedDistrictId = event.target.value;
    const selectedDistrict = districtOptionMap.get(selectedDistrictId);

    setGlobalError('');
    setGlobalSuccess('');
    setFormValues((current) => ({
      ...current,
      districtId: selectedDistrictId,
      districtName: selectedDistrict?.name || '',
    }));
  };

  const validateCreateForm = () => {
    if (!formValues.name.trim()) {
      setGlobalError('Analysis name is required.');
      return false;
    }
    if (!formValues.stateId) {
      setGlobalError('Please select a state.');
      return false;
    }
    if (districts.length > 0 && !formValues.districtId) {
      setGlobalError('Please select a district.');
      return false;
    }
    return true;
  };

  const createDraft = async () => {
    setGlobalError('');
    setGlobalSuccess('');
    if (!validateCreateForm()) return null;

    setCreatingAnalysis(true);
    try {
      if (isEditMode && executionId) {
        // Update existing draft
        const response = await executionService.updateExecution(executionId, {
          name: formValues.name.trim(),
          state: formValues.stateName,
          district: formValues.districtName || null,
        });
        setGlobalSuccess('Analysis updated successfully.');
        return response?.id || executionId;
      } else {
        // Create new draft
        const response = await executionService.createExecutionDraft({
          name: formValues.name.trim(),
          csv_type_id: DEFAULT_CSV_TYPE_ID,
          state: formValues.stateName,
          district: formValues.districtName || undefined,
        });
        const id = response?.id || '';
        setExecutionId(id);
        setGlobalSuccess('Analysis created successfully.');
        return id;
      }
    } catch (error) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to save analysis.';
      setGlobalError(typeof message === 'string' ? message : 'Failed to save analysis.');
      return null;
    } finally {
      setCreatingAnalysis(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (executionId && !isEditMode) {
      setGlobalSuccess('Analysis draft already created.');
      return;
    }
    await createDraft();
  };

  const handleSaveAndProceed = async () => {
    let id = executionId;
    if (isEditMode || !id) {
      id = await createDraft();
    }
    if (id) {
      navigate(`/executions/create/upload?executionId=${id}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Card className="border-2 border-slate-200 bg-white shadow-md">
        <CardContent className="space-y-8 p-8">
          <ExecutionWizardStepper activeStep={1} />

          <div className="border-b border-slate-200 pb-6">
            <h2 className="text-3xl font-bold text-slate-900">
              {isEditMode ? 'Edit Analysis' : 'Create Analysis'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {isEditMode ? 'Update your analysis details below' : 'Set up a new evidence analysis execution'}
            </p>
          </div>

          {loadingExecution ? (
            <Card className="border-2 border-slate-200">
              <CardContent className="p-12">
                <div className="flex items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="text-base text-slate-600">Loading execution details...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-slate-200 shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Analysis Details
                    </h3>
                    <p className="text-sm text-slate-600">
                      {isEditMode ? 'Update' : 'Provide'} the analysis configuration
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold text-slate-900">
                      Analysis Name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formValues.name}
                      onChange={handleTextChange}
                      placeholder="Enter analysis run name"
                      className="border-slate-300 bg-white text-slate-800 transition-colors hover:border-blue-400 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-900">State</Label>
                      <select
                        value={formValues.stateId}
                        onChange={handleStateChange}
                        disabled={statesLoading}
                        className="h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm text-slate-800 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">{statesLoading ? 'Loading states...' : 'Select state'}</option>
                        {states.map((stateItem) => (
                          <option key={stateItem.id} value={stateItem.id}>
                            {stateItem.name}
                          </option>
                        ))}
                      </select>
                      {stateError && (
                        <p className="flex items-center gap-1 text-xs text-rose-700">
                          <AlertCircle className="h-3 w-3" />
                          {stateError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-900">District</Label>
                      <select
                        value={formValues.districtId}
                        onChange={handleDistrictChange}
                        disabled={!formValues.stateId || districtsLoading}
                        className="h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm text-slate-800 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">
                          {!formValues.stateId ? 'Select state first' : districtsLoading ? 'Loading districts...' : 'Select district'}
                        </option>
                        {districts.map((districtItem) => (
                          <option key={districtItem.id} value={districtItem.id}>
                            {districtItem.name}
                          </option>
                        ))}
                      </select>
                      {districtError && (
                        <p className="flex items-center gap-1 text-xs text-rose-700">
                          <AlertCircle className="h-3 w-3" />
                          {districtError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Card className="border-2 border-slate-200 bg-slate-50">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => navigate('/executions')}
                        className="w-full shadow-sm transition-all hover:shadow sm:w-auto"
                      >
                        Cancel
                      </Button>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button 
                          type="button" 
                          variant="outline" 
                          disabled={creatingAnalysis} 
                          onClick={() => void handleSaveAsDraft()}
                          className="w-full shadow-sm transition-all hover:shadow sm:w-auto"
                        >
                          {creatingAnalysis ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            isEditMode ? 'Update Draft' : 'Save as Draft'
                          )}
                        </Button>
                        <Button
                          type="button"
                          className="w-full bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg sm:w-auto"
                          disabled={creatingAnalysis}
                          onClick={() => void handleSaveAndProceed()}
                        >
                          {creatingAnalysis ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              {isEditMode ? 'Update & Proceed' : 'Save & Proceed'}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {globalError && (
            <Card className="border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white">
                    <AlertCircle className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-rose-900">Error</h4>
                    <p className="mt-1 text-sm text-rose-700">{globalError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {globalSuccess && (
            <Card className="border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-900">{globalSuccess}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionCreate;
