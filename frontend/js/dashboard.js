/* หน้า Dashboard */
(function () {
  const { esc, Fmt, toast } = UI;
  Layout.init({ active: 'dashboard', title: 'Dashboard', subtitle: 'ภาพรวมระบบสมาชิกองค์การนักวิชาชีพแห่งประเทศไทย' });

  document.getElementById('ic1').innerHTML = Icons.users;
  document.getElementById('ic2').innerHTML = Icons.calendar;
  document.getElementById('ic3').innerHTML = Icons.award;
  document.getElementById('alertIcon').innerHTML = Icons.bell;

  const charts = {};
  const yearSel = document.getElementById('yearSelect');
  let yearId = null;

  if (Auth.can('members.view')) {
    new MemberTable(document.getElementById('memberTable'), { title: 'สมาชิกล่าสุด', perPage: 8, params: { sort: 'created', order: 'desc' } });
  } else {
    document.getElementById('memberTable').hidden = true;
  }

  async function load() {
    try {
      const d = await API.get('/api/dashboard', { year_id: yearId });
      const meta = await UI.getMeta();
      if (!yearSel.options.length) {
        yearSel.innerHTML = UI.options(meta.years, { label: 'name', selected: d.year && d.year.id });
        yearSel.addEventListener('change', () => { yearId = yearSel.value; load(); });
      }
      render(d);
    } catch (e) { toast(e.message, 'error'); }
  }

  function render(d) {
    const y = d.year ? d.year.year : '';
    document.getElementById('sTotal').textContent = Fmt.number(d.stats.total);
    document.getElementById('sYear').textContent = Fmt.number(d.stats.current_year);
    document.getElementById('sYearLabel').textContent = d.year && d.year.is_current ? `สมาชิกปีการศึกษาปัจจุบัน (${y})` : `สมาชิกปีการศึกษา ${y}`;
    document.getElementById('sCommittee').textContent = Fmt.number(d.stats.committee);
    document.getElementById('yearInfo').textContent = `ข้อมูล ณ ${Fmt.today()} · ${d.year ? d.year.name : ''}`;
    document.getElementById('posYear').textContent = d.year ? d.year.name : '';

    // ---- การ์ดแจ้งเตือน ----
    document.getElementById('aIncomplete').textContent = Fmt.number(d.stats.incomplete) + ' คน';
    document.getElementById('aText').innerHTML = d.stats.incomplete
      ? `ยังขาดรูปถ่าย เบอร์ติดต่อ หรือประวัติส่วนตัว และมีสมาชิก <b>${d.stats.pending}</b> คนที่รอตรวจสอบ`
      : `ข้อมูลสมาชิกครบถ้วนทุกคน${d.stats.pending ? ` · รอตรวจสอบ ${d.stats.pending} คน` : ''}`;

    // ---- การ์ดสรุปตามตำแหน่ง (วงกลมเปอร์เซ็นต์) ----
    const sum = d.by_position.reduce((s, p) => s + p.count, 0) || 1;
    const R = 25, C = 2 * Math.PI * R;
    document.getElementById('posCards').innerHTML = `<div class="side-title">สรุปตามตำแหน่ง</div>` + d.by_position.slice(0, 4).map((p) => {
      const pct = Math.round(p.count / sum * 100);
      return `<a class="pos-card" href="members.html?position_id=${p.id}&year_id=${d.year ? d.year.id : ''}" aria-label="${esc(p.name)} ${p.count} คน">
        <div class="ring"><svg viewBox="0 0 62 62"><circle class="bg" cx="31" cy="31" r="${R}"/><circle class="fg" cx="31" cy="31" r="${R}" stroke="${esc(p.color)}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - pct / 100)}"/></svg><span>${pct}%</span></div>
        <div><div class="p-name"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</div><div class="p-count">${Fmt.number(p.count)} <small>คน</small></div></div>
      </a>`;
    }).join('');
    requestAnimationFrame(() => document.querySelectorAll('.ring .fg').forEach(c => { c.style.strokeDashoffset = c.dataset.off; }));

    drawCharts(d);
  }

  function drawCharts(d) {
    if (!window.Chart) {   // กรณีออฟไลน์โหลด Chart.js ไม่ได้ → แสดงเป็นตาราง
      const table = (rows) => `<table class="table" style="min-width:0"><tbody>${rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num" style="text-align:right">${v}</td></tr>`).join('')}</tbody></table>`;
      document.getElementById('chartYear').parentNode.innerHTML = table(d.by_year.map(y => ['ปี ' + y.year, y.count]));
      document.getElementById('chartPos').parentNode.innerHTML = table(d.by_position.map(p => [p.name, p.count]));
      return;
    }
    Chart.defaults.font.family = "'Sarabun', sans-serif"; Chart.defaults.font.size = 13;
    Chart.defaults.color = '#6B778C';
    const grid = { color: '#EDF1F6', drawTicks: false };
    const tooltip = { backgroundColor: '#172033', padding: 10, cornerRadius: 10, titleFont: { weight: '600' }, displayColors: false,
      // แท่งแนวนอน (indexAxis: 'y') ค่าอยู่ที่แกน x — parsed.y คือลำดับแถว ไม่ใช่จำนวน
      callbacks: { label: (c) => `${Fmt.number(c.chart.options.indexAxis === 'y' ? c.parsed.x : c.parsed.y)} คน` } };

    // จำนวนสมาชิกแต่ละปีการศึกษา — ชุดข้อมูลเดียว สีเดียว
    charts.year && charts.year.destroy();
    charts.year = new Chart(document.getElementById('chartYear'), {
      type: 'bar',
      data: {
        labels: d.by_year.map(y => 'ปี ' + y.year),
        datasets: [{
          data: d.by_year.map(y => y.count),
          backgroundColor: d.by_year.map(y => (d.year && y.id === d.year.id) ? '#1F4FB5' : '#9DB4E0'),
          hoverBackgroundColor: '#13306B',
          borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: 44,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip },
        scales: { y: { beginAtZero: true, grid, border: { display: false }, ticks: { precision: 0, padding: 8 } },
                  x: { grid: { display: false }, border: { color: '#DFE5EE' } } },
      },
    });

    // จำนวนตามตำแหน่ง — แท่งแนวนอน สีตามตำแหน่ง พร้อมชื่อกำกับแกน
    charts.pos && charts.pos.destroy();
    charts.pos = new Chart(document.getElementById('chartPos'), {
      type: 'bar',
      data: {
        labels: d.by_position.map(p => p.name),
        datasets: [{
          data: d.by_position.map(p => p.count),
          backgroundColor: d.by_position.map(p => p.color || '#1F4FB5'),
          borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: 'left', maxBarThickness: 30,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip },
        scales: { x: { beginAtZero: true, grid, border: { display: false }, ticks: { precision: 0 } },
                  y: { grid: { display: false }, border: { color: '#DFE5EE' }, ticks: { color: '#3E4A5E', font: { size: 13 } } } },
      },
    });
  }

  load();
})();
