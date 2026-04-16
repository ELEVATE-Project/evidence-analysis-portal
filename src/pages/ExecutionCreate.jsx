import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FileSpreadsheet, ListChecks, PlayCircle, RefreshCw, UploadCloud } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { entityService, executionService } from '../services/executionService';

const steps = [
  {
    title: 'Upload Input Data',
    description: 'Add the evidence input CSV for the selected program scope.',
    icon: FileSpreadsheet,
  },
  {
    title: 'Upload Criteria File',
    description: 'Attach the criteria/questions CSV used for analysis evaluation.',
    icon: ListChecks,
  },
  {
    title: 'Start Analysis Run',
    description: 'Submit and monitor progress from Dashboard and View Analyses.',
    icon: PlayCircle,
  },
];

const ExecutionCreate = () => {
  const navigate = useNavigate();

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [stateError, setStateError] = useState('');
  const [districtError, setDistrictError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState('');

  const [formValues, setFormValues] = useState({
    name: '',
    stateId: '',
    stateName: '',
    districtId: '',
    districtName: '',
    programName: '',
    inputFile: null,
    questionsFile: null,
  });

  const stateOptionMap = useMemo(() => {
    return new Map(states.map((stateItem) => [stateItem.id, stateItem]));
  }, [states]);

  const districtOptionMap = useMemo(() => {
    return new Map(districts.map((districtItem) => [districtItem.id, districtItem]));
  }, [districts]);

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

  const handleTextChange = (event) => {
    const { name, value } = event.target;
    setSubmitError('');
    setCreatedId('');
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleStateChange = (event) => {
    const selectedStateId = event.target.value;
    const selectedState = stateOptionMap.get(selectedStateId);

    setSubmitError('');
    setCreatedId('');
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

    setSubmitError('');
    setCreatedId('');
    setFormValues((current) => ({
      ...current,
      districtId: selectedDistrictId,
      districtName: selectedDistrict?.name || '',
    }));
  };

  const handleFileChange = (event) => {
    const { name, files } = event.target;
    setSubmitError('');
    setCreatedId('');
    setFormValues((current) => ({
      ...current,
      [name]: files?.[0] || null,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setCreatedId('');

    if (!formValues.name.trim()) {
      setSubmitError('Analysis name is required.');
      return;
    }

    if (!formValues.stateId) {
      setSubmitError('Please select a state.');
      return;
    }

    if (districts.length > 0 && !formValues.districtId) {
      setSubmitError('Please select a district.');
      return;
    }

    if (!formValues.inputFile) {
      setSubmitError('Input CSV file is required.');
      return;
    }

    if (!formValues.questionsFile) {
      setSubmitError('Criteria/questions CSV file is required.');
      return;
    }

    const payload = new FormData();
    payload.append('name', formValues.name.trim());
    payload.append('state', formValues.stateName);

    if (formValues.districtName) {
      payload.append('district', formValues.districtName);
    }

    if (formValues.programName.trim()) {
      payload.append('program_name', formValues.programName.trim());
    }

    payload.append('input_file', formValues.inputFile);
    payload.append('questions_file', formValues.questionsFile);

    setSubmitting(true);

    try {
      const createdExecution = await executionService.createExecution(payload);
      const executionId = createdExecution?.id || '';
      setCreatedId(executionId);
      navigate('/executions');
    } catch (error) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to create analysis run. Please retry.';
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold text-slate-800">Start Analysis Run</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a new analysis run by uploading required files and selecting metadata.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">Run Setup</CardTitle>
          <CardDescription>
            Configure metadata and upload required files to start a new analysis run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="rounded-md border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="mb-3 inline-flex rounded-md border border-blue-100 bg-blue-50 p-2 text-blue-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">{step.description}</p>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">
                  Analysis Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formValues.name}
                  onChange={handleTextChange}
                  placeholder="Enter analysis run name"
                  className="border-slate-300 bg-white text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="programName" className="text-slate-700">
                  Program Name (Optional)
                </Label>
                <Input
                  id="programName"
                  name="programName"
                  value={formValues.programName}
                  onChange={handleTextChange}
                  placeholder="Enter program name"
                  className="border-slate-300 bg-white text-slate-800"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">State</span>
                <select
                  name="state"
                  value={formValues.stateId}
                  onChange={handleStateChange}
                  disabled={statesLoading}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">
                    {statesLoading ? 'Loading states...' : 'Select state'}
                  </option>
                  {states.map((stateItem) => (
                    <option key={stateItem.id} value={stateItem.id}>
                      {stateItem.name}
                    </option>
                  ))}
                </select>
                {stateError && <p className="text-xs text-rose-700">{stateError}</p>}
                {stateError && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => void loadStates()}
                    disabled={statesLoading}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${statesLoading ? 'animate-spin' : ''}`} />
                    Retry States
                  </Button>
                )}
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">District</span>
                <select
                  name="district"
                  value={formValues.districtId}
                  onChange={handleDistrictChange}
                  disabled={!formValues.stateId || districtsLoading}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">
                    {!formValues.stateId
                      ? 'Select state first'
                      : districtsLoading
                        ? 'Loading districts...'
                        : 'Select district'}
                  </option>
                  {districts.map((districtItem) => (
                    <option key={districtItem.id} value={districtItem.id}>
                      {districtItem.name}
                    </option>
                  ))}
                </select>
                {districtError && <p className="text-xs text-rose-700">{districtError}</p>}
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inputFile" className="text-slate-700">
                  Input Data CSV
                </Label>
                <Input
                  id="inputFile"
                  name="inputFile"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="border-slate-300 bg-white text-slate-800 file:cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="questionsFile" className="text-slate-700">
                  Criteria / Questions CSV
                </Label>
                <Input
                  id="questionsFile"
                  name="questionsFile"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="border-slate-300 bg-white text-slate-800 file:cursor-pointer"
                />
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {createdId && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Analysis run created successfully: {createdId}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={submitting || statesLoading || !states.length}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start Analysis Run
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={() => navigate('/executions')}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>

          <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-4">
            <div className="flex items-start gap-3 text-slate-600">
              <UploadCloud className="mt-0.5 h-4 w-4 text-blue-600" />
              <div className="text-xs">
                <p className="font-medium text-slate-700">Data source policy</p>
                <p className="mt-1">
                  States and districts are fetched only from backend APIs (`/api/v1/states`, `/api/v1/districts`)
                  and never from Entity Management service directly in the browser.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionCreate;
