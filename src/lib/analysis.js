export const getAnalysisStatusGroup = (status) => {
  const normalizedStatus = `${status || ''}`.toLowerCase();

  if (normalizedStatus === 'completed') {
    return 'completed';
  }

  if (normalizedStatus === 'failed') {
    return 'failed';
  }

  return 'in_progress';
};

export const getAnalysisStatusMeta = (status) => {
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

  return {
    label: 'In Progress',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  };
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
