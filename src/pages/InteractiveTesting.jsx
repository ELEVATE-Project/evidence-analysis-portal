import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ENV } from '../config/env';
import { executionService, getApiErrorMessage } from '../services/executionService';

const MAX_CRITERIA = ENV.VALIDATE_CRITERIA_MAX_ITEMS;
const DEFAULT_PROMPT =
  "You are an educational evidence validator. Analyze this image as field evidence from a PBL classroom in Bihar, India. Answer each evidence criteria with ONLY 'YES' or 'NO'. Consider all visible elements and context. Explain your reasoning for each answer briefly.";
const PREVIEW_IMAGE_CLASS = 'h-auto max-h-[420px] w-full rounded-md border border-slate-200 bg-slate-50 object-contain';

const getAnswerBadgeClass = (answer) => {
  const normalized = `${answer || ''}`.trim().toUpperCase();
  if (normalized.startsWith('YES')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized.startsWith('NO')) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const getRelevanceBadgeClass = (relevanceTag) => {
  if (relevanceTag === 'Relevant') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (relevanceTag === 'Partially Relevant') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-700';
};

const InteractiveTesting = () => {
  // Hidden for demo - show "Coming Soon" message
  const DEMO_MODE = true;

  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [criteriaInputs, setCriteriaInputs] = useState([{ id: 1, value: '' }]);
  const [submittedCriteria, setSubmittedCriteria] = useState([]);
  const [submittedEvidenceUrl, setSubmittedEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState({
    status: 'idle',
    url: '',
    error: '',
    requestId: 0,
  });
  const nextCriteriaIdRef = useRef(2);

  const activeCriteriaCount = useMemo(() => {
    return criteriaInputs.map((item) => item.value.trim()).filter(Boolean).length;
  }, [criteriaInputs]);

  const criteriaRows = useMemo(() => {
    if (Array.isArray(result?.criteria_results) && result.criteria_results.length > 0) {
      return result.criteria_results;
    }
    return submittedCriteria.map((criteria, index) => ({
      evidence_criteria: criteria,
      answer: result?.answers?.[index] || 'NO',
      reasoning: result?.reasonings?.[index] || 'Reasoning unavailable.',
    }));
  }, [result?.answers, result?.criteria_results, result?.reasonings, submittedCriteria]);

  const criteriaLimitReached = criteriaInputs.length >= MAX_CRITERIA;

  const handleCriteriaChange = (targetId, value) => {
    setCriteriaInputs((current) =>
      current.map((item) => (item.id === targetId ? { ...item, value } : item))
    );
  };

  const handleAddCriteria = () => {
    if (criteriaLimitReached) {
      return;
    }
    const nextId = nextCriteriaIdRef.current;
    nextCriteriaIdRef.current += 1;
    setCriteriaInputs((current) => [...current, { id: nextId, value: '' }]);
  };

  const handleRemoveCriteria = (targetId) => {
    setCriteriaInputs((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((item) => item.id !== targetId);
    });
  };

  const handleValidate = async () => {
    const normalizedUrl = evidenceUrl.trim();
    const normalizedCriteria = criteriaInputs.map((item) => item.value.trim()).filter(Boolean);
    const normalizedPrompt = prompt.trim();

    setGlobalError('');
    setResult(null);
    if (!normalizedUrl) {
      setGlobalError('Evidence URL is required.');
      return;
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setGlobalError('Evidence URL must start with http:// or https://');
        return;
      }
    } catch (error) {
      setGlobalError('Enter a valid Evidence URL.');
      return;
    }
    if (normalizedCriteria.length === 0) {
      setGlobalError('Add at least one Evidence Criteria to run validation.');
      return;
    }
    if (normalizedCriteria.length > MAX_CRITERIA) {
      setGlobalError(`Maximum ${MAX_CRITERIA} Evidence Criteria are allowed.`);
      return;
    }

    setSubmitting(true);
    setSubmittedCriteria(normalizedCriteria);
    setSubmittedEvidenceUrl(normalizedUrl);
    setPreview((current) => ({
      status: 'loading',
      url: normalizedUrl,
      error: '',
      requestId: current.requestId + 1,
    }));
    try {
      const response = await executionService.validateCriteria({
        evidence_url: normalizedUrl,
        evidence_criteria: normalizedCriteria,
        prompt: normalizedPrompt || null,
      });
      setResult(response);
    } catch (error) {
      setResult(null);
      setGlobalError(getApiErrorMessage(error, 'Unable to validate criteria right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Demo mode: Show "Coming Soon" message
  if (DEMO_MODE) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-slate-200 shadow-sm max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-blue-500" />
            <h2 className="text-2xl font-semibold text-slate-800 mb-2">Coming Soon</h2>
            <p className="text-slate-600">
              The Validate Criteria feature will be available soon. Stay tuned!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Validate Criteria</h2>
          <p className="mt-1 text-sm text-slate-600">
            Validate evidence criteria with Gemini before running a full analysis execution.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-12">
        <Card className="border-slate-200 shadow-sm 2xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-lg text-slate-800">Validation Inputs</CardTitle>
            <CardDescription>
              Provide an evidence image URL, dynamically add Evidence Criteria, and adjust the prompt if needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="evidenceUrl" className="text-slate-700">
                Evidence URL
              </Label>
              <Input
                id="evidenceUrl"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                placeholder="https://example.com/evidence-image.jpg"
                className="border-slate-300 bg-white text-slate-800"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700">Evidence Criteria</Label>
                <span className="text-xs text-slate-500">
                  {activeCriteriaCount} active • {criteriaInputs.length}/{MAX_CRITERIA}
                </span>
              </div>
              <div className="space-y-3">
                {criteriaInputs.map((item, index) => (
                  <div key={item.id} className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`criteria-${item.id}`} className="text-xs text-slate-600">
                        Evidence Criteria {index + 1}
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-slate-300 px-2 text-slate-600 hover:bg-slate-100"
                        onClick={() => handleRemoveCriteria(item.id)}
                        disabled={criteriaInputs.length <= 1}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                    <textarea
                      id={`criteria-${item.id}`}
                      value={item.value}
                      onChange={(event) => handleCriteriaChange(item.id, event.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                      placeholder={`Enter evidence criteria ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleAddCriteria}
                disabled={criteriaLimitReached}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Evidence Criteria
              </Button>
              {criteriaLimitReached ? (
                <p className="text-xs text-amber-700">
                  Maximum {MAX_CRITERIA} Evidence Criteria can be added.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="validationPrompt" className="text-slate-700">
                Prompt (Editable)
              </Label>
              <textarea
                id="validationPrompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
                placeholder="Customize the validation prompt"
              />
            </div>

            <Button
              type="button"
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => void handleValidate()}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Validate Criteria
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 2xl:col-span-7">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Image Preview</CardTitle>
              <CardDescription>
                Preview is attempted after clicking Validate Criteria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!submittedEvidenceUrl ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <ImageIcon className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700">Preview not available yet.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Submit a validation request to load the image preview.
                  </p>
                </div>
              ) : null}

              {submittedEvidenceUrl ? (
                <div className="space-y-2">
                  {preview.status === 'loading' ? (
                    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading image preview...
                    </div>
                  ) : null}
                  {preview.status === 'ready' || preview.status === 'loading' ? (
                    <img
                      key={`${preview.url}-${preview.requestId}`}
                      src={preview.url || submittedEvidenceUrl}
                      alt="Evidence preview"
                      className={`${PREVIEW_IMAGE_CLASS} ${preview.status === 'ready' ? 'opacity-100' : 'opacity-50'}`}
                      onLoad={() =>
                        setPreview((current) =>
                          current.url === submittedEvidenceUrl
                            ? { ...current, status: 'ready', error: '' }
                            : current
                        )
                      }
                      onError={() =>
                        setPreview((current) =>
                          current.url === submittedEvidenceUrl
                            ? {
                                ...current,
                                status: 'error',
                                error: 'Image preview failed to load. The URL may be private, expired, or invalid.',
                              }
                            : current
                        )
                      }
                    />
                  ) : null}
                  {preview.status === 'error' ? (
                    <p className="text-xs text-slate-500">Preview skipped for this URL.</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Validation Output</CardTitle>
              <CardDescription>
                Review relevance and criterion-level answers before using these criteria in production runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitting ? (
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gemini validation is in progress...
                </div>
              ) : null}

              {globalError ? (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{globalError}</span>
                </div>
              ) : null}

              {!submitting && !globalError && !result ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-700">Output will appear after validation.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Add evidence URL and evidence criteria, then run Validate Criteria.
                  </p>
                </div>
              ) : null}

              {result ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:text-sm">
                    <div className="text-slate-700">
                      <span className="font-medium text-slate-800">Source:</span> {result.source}
                      <span className="mx-2 text-slate-400">•</span>
                      <span className="font-medium text-slate-800">Model:</span> {result.model}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getRelevanceBadgeClass(result.relevance_tag)}`}
                    >
                      {result.relevance_tag}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {criteriaRows.map((row, index) => (
                      <section
                        key={`criteria-output-${index}`}
                        className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {index + 1}. {row.evidence_criteria}
                          </h4>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getAnswerBadgeClass(row.answer)}`}
                          >
                            {(row.answer || 'NO').trim()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{row.reasoning || 'Reasoning unavailable.'}</p>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InteractiveTesting;
