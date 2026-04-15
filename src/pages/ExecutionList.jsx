import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, Filter, PlayCircle, RefreshCw } from 'lucide-react';
import { executionService } from '../services/executionService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { formatDateTime, getAnalysisStatusGroup, getAnalysisStatusMeta } from '../lib/analysis';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const ExecutionList = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    state: 'all',
    district: 'all',
  });

  const loadAnalyses = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await executionService.getExecutions(1, 250);
      setAnalyses(Array.isArray(response?.items) ? response.items : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Unable to load analyses right now.');
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalyses();
  }, []);

  const stateOptions = useMemo(() => {
    const uniqueStates = [...new Set(analyses.map((analysis) => analysis.state).filter(Boolean))];
    return uniqueStates.sort((a, b) => a.localeCompare(b));
  }, [analyses]);

  const districtOptions = useMemo(() => {
    const scopedAnalyses =
      filters.state === 'all'
        ? analyses
        : analyses.filter((analysis) => analysis.state === filters.state);

    const uniqueDistricts = [...new Set(scopedAnalyses.map((analysis) => analysis.district).filter(Boolean))];
    return uniqueDistricts.sort((a, b) => a.localeCompare(b));
  }, [analyses, filters.state]);

  const filteredAnalyses = useMemo(() => {
    return analyses
      .filter((analysis) => {
        const statusMatch =
          filters.status === 'all' || getAnalysisStatusGroup(analysis.status) === filters.status;
        const stateMatch = filters.state === 'all' || analysis.state === filters.state;
        const districtMatch = filters.district === 'all' || analysis.district === filters.district;

        return statusMatch && stateMatch && districtMatch;
      })
      .sort((first, second) => new Date(second.created_at) - new Date(first.created_at));
  }, [analyses, filters]);

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
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      state: 'all',
      district: 'all',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-800">View Analyses</h2>
              <p className="mt-1 text-sm text-slate-600">Browse and manage all your analysis runs.</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => navigate('/executions/create')}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Analysis Run
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
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
          <CardDescription>{filteredAnalyses.length} analyses match current filters.</CardDescription>
        </CardHeader>
        <CardContent>
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
                <option value="all">All States</option>
                {stateOptions.map((stateOption) => (
                  <option key={stateOption} value={stateOption}>
                    {stateOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">District</span>
              <select
                name="district"
                value={filters.district}
                onChange={handleFilterChange}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Districts</option>
                {districtOptions.map((districtOption) => (
                  <option key={districtOption} value={districtOption}>
                    {districtOption}
                  </option>
                ))}
              </select>
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
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {error && (
            <div className="m-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-700">No analyses found.</p>
              <p className="mt-1 text-xs text-slate-500">Adjust filters or start a new analysis run.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">State / District</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAnalyses.map((analysis) => {
                    const statusMeta = getAnalysisStatusMeta(analysis.status);

                    return (
                      <tr
                        key={analysis.id}
                        className="transition-colors duration-150 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{analysis.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {[analysis.state, analysis.district].filter(Boolean).join(' / ') || '-'}
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

                            {getAnalysisStatusGroup(analysis.status) === 'completed' && (
                              <Button
                                type="button"
                                className="h-8 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                                onClick={() => navigate(`/reports/${analysis.id}`)}
                              >
                                <FileText className="mr-1.5 h-3.5 w-3.5" />
                                View Report
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionList;
