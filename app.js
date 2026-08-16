const COLORS = {
  blue: '#3A81E8',
  darkBlue: '#2D528A',
  gray: '#3C3C50',
  muted: '#9FA8B8',
  pale: '#DDEBFC',
  paleBlue: '#A8C9F5'
};

const charts = {};
let DATA = null;
let cityMap = null;
let cityLayer = null;
let currentTestVariant = 'all';

Chart.defaults.font.family = 'Open Sans, Arial, sans-serif';
Chart.defaults.color = '#596174';
Chart.defaults.borderColor = '#E6EAF0';

function formatNumber(v) {
  return new Intl.NumberFormat('ru-RU').format(v);
}
function formatDecimal(v) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v);
}
function values(series) { return series.map(d => d.value); }
function labels(series) { return series.map(d => d.label); }
function destroy(name) { if (charts[name]) charts[name].destroy(); }

function tooltipCountPercent(context) {
  const dataset = context.dataset.data;
  const total = dataset.reduce((a, b) => a + Number(b), 0);
  const p = total ? (Number(context.raw) / total * 100).toFixed(1).replace('.', ',') : '0';
  return `${context.label}: ${formatNumber(context.raw)} (${p}%)`;
}

function barChart(name, canvasId, series, opts = {}) {
  destroy(name);
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
      indexAxis: opts.horizontal === false ? 'x' : 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: tooltipCountPercent } }
      },
      scales: opts.horizontal === false ? {
        x: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#EEF1F5' }, ticks: { precision: 0 } }
      } : {
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
    data: { labels: labels(series), datasets: [{ data: values(series), backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, boxWidth: 8 } },
        tooltip: { callbacks: { label: tooltipCountPercent } }
      }
    }
  });
}

function renderFunnel() {
  destroy('funnel');
  const series = DATA.funnel;
  charts.funnel = new Chart(document.getElementById('funnelChart'), {
    type: 'bar',
    data: {
      labels: labels(series),
      datasets: [{
        data: values(series),
        backgroundColor: [COLORS.darkBlue, '#3569A8', COLORS.blue, '#76A9EE', '#A6C8F6'],
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 58
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${formatNumber(ctx.raw)} чел.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0, font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#EEF1F5' }, ticks: { precision: 0 } }
      }
    }
  });
}

function initCityMap() {
  cityMap = L.map('cityMap', {
    zoomControl: true,
    scrollWheelZoom: false,
    minZoom: 1,
    worldCopyJump: true
  }).setView([47, 46], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(cityMap);

  cityLayer = L.layerGroup().addTo(cityMap);
}

function renderCityMap(points) {
  if (!cityMap) initCityMap();
  cityLayer.clearLayers();
  const bounds = [];

  points.forEach(p => {
    const radius = Math.min(42, 4 + Math.sqrt(p.count) * 2.5);
    const marker = L.circleMarker([p.lat, p.lng], {
      radius,
      color: '#FFFFFF',
      weight: 1.5,
      fillColor: COLORS.blue,
      fillOpacity: .72
    });
    marker.bindTooltip(`<strong>${p.city}</strong><br>${formatNumber(p.count)} чел.`, {
      direction: 'top',
      className: 'city-tooltip'
    });
    marker.addTo(cityLayer);
    bounds.push([p.lat, p.lng]);
  });

  if (bounds.length > 1) {
    cityMap.fitBounds(bounds, { padding: [26, 26], maxZoom: 4 });
  } else if (bounds.length === 1) {
    cityMap.setView(bounds[0], 5);
  }
  setTimeout(() => cityMap.invalidateSize(), 0);
}

function subtractSeries(allSeries, subsetSeries) {
  const subset = new Map(subsetSeries.map(d => [d.label, Number(d.value)]));
  return allSeries.map(d => ({ label: d.label, value: Math.max(0, Number(d.value) - (subset.get(d.label) || 0)) })).filter(d => d.value > 0);
}

function notAllowedCohort() {
  const all = DATA.cohorts.all;
  const allowed = DATA.cohorts.allowed;
  const allowedCities = new Map(allowed.city_points.map(p => [p.city, p.count]));
  return {
    n: all.n - allowed.n,
    city_points: all.city_points
      .map(p => ({ ...p, count: Math.max(0, p.count - (allowedCities.get(p.city) || 0)) }))
      .filter(p => p.count > 0),
    study_status: subtractSeries(all.study_status, allowed.study_status),
    grad_group: subtractSeries(all.grad_group, allowed.grad_group),
    prior: subtractSeries(all.prior, allowed.prior)
  };
}

function renderCohort(key) {
  const c = key === 'not_allowed' ? notAllowedCohort() : DATA.cohorts[key];
  document.getElementById('cohortN').textContent = formatNumber(c.n);
  renderCityMap(c.city_points);
  barChart('study', 'studyChart', c.study_status, { color: COLORS.darkBlue, maxBarThickness: 30 });
  barChart('grad', 'gradChart', c.grad_group, { horizontal: false, color: COLORS.blue, maxBarThickness: 42 });
  doughnutChart('prior', 'priorChart', c.prior, [COLORS.blue, COLORS.darkBlue]);
}

function renderCourseChart() {
  barChart('course', 'courseChart', DATA.overall.course_score, { horizontal: false, color: COLORS.darkBlue, maxBarThickness: 54 });
}

function blockShortLabel(label) {
  if (label.startsWith('Молекулярная')) return ['Молекулярная', 'биология'];
  if (label === 'Статистика и R') return ['Статистика', 'и R'];
  return label;
}

function renderBlockComparison(key) {
  destroy('blocks');
  const labelsOrder = DATA.testing.all.blocks.map(b => b.label);
  let datasets;

  if (key === 'all') {
    const byVariant = ['v1', 'v2'].map(v => DATA.testing[v]);
    datasets = byVariant.map((stat, index) => ({
      label: stat.title,
      data: labelsOrder.map(lbl => stat.blocks.find(b => b.label === lbl).median_pct),
      backgroundColor: index === 0 ? COLORS.darkBlue : COLORS.blue,
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 34
    }));
  } else {
    const stat = DATA.testing[key];
    datasets = [{
      label: stat.title,
      data: labelsOrder.map(lbl => stat.blocks.find(b => b.label === lbl).median_pct),
      backgroundColor: key === 'v1' ? COLORS.darkBlue : COLORS.blue,
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 48
    }];
  }

  charts.blocks = new Chart(document.getElementById('blockChart'), {
    type: 'bar',
    data: { labels: labelsOrder.map(blockShortLabel), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: key === 'all', position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatDecimal(ctx.raw)}%` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, max: 100, grid: { color: '#EEF1F5' }, ticks: { callback: v => `${v}%` } }
      }
    }
  });
}

function renderTestDistribution(stat, key) {
  destroy('testScore');
  charts.testScore = new Chart(document.getElementById('testScoreChart'), {
    type: 'bar',
    data: {
      labels: stat.score_distribution.map(d => d.label),
      datasets: [{
        label: 'Число участников',
        data: stat.score_distribution.map(d => d.value),
        backgroundColor: key === 'v1' ? COLORS.darkBlue : (key === 'v2' ? COLORS.blue : COLORS.paleBlue),
        borderRadius: 2,
        borderSkipped: false,
        maxBarThickness: 18
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${formatNumber(ctx.raw)} чел.` } } },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 10 } }, title: { display: true, text: 'Общий балл', font: { size: 11, weight: '600' } } },
        y: { beginAtZero: true, grid: { color: '#EEF1F5' }, ticks: { precision: 0 }, title: { display: true, text: 'Число участников', font: { size: 11, weight: '600' } } }
      }
    }
  });
}

function renderBlockMetrics(stat) {
  const holder = document.getElementById('blockMetrics');
  holder.innerHTML = stat.blocks.map(b => {
    const displayLabel = b.label.startsWith('Молекулярная') ? 'Молекулярная биология' : b.label;
    return `
    <div class="block-metric">
      <strong>${formatDecimal(b.median_pct)}%</strong>
      <span>${displayLabel}</span>
    </div>`;
  }).join('');
}

function renderTesting(key) {
  currentTestVariant = key;
  const stat = DATA.testing[key];
  document.getElementById('testVariantN').textContent = formatNumber(stat.n);
  document.getElementById('testMean').textContent = formatDecimal(stat.mean_total);
  document.getElementById('testPassing').textContent = formatDecimal(stat.passing_score);
  document.getElementById('testVariantCaption').textContent = key === 'all' ? 'Все варианты' : `${stat.title} · ${stat.date}`;
  renderTestDistribution(stat, key);
  renderBlockComparison(key);
  renderBlockMetrics(stat);
  document.querySelectorAll('.segment').forEach(btn => btn.classList.toggle('active', btn.dataset.variant === key));
}

function renderKpis() {
  const k = DATA.kpis;
  const all = DATA.cohorts.all;
  const prior = all.prior.find(d => d.label === 'Пробовал поступать раньше');
  const course170 = DATA.overall.course_score.reduce((sum, d) => {
    const lower = Number(String(d.label).match(/^\d+/)?.[0] || 0);
    return sum + (lower >= 170 ? Number(d.value) : 0);
  }, 0);
  const competition = k.accepted ? k.applications_unique / k.accepted : 0;

  document.getElementById('kpiApplications').textContent = formatNumber(k.applications_unique);
  document.getElementById('kpiCities').textContent = formatNumber(all.city_points.length);
  document.getElementById('kpiPrior').textContent = formatNumber(prior ? prior.value : 0);
  document.getElementById('kpiCompetition').textContent = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(competition);
  document.getElementById('kpiCourse170').textContent = formatNumber(course170);
  document.getElementById('kpiTests').textContent = formatNumber(k.test_completed_unique);
  document.getElementById('kpiAllowed').textContent = formatNumber(k.interview_allowed_unique);
  document.getElementById('courseN').textContent = formatNumber(k.course_scores_available);
  const prepared = DATA.meta.generated.split('-').reverse().join('.');
  document.getElementById('dataStamp').textContent = `Данные на ${prepared}`;
}

async function init() {
  try {
    const response = await fetch('./data/admissions.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    DATA = await response.json();

    renderKpis();
    renderFunnel();
    renderCourseChart();
    renderCohort('all');
    renderTesting('all');

    document.getElementById('cohortSelect').addEventListener('change', e => renderCohort(e.target.value));
    document.querySelectorAll('.segment').forEach(btn => btn.addEventListener('click', () => renderTesting(btn.dataset.variant)));
  } catch (error) {
    console.error(error);
    document.getElementById('dataStamp').textContent = 'Не удалось загрузить data/admissions.json';
  }
}

document.addEventListener('DOMContentLoaded', init);
