import React from 'react';
import { Beaker, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const InteractiveTesting = () => {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold text-slate-800">Validate Criteria</h2>
          <p className="mt-1 text-sm text-slate-600">
            Validate criteria behavior before launching a full analysis run.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
            <Beaker className="h-4 w-4 text-blue-600" />
            Criteria Validation Panel
          </CardTitle>
          <CardDescription>
            This page can host real-time criteria checks and sample evidence validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <CheckCheck className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-2 text-sm font-medium text-slate-700">Validation tools placeholder</p>
            <p className="mt-1 text-xs text-slate-500">
              Add interactive criteria testing controls here when backend endpoints are ready.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InteractiveTesting;
