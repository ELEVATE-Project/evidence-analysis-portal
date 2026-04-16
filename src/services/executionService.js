import apiClient from './api';

const ENTITY_ID_KEYS = ['id', '_id', 'value', 'entityId', 'stateId', 'districtId', 'code', 'externalId'];
const ENTITY_NAME_KEYS = ['name', 'label', 'title', 'entityName', 'state_name', 'district_name', 'value'];

const pickFirstString = (objectValue, keys) => {
  for (const key of keys) {
    const value = objectValue?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
};

const normalizeEntityItem = (item, index) => {
  if (typeof item === 'string' || typeof item === 'number') {
    const rawValue = String(item).trim();
    return {
      id: rawValue || `entity-${index}`,
      name: rawValue || `Entity ${index + 1}`,
      raw: item,
    };
  }

  if (!item || typeof item !== 'object') {
    return {
      id: `entity-${index}`,
      name: `Entity ${index + 1}`,
      raw: item,
    };
  }

  const name = pickFirstString(item, ENTITY_NAME_KEYS);
  const id = pickFirstString(item, ENTITY_ID_KEYS) || name || `entity-${index}`;

  return {
    id,
    name: name || id,
    raw: item,
  };
};

const parseEntityResponse = (responseData, entityLabel) => {
  if (responseData?.success === false) {
    const details = responseData?.error?.details;
    const code = responseData?.error?.code;
    const serverMessage = responseData?.message || `Failed to fetch ${entityLabel}.`;
    const detailMessage = typeof details === 'string' ? details : '';
    throw new Error([serverMessage, code, detailMessage].filter(Boolean).join(' - '));
  }

  const items = Array.isArray(responseData?.data) ? responseData.data : [];
  return items.map((item, index) => normalizeEntityItem(item, index));
};

export const getApiErrorMessage = (error, fallbackMessage = 'Request failed.') => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
};

export const executionService = {
  // Create new execution
  createExecution: async (formData) => {
    const response = await apiClient.post('/executions/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get execution list
  getExecutions: async (page = 1, pageSize = 20, status = null) => {
    const params = { page, page_size: pageSize };
    if (status) params.status_filter = status;
    
    const response = await apiClient.get('/executions/', { params });
    return response.data;
  },

  // Get execution details
  getExecution: async (executionId) => {
    const response = await apiClient.get(`/executions/${executionId}`);
    return response.data;
  },

  // Get execution status
  getExecutionStatus: async (executionId) => {
    const response = await apiClient.get(`/executions/${executionId}/status`);
    return response.data;
  },

  // Delete execution
  deleteExecution: async (executionId) => {
    await apiClient.delete(`/executions/${executionId}`);
  },
};

export const entityService = {
  getStates: async () => {
    const response = await apiClient.get('/states');
    return parseEntityResponse(response.data, 'states');
  },

  getDistricts: async (stateId) => {
    const response = await apiClient.get('/districts', {
      params: { stateId },
    });
    return parseEntityResponse(response.data, 'districts');
  },
};

export const reportService = {
  // Get report data
  getReport: async (executionId) => {
    const response = await apiClient.get(`/reports/${executionId}`);
    return response.data;
  },

  // Get HTML report
  getHtmlReport: async (executionId) => {
    const response = await apiClient.get(`/reports/${executionId}/html`);
    return response.data;
  },

  // Download report
  downloadReport: async (executionId, format = 'csv') => {
    const response = await apiClient.get(`/reports/${executionId}/download`, {
      params: { format },
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `execution_${executionId}_report.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
