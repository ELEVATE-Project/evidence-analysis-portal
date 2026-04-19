import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const ExecutionDetail = () => {
  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Analysis Details</h2>
          <p className="mt-1 text-sm text-slate-600">Detailed analysis metadata and progress information.</p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg text-slate-800">Analysis Overview</CardTitle>
          <CardDescription className="text-sm">
            This page can be extended with per-analysis status timeline, files, and run diagnostics.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default ExecutionDetail;
