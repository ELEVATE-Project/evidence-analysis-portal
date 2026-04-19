import React from 'react';
import { Lock } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Create' },
  { id: 2, label: 'Upload' },
  { id: 3, label: 'Validate' },
  { id: 4, label: 'Run' },
];

const ExecutionWizardStepper = ({ activeStep = 1 }) => {
  return (
    <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2">
      {STEPS.map((step, index) => {
        const isActive = step.id === activeStep;
        const isDone = step.id < activeStep;
        const isLocked = step.id > activeStep;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
              <span
                className={`inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md border text-xs font-semibold ${
                  isActive
                    ? 'border-blue-700 bg-blue-600 text-white'
                    : isDone
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-slate-100 text-slate-500'
                }`}
              >
                {isLocked ? <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : step.id}
              </span>
              <span className={`text-sm sm:text-base font-medium ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`h-px min-w-8 sm:min-w-16 flex-1 ${step.id < activeStep ? 'bg-blue-500' : 'bg-slate-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ExecutionWizardStepper;
