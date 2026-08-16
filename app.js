const COLORS = {
  blue: '#3A81E8',
  darkBlue: '#2D528A',
  gray: '#3C3C50',
  smoke: '#F5F5F5',
  muted: '#9FA8B8',
  pale: '#DDEBFC'
};

const charts = {};
let DATA = null;

Chart.defaults.font.family = 'Open Sans, Arial, sans-serif';
Chart.defaults.color = '#596174';
Chart.defaults.borderColor = '#E6EAF0';

function formatNumber(v) {
  return new Intl.NumberFormat('ru-RU').format(v);
}

function values(series) { return series.map(d => d.value); }
function labels(series) { return series.map(d => d.label); }

function destroy(name) {
  if (charts[name]) charts[name].destroy();
}

function tooltipPercent(context) {
  const dataset = context.dataset.data;
  const total = dataset.reduce((a,b) => a + b, 0);
  const p = total ? (context.raw / total * 100).toFixed(1).replace('.', ',') : '0';
  return `${context.label}: ${formatNumber(context.raw)} (${p}%)`;
}

function barChart(name, canvasId, series, opts = {}) {
  destroy(name);
  const horizontal = opts.horizontal ?? true;
  const ctx = document.getElementById(canvasId);
  charts[name] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels(series),
      datasets: [{
        data: values(series),
        backgroundColor: opts.color || COLORS.blue,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: opts.maxBarThickness || 34
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: tooltipPercent } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#EEF1F5' }, ticks: { precision: 0 } },
        y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } }
      }
    }
  });
}

function doughnutChart(name, canvasId, series, colors = [COLORS.blue, COLORS.darkBlue, COLORS.muted, COLORS.pale]) {
  destroy(name);
  const ctx = document.getElementById(canvasId);
  charts[name] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels(series),
      datasets: [{ data: values(series), backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
        tooltip: { callbacks: { label: tooltipPercent } }
      }
    }
  });
}

function renderFunnel() {
  destroy('funnel');
  const series = DATA.funnel;
  const ctx = document.getElementById('funnelChart');
  charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels(series),
      datasets: [{
        data: values(series),
        backgroundColor: [COLORS.darkBlue, '#3569A8', COLORS.blue, '#69A0ED', '#8BB7F3', '#B4D2FA'],
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 56
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${formatNumber(ctx.raw)} человек` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#EEF1F5' }, ticks: { precision: 0 } }
      }
    }
  });
}

function renderCohort(key) {
  const c = DATA.cohorts[key];
  document.getElementById('cohortN').textContent = formatNumber(c.n);
  barChart('city', 'cityChart', c.city, { horizontal: true, color: COLORS.blue, maxBarThickness: 28 });
  barChart('study', 'studyChart', c.study_status, { horizontal: true, color: COLORS.darkBlue, maxBarThickness: 30 });
  barChart('grad', 'gradChart', c.grad_group, { horizontal: false, color: COLORS.blue, maxBarThickness: 42 });
  doughnutChart('prior', 'priorChart', c.prior, [COLORS.blue, COLORS.darkBlue, COLORS.muted]);
}

function renderStaticCharts() {
  barChart('course', 'courseChart', DATA.overall.course_score, { horizontal: false, color: COLORS.darkBlue, maxBarThickness: 42 });
  barChart('test', 'testChart', DATA.overall.test_score, { horizontal: false, color: COLORS.blue, maxBarThickness: 42 });
  barChart('interview', 'interviewChart', DATA.overall.interview_score, { horizontal: false, color: COLORS.darkBlue, maxBarThickness: 42 });
  doughnutChart('decision', 'decisionChart', DATA.overall.decision, [COLORS.blue, COLORS.gray]);
  doughnutChart('grant', 'grantChart', DATA.overall.grant_interviewed, [COLORS.darkBlue, COLORS.pale]);
}

function renderKpis() {
  const k = DATA.kpis;
  document.getElementById('kpiApplications').textContent = formatNumber(k.applications_unique);
  document.getElementById('kpiTests').textContent = formatNumber(k.test_completed_unique);
  document.getElementById('kpiAllowed').textContent = formatNumber(k.interview_allowed_unique);
  document.getElementById('kpiInterviewed').textContent = formatNumber(k.interviewed_unique);
  document.getElementById('kpiAccepted').textContent = formatNumber(k.accepted);
  document.getElementById('kpiConversion').textContent = `${String(k.acceptance_from_applications_pct).replace('.', ',')}%`;
  document.getElementById('courseN').textContent = formatNumber(k.course_scores_available);
  document.getElementById('testN').textContent = formatNumber(k.test_completed_unique);
  document.getElementById('dataStamp').textContent = `Источник: ${DATA.meta.source_file} · подготовлено ${DATA.meta.generated.split('-').reverse().join('.')}`;
}

async function init() {
  try {
    const response = await fetch('./data/admissions.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    DATA = await response.json();
    renderKpis();
    renderFunnel();
    renderStaticCharts();
    renderCohort('all');
    document.getElementById('cohortSelect').addEventListener('change', e => renderCohort(e.target.value));
  } catch (error) {
    console.error(error);
    document.getElementById('dataStamp').textContent = 'Не удалось загрузить data/admissions.json';
  }
}

document.addEventListener('DOMContentLoaded', init);
