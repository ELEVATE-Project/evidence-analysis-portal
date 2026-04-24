import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, FileText, Filter, Loader2, Pencil, PlayCircle, RefreshCw, Search } from 'lucide-react';
import { entityService, executionService, getApiErrorMessage, reportService } from '../services/executionService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { formatDateTime, getAnalysisStatusGroup, getAnalysisStatusMeta } from '../lib/analysis';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];
const PAGE_SIZE = 10;

const toSortedUniqueOptions = (values) => {
  const normalizedValues = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return [...new Set(normalizedValues)].sort((first, second) => first.localeCompare(second));
};

const ExecutionList = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadingExecutionId, setDownloadingExecutionId] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [stateError, setStateError] = useState('');
  const [districtError, setDistrictError] = useState('');

  const [filters, setFilters] = useState({
    status: 'all',
    state: 'all',
    district: 'all',
  });

  const [searchQuery, setSearchQuery] = useState('');

  const analysisStateOptions = useMemo(() => {
    return toSortedUniqueOptions(analyses.map((analysis) => analysis.state));
  }, [analyses]);

  const analysisDistrictOptions = useMemo(() => {
    const scopedAnalyses =
      filters.state === 'all'
        ? analyses
        : analyses.filter((analysis) => analysis.state === filters.state);

    return toSortedUniqueOptions(scopedAnalyses.map((analysis) => analysis.district));
  }, [analyses, filters.state]);

  const stateNameToIdMap = useMemo(() => {
    return new Map(
      states
        .map((stateItem) => [stateItem?.name, stateItem?.id])
        .filter(([name, id]) => typeof name === 'string' && name.trim() && id)
    );
  }, [states]);

  const stateOptions = useMemo(() => {
    const entityStateOptions = toSortedUniqueOptions(states.map((stateItem) => stateItem?.name));
    return entityStateOptions.length > 0 ? entityStateOptions : analysisStateOptions;
  }, [states, analysisStateOptions]);

  const districtOptions = useMemo(() => {
    const entityDistrictOptions = toSortedUniqueOptions(districts.map((districtItem) => districtItem?.name));
    return entityDistrictOptions.length > 0 ? entityDistrictOptions : analysisDistrictOptions;
  }, [districts, analysisDistrictOptions]);

  const loadAnalyses = async () => {
    setLoading(true);
    setError('');

    const queryParams = {
      page: currentPage,
      page_size: PAGE_SIZE,
    };

    if (filters.status !== 'all') {
      queryParams.status_group = filters.status;
    }
    if (filters.state !== 'all') {
      queryParams.state_filter = filters.state;
    }
    if (filters.district !== 'all') {
      queryParams.district_filter = filters.district;
    }

    const normalizedSearchQuery = searchQuery.trim();
    if (normalizedSearchQuery) {
      queryParams.search_query = normalizedSearchQuery;
    }

    try {
      const response = await executionService.getExecutions(
        queryParams.page,
        queryParams.page_size,
        null,
        queryParams
      );
      setAnalyses(Array.isArray(response?.items) ? response.items : []);
      setTotalItems(typeof response?.total === 'number' ? response.total : 0);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load analyses right now.'));
      setAnalyses([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const loadStates = async () => {
    setStatesLoading(true);
    setStateError('');

    try {
      const stateItems = await entityService.getStates();
      setStates(stateItems);
    } catch (requestError) {
      setStates([]);
      setStateError(
        `${getApiErrorMessage(requestError, 'Unable to load states right now.')} Showing available analysis states when possible.`
      );
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
    } catch (requestError) {
      setDistricts([]);
      setDistrictError(
        `${getApiErrorMessage(requestError, 'Unable to load districts for selected state.')} Showing available analysis districts when possible.`
      );
    } finally {
      setDistrictsLoading(false);
    }
  };

  useEffect(() => {
    void loadStates();
  }, []);

  useEffect(() => {
    void loadAnalyses();
  }, [currentPage, filters.status, filters.state, filters.district, searchQuery]);

  useEffect(() => {
    if (filters.state === 'all') {
      setDistricts([]);
      setDistrictError('');
      return;
    }

    const selectedStateId = stateNameToIdMap.get(filters.state);

    if (!selectedStateId) {
      setDistricts([]);
      setDistrictError('');
      return;
    }

    void loadDistricts(selectedStateId);
  }, [filters.state, stateNameToIdMap]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageStartItem = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEndItem = totalItems === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalItems);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((currentFilters) => {
      if (name === 'state') {
        return {
          ...currentFilters,
          state: value,
          district: 'all',
        };
      }

      return {
        ...currentFilters,
        [name]: value,
      };
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      state: 'all',
      district: 'all',
    });
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleDownloadReport = async (executionId) => {
    if (!executionId) {
      return;
    }

    setDownloadError('');
    setDownloadingExecutionId(executionId);

    try {
      await reportService.downloadReport(executionId, 'csv');
    } catch (requestError) {
      setDownloadError(getApiErrorMessage(requestError, 'Failed to download report CSV.'));
    } finally {
      setDownloadingExecutionId('');
    }
  };

  const districtFilterDisabled = filters.state === 'all' || districtsLoading;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">View Analyses</h2>
              <p className="mt-1 text-sm text-slate-600">Browse and manage all your analysis runs.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
                onClick={() => navigate('/executions/create')}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                <span className="truncate">Start Analysis Run</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 w-full sm:w-auto"
                onClick={() => void loadAnalyses()}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
            <Filter className="h-4 w-4 text-blue-600" />
            Filter Analyses
          </CardTitle>
          <CardDescription>{totalItems} analyses match current filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by analysis name..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full pl-10 border-slate-300 bg-white text-slate-800"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Status</span>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">State</span>
              <select
                name="state"
                value={filters.state}
                onChange={handleFilterChange}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">{statesLoading ? 'Loading states...' : 'All States'}</option>
                {stateOptions.map((stateOption) => (
                  <option key={stateOption} value={stateOption}>
                    {stateOption}
                  </option>
                ))}
              </select>
              {stateError && <p className="text-xs text-amber-700">{stateError}</p>}
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">District</span>
              <select
                name="district"
                value={filters.district}
                onChange={handleFilterChange}
                disabled={districtFilterDisabled}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="all">
                  {filters.state === 'all'
                    ? 'Select state first'
                    : districtsLoading
                      ? 'Loading districts...'
                      : 'All Districts'}
                </option>
                {districtOptions.map((districtOption) => (
                  <option key={districtOption} value={districtOption}>
                    {districtOption}
                  </option>
                ))}
              </select>
              {districtError && <p className="text-xs text-amber-700">{districtError}</p>}
            </label>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {error && (
            <div className="m-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {downloadError && (
            <div className="mx-4 mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <span className="font-semibold">Download error: </span>
              {downloadError}
            </div>
          )}

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : totalItems === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-700">No analyses found.</p>
              <p className="mt-1 text-xs text-slate-500">Adjust filters or start a new analysis run.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">State</th>
                      <th className="px-4 py-3 font-semibold">District</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Created Date</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyses.map((analysis) => {
                      const statusMeta = getAnalysisStatusMeta(analysis.status);

                      return (
                        <tr
                          key={analysis.id}
                          className="transition-colors duration-150 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{analysis.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {analysis.state || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {analysis.district || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.badgeClass}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(analysis.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-100"
                                onClick={() => navigate(`/executions/${analysis.id}`)}
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                View
                              </Button>

                              {getAnalysisStatusGroup(analysis.status) === 'draft' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50"
                                  onClick={() => navigate(`/executions/create?executionId=${analysis.id}`)}
                                >
                                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                  Edit
                                </Button>
                              )}

                              {getAnalysisStatusGroup(analysis.status) === 'completed' && (
                                <>
                                  <Button
                                    type="button"
                                    className="h-8 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                                    onClick={() => navigate(`/reports/${analysis.id}`)}
                                  >
                                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                                    View Report
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50"
                                    onClick={() => void handleDownloadReport(analysis.id)}
                                    disabled={Boolean(downloadingExecutionId)}
                                  >
                                    {downloadingExecutionId === analysis.id ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Download className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    {downloadingExecutionId === analysis.id ? 'Downloading...' : 'Download'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-slate-200">
                {analyses.map((analysis) => {
                  const statusMeta = getAnalysisStatusMeta(analysis.status);

                  return (
                    <div key={analysis.id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-800 text-sm truncate">{analysis.name}</h3>
                          <div className="mt-1 space-y-0.5">
                            {analysis.state && (
                              <p className="text-xs text-slate-600">
                                <span className="font-medium">State:</span> {analysis.state}
                              </p>
                            )}
                            {analysis.district && (
                              <p className="text-xs text-slate-600">
                                <span className="font-medium">District:</span> {analysis.district}
                              </p>
                            )}
                            {!analysis.state && !analysis.district && (
                              <p className="text-xs text-slate-500">-</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusMeta.badgeClass}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                          {statusMeta.label}
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-500">
                        {formatDateTime(analysis.created_at)}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 min-w-[110px] h-9 border-slate-300 text-xs text-slate-700 hover:bg-slate-100"
                          onClick={() => navigate(`/executions/${analysis.id}`)}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>

                        {getAnalysisStatusGroup(analysis.status) === 'draft' && (
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 min-w-[110px] h-9 border-blue-300 text-xs text-blue-700 hover:bg-blue-50"
                            onClick={() => navigate(`/executions/create?executionId=${analysis.id}`)}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                        )}

                        {getAnalysisStatusGroup(analysis.status) === 'completed' && (
                          <>
                            <Button
                              type="button"
                              className="flex-1 min-w-[110px] h-9 bg-blue-600 text-xs text-white hover:bg-blue-700"
                              onClick={() => navigate(`/reports/${analysis.id}`)}
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              Report
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1 min-w-[110px] h-9 border-blue-300 text-xs text-blue-700 hover:bg-blue-50"
                              onClick={() => void handleDownloadReport(analysis.id)}
                              disabled={Boolean(downloadingExecutionId)}
                            >
                              {downloadingExecutionId === analysis.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {downloadingExecutionId === analysis.id ? 'Downloading...' : 'Download'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-600">
                  Showing {pageStartItem}-{pageEndItem} of {totalItems}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionList;
