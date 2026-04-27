import { useState } from 'react';
import { AlertCircle, FileUp, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import StandardReportRenderer from '../components/reports/StandardReportRenderer';

const ReportsList = () => {
  // Hidden for demo - show "Coming Soon" message
  const DEMO_MODE = true;

  const [selectedFileName, setSelectedFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setError('');

    if (!file) {
      setSelectedFileName('');
      setCsvText('');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFileName(file.name);
      setCsvText('');
      setError('Please upload a valid .csv file.');
      return;
    }

    setSelectedFileName(file.name);
    setLoading(true);

    try {
      const text = await file.text();
      if (!text.trim()) {
        throw new Error('Uploaded CSV is empty.');
      }
      setCsvText(text);
    } catch (readError) {
      setCsvText('');
      setError(readError?.message || 'Unable to read CSV file.');
    } finally {
      setLoading(false);
    }
  };

  // Demo mode: Show "Coming Soon" message
  if (DEMO_MODE) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-slate-200 shadow-sm max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-blue-500" />
            <h2 className="text-2xl font-semibold text-slate-800 mb-2">Coming Soon</h2>
            <p className="text-slate-600">
              The View Reports feature will be available soon. Stay tuned!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-800">External CSV Report Viewer</CardTitle>
          <CardDescription>
            Upload any valid output CSV to render the standardized report format. This page is external CSV-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/70 p-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-6 text-center">
              <FileUp className="h-6 w-6 text-blue-600" />
              <span className="text-sm font-medium text-slate-800">Choose Output CSV File</span>
              <span className="text-xs text-slate-500">{selectedFileName || 'No file selected'}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleFileChange(event)} />
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedFileName('');
                setCsvText('');
                setError('');
              }}
            >
              Reset
            </Button>
          </div>

          {loading && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Reading CSV file...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {csvText && !loading ? <StandardReportRenderer csvText={csvText} sourceLabel={`External CSV: ${selectedFileName}`} /> : null}
    </div>
  );
};

export default ReportsList;
