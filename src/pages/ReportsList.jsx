import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, RefreshCw } from 'lucide-react';
import { executionService } from '../services/executionService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { formatDateTime } from '../lib/analysis';

const ReportsList = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completedAnalyses, setCompletedAnalyses] = useState([]);

  const loadCompletedAnalyses = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await executionService.getExecutions(1, 250, 'completed');
      setCompletedAnalyses(Array.isArray(response?.items) ? response.items : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Unable to load completed analyses.');
      setCompletedAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompletedAnalyses();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-800">View Reports</h2>
              <p className="mt-1 text-sm text-slate-600">Access completed analyses and open report outputs.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={() => void loadCompletedAnalyses()}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">Completed Analyses</CardTitle>
          <CardDescription>
            {completedAnalyses.length} completed {completedAnalyses.length === 1 ? 'analysis' : 'analyses'} available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : completedAnalyses.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No reports available yet.</p>
              <p className="mt-1 text-xs text-slate-500">Reports will appear once analysis runs are completed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-3 font-semibold">Analysis</th>
                    <th className="px-2 py-3 font-semibold">State / District</th>
                    <th className="px-2 py-3 font-semibold">Created Date</th>
                    <th className="px-2 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedAnalyses.map((analysis) => (
                    <tr key={analysis.id} className="transition-colors duration-150 hover:bg-slate-50">
                      <td className="px-2 py-3 text-sm font-medium text-slate-800">{analysis.name}</td>
                      <td className="px-2 py-3 text-sm text-slate-600">
                        {[analysis.state, analysis.district].filter(Boolean).join(' / ') || '-'}
                      </td>
                      <td className="px-2 py-3 text-sm text-slate-600">{formatDateTime(analysis.created_at)}</td>
                      <td className="px-2 py-3">
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
                          <Button
                            type="button"
                            className="h-8 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                            onClick={() => navigate(`/reports/${analysis.id}`)}
                          >
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            View Report
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsList;
