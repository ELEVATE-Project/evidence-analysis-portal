import React from 'react';
import { UploadCloud, PlayCircle, FileSpreadsheet, ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const steps = [
  {
    title: 'Upload Input Data',
    description: 'Add the evidence input CSV for the selected program scope.',
    icon: FileSpreadsheet,
  },
  {
    title: 'Upload Criteria File',
    description: 'Attach the criteria/questions CSV used for analysis evaluation.',
    icon: ListChecks,
  },
  {
    title: 'Start Analysis Run',
    description: 'Submit and monitor progress from Dashboard and View Analyses.',
    icon: PlayCircle,
  },
];

const ExecutionCreate = () => {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold text-slate-800">Start Analysis Run</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a new analysis run by uploading required files and selecting metadata.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-800">Run Setup</CardTitle>
          <CardDescription>
            Form implementation can be added in this section while preserving the design system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="rounded-md border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="mb-3 inline-flex rounded-md border border-blue-100 bg-blue-50 p-2 text-blue-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">{step.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <UploadCloud className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-2 text-sm font-medium text-slate-700">Analysis creation form placeholder</p>
            <p className="mt-1 text-xs text-slate-500">
              Replace this block with the production upload form and submit workflow.
            </p>
            <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700">
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Analysis Run
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionCreate;
