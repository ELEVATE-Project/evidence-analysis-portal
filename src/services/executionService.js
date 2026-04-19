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

const parseConfigResponse = (responseData, configLabel) => {
  if (responseData?.success === false) {
    const details = responseData?.error?.details;
    const code = responseData?.error?.code;
    const serverMessage = responseData?.message || `Failed to fetch ${configLabel}.`;
    const detailMessage = typeof details === 'string' ? details : '';
    throw new Error([serverMessage, code, detailMessage].filter(Boolean).join(' - '));
  }

  return Array.isArray(responseData?.data) ? responseData.data : [];
};

const normalizeSourceTypeItem = (item, index) => {
  if (!item || typeof item !== 'object') {
    const fallbackKey = `source_type_${index + 1}`;
    return {
      id: fallbackKey,
      typeKey: fallbackKey,
      name: fallbackKey,
      displayName: fallbackKey,
      hasGeo: false,
      hasProgram: false,
      raw: item,
    };
  }

  const typeKey = typeof item.type_key === 'string' && item.type_key.trim() ? item.type_key.trim() : `source_type_${index + 1}`;
  const displayName =
    typeof item.display_name === 'string' && item.display_name.trim()
      ? item.display_name.trim()
      : typeKey;

  return {
    id: typeKey,
    typeKey,
    name: displayName,
    displayName,
    hasGeo: Boolean(item.has_geo),
    hasProgram: Boolean(item.has_program),
    raw: item,
  };
};

const uploadFileToSignedUrl = async (signedUpload, file) => {
  const headers = { ...(signedUpload?.headers || {}) };
  const hasCustomHeaders = Object.keys(headers).length > 0;
  const uploadBody = hasCustomHeaders ? file : await file.arrayBuffer();

  let response;
  try {
    response = await fetch(signedUpload.url, {
      method: signedUpload.method || 'PUT',
      headers,
      body: uploadBody,
      mode: 'cors',
    });
  } catch (error) {
    throw new Error(
      'Cloud upload failed before completion. Check signed URL expiry/CORS and retry with a fresh upload request.'
    );
  }

  if (!response.ok) {
    let backendMessage = '';
    try {
      const responseText = await response.text();
      if (responseText) {
        const messageMatch = responseText.match(/<Message>(.*?)<\/Message>/i);
        backendMessage = messageMatch?.[1] || responseText.slice(0, 200);
      }
    } catch (error) {
      backendMessage = '';
    }
    const suffix = backendMessage ? ` - ${backendMessage}` : '';
    throw new Error(`Cloud upload failed with status ${response.status}${suffix}`);
  }
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
  // Step 1: Create analysis draft
  createExecutionDraft: async ({
    name,
    csv_type_id,
    state,
    district,
    program_name,
    ai_model_id,
    program_ref_id,
    criterias_mode,
    threshold_config,
  }) => {
    const payload = {
      name,
      csv_type_id,
      state,
      district,
      program_name,
      ai_model_id,
      program_ref_id,
      criterias_mode,
      threshold_config,
    };
    const response = await apiClient.post('/executions/', payload);
    return response.data;
  },

  // Step 2: Get signed URL for file section
  requestExecutionFileUploadUrl: async (executionId, fileType, file) => {
    const payload = {
      file: {
        file_name: file.name,
        content_type: file.type || 'text/csv',
        size_bytes: file.size,
      },
    };
    const response = await apiClient.post(`/executions/${executionId}/files/${fileType}/upload-url`, payload);
    return response.data;
  },

  // Step 2 (common): Get signed URLs for multiple files at once
  getCommonExecutionUploadUrls: async (executionId, files) => {
    const payload = {
      request: {
        [executionId]: {
          files: files.map((file) => file.name),
        },
      },
      ref: 'execution',
    };
    const response = await apiClient.post('/cloud-services/getSignedUrl', payload);
    return response.data;
  },

  uploadToSignedUrl: async (signedUpload, file) => {
    await uploadFileToSignedUrl(signedUpload, file);
  },

  // Step 2: Confirm upload and detect rows/columns
  completeExecutionFileUpload: async (executionId, fileType) => {
    const response = await apiClient.post(`/executions/${executionId}/files/${fileType}/complete`);
    return response.data;
  },

  // Step 2 fallback: Upload via backend (avoids browser-to-cloud CORS issues)
  directUploadExecutionFile: async (executionId, fileType, file) => {
    const formData = new FormData();
    formData.append('execution_id', executionId);
    formData.append('file_type', fileType);
    formData.append('file', file);
    const response = await apiClient.post('/cloud-services/upload', formData);
    return response.data;
  },

  // Optimized: Upload both files in a single API call
  uploadBothFiles: async (executionId, inputFile, questionsFile) => {
    const formData = new FormData();
    formData.append('input_file', inputFile);
    formData.append('questions_file', questionsFile);
    const response = await apiClient.post(`/executions/${executionId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Step 3: Validate both uploaded files
  validateExecutionFiles: async (executionId) => {
    const response = await apiClient.post(`/executions/${executionId}/validate`);
    return response.data;
  },

  // Step 4: Start analysis
  startExecution: async (executionId) => {
    const response = await apiClient.post(`/executions/${executionId}/start`);
    return response.data;
  },

  // Create execution with signed URL upload flow
  createExecution: async ({
    name,
    csv_type_id,
    state,
    district,
    program_name,
    ai_model_id,
    program_ref_id,
    criterias_mode,
    inputFile,
    questionsFile,
  }) => {
    const initPayload = {
      name,
      csv_type_id,
      state,
      district,
      program_name,
      ai_model_id,
      program_ref_id,
      criterias_mode,
      input_file: {
        file_name: inputFile.name,
        content_type: inputFile.type || 'text/csv',
        size_bytes: inputFile.size,
      },
      questions_file: {
        file_name: questionsFile.name,
        content_type: questionsFile.type || 'text/csv',
        size_bytes: questionsFile.size,
      },
    };

    const initResponse = await apiClient.post('/executions/init-upload', initPayload);
    const initData = initResponse.data;

    await Promise.all([
      uploadFileToSignedUrl(initData.input_upload, inputFile),
      uploadFileToSignedUrl(initData.questions_upload, questionsFile),
    ]);

    const completeResponse = await apiClient.post(`/executions/${initData.execution_id}/complete-upload`);
    return completeResponse.data;
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

  // Update execution (only drafts)
  updateExecution: async (executionId, updateData) => {
    const response = await apiClient.patch(`/executions/${executionId}`, updateData);
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

export const configService = {
  listProjectCsvSourceTypes: async () => {
    const response = await apiClient.get('/config/list', {
      params: { type: 'project' },
    });
    const items = parseConfigResponse(response.data, 'project CSV source types');
    return items.map((item, index) => normalizeSourceTypeItem(item, index));
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

  // Download report using short-lived signed URL
  downloadReport: async (executionId, format = 'csv') => {
    const response = await apiClient.get(`/reports/${executionId}/download`, {
      params: { format },
    });

    const signedUrl = response?.data?.download_url;
    if (!signedUrl) {
      throw new Error('Signed download URL is missing.');
    }

    const link = document.createElement('a');
    link.href = signedUrl;
    link.setAttribute('download', `execution_${executionId}_report.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
