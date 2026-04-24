import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Papa from 'papaparse';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import './standard-report.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const REQUIRED_COLUMNS = [
  'UUID',
  'Declared State',
  'District',
  'Block',
  'School Name',
  'Tasks',
  'Project ID',
  'Project start date of the user',
  'Project completion date of the user',
  'Relevance Tag',
];

const RELEVANCE_TYPES = ['Relevant', 'Partially Relevant', 'Irrelevant'];

const emptyFilters = {
  state: '',
  district: '',
  block: '',
  school: '',
  relevance: '',
};

const relScore = (relevant, partiallyRelevant, total) => {
  if (!total) return 0;
  return ((relevant + partiallyRelevant * 0.5) / total) * 100;
};

const parseSubject = (task) => {
  if (!task) return 'Other';
  if (task.includes('विज्ञान')) return 'Science';
  if (task.includes('गणित')) return 'Math';
  if (task.includes('अंग्रेजी') || task.includes('English')) return 'English';
  return 'Other';
};

const parseGrade = (task) => {
  const match = (task || '').match(/कक्षा\s*(\d{1,2})/);
  return match ? `Grade ${match[1]}` : 'Unknown';
};

const normalizeValue = (value) => String(value || '').trim();

const getGroupKey = (dateStr, unit) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  if (unit === 'day') {
    return date.toISOString().split('T')[0];
  }

  if (unit === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  const dayOfWeek = date.getDay();
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - dayOfWeek);
  return startOfWeek.toISOString().split('T')[0];
};

const getTimelineUnit = (minDate, maxDate) => {
  if (!minDate || !maxDate) return 'month';
  if (
    minDate.getMonth() === maxDate.getMonth() &&
    minDate.getFullYear() === maxDate.getFullYear()
  ) {
    return 'day';
  }

  const diffMs = Math.abs(maxDate.getTime() - minDate.getTime());
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 183) return 'week';
  return 'month';
};

const sortEntries = (entries) => [...entries].sort((a, b) => a[0].localeCompare(b[0]));

const parseCsvText = (csvText) => {
  const parseResult = Papa.parse(csvText || '', {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors?.length) {
    const message = parseResult.errors[0]?.message || 'Invalid CSV format.';
    return { error: message, rows: [], headers: [] };
  }

  const headers = (parseResult.meta?.fields || []).map((field, index) => {
    const cleaned = normalizeValue(field);
    return index === 0 ? cleaned.replace(/^\ufeff/, '') : cleaned;
  });

  if (!headers.length) {
    return { error: 'CSV header row is missing.', rows: [], headers: [] };
  }

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length) {
    return {
      error: `Missing required CSV columns: ${missingColumns.join(', ')}`,
      rows: [],
      headers,
    };
  }

  const rows = (parseResult.data || [])
    .map((row) => {
      const normalized = {};
      headers.forEach((header) => {
        normalized[header] = normalizeValue(row?.[header]);
      });
      return normalized;
    })
    .filter((row) => Object.values(row).some((value) => value !== ''));

  if (!rows.length) {
    return { error: 'CSV contains no data rows.', rows: [], headers };
  }

  return { error: '', rows, headers };
};

const createNode = () => ({
  total: 0,
  Relevant: 0,
  'Partially Relevant': 0,
  Irrelevant: 0,
});

const updateNode = (node, relevanceTag) => {
  node.total += 1;
  if (RELEVANCE_TYPES.includes(relevanceTag)) {
    node[relevanceTag] += 1;
  }
};

const computeReportData = (rows) => {
  const totalEvidence = rows.length;

  const relevanceCounts = {
    Relevant: 0,
    'Partially Relevant': 0,
    Irrelevant: 0,
  };

  const statesSet = new Set();
  const usersSet = new Set();
  const schoolsSet = new Set();
  const districtsSet = new Set();
  const blocksSet = new Set();

  const subjectCounts = {};
  const gradeCounts = {};
  const taskCounts = {};

  const timeline = {
    day: { starts: {}, completions: {}, submissions: {}, relevant: {} },
    week: { starts: {}, completions: {}, submissions: {}, relevant: {} },
    month: { starts: {}, completions: {}, submissions: {}, relevant: {} },
  };

  const districtHierarchy = {};

  const teacherMap = {};
  const enrollment = {};
  let hasEnrollmentData = false;

  const customTaskHierarchy = {};
  let hasCustomTasks = false;

  let minDate = null;
  let maxDate = null;

  rows.forEach((row) => {
    const relevanceTag = normalizeValue(row['Relevance Tag']);
    const district = normalizeValue(row.District) || 'Unknown';
    const block = normalizeValue(row.Block) || 'Unknown';
    const school = normalizeValue(row['School Name']) || 'Unknown';
    const uuid = normalizeValue(row.UUID) || 'Unknown User';
    const task = normalizeValue(row.Tasks) || 'Unknown Task';

    const state = normalizeValue(row['Declared State']);
    if (state) statesSet.add(state.toUpperCase());

    if (RELEVANCE_TYPES.includes(relevanceTag)) {
      relevanceCounts[relevanceTag] += 1;
    }

    if (uuid) usersSet.add(uuid);
    if (school) schoolsSet.add(school);
    if (district) districtsSet.add(district);
    if (block) blocksSet.add(block);

    const subject = parseSubject(task);
    const grade = parseGrade(task);
    subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;

    taskCounts[task] = (taskCounts[task] || 0) + 1;

    const startDate = new Date(row['Project start date of the user']);
    const completionDate = new Date(row['Project completion date of the user']);

    [startDate, completionDate].forEach((candidate) => {
      if (!Number.isNaN(candidate.getTime())) {
        if (!minDate || candidate < minDate) minDate = new Date(candidate);
        if (!maxDate || candidate > maxDate) maxDate = new Date(candidate);
      }
    });

    ['day', 'week', 'month'].forEach((unit) => {
      const startKey = getGroupKey(row['Project start date of the user'], unit);
      const completionKey = getGroupKey(row['Project completion date of the user'], unit);

      if (startKey) {
        timeline[unit].starts[startKey] = (timeline[unit].starts[startKey] || 0) + 1;
      }

      if (completionKey) {
        timeline[unit].completions[completionKey] = (timeline[unit].completions[completionKey] || 0) + 1;
        timeline[unit].submissions[completionKey] = (timeline[unit].submissions[completionKey] || 0) + 1;
        if (relevanceTag === 'Relevant') {
          timeline[unit].relevant[completionKey] = (timeline[unit].relevant[completionKey] || 0) + 1;
        }
      }
    });

    if (!districtHierarchy[district]) {
      districtHierarchy[district] = {
        ...createNode(),
        blocks: {},
      };
    }
    updateNode(districtHierarchy[district], relevanceTag);

    if (!districtHierarchy[district].blocks[block]) {
      districtHierarchy[district].blocks[block] = {
        ...createNode(),
        schools: {},
      };
    }
    updateNode(districtHierarchy[district].blocks[block], relevanceTag);

    if (!districtHierarchy[district].blocks[block].schools[school]) {
      districtHierarchy[district].blocks[block].schools[school] = {
        ...createNode(),
      };
    }
    updateNode(districtHierarchy[district].blocks[block].schools[school], relevanceTag);

    const teacherKey = `${district}||${block}||${school}||${uuid}`;
    if (!teacherMap[teacherKey]) {
      teacherMap[teacherKey] = {
        district,
        block,
        school,
        teacher: uuid,
        ...createNode(),
      };
    }
    updateNode(teacherMap[teacherKey], relevanceTag);

    const enrollment2024 = Number.parseFloat(row.Enrollment_2024);
    const enrollment2025 = Number.parseFloat(row.Enrollment_2025);
    const enrollmentGrowth = Number.parseFloat(row.Enrollment_Increase_Percentage);

    const hasEnrollmentRowData =
      Number.isFinite(enrollment2024) ||
      Number.isFinite(enrollment2025) ||
      Number.isFinite(enrollmentGrowth);

    if (hasEnrollmentRowData) {
      hasEnrollmentData = true;

      if (!enrollment[district]) {
        enrollment[district] = {
          enrollment2024: 0,
          enrollment2025: 0,
          count2024: 0,
          count2025: 0,
          growthSum: 0,
          growthCount: 0,
          blocks: {},
        };
      }
      if (!enrollment[district].blocks[block]) {
        enrollment[district].blocks[block] = {
          enrollment2024: 0,
          enrollment2025: 0,
          count2024: 0,
          count2025: 0,
          growthSum: 0,
          growthCount: 0,
          schools: {},
        };
      }
      if (!enrollment[district].blocks[block].schools[school]) {
        enrollment[district].blocks[block].schools[school] = {
          enrollment2024: 0,
          enrollment2025: 0,
          count2024: 0,
          count2025: 0,
          growthSum: 0,
          growthCount: 0,
        };
      }

      const districtNode = enrollment[district];
      const blockNode = enrollment[district].blocks[block];
      const schoolNode = enrollment[district].blocks[block].schools[school];

      if (Number.isFinite(enrollment2024)) {
        districtNode.enrollment2024 += enrollment2024;
        districtNode.count2024 += 1;
        blockNode.enrollment2024 += enrollment2024;
        blockNode.count2024 += 1;
        schoolNode.enrollment2024 += enrollment2024;
        schoolNode.count2024 += 1;
      }

      if (Number.isFinite(enrollment2025)) {
        districtNode.enrollment2025 += enrollment2025;
        districtNode.count2025 += 1;
        blockNode.enrollment2025 += enrollment2025;
        blockNode.count2025 += 1;
        schoolNode.enrollment2025 += enrollment2025;
        schoolNode.count2025 += 1;
      }

      if (Number.isFinite(enrollmentGrowth)) {
        districtNode.growthSum += enrollmentGrowth;
        districtNode.growthCount += 1;
        blockNode.growthSum += enrollmentGrowth;
        blockNode.growthCount += 1;
        schoolNode.growthSum += enrollmentGrowth;
        schoolNode.growthCount += 1;
      }
    }

    if (normalizeValue(row['Task Type']) === 'User-Owned') {
      hasCustomTasks = true;

      if (!customTaskHierarchy[district]) {
        customTaskHierarchy[district] = { ...createNode(), blocks: {} };
      }
      updateNode(customTaskHierarchy[district], relevanceTag);

      if (!customTaskHierarchy[district].blocks[block]) {
        customTaskHierarchy[district].blocks[block] = { ...createNode(), schools: {} };
      }
      updateNode(customTaskHierarchy[district].blocks[block], relevanceTag);

      if (!customTaskHierarchy[district].blocks[block].schools[school]) {
        customTaskHierarchy[district].blocks[block].schools[school] = { ...createNode() };
      }
      updateNode(customTaskHierarchy[district].blocks[block].schools[school], relevanceTag);
    }
  });

  const timelineUnit = getTimelineUnit(minDate, maxDate);
  const starts = timeline[timelineUnit].starts;
  const completions = timeline[timelineUnit].completions;
  const submissions = timeline[timelineUnit].submissions;
  const relevant = timeline[timelineUnit].relevant;

  const timelineLabels = Array.from(new Set([...Object.keys(starts), ...Object.keys(completions)])).sort();
  const submissionLabels = Array.from(new Set([...Object.keys(submissions), ...Object.keys(relevant)])).sort();

  const taskEntries = Object.entries(taskCounts)
    .filter(([taskName]) => taskName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const sortedDistricts = sortEntries(Object.entries(districtHierarchy));

  const topHierarchy = sortedDistricts
    .map(([district, districtData]) => {
      const blocks = Object.entries(districtData.blocks)
        .map(([block, blockData]) => ({
          block,
          ...blockData,
          relevancePercent: relScore(
            blockData.Relevant,
            blockData['Partially Relevant'],
            blockData.total
          ),
          schools: Object.entries(blockData.schools)
            .map(([school, schoolData]) => ({
              school,
              ...schoolData,
              relevancePercent: relScore(
                schoolData.Relevant,
                schoolData['Partially Relevant'],
                schoolData.total
              ),
              teachers: Object.values(teacherMap)
                .filter(
                  (teacherRow) =>
                    teacherRow.district === district &&
                    teacherRow.block === block &&
                    teacherRow.school === school
                )
                .map((teacherRow) => ({
                  teacher: teacherRow.teacher,
                  ...teacherRow,
                  relevancePercent: relScore(
                    teacherRow.Relevant,
                    teacherRow['Partially Relevant'],
                    teacherRow.total
                  ),
                }))
                .sort((a, b) => b.relevancePercent - a.relevancePercent)
                .slice(0, 5),
            }))
            .sort((a, b) => b.relevancePercent - a.relevancePercent)
            .slice(0, 5),
        }))
        .sort((a, b) => b.relevancePercent - a.relevancePercent)
        .slice(0, 5);

      return {
        district,
        ...districtData,
        relevancePercent: relScore(
          districtData.Relevant,
          districtData['Partially Relevant'],
          districtData.total
        ),
        blocks,
      };
    })
    .sort((a, b) => b.relevancePercent - a.relevancePercent)
    .slice(0, 5);

  return {
    totalEvidence,
    relevanceCounts,
    usersCount: usersSet.size,
    schoolsCount: schoolsSet.size,
    districtsCount: districtsSet.size,
    blocksCount: blocksSet.size,
    statesUpper: statesSet,
    subjectCounts,
    gradeCounts,
    timelineLabels,
    timelineStarts: timelineLabels.map((label) => starts[label] || 0),
    timelineCompletions: timelineLabels.map((label) => completions[label] || 0),
    submissionLabels,
    submissionTotal: submissionLabels.map((label) => submissions[label] || 0),
    submissionRelevant: submissionLabels.map((label) => relevant[label] || 0),
    taskEntries,
    districtHierarchy,
    sortedDistricts,
    topHierarchy,
    hasEnrollmentData,
    enrollment,
    hasCustomTasks,
    customTaskHierarchy,
  };
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-IN');
};

const StandardReportRenderer = ({ csvText, sourceLabel = 'Report CSV' }) => {
  const reportRef = useRef(null);

  const [filters, setFilters] = useState(emptyFilters);
  const [expandedDistricts, setExpandedDistricts] = useState(new Set());
  const [expandedBlocks, setExpandedBlocks] = useState(new Set());
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setFilters(emptyFilters);
    setExpandedDistricts(new Set());
    setExpandedBlocks(new Set());
  }, [csvText]);

  const parsed = useMemo(() => parseCsvText(csvText), [csvText]);

  const filterOptions = useMemo(() => {
    const rows = parsed.rows;

    const states = Array.from(new Set(rows.map((row) => normalizeValue(row['Declared State'])).filter(Boolean))).sort();

    const districts = Array.from(
      new Set(
        rows
          .filter((row) => !filters.state || normalizeValue(row['Declared State']) === filters.state)
          .map((row) => normalizeValue(row.District))
          .filter(Boolean)
      )
    ).sort();

    const blocks = Array.from(
      new Set(
        rows
          .filter((row) => {
            if (filters.state && normalizeValue(row['Declared State']) !== filters.state) return false;
            if (filters.district && normalizeValue(row.District) !== filters.district) return false;
            return true;
          })
          .map((row) => normalizeValue(row.Block))
          .filter(Boolean)
      )
    ).sort();

    const schools = Array.from(
      new Set(
        rows
          .filter((row) => {
            if (filters.state && normalizeValue(row['Declared State']) !== filters.state) return false;
            if (filters.district && normalizeValue(row.District) !== filters.district) return false;
            if (filters.block && normalizeValue(row.Block) !== filters.block) return false;
            return true;
          })
          .map((row) => normalizeValue(row['School Name']))
          .filter(Boolean)
      )
    ).sort();

    return { states, districts, blocks, schools };
  }, [filters.block, filters.district, filters.state, parsed.rows]);

  const filteredRows = useMemo(() => {
    return parsed.rows.filter((row) => {
      if (filters.state && normalizeValue(row['Declared State']) !== filters.state) return false;
      if (filters.district && normalizeValue(row.District) !== filters.district) return false;
      if (filters.block && normalizeValue(row.Block) !== filters.block) return false;
      if (filters.school && normalizeValue(row['School Name']) !== filters.school) return false;
      if (filters.relevance && normalizeValue(row['Relevance Tag']) !== filters.relevance) return false;
      return true;
    });
  }, [filters.block, filters.district, filters.relevance, filters.school, filters.state, parsed.rows]);

  const reportData = useMemo(() => computeReportData(filteredRows), [filteredRows]);

  const shouldShowSubjectGrade = reportData.statesUpper.has('BIHAR');

  const enrollmentDistrictRows = useMemo(() => {
    return Object.entries(reportData.enrollment).map(([district, districtData]) => {
      const growth =
        districtData.enrollment2024 > 0
          ? ((districtData.enrollment2025 - districtData.enrollment2024) / districtData.enrollment2024) * 100
          : 0;
      return {
        district,
        ...districtData,
        growth,
        difference: districtData.enrollment2025 - districtData.enrollment2024,
      };
    });
  }, [reportData.enrollment]);

  const toggleDistrict = (district) => {
    setExpandedDistricts((previous) => {
      const next = new Set(previous);
      if (next.has(district)) {
        next.delete(district);
      } else {
        next.add(district);
      }
      return next;
    });
  };

  const toggleBlock = (district, block) => {
    const key = `${district}||${block}`;
    setExpandedBlocks((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const downloadPdf = async () => {
    if (!reportRef.current || pdfLoading) {
      return;
    }

    setPdfLoading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imageData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imageData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imageData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('evidence-analysis-report.pdf');
    } finally {
      setPdfLoading(false);
    }
  };

  if (parsed.error) {
    return (
      <div className="report-error">
        <p className="report-error-title">Unable to render report</p>
        <p className="report-error-body">{parsed.error}</p>
      </div>
    );
  }

  if (!parsed.rows.length) {
    return null;
  }

  return (
    <div className="report-dashboard">
      <div className="report-header">
        <div>
          <h2>MIP Evidence Analysis Dashboard</h2>
          <p>{sourceLabel}</p>
        </div>
        <Button type="button" onClick={downloadPdf} disabled={pdfLoading} className="report-download-btn">
          <Download className="h-4 w-4" />
          {pdfLoading ? 'Generating PDF...' : 'Download PDF'}
        </Button>
      </div>

      <div className="report-filter-panel">
        <div className="report-filter-grid">
          <label>
            State
            <select
              value={filters.state}
              onChange={(event) => setFilters((previous) => ({ ...previous, state: event.target.value, district: '', block: '', school: '' }))}
            >
              <option value="">All States</option>
              {filterOptions.states.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </label>

          <label>
            District
            <select
              value={filters.district}
              onChange={(event) => setFilters((previous) => ({ ...previous, district: event.target.value, block: '', school: '' }))}
            >
              <option value="">All Districts</option>
              {filterOptions.districts.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </label>

          <label>
            Block
            <select
              value={filters.block}
              onChange={(event) => setFilters((previous) => ({ ...previous, block: event.target.value, school: '' }))}
            >
              <option value="">All Blocks</option>
              {filterOptions.blocks.map((block) => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>
          </label>

          <label>
            School
            <select
              value={filters.school}
              onChange={(event) => setFilters((previous) => ({ ...previous, school: event.target.value }))}
            >
              <option value="">All Schools</option>
              {filterOptions.schools.map((school) => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </label>

          <label>
            Relevance Tag
            <select
              value={filters.relevance}
              onChange={(event) => setFilters((previous) => ({ ...previous, relevance: event.target.value }))}
            >
              <option value="">All Relevance</option>
              {RELEVANCE_TYPES.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="report-filter-actions">
          <Button type="button" variant="outline" onClick={() => setFilters(emptyFilters)}>
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="report-content" ref={reportRef}>
        <section className="report-section">
          <h3>📊 Executive Summary</h3>
          <div className="report-grid report-grid-3">
            <div className="report-card">
              <p>Total Evidence</p>
              <strong>{formatNumber(reportData.totalEvidence)}</strong>
            </div>
            <div className="report-card">
              <p>Relevance Distribution</p>
              <strong>{formatNumber(reportData.relevanceCounts.Relevant)} Relevant</strong>
              <span>{formatNumber(reportData.relevanceCounts['Partially Relevant'])} Partially Relevant</span>
              <span>{formatNumber(reportData.relevanceCounts.Irrelevant)} Irrelevant</span>
            </div>
            <div className="report-card">
              <p>Participation</p>
              <strong>{formatNumber(reportData.usersCount)}</strong>
              <span>Users with MIPs</span>
            </div>
          </div>
        </section>

        <section className="report-section">
          <h3>📈 Evidence Submission Overview</h3>
          <div className="report-grid report-grid-4">
            <div className="report-card"><p>Schools</p><strong>{formatNumber(reportData.schoolsCount)}</strong></div>
            <div className="report-card"><p>Districts</p><strong>{formatNumber(reportData.districtsCount)}</strong></div>
            <div className="report-card"><p>Blocks</p><strong>{formatNumber(reportData.blocksCount)}</strong></div>
            <div className="report-card"><p>Visible Evidence</p><strong>{formatNumber(reportData.totalEvidence)}</strong></div>
          </div>

          <div className="report-chart-grid report-chart-grid-stacked">
            <div className="report-chart-card">
              <h4>Project Timeline</h4>
              <Line
                data={{
                  labels: reportData.timelineLabels,
                  datasets: [
                    {
                      label: 'Project Starts',
                      data: reportData.timelineStarts,
                      borderColor: '#4facfe',
                      backgroundColor: 'rgba(79, 172, 254, 0.2)',
                      fill: true,
                      tension: 0.35,
                    },
                    {
                      label: 'Project Completions',
                      data: reportData.timelineCompletions,
                      borderColor: '#42e695',
                      backgroundColor: 'rgba(66, 230, 149, 0.2)',
                      fill: true,
                      tension: 0.35,
                    },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
              />
            </div>

            <div className="report-chart-card">
              <h4>Submission Volume</h4>
              <Line
                data={{
                  labels: reportData.submissionLabels,
                  datasets: [
                    {
                      label: 'Total Evidence',
                      data: reportData.submissionTotal,
                      borderColor: '#4facfe',
                      backgroundColor: 'rgba(79, 172, 254, 0.2)',
                      fill: true,
                      tension: 0.35,
                    },
                    {
                      label: 'Relevant Evidence',
                      data: reportData.submissionRelevant,
                      borderColor: '#ff6b6b',
                      backgroundColor: 'rgba(255, 107, 107, 0.2)',
                      fill: true,
                      tension: 0.35,
                    },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
              />
            </div>
          </div>

          {shouldShowSubjectGrade && (
            <div className="report-chart-grid">
              <div className="report-chart-card">
                <h4>Subject Distribution</h4>
                <Doughnut
                  data={{
                    labels: Object.keys(reportData.subjectCounts),
                    datasets: [
                      {
                        data: Object.values(reportData.subjectCounts),
                        backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#feca57', '#96ceb4'],
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
              <div className="report-chart-card">
                <h4>Grade Distribution</h4>
                <Doughnut
                  data={{
                    labels: Object.keys(reportData.gradeCounts),
                    datasets: [
                      {
                        data: Object.values(reportData.gradeCounts),
                        backgroundColor: ['#a8e6cf', '#dcedc1', '#ffd3a5', '#fd9853', '#ff8a80'],
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="report-section">
          <h3>🎯 Quality & Relevance Analysis</h3>
          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Relevant</th>
                  <th>Partially Relevant</th>
                  <th>Irrelevant</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatNumber(reportData.relevanceCounts.Relevant)}</td>
                  <td>{formatNumber(reportData.relevanceCounts['Partially Relevant'])}</td>
                  <td>{formatNumber(reportData.relevanceCounts.Irrelevant)}</td>
                  <td>{formatNumber(reportData.totalEvidence)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="report-chart-card report-tall-chart">
            <h4>Task Completion Analysis</h4>
            <Bar
              data={{
                labels: reportData.taskEntries.map(([task]) => task),
                datasets: [
                  {
                    label: 'Task Completion Count',
                    data: reportData.taskEntries.map(([, count]) => count),
                    backgroundColor: 'rgba(79, 172, 254, 0.8)',
                    borderColor: '#4facfe',
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    ticks: {
                      callback(value) {
                        const label = this.getLabelForValue(value);
                        return label.length > 40 ? `${label.slice(0, 40)}...` : label;
                      },
                    },
                  },
                  y: { beginAtZero: true },
                },
              }}
            />
          </div>
        </section>

        <section className="report-section">
          <h3>🗺️ District-wise Submission Quality & Insights</h3>
          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>District / Block / School</th>
                  <th>Total</th>
                  <th>Relevant</th>
                  <th>Partially Relevant</th>
                  <th>Irrelevant</th>
                  <th>% Relevant</th>
                </tr>
              </thead>
              <tbody>
                {reportData.sortedDistricts.map(([district, districtData]) => {
                  const districtScore = relScore(
                    districtData.Relevant,
                    districtData['Partially Relevant'],
                    districtData.total
                  );
                  const districtExpanded = expandedDistricts.has(district);

                  return (
                    <Fragment key={district}>
                      <tr className="clickable-row" onClick={() => toggleDistrict(district)}>
                        <td><strong>{districtExpanded ? '▼' : '▶'} {district}</strong></td>
                        <td>{formatNumber(districtData.total)}</td>
                        <td>{formatNumber(districtData.Relevant)}</td>
                        <td>{formatNumber(districtData['Partially Relevant'])}</td>
                        <td>{formatNumber(districtData.Irrelevant)}</td>
                        <td>{districtScore.toFixed(1)}%</td>
                      </tr>

                      {districtExpanded && Object.entries(districtData.blocks).map(([block, blockData]) => {
                        const blockKey = `${district}||${block}`;
                        const blockExpanded = expandedBlocks.has(blockKey);
                        const blockScore = relScore(
                          blockData.Relevant,
                          blockData['Partially Relevant'],
                          blockData.total
                        );

                        return (
                          <Fragment key={blockKey}>
                            <tr className="clickable-row report-row-block" onClick={() => toggleBlock(district, block)}>
                              <td>{blockExpanded ? '▼' : '▶'} {block}</td>
                              <td>{formatNumber(blockData.total)}</td>
                              <td>{formatNumber(blockData.Relevant)}</td>
                              <td>{formatNumber(blockData['Partially Relevant'])}</td>
                              <td>{formatNumber(blockData.Irrelevant)}</td>
                              <td>{blockScore.toFixed(1)}%</td>
                            </tr>

                            {blockExpanded && Object.entries(blockData.schools).map(([school, schoolData]) => {
                              const schoolScore = relScore(
                                schoolData.Relevant,
                                schoolData['Partially Relevant'],
                                schoolData.total
                              );
                              return (
                                <tr key={`${blockKey}||${school}`} className="report-row-school">
                                  <td>{school}</td>
                                  <td>{formatNumber(schoolData.total)}</td>
                                  <td>{formatNumber(schoolData.Relevant)}</td>
                                  <td>{formatNumber(schoolData['Partially Relevant'])}</td>
                                  <td>{formatNumber(schoolData.Irrelevant)}</td>
                                  <td>{schoolScore.toFixed(1)}%</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section">
          <h3>🏆 Top Relevance Hierarchy</h3>
          <p className="report-muted">Top 5 Districts → Top 5 Blocks → Top 5 Schools → Top 5 Teachers</p>
          <div className="report-hierarchy-grid">
            {reportData.topHierarchy.map((district) => (
              <div key={district.district} className="report-hierarchy-card">
                <h4>{district.district}</h4>
                <p>{district.relevancePercent.toFixed(1)}% relevance</p>
                {district.blocks.map((block) => (
                  <div key={`${district.district}-${block.block}`} className="report-hierarchy-block">
                    <strong>{block.block}</strong> ({block.relevancePercent.toFixed(1)}%)
                    {block.schools.map((school) => (
                      <div key={`${district.district}-${block.block}-${school.school}`} className="report-hierarchy-school">
                        <span>{school.school} ({school.relevancePercent.toFixed(1)}%)</span>
                        {school.teachers.slice(0, 3).map((teacher) => (
                          <small key={`${district.district}-${block.block}-${school.school}-${teacher.teacher}`}>
                            {teacher.teacher} ({teacher.relevancePercent.toFixed(1)}%)
                          </small>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {reportData.hasEnrollmentData && (
          <section className="report-section">
            <h3>📚 Enrollment Analytics</h3>
            <div className="report-grid report-grid-3">
              <div className="report-card">
                <p>Total Enrollment 2024</p>
                <strong>{formatNumber(enrollmentDistrictRows.reduce((sum, row) => sum + row.enrollment2024, 0))}</strong>
              </div>
              <div className="report-card">
                <p>Total Enrollment 2025</p>
                <strong>{formatNumber(enrollmentDistrictRows.reduce((sum, row) => sum + row.enrollment2025, 0))}</strong>
              </div>
              <div className="report-card">
                <p>Districts with Data</p>
                <strong>{formatNumber(enrollmentDistrictRows.length)}</strong>
              </div>
            </div>

            <div className="report-chart-grid">
              <div className="report-chart-card">
                <h4>Enrollment 2024 vs 2025 by District</h4>
                <Bar
                  data={{
                    labels: enrollmentDistrictRows.map((row) => row.district),
                    datasets: [
                      {
                        label: 'Enrollment 2024',
                        data: enrollmentDistrictRows.map((row) => row.enrollment2024),
                        backgroundColor: 'rgba(79, 172, 254, 0.8)',
                      },
                      {
                        label: 'Enrollment 2025',
                        data: enrollmentDistrictRows.map((row) => row.enrollment2025),
                        backgroundColor: 'rgba(66, 230, 149, 0.8)',
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
              <div className="report-chart-card">
                <h4>Enrollment Growth (%) by District</h4>
                <Bar
                  data={{
                    labels: enrollmentDistrictRows.map((row) => row.district),
                    datasets: [
                      {
                        label: 'Growth %',
                        data: enrollmentDistrictRows.map((row) => row.growth),
                        backgroundColor: enrollmentDistrictRows.map((row) =>
                          row.growth >= 0 ? 'rgba(66, 230, 149, 0.8)' : 'rgba(255, 107, 107, 0.8)'
                        ),
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
            </div>

            <div className="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Enrollment 2024</th>
                    <th>Enrollment 2025</th>
                    <th>Difference</th>
                    <th>Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollmentDistrictRows
                    .sort((a, b) => b.enrollment2025 - a.enrollment2025)
                    .map((row) => (
                      <tr key={row.district}>
                        <td>{row.district}</td>
                        <td>{formatNumber(row.enrollment2024)}</td>
                        <td>{formatNumber(row.enrollment2025)}</td>
                        <td>{formatNumber(row.difference)}</td>
                        <td>{row.growth.toFixed(2)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {reportData.hasCustomTasks && (
          <section className="report-section">
            <h3>🧩 User-Owned Tasks Analysis</h3>
            <div className="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Total Custom Tasks</th>
                    <th>Relevant</th>
                    <th>Partially Relevant</th>
                    <th>Irrelevant</th>
                    <th>% Relevant</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.customTaskHierarchy).map(([district, districtData]) => {
                    const score = relScore(
                      districtData.Relevant,
                      districtData['Partially Relevant'],
                      districtData.total
                    );
                    return (
                      <tr key={district}>
                        <td>{district}</td>
                        <td>{formatNumber(districtData.total)}</td>
                        <td>{formatNumber(districtData.Relevant)}</td>
                        <td>{formatNumber(districtData['Partially Relevant'])}</td>
                        <td>{formatNumber(districtData.Irrelevant)}</td>
                        <td>{score.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

StandardReportRenderer.propTypes = {
  csvText: PropTypes.string.isRequired,
  sourceLabel: PropTypes.string,
};

export default StandardReportRenderer;
