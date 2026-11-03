/* หน้าจัดการสมาชิก — เพิ่ม แก้ไข ลบ ตรวจสอบ */
(function () {
  const { Fmt } = UI;
  Layout.init({ active: 'members', title: 'จัดการสมาชิก', subtitle: 'เพิ่ม แก้ไข ลบ และตรวจสอบข้อมูลสมาชิก' });
  if (!Auth.require('members.view')) return;

  // รับค่าตัวกรองจาก URL เช่น members.html?position_id=1&year_id=2&incomplete=1
  const url = new URLSearchParams(location.search);
  const params = {};
  ['year_id', 'position_id', 'department_id', 'status', 'level', 'incomplete', 'q'].forEach(k => { if (url.get(k)) params[k] = url.get(k); });
  const hasFilter = Object.keys(params).some(k => k !== 'q');

  const table = new MemberTable(document.getElementById('memberTable'), {
    title: 'รายชื่อสมาชิกทั้งหมด', perPage: 15, params, openFilter: hasFilter,
    onLoad: loadStatus,
  });

  // การ์ดสรุปสถานะ (กดเพื่อกรอง)
  const cards = document.getElementById('statusCards');
  async function loadStatus() {
    try {
      const d = await API.get('/api/dashboard');
      const by = Object.fromEntries(d.by_status.map(s => [s.status, s.count]));
      const items = [
        { k: '', label: 'สมาชิกทั้งหมด', v: d.stats.total, color: 'var(--primary)' },
        { k: 'active', label: 'ปกติ', v: by.active, color: 'var(--success)' },
        { k: 'pending', label: 'รอตรวจสอบ', v: by.pending, color: 'var(--warning)' },
        { k: 'inactive', label: 'พ้นสภาพ', v: by.inactive, color: 'var(--danger)' },
      ];
      cards.innerHTML = items.map(i => `
        <button class="card stat-card" data-st="${i.k}" style="text-align:left;border:0;cursor:pointer;font:inherit;${(table.state.status || '') === i.k ? 'outline:2px solid ' + i.color : ''}">
          <div class="stat-value" style="font-size:32px">${Fmt.number(i.v || 0)}</div>
          <div class="stat-label"><span class="status ${i.k}">${i.label}</span></div>
        </button>`).join('');
      cards.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
        table.state.status = b.dataset.st; table.state.page = 1;
        table.renderFilters(); table.load();
      }));
    } catch (e) { /* ignore */ }
  }
})();
