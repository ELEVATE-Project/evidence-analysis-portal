import apiClient from './api';

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
