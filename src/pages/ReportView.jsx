import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import StandardReportRenderer from '../components/reports/StandardReportRenderer';
import { getApiErrorMessage, reportService } from '../services/executionService';

const ReportView = () => {
  const { id: executionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const loadReportCsv = async () => {
      if (!executionId) {
        setError('Missing execution id in URL.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const csvContent = await reportService.getReportCsv(executionId);
        setCsvText(typeof csvContent === 'string' ? csvContent : '');
      } catch (requestError) {
        setCsvText('');
        setError(getApiErrorMessage(requestError, 'Unable to load report CSV.'));
      } finally {
        setLoading(false);
      }
    };

    void loadReportCsv();
  }, [executionId, reloadKey]);

  if (loading) {
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

  return <StandardReportRenderer csvText={csvText} sourceLabel={`Execution Report: ${executionId}`} />;
};

export default ReportView;
