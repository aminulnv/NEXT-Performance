export function flattenGrades(gradesResp, employeesList, cyclePayload, scorecardPayload) {
  const results = gradesResp.results ?? [];
  const cycleMap = cyclePayload.cycleMap ?? {};
  const timelineByEmpCycle = cyclePayload.timelineByEmpCycle ?? {};
  const scorecardBuckets = scorecardPayload.scorecardBuckets ?? {};

  const str = (v) => (v == null ? '' : String(v));
const num = (v) => (v == null || v === '' ? '' : String(v));
const joinArr = (arr) => (Array.isArray(arr) ? arr.map(str).filter(Boolean).join(', ') : '');
const joinLines = (arr) => (Array.isArray(arr) ? arr.map(str).filter(Boolean).join('\n') : '');

const FINAL_GRADE_LABELS = {
  exceptional: 'Exceptional',
  strong: 'Exceeding',
  average_plus: 'Performing',
  average_minus: 'Developing',
  unsatisfactory: 'Unsatisfactory',
};

const EMPLOYEE_TYPE_LABELS = {
  high_impact_individual: 'Manager',
  individual_contributor: 'Individual Contributor',
};

const RATING_LABEL_DISPLAY = {
  dont_know: 'Dont Know',
  poor: 'Poor',
  poor_plus: 'Poor Plus',
  basic_minus: 'Basic Minus',
  basic: 'Basic',
  basic_plus: 'Basic Plus',
  intermediate_minus: 'Intermediate Minus',
  intermediate: 'Intermediate',
  intermediate_plus: 'Intermediate Plus',
  advanced_minus: 'Advanced Minus',
  advanced: 'Advanced',
  advanced_plus: 'Advanced Plus',
  expert_minus: 'Expert Minus',
  expert: 'Expert',
  expert_plus: 'Expert Plus',
  skipped: 'Skipped',
};

function gradeLabelFromCode(code) {
  const key = code == null || code === '' ? '' : String(code).trim();
  if (!key) return '';
  return FINAL_GRADE_LABELS[key] ?? key;
}

function ratingCode(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return str(value.id ?? value.label);
  return str(value);
}

function ratingDisplay(value) {
  const key = ratingCode(value);
  if (!key) return '';
  return RATING_LABEL_DISPLAY[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function gradeColumn(value, colName) {
  if (value == null || value === '') {
    return { [colName]: '' };
  }
  if (typeof value === 'object') {
    const code = str(value.id);
    const label = str(value.label) || gradeLabelFromCode(code);
    return { [colName]: label };
  }
  const code = str(value);
  return { [colName]: gradeLabelFromCode(code) };
}

function ratingColumn(value, colName) {
  return { [colName]: ratingDisplay(value) };
}

function employeeFullName(e) {
  if (!e || typeof e !== 'object') return '';
  const d = (v) => (typeof v === 'string' ? v.trim() : '') || '';
  if (d(e.full_name)) return d(e.full_name);
  if (d(e.fullName)) return d(e.fullName);
  if (e.first_name != null || e.last_name != null) {
    const combined = [d(e.first_name), d(e.last_name)].filter(Boolean).join(' ');
    if (combined) return combined;
  }
  return '';
}

function employeeDepartment(e) {
  if (!e) return '';
  if (typeof e.department === 'string' && e.department.trim()) return e.department.trim();
  const n = e?.team?.department?.name;
  return typeof n === 'string' ? n.trim() : '';
}

function employeeTeam(e) {
  if (!e) return '';
  const t = e.team;
  if (typeof t === 'string') return t.trim();
  if (t && typeof t === 'object') return str(t.name).trim();
  return '';
}

function nestedField(e, key, subKey = 'name') {
  const v = e?.[key];
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') return str(v[subKey]).trim();
  return '';
}

function employeeStatus(e) {
  const s = e?.status;
  if (s == null || s === '') return '';
  if (typeof s === 'string') return s.trim();
  if (typeof s === 'object') {
    return str(s.name ?? s.label ?? s.display_name ?? s.status ?? s.id ?? s.key ?? '').trim();
  }
  return str(s);
}

function lineManagerFromProfile(e) {
  const lm = e?.line_manager;
  if (!lm || typeof lm !== 'object') return { name: '', id: '', email: '' };
  const d = (v) => (typeof v === 'string' ? v.trim() : '') || '';
  const name = [d(lm.first_name), d(lm.last_name)].filter(Boolean).join(' ') || d(lm.full_name);
  return { name, id: str(lm.id), email: d(lm.email) };
}

function teamId(e) {
  const t = e?.team;
  if (t && typeof t === 'object' && t.id != null) return str(t.id);
  return '';
}

function departmentId(e) {
  const d = e?.team?.department;
  if (d && typeof d === 'object' && d.id != null) return str(d.id);
  return '';
}

const employeeById = {};
const employeeNameMap = {};
employeesList.forEach((e) => {
  employeeById[e.id] = e;
  employeeNameMap[e.id] = employeeFullName(e) || str(e.id);
  if (e.remote_id) {
    employeeById[e.remote_id] = e;
    employeeNameMap[e.remote_id] = employeeFullName(e) || str(e.remote_id);
  }
});

const getEmp = (id) => (id != null ? employeeById[id] ?? employeeById[String(id)] ?? null : null);
const getName = (id) => (id != null ? employeeNameMap[id] ?? employeeNameMap[String(id)] ?? str(id) : '');

const getCycleName = (id) => (id != null ? cycleMap[id] ?? cycleMap[String(id)] ?? '' : '');

const INCLUDE_ALL_SCORECARDS = process.env.INCLUDE_ALL_SCORECARDS !== 'false';

function listScorecardCandidates(employeeId, cycleId, eligibilityId) {
  const keys = [];
  if (employeeId != null && cycleId != null) keys.push(`${employeeId}:${cycleId}`);
  if (employeeId != null && eligibilityId != null) keys.push(`${employeeId}:elig:${eligibilityId}`);
  let candidates = [];
  for (const key of keys) {
    const bucket = scorecardBuckets[key];
    if (Array.isArray(bucket)) candidates = candidates.concat(bucket);
  }
  if (!candidates.length) return [];
  const seen = new Set();
  return candidates.filter((s) => {
    const id = s.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function pickScorecard(employeeId, cycleId, eligibilityId) {
  const candidates = listScorecardCandidates(employeeId, cycleId, eligibilityId);
  if (!candidates.length) return null;
  const lmDone = candidates.find((s) => s.reviewer_relation === 'line_manager' && s.status === 'completed');
  if (lmDone) return lmDone;
  const done = candidates.find((s) => s.status === 'completed' || s.status === 'completed_late');
  if (done) return done;
  const lm = candidates.find((s) => s.reviewer_relation === 'line_manager');
  if (lm) return lm;
  return candidates[0];
}

function allScorecardsJson(employeeId, cycleId, eligibilityId) {
  if (!INCLUDE_ALL_SCORECARDS) return '';
  const candidates = listScorecardCandidates(employeeId, cycleId, eligibilityId);
  if (!candidates.length) return '';
  try {
    return JSON.stringify(
      candidates.map((s) => ({
        id: s.id,
        reviewer: getName(s.reviewer_id),
        relation: s.reviewer_relation ?? '',
        status: s.status ?? '',
        opened: s.opened_date_time ?? '',
        completed: s.completed_date_time ?? '',
      })),
    );
  } catch {
    return '';
  }
}

function cardsToColumns(cards, labelPrefix) {
  const out = {};
  if (!Array.isArray(cards)) return out;
  cards.forEach((c) => {
    const label = (c.name || c.criteria_key || '').trim();
    if (label) out[`${labelPrefix} - ${label}`] = str(c.rating);
  });
  return out;
}

function deliverablesJustifications(cards) {
  if (!Array.isArray(cards)) return '';
  const parts = [];
  cards.forEach((c) => {
    (c.previous_justifications ?? []).forEach((p) => {
      const val = p.value;
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (v && v.comment) parts.push(`[${c.name || c.criteria_key}]: ${v.comment}`);
        });
      }
    });
  });
  return parts.join('\n---\n');
}

function barRaiserColumns(rd) {
  const extra = rd.line_manager_extra_section || {};
  const keeper = extra.keeper_test_section || {};
  const questions = keeper.questions || [];
  const q0 = questions[0];
  const q1 = questions[1];
  const q2 = questions[2];
  return {
    'Scorecard Bar Raiser - Keep if competitive offer?': str(q0 && q0.value),
    'Scorecard Bar Raiser - Re-hire in current role?': str(q1 && q1.value),
    'Scorecard Bar Raiser - RFP or promotion eligible?': str(q2 && q2.value),
  };
}

function feedbackColumns(rd) {
  const extra = rd.line_manager_extra_section || {};
  const epp = extra.employee_project_performance || {};
  const opt = (epp.options || []).find((o) => o.key === epp.value);
  const details = opt && Array.isArray(opt.items) ? opt.items.join('\n') : '';
  return {
    'Scorecard Feedback - Question': str(epp.name),
    'Scorecard Feedback - Selected performance level': str(epp.value),
    'Scorecard Feedback - Details (selected level)': details,
    'Scorecard Feedback - Justification': str(epp.justification),
  };
}

function scorecardColumns(s) {
  const emptyStatic = {
    'Scorecard ID': '',
    'Scorecard Category': '',
    'Scorecard Status': '',
    'Scorecard Reviewer Relation': '',
    'Scorecard Reviewer ID': '',
    'Scorecard Reviewer': '',
    'Scorecard Requester ID': '',
    'Scorecard Requester': '',
    'Scorecard Reviewed Employee ID': '',
    'Scorecard Reviewed Employee Type': '',
    'Scorecard Opened Date Time': '',
    'Scorecard Completed Date Time': '',
    'Scorecard Created Date': '',
    'Scorecard Updated Date': '',
    'Scorecard Visible to Reviewee': '',
    'Scorecard Performance Checkpoint ID': '',
    'Scorecard Extra Section WNIPS': '',
    'Review Overall Rating': '',
    'Review Rating': '',
    'Review Rating Score': '',
    'Review Final Grade Score': '',
    'Review Prefilled': '',
    'Scorecard Deliverables Rating': '',
    'Scorecard Deliverables Section Grade': '',
    'Scorecard Deliverables Justifications': '',
    'Scorecard Values Rating': '',
    'Scorecard Values Section Grade': '',
    'Scorecard Skills Rating': '',
    'Scorecard Skills Section Grade': '',
    'Scorecard Skills Rating Score': '',
    'Scorecard Culture Skills Rating': '',
    'Scorecard Overall Feedback - Pros': '',
    'Scorecard Overall Feedback - Cons': '',
    'Scorecard Key Learnings & Initiatives (JSON)': '',
    'Scorecard Roadmaps': '',
    'Scorecard KPIs Section (JSON)': '',
    'Scorecard Previous Reviews By Cycle (JSON)': '',
    'Scorecard Bar Raiser - Keep if competitive offer?': '',
    'Scorecard Bar Raiser - Re-hire in current role?': '',
    'Scorecard Bar Raiser - RFP or promotion eligible?': '',
    'Scorecard Feedback - Question': '',
    'Scorecard Feedback - Selected performance level': '',
    'Scorecard Feedback - Details (selected level)': '',
    'Scorecard Feedback - Justification': '',
  };

  if (!s) {
    return { ...emptyStatic };
  }

  const rd = s.review_data || {};
  const d = rd.deliverables || {};
  const cv = rd.culture_values || {};
  const fs = rd.functional_skills || {};
  const cs = rd.culture_skills || {};
  const of = rd.overall_feedback || {};
  const fg = rd.final_grade;
  let reviewOverallRating = '';
  if (fg != null && fg !== '') {
    if (typeof fg === 'object') {
      reviewOverallRating = str(fg.label) || gradeLabelFromCode(str(fg.id));
    } else {
      reviewOverallRating = gradeLabelFromCode(str(fg)) || str(fg);
    }
  }

  const out = {
    ...emptyStatic,
    'Scorecard ID': str(s.id),
    'Scorecard Category': str(s.category),
    'Scorecard Status': str(s.status),
    'Scorecard Reviewer Relation': str(s.reviewer_relation),
    'Scorecard Reviewer ID': str(s.reviewer_id),
    'Scorecard Reviewer': getName(s.reviewer_id),
    'Scorecard Requester ID': str(s.requester_id),
    'Scorecard Requester': getName(s.requester_id),
    'Scorecard Reviewed Employee ID': str(s.reviewed_employee_id),
    'Scorecard Reviewed Employee Type': str(s.reviewed_employee_type),
    'Scorecard Opened Date Time': str(s.opened_date_time),
    'Scorecard Completed Date Time': str(s.completed_date_time),
    'Scorecard Created Date': str(s.created_date),
    'Scorecard Updated Date': str(s.updated_date),
    'Scorecard Visible to Reviewee': str(s.visible_to_reviewee),
    'Scorecard Performance Checkpoint ID': str(s.performance_checkpoint_id),
    'Scorecard Extra Section WNIPS': num(s.extra_section_wnips),
    'Review Overall Rating': reviewOverallRating,
    'Review Rating': str(rd.rating),
    'Review Rating Score': num(rd.rating_score),
    'Review Final Grade Score': num(rd.final_grade_score),
    'Review Prefilled': str(rd.prefilled),
    'Scorecard Deliverables Rating': str(d.rating),
    'Scorecard Deliverables Section Grade': str(d.section_grade),
    'Scorecard Deliverables Justifications': deliverablesJustifications(d.cards),
    'Scorecard Values Rating': str(cv.rating),
    'Scorecard Values Section Grade': str(cv.section_grade),
    'Scorecard Skills Rating': str(fs.rating),
    'Scorecard Skills Section Grade': str(fs.section_grade),
    'Scorecard Skills Rating Score': num(fs.rating_score),
    'Scorecard Culture Skills Rating': str(cs.rating),
    'Scorecard Overall Feedback - Pros': joinLines(of.pros),
    'Scorecard Overall Feedback - Cons': joinLines(of.cons),
  };

  const cycleSections = rd.cycle_sections;
  if (Array.isArray(cycleSections) && cycleSections.length > 0) {
    try {
      out['Scorecard Key Learnings & Initiatives (JSON)'] = JSON.stringify(cycleSections);
    } catch (e) {
      out['Scorecard Key Learnings & Initiatives (JSON)'] = '';
    }
  }

  const roadmaps = rd.roadmaps_section;
  if (roadmaps && roadmaps.roadmap_items && roadmaps.roadmap_items.length > 0) {
    out['Scorecard Roadmaps'] = roadmaps.roadmap_items
      .map((i) => `${i.name || i.key || ''}: ${i.status || ''}`)
      .join(' | ');
  }

  if (rd.kpis_section != null) {
    try {
      out['Scorecard KPIs Section (JSON)'] = JSON.stringify(rd.kpis_section);
    } catch (e) {
      out['Scorecard KPIs Section (JSON)'] = '';
    }
  }

  if (rd.previous_reviews_by_cycle != null) {
    try {
      out['Scorecard Previous Reviews By Cycle (JSON)'] = JSON.stringify(rd.previous_reviews_by_cycle);
    } catch (e) {
      out['Scorecard Previous Reviews By Cycle (JSON)'] = '';
    }
  }

  Object.assign(out, cardsToColumns(d.cards, 'Scorecard Deliverables'));
  Object.assign(out, cardsToColumns(cv.cards, 'Scorecard Values'));
  Object.assign(out, cardsToColumns(fs.cards, 'Scorecard Skills'));
  Object.assign(out, cardsToColumns(cs.cards, 'Scorecard Culture Skills'));
  Object.assign(out, barRaiserColumns(rd));
  Object.assign(out, feedbackColumns(rd));

  const ms = rd.manager_skills || {};
  const mv = rd.manager_values || {};
  if (ms.cards && ms.cards.length) Object.assign(out, cardsToColumns(ms.cards, 'Scorecard Culture (Manager Skills)'));
  if (mv.cards && mv.cards.length) Object.assign(out, cardsToColumns(mv.cards, 'Scorecard Culture (Manager Values)'));

  return out;
}

function buildRow(g) {
  const emp = getEmp(g.employee_id);
  const profileLm = lineManagerFromProfile(emp);
  const timeline =
    timelineByEmpCycle[`${g.employee_id}:${g.cycle_id}`] ??
    timelineByEmpCycle[`${String(g.employee_id)}:${String(g.cycle_id)}`] ??
    {};
  const scorecard = pickScorecard(g.employee_id, g.cycle_id, g.eligibility_id);

  const row = {
    'Grade Record ID': str(g.id),
    Employee: employeeFullName(emp) || getName(g.employee_id),
    'Employee ID': str(g.employee_id),
    'Employee First Name': str(emp?.first_name),
    'Employee Middle Name': str(emp?.middle_name),
    'Employee Last Name': str(emp?.last_name),
    'Employee Email': str(emp?.email),
    'Employee Remote ID': str(emp?.remote_id),
    'Employee Candidate ID': str(emp?.candidate_id),
    'Employee Joining Date': str(emp?.joining_date_time),
    'Employee Termination Date': str(emp?.termination_date_time),
    'Employee Last Updated': str(emp?.updated_date_time),
    'Employee Avatar URL': str(emp?.avatar),
    'Employee Department': employeeDepartment(emp),
    'Employee Department ID': departmentId(emp),
    'Employee Team': employeeTeam(emp),
    'Employee Team ID': teamId(emp),
    'Employee Location': nestedField(emp, 'location'),
    'Employee Seniority': nestedField(emp, 'seniority'),
    'Employee Specialisation': nestedField(emp, 'specialisation'),
    'Employee Status': employeeStatus(emp),
    'Employee Inactivity Reason': str(emp?.inactivity_reason),
    'Employee Entity': str(emp?.entity),
    'Line Manager (cycle) ID': str(g.line_manager_id),
    'Line Manager (cycle)': getName(g.line_manager_id),
    'Line Manager (HR profile) ID': profileLm.id,
    'Line Manager (HR profile)': profileLm.name,
    'Line Manager (HR profile) Email': profileLm.email,
    'Cycle ID': str(g.cycle_id),
    'Cycle Name': getCycleName(g.cycle_id),
    'Cycle Completion Date': str(timeline.completion_date_time),
    'Cycle Timeline Item ID': str(timeline.timeline_item_id),
    'Cycle Timeline Category': str(timeline.category),
    'Cycle Timeline Type': str(timeline.type),
    'Cycle Timeline Status': str(timeline.status),
    'Cycle Timeline Stage': str(timeline.stage),
    'Cycle Timeline Reviewer Relation': str(timeline.reviewer_relation),
    'Cycle Timeline Employee Seniority ID': str(timeline.employee_seniority_id),
    'Cycle Timeline Employee Specialisation ID': str(timeline.employee_specialisation_id),
    'Cycle Timeline Employee Spec Seniority Sublevel ID': str(
      timeline.employee_specialisation_seniority_sublevel_id,
    ),
    'Cycle Timeline Nested Cycle ID': str(timeline.cycle_nested_id),
    'Cycle Timeline Nested Cycle Name': str(timeline.cycle_nested_name),
    'Employee Cycle ID': str(timeline.employee_cycle_id),
    'Employee Cycle HR Manager ID': str(timeline.employee_cycle_hr_manager_id),
    'Employee Cycle Name': str(timeline.employee_cycle_name),
    'Employee Cycle Start': str(timeline.employee_cycle_start),
    'Employee Cycle End': str(timeline.employee_cycle_end),
    'Employee Cycle Rating Score': str(timeline.employee_cycle_rating_score),
    'Employee Cycle Rating Label': str(timeline.employee_cycle_rating_label),
    'Employee Cycle Grade': str(timeline.employee_cycle_grade),
    'Employee Cycle Skills Rating': str(timeline.employee_cycle_skills_rating),
    'Employee Cycle Values Rating': str(timeline.employee_cycle_values_rating),
    'Employee Cycle Deliverables Rating': str(timeline.employee_cycle_deliverables_rating),
    'Employee Cycle Outcome': str(timeline.employee_cycle_outcome),
    'Eligibility ID': str(g.eligibility_id),
    'Functional Manager ID': str(g.functional_manager_id),
    'Functional Manager': getName(g.functional_manager_id),
    'Department Grade Calibrator ID': str(g.department_grade_calibrator_id),
    'Department Grade Calibrator': getName(g.department_grade_calibrator_id),
    'Function Grade Calibrator ID': str(g.function_grade_calibrator_id),
    'Function Grade Calibrator': getName(g.function_grade_calibrator_id),
    'Reviewed Employee Type Code': str(g.reviewed_employee_type),
    'Reviewed Employee Type':
      EMPLOYEE_TYPE_LABELS[g.reviewed_employee_type] ?? str(g.reviewed_employee_type),
    'Grade Calibrated': str(g.grade_calibrated),
    'Can Recalculate Grades': str(g.can_recalculate_grades),
    'Calibration Flags': joinArr(g.calibration_flags),
    'Performance Team Comment': str(g.performance_team_comment),
    'Ranking Score': num(g.ranking_score),
    'Created Date Time': str(g.created_date_time),
    'Updated Date Time': str(g.updated_date_time),
  };

  Object.assign(row, scorecardColumns(scorecard));
  row['All Scorecards (JSON)'] = allScorecardsJson(g.employee_id, g.cycle_id, g.eligibility_id);

  Object.assign(row, gradeColumn(g.display_grade, 'Display Grade'));
  Object.assign(row, gradeColumn(g.calculated_grade, 'Calculated Grade'));
  Object.assign(row, gradeColumn(g.line_manager_grade, 'Line Manager Grade'));
  Object.assign(row, gradeColumn(g.functional_manager_grade, 'Functional Manager Grade'));
  Object.assign(row, gradeColumn(g.line_manager_grade_suggestion, 'Line Manager Grade Suggestion'));
  Object.assign(
    row,
    gradeColumn(g.functional_manager_grade_suggestion, 'Functional Manager Grade Suggestion'),
  );
  Object.assign(row, gradeColumn(g.department_owner_grade_suggestion, 'Department Owner Grade Suggestion'));
  Object.assign(row, gradeColumn(g.function_owner_grade_suggestion, 'Function Owner Grade Suggestion'));
  Object.assign(row, gradeColumn(g.performance_grade_suggestion, 'Performance Grade Suggestion'));
  Object.assign(row, gradeColumn(g.performance_extra_grade_suggestion, 'Performance Extra Grade Suggestion'));
  Object.assign(row, gradeColumn(g.ranking_grade, 'Ranking Grade'));

  Object.assign(row, ratingColumn(g.absolute_rating_label, 'Absolute Rating'));
  row['Absolute Rating Score'] = num(g.absolute_rating_score);
  Object.assign(row, ratingColumn(g.calculated_rating_label, 'Calculated Rating'));
  row['Calculated Rating Score'] = num(g.calculated_rating_score);
  Object.assign(row, ratingColumn(g.deliverables_rating_label, 'Deliverables Rating'));
  row['Deliverables Rating Score'] = num(g.deliverables_rating_score);
  Object.assign(row, ratingColumn(g.expected_rating_label, 'Expected Rating'));
  row['Expected Rating Score'] = num(g.expected_rating_score);
  Object.assign(row, ratingColumn(g.functional_skills_label, 'Functional Skills'));
  row['Functional Skills Rating Score'] = num(g.functional_skills_rating_score);
  Object.assign(row, ratingColumn(g.culture_rating_label, 'Culture Rating'));
  row['Culture Rating Score'] = num(g.culture_rating_score);
  Object.assign(row, ratingColumn(g.department_owner_rating_label, 'Department Owner Rating'));
  row['Department Owner Rating Score'] = num(g.department_owner_rating_score);
  Object.assign(row, ratingColumn(g.function_owner_rating_label, 'Function Owner Rating'));
  row['Function Owner Rating Score'] = num(g.function_owner_rating_score);
  row['Department Owner Grade Suggestion Comment'] = str(g.department_owner_grade_suggestion_comment);
  row['Function Owner Grade Suggestion Comment'] = str(g.function_owner_grade_suggestion_comment);

  return row;
}

const built = results.map((g) => buildRow(g));
const allKeys = new Set();
built.forEach((row) => {
  Object.keys(row).forEach((k) => allKeys.add(k));
});

const preferredOrder = [
  'Grade Record ID',
  'Employee',
  'Employee ID',
  'Employee First Name',
  'Employee Middle Name',
  'Employee Last Name',
  'Employee Email',
  'Employee Remote ID',
  'Employee Candidate ID',
  'Employee Joining Date',
  'Employee Termination Date',
  'Employee Last Updated',
  'Employee Avatar URL',
  'Employee Department',
  'Employee Department ID',
  'Employee Team',
  'Employee Team ID',
  'Employee Location',
  'Employee Seniority',
  'Employee Specialisation',
  'Employee Status',
  'Employee Inactivity Reason',
  'Employee Entity',
  'Line Manager (cycle) ID',
  'Line Manager (cycle)',
  'Line Manager (HR profile) ID',
  'Line Manager (HR profile)',
  'Line Manager (HR profile) Email',
  'Cycle ID',
  'Cycle Name',
  'Cycle Completion Date',
  'Cycle Timeline Item ID',
  'Cycle Timeline Category',
  'Cycle Timeline Type',
  'Cycle Timeline Status',
  'Cycle Timeline Stage',
  'Cycle Timeline Reviewer Relation',
  'Cycle Timeline Employee Seniority ID',
  'Cycle Timeline Employee Specialisation ID',
  'Cycle Timeline Employee Spec Seniority Sublevel ID',
  'Cycle Timeline Nested Cycle ID',
  'Cycle Timeline Nested Cycle Name',
  'Employee Cycle ID',
  'Employee Cycle HR Manager ID',
  'Employee Cycle Name',
  'Employee Cycle Start',
  'Employee Cycle End',
  'Employee Cycle Rating Score',
  'Employee Cycle Rating Label',
  'Employee Cycle Grade',
  'Employee Cycle Skills Rating',
  'Employee Cycle Values Rating',
  'Employee Cycle Deliverables Rating',
  'Employee Cycle Outcome',
  'Eligibility ID',
  'Functional Manager ID',
  'Functional Manager',
  'Department Grade Calibrator ID',
  'Department Grade Calibrator',
  'Function Grade Calibrator ID',
  'Function Grade Calibrator',
  'Reviewed Employee Type Code',
  'Reviewed Employee Type',
  'Grade Calibrated',
  'Can Recalculate Grades',
  'Calibration Flags',
  'Performance Team Comment',
  'Ranking Score',
  'Created Date Time',
  'Updated Date Time',
];

const rest = [...allKeys].filter((k) => !preferredOrder.includes(k)).sort();
const keyOrder = [...preferredOrder.filter((k) => allKeys.has(k)), ...rest];

return built.map((row) => {
  const full = {};
  keyOrder.forEach((k) => {
    full[k] = row[k] ?? '';
  });
  return full;
});

}
