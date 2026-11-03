/* หน้ารายงาน — ตัวอย่างรายงาน และส่งออก Excel / PDF */
(function () {
  const { esc, Fmt, toast, options, setLoading, posBadge } = UI;
  Layout.init({ active: 'reports', title: 'รายงาน', subtitle: 'รายงานสมาชิกตามปีการศึกษาและตำแหน่ง' });
  if (!Auth.require('reports')) return;

  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  const form = document.getElementById('reportForm');
  const btnX = document.getElementById('btnExcel'), btnP = document.getElementById('btnPdf');
  btnX.innerHTML = Icons.excel + 'ส่งออก Excel';
  btnP.innerHTML = Icons.pdf + 'ส่งออก PDF';

  const params = () => ({ year_id: form.year_id.value, position_id: form.position_id.value, department_id: form.department_id.value, status: form.status.value });

  UI.getMeta().then(meta => {
    form.year_id.innerHTML = options(meta.years, { label: 'name', selected: meta.current_year_id, placeholder: 'ทุกปีการศึกษา' });
    form.position_id.innerHTML = options(meta.positions, { placeholder: 'ทุกตำแหน่ง' });
    form.department_id.innerHTML = options(meta.departments, { placeholder: 'ทุกแผนก' });
    form.status.innerHTML = options(Object.entries(meta.statuses).map(([k, v]) => ({ id: k, name: v })), { placeholder: 'ทุกสถานะ' });
    form.querySelectorAll('select').forEach(s => s.addEventListener('change', load));
    load();
  });

  async function load() {
    const prev = document.getElementById('preview');
    prev.innerHTML = UI.loadingHtml();
    try {
      const r = await API.get('/api/reports/members', { ...params(), format: 'json' });
      document.getElementById('rTitle').innerHTML = `${esc(r.title)}<div class="card-sub">จำนวน ${Fmt.number(r.total)} คน</div>`;
      prev.innerHTML = r.items.length ? `<table class="table">
        <thead><tr><th class="center">ลำดับ</th><th>เลขสมาชิก</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>แผนกวิชา</th><th class="center">ระดับชั้น</th><th class="center">ปีการศึกษา</th><th>สถานะ</th><th>เบอร์ติดต่อ</th></tr></thead>
        <tbody>${r.items.map(m => `<tr><td class="center num">${m.no}</td><td class="num">${esc(m.member_no)}</td>
          <td><a href="member-view.html?id=${m.id}" style="color:inherit">${esc(m.full_name)}</a></td><td>${posBadge(m.position, m.position_color)}</td>
          <td>${esc(m.department || '-')}</td><td class="center">${esc(m.education_level || '-')}</td><td class="center num">${esc(m.academic_year || '-')}</td>
          <td>${UI.statusHtml(m.status)}</td><td class="num">${Fmt.phone(m.phone)}</td></tr>`).join('')}</tbody></table>`
        : UI.emptyHtml('ไม่พบข้อมูลตามเงื่อนไข');

      // ตารางสรุป
      const s = r.summary;
      document.getElementById('sumSub').textContent = form.year_id.value ? form.year_id.options[form.year_id.selectedIndex].text : 'ทุกปีการศึกษา (ตำแหน่งล่าสุด)';
      document.getElementById('summary').innerHTML = s.rows.length ? `<table class="table matrix">
        <thead><tr><th>แผนกวิชา</th>${s.positions.map(p => `<th>${esc(p)}</th>`).join('')}<th>รวม</th></tr></thead>
        <tbody>${s.rows.map(row => `<tr><td>${esc(row.department)}</td>${row.counts.map(c => `<td class="num">${c || '<span class="text-muted">–</span>'}</td>`).join('')}<td class="num"><b>${row.total}</b></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>รวมทั้งหมด</td>${s.totals.map(t => `<td class="num">${t}</td>`).join('')}<td class="num">${s.grand_total}</td></tr></tfoot></table>`
        : UI.emptyHtml('ไม่มีข้อมูล');
    } catch (e) { prev.innerHTML = UI.emptyHtml('โหลดรายงานไม่สำเร็จ', e.message); }
  }

  async function exportFile(fmt, btn) {
    setLoading(btn, true, 'กำลังสร้างไฟล์...');
    try {
      await API.download('/api/reports/members', { ...params(), format: fmt }, `member_report.${fmt}`);
      toast(`ส่งออกไฟล์ ${fmt === 'xlsx' ? 'Excel' : 'PDF'} เรียบร้อย`);
    } catch (e) { toast(e.message, 'error'); } finally { setLoading(btn, false); }
  }
  btnX.addEventListener('click', () => exportFile('xlsx', btnX));
  btnP.addEventListener('click', () => exportFile('pdf', btnP));
})();
