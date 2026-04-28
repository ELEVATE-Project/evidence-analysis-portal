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
import { Download, Filter, BarChart3, Users, School, Building2, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
const MAX_TOP_HIERARCHY_ITEMS = 15;
const REQUIRED_ENROLLMENT_COLUMNS = [
  'Enrollment_2024',
  'Enrollment_2025',
  'Enrollment_Increase_Percentage',
];

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
                .slice(0, MAX_TOP_HIERARCHY_ITEMS),
            }))
            .sort((a, b) => b.relevancePercent - a.relevancePercent)
            .slice(0, MAX_TOP_HIERARCHY_ITEMS),
        }))
        .sort((a, b) => b.relevancePercent - a.relevancePercent)
        .slice(0, MAX_TOP_HIERARCHY_ITEMS);

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
  const [topHierarchyCount, setTopHierarchyCount] = useState(5);
  const [expandedTopDistricts, setExpandedTopDistricts] = useState(new Set());
  const [expandedTopBlocks, setExpandedTopBlocks] = useState(new Set());
  const [expandedTopSchools, setExpandedTopSchools] = useState(new Set());
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setFilters(emptyFilters);
    setExpandedDistricts(new Set());
    setExpandedBlocks(new Set());
    setTopHierarchyCount(5);
    setExpandedTopDistricts(new Set());
    setExpandedTopBlocks(new Set());
    setExpandedTopSchools(new Set());
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
  const hasRequiredEnrollmentColumns = useMemo(
    () => REQUIRED_ENROLLMENT_COLUMNS.every((column) => parsed.headers.includes(column)),
    [parsed.headers]
  );

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

  const enrollmentDistrictRowsSorted = useMemo(() => {
    return [...enrollmentDistrictRows].sort((a, b) => b.enrollment2025 - a.enrollment2025);
  }, [enrollmentDistrictRows]);

  const enrollmentSummary = useMemo(() => {
    return enrollmentDistrictRows.reduce(
      (accumulator, row) => ({
        enrollment2024: accumulator.enrollment2024 + row.enrollment2024,
        enrollment2025: accumulator.enrollment2025 + row.enrollment2025,
        districtCount: accumulator.districtCount + 1,
      }),
      {
        enrollment2024: 0,
        enrollment2025: 0,
        districtCount: 0,
      }
    );
  }, [enrollmentDistrictRows]);

  const visibleTopHierarchy = useMemo(() => {
    const trimTeachers = (teachers) => teachers.slice(0, topHierarchyCount);
    const trimSchools = (schools) =>
      schools.slice(0, topHierarchyCount).map((school) => ({
        ...school,
        teachers: trimTeachers(school.teachers),
      }));
    const trimBlocks = (blocks) =>
      blocks.slice(0, topHierarchyCount).map((block) => ({
        ...block,
        schools: trimSchools(block.schools),
      }));

    return reportData.topHierarchy.slice(0, topHierarchyCount).map((district) => ({
      ...district,
      blocks: trimBlocks(district.blocks),
    }));
  }, [reportData.topHierarchy, topHierarchyCount]);

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

  const toggleTopDistrict = (districtName) => {
    setExpandedTopDistricts((previous) => {
      const next = new Set(previous);
      if (next.has(districtName)) {
        next.delete(districtName);
        setExpandedTopBlocks((previousBlocks) => {
          const nextBlocks = new Set(previousBlocks);
          Array.from(nextBlocks).forEach((key) => {
            if (key.startsWith(`${districtName}||`)) {
              nextBlocks.delete(key);
            }
          });
          return nextBlocks;
        });
        setExpandedTopSchools((previousSchools) => {
          const nextSchools = new Set(previousSchools);
          Array.from(nextSchools).forEach((key) => {
            if (key.startsWith(`${districtName}||`)) {
              nextSchools.delete(key);
            }
          });
          return nextSchools;
        });
      } else {
        next.add(districtName);
      }
      return next;
    });
  };

  const toggleTopBlock = (districtName, blockName) => {
    const key = `${districtName}||${blockName}`;
    setExpandedTopBlocks((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
        setExpandedTopSchools((previousSchools) => {
          const nextSchools = new Set(previousSchools);
          Array.from(nextSchools).forEach((schoolKey) => {
            if (schoolKey.startsWith(`${key}||`)) {
              nextSchools.delete(schoolKey);
            }
          });
          return nextSchools;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleTopSchool = (districtName, blockName, schoolName) => {
    const key = `${districtName}||${blockName}||${schoolName}`;
    setExpandedTopSchools((previous) => {
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
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-800">Evidence Analysis Report</h2>
              <p className="mt-1 text-sm text-slate-600">{sourceLabel}</p>
            </div>
            <Button 
              type="button" 
              onClick={downloadPdf} 
              disabled={pdfLoading}
              className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              {pdfLoading ? 'Generating PDF...' : 'Download PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
            <Filter className="h-4 w-4 text-blue-600" />
            Filter Report Data
          </CardTitle>
          <CardDescription>Refine report insights by location and relevance criteria.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">State</span>
              <select
                value={filters.state}
                onChange={(event) => setFilters((previous) => ({ ...previous, state: event.target.value, district: '', block: '', school: '' }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All States</option>
                {filterOptions.states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">District</span>
              <select
                value={filters.district}
                onChange={(event) => setFilters((previous) => ({ ...previous, district: event.target.value, block: '', school: '' }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Districts</option>
                {filterOptions.districts.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Block</span>
              <select
                value={filters.block}
                onChange={(event) => setFilters((previous) => ({ ...previous, block: event.target.value, school: '' }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Blocks</option>
                {filterOptions.blocks.map((block) => (
                  <option key={block} value={block}>{block}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">School</span>
              <select
                value={filters.school}
                onChange={(event) => setFilters((previous) => ({ ...previous, school: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Schools</option>
                {filterOptions.schools.map((school) => (
                  <option key={school} value={school}>{school}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span className="font-medium">Relevance Tag</span>
              <select
                value={filters.relevance}
                onChange={(event) => setFilters((previous) => ({ ...previous, relevance: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Relevance</option>
                {RELEVANCE_TYPES.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setFilters(emptyFilters)}
              className="h-10 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 sm:space-y-6" ref={reportRef}>
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Evidence</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-800">{formatNumber(reportData.totalEvidence)}</p>
                </div>
                <div className="rounded-md border p-2 flex-shrink-0 text-blue-600 bg-blue-50 border-blue-100">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4 sm:p-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relevance Distribution</p>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-emerald-700">{formatNumber(reportData.relevanceCounts.Relevant)} Relevant</p>
                  <p className="text-sm text-amber-700">{formatNumber(reportData.relevanceCounts['Partially Relevant'])} Partially</p>
                  <p className="text-sm text-rose-700">{formatNumber(reportData.relevanceCounts.Irrelevant)} Irrelevant</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Participation</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-800">{formatNumber(reportData.usersCount)}</p>
                  <p className="mt-1 text-xs text-slate-600">Users with Evidence</p>
                </div>
                <div className="rounded-md border p-2 flex-shrink-0 text-blue-600 bg-blue-50 border-blue-100">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-800">Evidence Submission Overview</CardTitle>
            <CardDescription>Comprehensive view of submissions across locations</CardDescription>
          </CardHeader>
          <CardContent>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schools</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{formatNumber(reportData.schoolsCount)}</p>
                    </div>
                    <div className="rounded-md border p-2 flex-shrink-0 text-emerald-600 bg-emerald-50 border-emerald-100">
                      <School className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Districts</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{formatNumber(reportData.districtsCount)}</p>
                    </div>
                    <div className="rounded-md border p-2 flex-shrink-0 text-amber-600 bg-amber-50 border-amber-100">
                      <Building2 className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blocks</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{formatNumber(reportData.blocksCount)}</p>
                    </div>
                    <div className="rounded-md border p-2 flex-shrink-0 text-blue-600 bg-blue-50 border-blue-100">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </CardContent>
        </Card>

        {/* Project Timeline Section */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-800">Project Timeline</CardTitle>
            <CardDescription>Project starts and completions over time</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full" style={{ height: '350px' }}>
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
                      borderWidth: 2,
                    },
                    {
                      label: 'Project Completions',
                      data: reportData.timelineCompletions,
                      borderColor: '#42e695',
                      backgroundColor: 'rgba(66, 230, 149, 0.2)',
                      fill: true,
                      tension: 0.35,
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                      align: 'end',
                      labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                          size: 12,
                        },
                      },
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      padding: 12,
                      titleFont: {
                        size: 13,
                      },
                      bodyFont: {
                        size: 12,
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        font: {
                          size: 11,
                        },
                      },
                    },
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                      ticks: {
                        font: {
                          size: 11,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submission Volume Section */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-800">Submission Volume</CardTitle>
            <CardDescription>Total and relevant evidence submissions over time</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full" style={{ height: '350px' }}>
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
                      borderWidth: 2,
                    },
                    {
                      label: 'Relevant Evidence',
                      data: reportData.submissionRelevant,
                      borderColor: '#ff6b6b',
                      backgroundColor: 'rgba(255, 107, 107, 0.2)',
                      fill: true,
                      tension: 0.35,
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                      align: 'end',
                      labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                          size: 12,
                        },
                      },
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      padding: 12,
                      titleFont: {
                        size: 13,
                      },
                      bodyFont: {
                        size: 12,
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        font: {
                          size: 11,
                        },
                      },
                    },
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                      ticks: {
                        font: {
                          size: 11,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        {shouldShowSubjectGrade && (
          <>
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-slate-800">Subject Distribution</CardTitle>
                <CardDescription>Distribution of evidence across subjects</CardDescription>
              </CardHeader>
                  <CardContent className="p-6">
                    <div className="w-full flex items-center justify-center" style={{ height: '350px' }}>
                      <div style={{ maxWidth: '400px', width: '100%' }}>
                        <Doughnut
                          data={{
                            labels: Object.keys(reportData.subjectCounts),
                            datasets: [
                              {
                                data: Object.values(reportData.subjectCounts),
                                backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#feca57', '#96ceb4'],
                                borderWidth: 0,
                                hoverBorderWidth: 2,
                                hoverBorderColor: '#fff',
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  boxWidth: 12,
                                  padding: 15,
                                  font: {
                                    size: 12,
                                  },
                                },
                              },
                              tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                titleFont: {
                                  size: 13,
                                },
                                bodyFont: {
                                  size: 12,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-slate-800">Grade Distribution</CardTitle>
                <CardDescription>Distribution of evidence across grades</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                    <div className="w-full flex items-center justify-center" style={{ height: '350px' }}>
                      <div style={{ maxWidth: '400px', width: '100%' }}>
                        <Doughnut
                          data={{
                            labels: Object.keys(reportData.gradeCounts),
                            datasets: [
                              {
                                data: Object.values(reportData.gradeCounts),
                                backgroundColor: ['#a8e6cf', '#dcedc1', '#ffd3a5', '#fd9853', '#ff8a80'],
                                borderWidth: 0,
                                hoverBorderWidth: 2,
                                hoverBorderColor: '#fff',
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  boxWidth: 12,
                                  padding: 15,
                                  font: {
                                    size: 12,
                                  },
                                },
                              },
                              tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                titleFont: {
                                  size: 13,
                                },
                                bodyFont: {
                                  size: 12,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
            </Card>
          </>
        )}

        {/* Quality & Relevance Analysis Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-800">Quality & Relevance Analysis</CardTitle>
            <CardDescription>Comprehensive relevance breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-3 font-semibold">Relevant</th>
                    <th className="px-2 py-3 font-semibold">Partially Relevant</th>
                    <th className="px-2 py-3 font-semibold">Irrelevant</th>
                    <th className="px-2 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-3 text-sm text-slate-800 font-medium">{formatNumber(reportData.relevanceCounts.Relevant)}</td>
                    <td className="px-2 py-3 text-sm text-slate-800 font-medium">{formatNumber(reportData.relevanceCounts['Partially Relevant'])}</td>
                    <td className="px-2 py-3 text-sm text-slate-800 font-medium">{formatNumber(reportData.relevanceCounts.Irrelevant)}</td>
                    <td className="px-2 py-3 text-sm text-slate-800 font-medium">{formatNumber(reportData.totalEvidence)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Task Completion Analysis Section */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-800">Task Completion Analysis</CardTitle>
            <CardDescription>Top tasks by completion count</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full" style={{ height: '400px' }}>
              <Bar
                data={{
                  labels: reportData.taskEntries.map(([task]) => task),
                  datasets: [
                    {
                      label: 'Task Completion Count',
                      data: reportData.taskEntries.map(([, count]) => count),
                      backgroundColor: 'rgba(79, 172, 254, 0.8)',
                      borderColor: '#4facfe',
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      padding: 12,
                      titleFont: {
                        size: 13,
                      },
                      bodyFont: {
                        size: 12,
                      },
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                      },
                      ticks: {
                        font: {
                          size: 11,
                        },
                      },
                      title: {
                        display: true,
                        text: 'Number of Completions',
                        font: {
                          size: 12,
                        },
                      },
                    },
                    y: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        font: {
                          size: 10,
                        },
                        callback(value) {
                          const label = this.getLabelForValue(value);
                          return label.length > 50 ? `${label.slice(0, 50)}...` : label;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-800">District-wise Submission Quality & Insights</CardTitle>
            <CardDescription>Hierarchical view of evidence quality across districts, blocks, and schools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-3 font-semibold">District / Block / School</th>
                    <th className="px-2 py-3 font-semibold">Total</th>
                    <th className="px-2 py-3 font-semibold">Relevant</th>
                    <th className="px-2 py-3 font-semibold">Partially Relevant</th>
                    <th className="px-2 py-3 font-semibold">Irrelevant</th>
                    <th className="px-2 py-3 font-semibold">% Relevant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.sortedDistricts.map(([district, districtData]) => {
                    const districtScore = relScore(
                      districtData.Relevant,
                      districtData['Partially Relevant'],
                      districtData.total
                    );
                    const districtExpanded = expandedDistricts.has(district);

                    return (
                      <Fragment key={district}>
                        <tr 
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleDistrict(district)}
                        >
                          <td className="px-2 py-3 text-sm font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              {districtExpanded ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                              {district}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-sm text-slate-700">{formatNumber(districtData.total)}</td>
                          <td className="px-2 py-3 text-sm text-emerald-700 font-medium">{formatNumber(districtData.Relevant)}</td>
                          <td className="px-2 py-3 text-sm text-amber-700 font-medium">{formatNumber(districtData['Partially Relevant'])}</td>
                          <td className="px-2 py-3 text-sm text-rose-700 font-medium">{formatNumber(districtData.Irrelevant)}</td>
                          <td className="px-2 py-3 text-sm">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                              {districtScore.toFixed(1)}%
                            </span>
                          </td>
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
                              <tr 
                                className="cursor-pointer hover:bg-slate-50 transition-colors bg-slate-50/50"
                                onClick={() => toggleBlock(district, block)}
                              >
                                <td className="px-2 py-3 text-sm font-medium text-slate-700 pl-8">
                                  <div className="flex items-center gap-2">
                                    {blockExpanded ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                    {block}
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-sm text-slate-600">{formatNumber(blockData.total)}</td>
                                <td className="px-2 py-3 text-sm text-emerald-600">{formatNumber(blockData.Relevant)}</td>
                                <td className="px-2 py-3 text-sm text-amber-600">{formatNumber(blockData['Partially Relevant'])}</td>
                                <td className="px-2 py-3 text-sm text-rose-600">{formatNumber(blockData.Irrelevant)}</td>
                                <td className="px-2 py-3 text-sm">
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {blockScore.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>

                              {blockExpanded && Object.entries(blockData.schools).map(([school, schoolData]) => {
                                const schoolScore = relScore(
                                  schoolData.Relevant,
                                  schoolData['Partially Relevant'],
                                  schoolData.total
                                );
                                return (
                                  <tr key={`${blockKey}||${school}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-2 py-3 text-sm text-slate-600 pl-14">{school}</td>
                                    <td className="px-2 py-3 text-sm text-slate-600">{formatNumber(schoolData.total)}</td>
                                    <td className="px-2 py-3 text-sm text-emerald-600">{formatNumber(schoolData.Relevant)}</td>
                                    <td className="px-2 py-3 text-sm text-amber-600">{formatNumber(schoolData['Partially Relevant'])}</td>
                                    <td className="px-2 py-3 text-sm text-rose-600">{formatNumber(schoolData.Irrelevant)}</td>
                                    <td className="px-2 py-3 text-sm">
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                        {schoolScore.toFixed(1)}%
                                      </span>
                                    </td>
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
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg text-slate-800">Top Relevance Hierarchy</CardTitle>
                <CardDescription>
                  Top performing Districts → Blocks → Schools → Teachers ranked by Relevance %
                </CardDescription>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <span className="font-medium">Show top:</span>
                <select
                  value={topHierarchyCount}
                  onChange={(event) => {
                    const nextTopN = Number.parseInt(event.target.value, 10) || 5;
                    setTopHierarchyCount(nextTopN);
                    setExpandedTopDistricts(new Set());
                    setExpandedTopBlocks(new Set());
                    setExpandedTopSchools(new Set());
                  }}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={15}>Top 15</option>
                </select>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-3 font-semibold">District / Block / School / Teacher</th>
                    <th className="px-2 py-3 font-semibold">Total Evidence</th>
                    <th className="px-2 py-3 font-semibold">% Relevant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTopHierarchy.length > 0 ? (
                    visibleTopHierarchy.map((district, districtIndex) => {
                      const districtKey = district.district;
                      const districtExpanded = expandedTopDistricts.has(districtKey);

                      return (
                        <Fragment key={districtKey}>
                          <tr
                            className="cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => toggleTopDistrict(districtKey)}
                          >
                            <td className="px-2 py-3 text-sm font-semibold text-slate-800">
                              <div className="flex items-center gap-2">
                                {districtExpanded ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1">
                                  {districtIndex + 1}
                                </span>
                                {district.district}
                              </div>
                            </td>
                            <td className="px-2 py-3 text-sm text-slate-700">{formatNumber(district.total)}</td>
                            <td className="px-2 py-3 text-sm">
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                                {district.relevancePercent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>

                          {districtExpanded &&
                            district.blocks.map((block, blockIndex) => {
                              const blockKey = `${districtKey}||${block.block}`;
                              const blockExpanded = expandedTopBlocks.has(blockKey);

                              return (
                                <Fragment key={blockKey}>
                                  <tr
                                    className="cursor-pointer hover:bg-slate-50 transition-colors bg-slate-50/50"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleTopBlock(districtKey, block.block);
                                    }}
                                  >
                                    <td className="px-2 py-3 text-sm font-medium text-slate-700 pl-8">
                                      <div className="flex items-center gap-2">
                                        {blockExpanded ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold mr-1">
                                          {blockIndex + 1}
                                        </span>
                                        {block.block}
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 text-sm text-slate-600">{formatNumber(block.total)}</td>
                                    <td className="px-2 py-3 text-sm">
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                        {block.relevancePercent.toFixed(1)}%
                                      </span>
                                    </td>
                                  </tr>

                                  {blockExpanded &&
                                    block.schools.map((school, schoolIndex) => {
                                      const schoolKey = `${districtKey}||${block.block}||${school.school}`;
                                      const schoolExpanded = expandedTopSchools.has(schoolKey);

                                      return (
                                        <Fragment key={schoolKey}>
                                          <tr
                                            className="cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              toggleTopSchool(districtKey, block.block, school.school);
                                            }}
                                          >
                                            <td className="px-2 py-3 text-sm text-slate-600 pl-14">
                                              <div className="flex items-center gap-2">
                                                {schoolExpanded ? <ChevronDown className="h-4 w-4 text-blue-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold mr-1">
                                                  {schoolIndex + 1}
                                                </span>
                                                {school.school}
                                              </div>
                                            </td>
                                            <td className="px-2 py-3 text-sm text-slate-600">{formatNumber(school.total)}</td>
                                            <td className="px-2 py-3 text-sm">
                                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                {school.relevancePercent.toFixed(1)}%
                                              </span>
                                            </td>
                                          </tr>

                                          {schoolExpanded &&
                                            school.teachers.map((teacher, teacherIndex) => (
                                              <tr
                                                key={`${schoolKey}||${teacher.teacher}`}
                                                className="hover:bg-slate-50 transition-colors"
                                              >
                                                <td className="px-2 py-3 text-sm text-slate-600 pl-20">
                                                  <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500 mr-1">#{teacherIndex + 1}</span>
                                                    <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{teacher.teacher}</code>
                                                  </div>
                                                </td>
                                                <td className="px-2 py-3 text-sm text-slate-600">{formatNumber(teacher.total)}</td>
                                                <td className="px-2 py-3 text-sm">
                                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                    {teacher.relevancePercent.toFixed(1)}%
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                        </Fragment>
                                      );
                                    })}
                                </Fragment>
                              );
                            })}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-2 py-8 text-center text-sm text-slate-500">
                        No hierarchy insights available for selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {hasRequiredEnrollmentColumns && reportData.hasEnrollmentData && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-800">Enrollment Analytics</CardTitle>
              <CardDescription>Review enrollment trends, growth patterns, and district-level comparisons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-slate-800 mb-3">Enrollment Comparison</h4>
                <p className="text-sm text-slate-600 mb-4">Compare 2024 and 2025 totals along with district-wise distribution.</p>

                <section className="grid gap-4 md:grid-cols-3 mb-6">
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Enrollment 2024</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{formatNumber(enrollmentSummary.enrollment2024)}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Enrollment 2025</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{formatNumber(enrollmentSummary.enrollment2025)}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Districts with Data</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">{formatNumber(enrollmentSummary.districtCount)}</p>
                    </CardContent>
                  </Card>
                </section>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-slate-800">Enrollment 2024 vs 2025 by District</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <Bar
                        data={{
                          labels: enrollmentDistrictRowsSorted.map((row) => row.district),
                          datasets: [
                            {
                              label: 'Enrollment 2024',
                              data: enrollmentDistrictRowsSorted.map((row) => row.enrollment2024),
                              backgroundColor: 'rgba(79, 172, 254, 0.8)',
                            },
                            {
                              label: 'Enrollment 2025',
                              data: enrollmentDistrictRowsSorted.map((row) => row.enrollment2025),
                              backgroundColor: 'rgba(66, 230, 149, 0.8)',
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="text-base font-semibold text-slate-800 mb-3">Enrollment Growth</h4>
                <p className="text-sm text-slate-600 mb-4">Inspect district-level growth percentage between 2024 and 2025.</p>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-slate-800">Enrollment Growth (%) by District</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <Bar
                        data={{
                          labels: enrollmentDistrictRowsSorted.map((row) => row.district),
                          datasets: [
                            {
                              label: 'Growth %',
                              data: enrollmentDistrictRowsSorted.map((row) => row.growth),
                              backgroundColor: enrollmentDistrictRowsSorted.map((row) =>
                                row.growth >= 0 ? 'rgba(66, 230, 149, 0.8)' : 'rgba(255, 107, 107, 0.8)'
                              ),
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="text-base font-semibold text-slate-800 mb-3">District Data Table</h4>
                <p className="text-sm text-slate-600 mb-4">View district totals, differences, and growth values in tabular form.</p>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-3 font-semibold">District</th>
                        <th className="px-2 py-3 font-semibold">Enrollment 2024</th>
                        <th className="px-2 py-3 font-semibold">Enrollment 2025</th>
                        <th className="px-2 py-3 font-semibold">Difference</th>
                        <th className="px-2 py-3 font-semibold">Growth %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {enrollmentDistrictRowsSorted.map((row) => (
                        <tr key={row.district} className="hover:bg-slate-50 transition-colors">
                          <td className="px-2 py-3 text-sm font-medium text-slate-800">{row.district}</td>
                          <td className="px-2 py-3 text-sm text-slate-700">{formatNumber(row.enrollment2024)}</td>
                          <td className="px-2 py-3 text-sm text-slate-700">{formatNumber(row.enrollment2025)}</td>
                          <td className="px-2 py-3 text-sm text-slate-700">{formatNumber(row.difference)}</td>
                          <td className="px-2 py-3 text-sm">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              row.growth >= 0 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {row.growth.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {reportData.hasCustomTasks && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-800">User-Owned Tasks Analysis</CardTitle>
              <CardDescription>Analysis of custom user-created tasks and their relevance distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-3 font-semibold">District</th>
                      <th className="px-2 py-3 font-semibold">Total Custom Tasks</th>
                      <th className="px-2 py-3 font-semibold">Relevant</th>
                      <th className="px-2 py-3 font-semibold">Partially Relevant</th>
                      <th className="px-2 py-3 font-semibold">Irrelevant</th>
                      <th className="px-2 py-3 font-semibold">% Relevant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(reportData.customTaskHierarchy).map(([district, districtData]) => {
                      const score = relScore(
                        districtData.Relevant,
                        districtData['Partially Relevant'],
                        districtData.total
                      );
                      return (
                        <tr key={district} className="hover:bg-slate-50 transition-colors">
                          <td className="px-2 py-3 text-sm font-medium text-slate-800">{district}</td>
                          <td className="px-2 py-3 text-sm text-slate-700">{formatNumber(districtData.total)}</td>
                          <td className="px-2 py-3 text-sm text-emerald-700 font-medium">{formatNumber(districtData.Relevant)}</td>
                          <td className="px-2 py-3 text-sm text-amber-700 font-medium">{formatNumber(districtData['Partially Relevant'])}</td>
                          <td className="px-2 py-3 text-sm text-rose-700 font-medium">{formatNumber(districtData.Irrelevant)}</td>
                          <td className="px-2 py-3 text-sm">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                              {score.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
