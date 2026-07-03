export const getAnalysisStatusGroup = (status) => {
  const normalizedStatus = `${status || ''}`.toLowerCase();

  if (normalizedStatus === 'completed') {
    return 'completed';
  }

  if (normalizedStatus === 'failed') {
    return 'failed';
  }

  if (normalizedStatus === 'draft' || normalizedStatus === 'validated' || normalizedStatus === 'notstarted') {
    return 'draft';
  }

  if (normalizedStatus === 'queued' || normalizedStatus === 'in_progress' || normalizedStatus === 'running') {
    return 'in_progress';
  }

  return 'in_progress';
};

export const getAnalysisStatusMeta = (status) => {
  const normalizedStatus = `${status || ''}`.toLowerCase();
  const group = getAnalysisStatusGroup(status);

  if (group === 'completed') {
    return {
      label: 'Completed',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dotClass: 'bg-emerald-500',
    };
  }

  if (group === 'failed') {
    return {
      label: 'Failed',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
      dotClass: 'bg-rose-500',
    };
  }

  if (group === 'draft') {
    return {
      label: 'Draft',
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
      dotClass: 'bg-slate-500',
    };
  }

  if (normalizedStatus === 'queued') {
    return {
      label: 'Queued',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
      dotClass: 'bg-blue-500',
    };
  }

  return {
    label: 'In Progress',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  };
};

export const EVIDENCE_TYPE_LABELS = {
  image: 'Image',
  pdf: 'PDF',
  excel: 'Excel',
};

export const formatEvidenceTypes = (evidenceTypes) => {
  if (!Array.isArray(evidenceTypes) || evidenceTypes.length === 0) {
    return '';
  }

  const allKeys = Object.keys(EVIDENCE_TYPE_LABELS);
  const isUnrestricted = evidenceTypes.length === allKeys.length && allKeys.every((key) => evidenceTypes.includes(key));
  if (isUnrestricted) {
    return '';
  }

  return evidenceTypes.map((key) => EVIDENCE_TYPE_LABELS[key] || key).join(', ');
};

export const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
