import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, ChevronDown, FileText, Info, RefreshCw, X } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ENV } from '../config/env';
import { configService, entityService, executionService, getApiErrorMessage } from '../services/executionService';
import ExecutionWizardStepper from '../components/executions/ExecutionWizardStepper';

const DEFAULT_CSV_TYPE_ID = ENV.DEFAULT_CSV_TYPE_ID;

const ExecutionCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const executionIdFromUrl = searchParams.get('executionId');

  const [states, setStates] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [stateError, setStateError] = useState('');
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const stateDropdownRef = useRef(null);
  const [evidenceTypeOptions, setEvidenceTypeOptions] = useState([]);
  const [evidenceTypesLoading, setEvidenceTypesLoading] = useState(false);
  const [evidenceTypeError, setEvidenceTypeError] = useState('');
  const [creatingAnalysis, setCreatingAnalysis] = useState(false);
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [executionId, setExecutionId] = useState(executionIdFromUrl || '');
  const [isEditMode, setIsEditMode] = useState(false);

  const allEvidenceTypeKeys = useMemo(
    () => evidenceTypeOptions.map((evidenceType) => evidenceType.key),
    [evidenceTypeOptions]
  );

  const [formValues, setFormValues] = useState({
    name: '',
    selectedStateNames: [],
    selectedEvidenceTypes: [],
    evidenceThreshold: '',
  });

  useEffect(() => {
    void loadStates();
    void loadEvidenceTypes();
  }, []);

  useEffect(() => {
    if (executionIdFromUrl) {
      void loadExecution(executionIdFromUrl);
    }
  }, [executionIdFromUrl]);

  useEffect(() => {
    if (!executionIdFromUrl) {
      setIsEditMode(false);
      setExecutionId('');
      setFormValues({ name: '', selectedStateNames: [], selectedEvidenceTypes: allEvidenceTypeKeys, evidenceThreshold: '' });
    }
  }, [executionIdFromUrl, allEvidenceTypeKeys]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) {
        setStateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadStates = async () => {
    setStatesLoading(true);
    setStateError('');
    try {
      const stateItems = await entityService.getStates();
      setStates(stateItems);
    } catch (error) {
      setStates([]);
      setStateError(getApiErrorMessage(error, 'Unable to load states. Please try again.'));
    } finally {
      setStatesLoading(false);
    }
  };

  const loadEvidenceTypes = async () => {
    setEvidenceTypesLoading(true);
    setEvidenceTypeError('');
    try {
      const items = await configService.listEvidenceTypes();
      setEvidenceTypeOptions(items);
      return items;
    } catch (error) {
      setEvidenceTypeOptions([]);
      setEvidenceTypeError(getApiErrorMessage(error, 'Unable to load evidence types. Please try again.'));
      return [];
    } finally {
      setEvidenceTypesLoading(false);
    }
  };

  const loadExecution = async (id) => {
    setLoadingExecution(true);
    setGlobalError('');
    setIsEditMode(false);
    try {
      const execution = await executionService.getExecution(id);

      if (!['draft', 'validated'].includes((execution.status || '').toLowerCase())) {
        setGlobalError('Only draft or validated executions can be edited.');
        return;
      }

      // Resolve the unrestricted default independently of evidenceTypeOptions state,
      // which may not have finished loading yet.
      const knownKeys = evidenceTypeOptions.length > 0 ? evidenceTypeOptions : await loadEvidenceTypes();
      const allKeys = knownKeys.map((evidenceType) => evidenceType.key);

      setIsEditMode(true);
      setExecutionId(id);
      setFormValues({
        name: execution.name || '',
        selectedStateNames: Array.isArray(execution.states) ? execution.states : [],
        selectedEvidenceTypes: execution.processing_config?.evidence_types || allKeys,
        evidenceThreshold: typeof execution.threshold_config?.max_relevant_per_user_task === 'number'
          ? String(execution.threshold_config.max_relevant_per_user_task)
          : '',
      });
    } catch (error) {
      setGlobalError(getApiErrorMessage(error, 'Failed to load execution.'));
    } finally {
      setLoadingExecution(false);
    }
  };

  const handleTextChange = (event) => {
    const { name, value } = event.target;
    setGlobalError('');
    setGlobalSuccess('');
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleStateToggle = (stateName) => {
    setGlobalError('');
    setGlobalSuccess('');
    setFormValues((current) => {
      const next = current.selectedStateNames.includes(stateName)
        ? current.selectedStateNames.filter((s) => s !== stateName)
        : [...current.selectedStateNames, stateName];
      return { ...current, selectedStateNames: next };
    });
  };

  const handleEvidenceTypeToggle = (evidenceTypeKey) => {
    setGlobalError('');
    setGlobalSuccess('');
    setFormValues((current) => {
      const next = current.selectedEvidenceTypes.includes(evidenceTypeKey)
        ? current.selectedEvidenceTypes.filter((key) => key !== evidenceTypeKey)
        : [...current.selectedEvidenceTypes, evidenceTypeKey];
      return { ...current, selectedEvidenceTypes: next };
    });
  };

  const validateCreateForm = () => {
    if (!formValues.name.trim()) {
      setGlobalError('Analysis name is required.');
      return false;
    }
    if (formValues.selectedStateNames.length === 0) {
      setGlobalError('Please select at least one state.');
      return false;
    }
    if (formValues.selectedEvidenceTypes.length === 0) {
      setGlobalError('Please select at least one evidence type.');
      return false;
    }
    if (formValues.evidenceThreshold !== '') {
      const n = Number(formValues.evidenceThreshold);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        setGlobalError('Evidence threshold must be a whole number between 1 and 10.');
        return false;
      }
    }
    return true;
  };

  const createDraft = async () => {
    setGlobalError('');
    setGlobalSuccess('');
    if (!validateCreateForm()) return null;

    setCreatingAnalysis(true);
    try {
      // Number() here matches the parser used in validateCreateForm — parseInt() would
      // silently disagree on inputs like "2e1" (parseInt -> 2, Number -> 20).
      const thresholdValue = formValues.evidenceThreshold !== ''
        ? Number(formValues.evidenceThreshold)
        : undefined;

      if (isEditMode && executionId) {
        // Update existing draft. evidence_types is always sent so an update can clear
        // a prior restriction by re-checking all types. evidence_threshold is always
        // included (as a number or null) so clearing the field explicitly removes a
        // previously-set threshold — PATCH semantics mean an omitted key would
        // otherwise leave the old value intact.
        const updatePayload = {
          name: formValues.name.trim(),
          states: formValues.selectedStateNames,
          evidence_types: formValues.selectedEvidenceTypes,
          evidence_threshold: thresholdValue !== undefined ? thresholdValue : null,
        };
        const response = await executionService.updateExecution(executionId, updatePayload);
        setGlobalSuccess('Analysis updated successfully.');
        return response?.id || executionId;
      } else {
        // evidence_types is always sent, even when every type is checked — the backend
        // requires it (fail loud on a missing filter instead of silently processing
        // every type).
        const response = await executionService.createExecutionDraft({
          name: formValues.name.trim(),
          csv_type_id: DEFAULT_CSV_TYPE_ID,
          states: formValues.selectedStateNames,
          evidence_types: formValues.selectedEvidenceTypes,
          ...(thresholdValue !== undefined ? { evidence_threshold: thresholdValue } : {}),
        });
        const id = response?.id || '';
        setExecutionId(id);
        setGlobalSuccess('Analysis created successfully.');
        return id;
      }
    } catch (error) {
      setGlobalError(getApiErrorMessage(error, 'Failed to save analysis.'));
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
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <ExecutionWizardStepper activeStep={1} />

          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">
              {isEditMode ? 'Edit Analysis' : 'Create Analysis'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isEditMode ? 'Update your analysis details below' : 'Set up a new evidence analysis execution'}
            </p>
          </div>

          {loadingExecution ? (
            <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-8">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-slate-600">Loading execution details...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 border border-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">
                      Analysis Details
                    </h3>
                    <p className="text-xs text-slate-600">
                      {isEditMode ? 'Update' : 'Provide'} the analysis configuration
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-slate-800">
                    Analysis Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formValues.name}
                    onChange={handleTextChange}
                    placeholder="Enter analysis run name"
                    className="border-slate-300 bg-white text-slate-800 hover:border-blue-400 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-800">State</Label>
                  <div className="relative" ref={stateDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setStateDropdownOpen((prev) => !prev)}
                      disabled={statesLoading}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 hover:border-blue-400 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 flex items-center justify-between"
                    >
                      <span className="truncate text-left">
                        {statesLoading
                          ? 'Loading states...'
                          : formValues.selectedStateNames.length === 0
                            ? 'Select states'
                            : `${formValues.selectedStateNames.length} state${formValues.selectedStateNames.length > 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-500 shrink-0 ml-2" />
                    </button>
                    {stateDropdownOpen && states.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                        <div className="max-h-48 overflow-y-auto py-1">
                          {states.map((stateItem) => (
                            <label
                              key={stateItem.id}
                              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formValues.selectedStateNames.includes(stateItem.name)}
                                onChange={() => handleStateToggle(stateItem.name)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                              />
                              <span className="text-sm text-slate-700">{stateItem.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {formValues.selectedStateNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {formValues.selectedStateNames.map((stateName) => (
                        <span
                          key={stateName}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                        >
                          {stateName}
                          <button
                            type="button"
                            aria-label={`Remove ${stateName}`}
                            onClick={() => handleStateToggle(stateName)}
                            className="hover:text-blue-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {stateError && (
                    <p className="flex items-center gap-1 text-xs text-rose-700">
                      <AlertCircle className="h-3 w-3" />
                      {stateError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-800">Evidence Types</Label>
                  {evidenceTypesLoading ? (
                    <p className="text-sm text-slate-500">Loading evidence types...</p>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {evidenceTypeOptions.map((evidenceType) => (
                        <label
                          key={evidenceType.key}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formValues.selectedEvidenceTypes.includes(evidenceType.key)}
                            onChange={() => handleEvidenceTypeToggle(evidenceType.key)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <span className="text-sm text-slate-700">{evidenceType.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Leave all checked to validate every evidence type. Uncheck to restrict analysis to specific types.
                  </p>
                  {evidenceTypeError && (
                    <p className="flex items-center gap-1 text-xs text-rose-700">
                      <AlertCircle className="h-3 w-3" />
                      {evidenceTypeError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="evidenceThreshold" className="text-sm font-semibold text-slate-800">
                      Maximum Valid Evidences{' '}
                      <span className="font-normal text-slate-500">(optional)</span>
                    </Label>
                    <span className="group relative inline-flex">
                      <button
                        type="button"
                        aria-label="What is Maximum Valid Evidences?"
                        className="rounded-full text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-md bg-slate-800 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        Once this number of valid evidences is reached for a task, no further evidences will be checked for that user. Leave blank to evaluate all rows.
                      </span>
                    </span>
                  </div>
                  <Input
                    id="evidenceThreshold"
                    name="evidenceThreshold"
                    type="number"
                    min={1}
                    max={10}
                    value={formValues.evidenceThreshold}
                    onChange={handleTextChange}
                    placeholder="e.g. 3"
                    className="border-slate-300 bg-white text-slate-800 hover:border-blue-400 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:justify-between rounded-md border border-slate-200 bg-slate-50 p-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/executions')}
                  className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    disabled={creatingAnalysis} 
                    onClick={() => void handleSaveAsDraft()}
                    className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100"
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
                    className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700"
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

export default ExecutionCreate;
