import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const ExecutionDetail = () => {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold text-slate-800">Analysis Details</h2>
          <p className="mt-1 text-sm text-slate-600">Detailed analysis metadata and progress information.</p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">Analysis Overview</CardTitle>
          <CardDescription>
            This page can be extended with per-analysis status timeline, files, and run diagnostics.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default ExecutionDetail;
