import { useState } from 'react';
import { AlertCircle, FileUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import StandardReportRenderer from '../components/reports/StandardReportRenderer';

const ReportsList = () => {
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
