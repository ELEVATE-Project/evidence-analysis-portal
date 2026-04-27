import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Download, FileSearch, FileText, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { executionService, getApiErrorMessage, reportService } from '../services/executionService';
import { formatDateTime, getAnalysisStatusGroup, getAnalysisStatusMeta } from '../lib/analysis';

const PREVIEW_LIMIT = 10;

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
};

const formatValue = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'string') {
    return value.trim() || '-';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('en-IN') : '-';
  }

  return String(value);
};

const ExecutionDetail = () => {
  const { id: executionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const [execution, setExecution] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [previews, setPreviews] = useState({
    input: null,
    questions: null,
  });
  const [previewErrors, setPreviewErrors] = useState({
    input: '',
    questions: '',
  });

  const loadExecutionView = useCallback(
    async ({ showFullLoader = false } = {}) => {
      if (!executionId) {
        setError('Missing execution id in route.');
        setLoading(false);
        return;
      }

      if (showFullLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      const fetchPreview = async (fileType) => {
        try {
          const data = await executionService.getExecutionFilePreview(executionId, fileType, PREVIEW_LIMIT);
          return { data, error: '' };
        } catch (requestError) {
          return {
            data: null,
            error: getApiErrorMessage(requestError, `Unable to load ${fileType} preview.`),
          };
        }
      };

      try {
        const [executionDetail, executionStatus, inputPreview, questionsPreview] = await Promise.all([
          executionService.getExecution(executionId),
          executionService.getExecutionStatus(executionId),
          fetchPreview('input'),
          fetchPreview('questions'),
        ]);

        setExecution(executionDetail);
        setStatusInfo(executionStatus);
        setPreviews({
          input: inputPreview.data,
          questions: questionsPreview.data,
        });
        setPreviewErrors({
          input: inputPreview.error,
          questions: questionsPreview.error,
        });
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Unable to load analysis details right now.'));
        setExecution(null);
        setStatusInfo(null);
        setPreviews({ input: null, questions: null });
        setPreviewErrors({ input: '', questions: '' });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [executionId]
  );

  useEffect(() => {
    void loadExecutionView({ showFullLoader: true });
  }, [loadExecutionView]);

  useEffect(() => {
    if (!executionId || loading) {
      return undefined;
    }

    const statusGroup = getAnalysisStatusGroup(statusInfo?.status || execution?.status);
    if (statusGroup === 'completed' || statusGroup === 'failed') {
      return undefined;
    }

    const pollTimer = setInterval(() => {
      void (async () => {
        try {
          const latestStatus = await executionService.getExecutionStatus(executionId);
          setStatusInfo(latestStatus);

          if (getAnalysisStatusGroup(latestStatus?.status) === 'completed') {
            const latestExecution = await executionService.getExecution(executionId);
            setExecution(latestExecution);
          }
        } catch (requestError) {
          // Silent poll failure; explicit refresh button remains available.
        }
      })();
    }, 10000);

    return () => clearInterval(pollTimer);
  }, [execution?.status, executionId, loading, statusInfo?.status]);

  const statusMeta = useMemo(() => getAnalysisStatusMeta(statusInfo?.status || execution?.status), [execution?.status, statusInfo?.status]);

  const progressPercent = useMemo(() => {
    if (typeof statusInfo?.progress_percentage === 'number') {
      return statusInfo.progress_percentage;
    }

    const processedRows = statusInfo?.processed_rows ?? execution?.processed_rows;
    const totalRows = statusInfo?.total_rows ?? execution?.total_rows;

    if (typeof processedRows === 'number' && typeof totalRows === 'number' && totalRows > 0) {
      return (processedRows / totalRows) * 100;
    }

    return null;
  }, [execution?.processed_rows, execution?.total_rows, statusInfo]);

  const canEdit = useMemo(() => {
    const normalizedStatus = `${statusInfo?.status || execution?.status || ''}`.toLowerCase();
    return normalizedStatus === 'draft' || normalizedStatus === 'validated';
  }, [execution?.status, statusInfo?.status]);
  const canViewReport = useMemo(() => {
    return getAnalysisStatusGroup(statusInfo?.status || execution?.status) === 'completed';
  }, [execution?.status, statusInfo?.status]);

  const quickDetails = useMemo(
    () => [
      { label: 'State', value: execution?.state },
      { label: 'District', value: execution?.district },
      { label: 'Program', value: execution?.program_name },
      { label: 'Created On', value: formatDateTime(execution?.created_at) },
      { label: 'Last Updated', value: formatDateTime(execution?.updated_at) },
    ],
    [execution]
  );

  const handleDownloadReport = useCallback(async () => {
    if (!execution?.id) {
      return;
    }

    setDownloadError('');
    setDownloadingReport(true);

    try {
      await reportService.downloadReport(execution.id, 'csv');
    } catch (requestError) {
      setDownloadError(getApiErrorMessage(requestError, 'Failed to download report CSV.'));
    } finally {
      setDownloadingReport(false);
    }
  }, [execution?.id]);

  const renderPreviewSection = (title, fileType) => {
    const previewData = previews[fileType];
    const previewError = previewErrors[fileType];
    const columns = Array.isArray(previewData?.columns_detected) ? previewData.columns_detected : [];
    const previewRows = Array.isArray(previewData?.preview_rows) ? previewData.preview_rows : [];

    return (
      <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-slate-800">{title}</h4>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              <span className="font-medium">{formatValue(previewData?.rows_detected)}</span> rows
            </span>
            <span className="text-slate-400">•</span>
            <span>
              <span className="font-medium">{columns.length}</span> columns
            </span>
          </div>
        </div>

        {previewError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {previewError}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          {columns.length > 0 ? (
            <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-100 whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700">
                    #
                  </th>
                  {columns.map((column) => (
                    <th
                      key={`${fileType}-col-${column}`}
                      className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {previewRows.length > 0 ? (
                  previewRows.map((row, rowIndex) => (
                    <tr key={`${fileType}-row-${rowIndex}`} className="hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 z-10 bg-white whitespace-nowrap px-4 py-3 text-slate-500 font-medium">
                        {rowIndex + 1}
                      </td>
                      {columns.map((column) => (
                        <td
                          key={`${fileType}-cell-${rowIndex}-${column}`}
                          className="min-w-[140px] max-w-xs break-words px-4 py-3 text-slate-700"
                        >
                          {row?.[column] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-500">
                      No sample rows available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Preview unavailable
            </div>
          )}
        </div>
      </section>
    );
  };

  if (!executionId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <p className="text-sm font-medium text-rose-900">Missing execution id in URL.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border-2 border-slate-200 bg-slate-100 shadow-sm" />
        ))}
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Card className="border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100 shadow-md">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <span className="font-medium text-rose-900">{error || 'Analysis details not available.'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/executions')}>
                Back to Analyses
              </Button>
              <Button
                type="button"
                className="bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
                onClick={() => void loadExecutionView({ showFullLoader: true })}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header with Title and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{execution.name || 'Analysis Details'}</h2>
          <p className="mt-1.5 text-sm text-slate-600">Track status and review uploaded data</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {canViewReport ? (
            <>
              <Button
                type="button"
                className="bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
                onClick={() => navigate(`/reports/${execution.id}`)}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                View Report
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-blue-300 text-blue-700 shadow-sm transition-all hover:bg-blue-50 hover:shadow"
                onClick={() => void handleDownloadReport()}
                disabled={downloadingReport}
              >
                {downloadingReport ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                {downloadingReport ? 'Downloading...' : 'Download'}
              </Button>
            </>
          ) : null}

          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="border-blue-300 text-blue-700 shadow-sm transition-all hover:bg-blue-50 hover:shadow"
              onClick={() => navigate(`/executions/create?executionId=${execution.id}`)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="border-slate-300 text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:shadow"
            onClick={() => void loadExecutionView({ showFullLoader: false })}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {downloadError ? (
        <Card className="border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
              <p className="text-sm text-rose-900">
                <span className="font-semibold">Download error: </span>
                {downloadError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Combined Overview Card */}
      <Card className="border-2 border-slate-200 bg-white shadow-md">
        <CardHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-900">Analysis Overview</CardTitle>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${statusMeta.badgeClass}`}
            >
              <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`} />
              {statusMeta.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Section */}
          <div>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Processing Progress</span>
              <span className="text-slate-600">{formatPercent(progressPercent)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, progressPercent || 0))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {formatValue(statusInfo?.processed_rows ?? execution.processed_rows)} processed
              </span>
              <span>
                {formatValue(statusInfo?.total_rows ?? execution.total_rows)} total rows
              </span>
            </div>
          </div>

          {/* Error Message if any */}
          {(statusInfo?.failure_reason || execution.failure_reason) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span className="font-semibold">Error: </span>
              {statusInfo?.failure_reason || execution.failure_reason}
            </div>
          )}

          {/* Details Grid */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-700">Details</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quickDetails.map((field) => (
                <div key={field.label} className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">{field.label}</p>
                  <p className="break-words text-sm text-slate-900">{formatValue(field.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Preview Card */}
      <Card className="border-2 border-slate-200 bg-white shadow-md">
        <CardHeader className="border-b border-slate-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileSearch className="h-5 w-5 text-blue-600" />
            Uploaded Files Preview
          </CardTitle>
          <CardDescription className="text-slate-600">First {PREVIEW_LIMIT} rows from your uploaded data files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {renderPreviewSection('Input Data CSV', 'input')}
          {renderPreviewSection('Criteria / Questions CSV', 'questions')}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionDetail;
