import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import StandardReportRenderer from '../components/reports/StandardReportRenderer';
import { getApiErrorMessage, reportService, executionService } from '../services/executionService';
import { isReportViewSupported } from '../lib/analysis';

const ReportView = () => {
  const { id: executionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [reportApiData, setReportApiData] = useState(null);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [executionName, setExecutionName] = useState('');

  // Tracks the most recent request so out-of-order responses can be ignored
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!executionId) {
      setError('Missing execution id in URL.');
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError('');
    setFilterError('');

    const loadInitialData = async () => {
      try {
        const executionDetails = await executionService.getExecution(executionId);
        if (requestId !== requestIdRef.current) return;
        setExecutionName(executionDetails?.name || 'Unnamed Execution');

        // Report view (aggregated summary/filters) still hardcodes project_report's
        // column names on the backend, so it silently shows wrong/empty data for other
        // CSV shapes (e.g. observation) — checked here since this route is reachable by
        // direct URL even though the "View Report" button is disabled for these types.
        if (!isReportViewSupported(executionDetails?.csv_type_id)) {
          setReportApiData(null);
          setError('Report view is not available yet for this CSV type. Use the Download button on the execution page instead.');
          return;
        }

        const pageData = await reportService.getReportDataPage(executionId, { page: 1, pageSize: 1000 });
        if (requestId !== requestIdRef.current) return;
        setReportApiData(pageData);
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return;
        setReportApiData(null);
        setExecutionName('');
        setError(getApiErrorMessage(requestError, 'Unable to load report data.'));
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();
  }, [executionId, reloadKey]);

  const handleFilterChange = useCallback((filters) => {
    if (!executionId) return;

    const requestId = ++requestIdRef.current;
    setFilterError('');
    setFilterLoading(true);

    const loadFilteredData = async () => {
      try {
        const pageData = await reportService.getReportDataPage(executionId, {
          page: 1,
          pageSize: 1000,
          ...filters,
        });

        if (requestId !== requestIdRef.current) return;
        setReportApiData(pageData);
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return;
        setFilterError(getApiErrorMessage(requestError, 'Unable to apply filters. Please try again.'));
      } finally {
        if (requestId === requestIdRef.current) {
          setFilterLoading(false);
        }
      }
    };

    void loadFilteredData();
  }, [executionId]);

  if (loading && !reportApiData) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-rose-200 bg-rose-50 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/reports')}>
              Back to Reports
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {filterError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          <span>{filterError}</span>
        </div>
      )}
      <StandardReportRenderer
        key={executionId}
        reportApiData={reportApiData}
        onFilterChange={handleFilterChange}
        isFilterLoading={filterLoading}
        sourceLabel={`Analysis Report - ${executionName}`}
      />
    </div>
  );
};

export default ReportView;
