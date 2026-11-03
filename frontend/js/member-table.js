/* =====================================================================
   member-table.js — ตารางสมาชิก (checkbox, เรียงข้อมูล, ตัวกรอง, เมนู ⋮)
   ใช้ร่วมกันในหน้า Dashboard และหน้าสมาชิก
   ===================================================================== */
(function () {
  const { esc, avatar, statusHtml, posBadge, Fmt, toast, popMenu, confirm, modal, options, debounce } = UI;

  const COLS = [
    { key: 'name', label: 'ชื่อ - นามสกุล' },
    { key: 'member_no', label: 'เลขสมาชิก' },
    { key: 'position', label: 'ตำแหน่ง' },
    { key: 'department', label: 'แผนกวิชา' },
    { key: 'status', label: 'สถานะ' },
    { key: 'phone', label: 'เบอร์ติดต่อ' },
  ];

  class MemberTable {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = Object.assign({ title: 'รายชื่อสมาชิก', perPage: 10, showAdd: true, pagination: true }, opts);
      this.state = Object.assign({ page: 1, per_page: this.opts.perPage, sort: 'member_no', order: 'asc', q: '' }, opts.params || {});
      this.selected = new Set();
      this.items = [];
      this.showFilter = !!opts.openFilter;
      this.render();
      this.load();
    }

    render() {
      const canEdit = Auth.can('members.edit'), canDel = Auth.can('members.delete');
      this.el.innerHTML = `
        <div class="card-head">
          <div class="card-title"><span class="ic">${Icons.users}</span><div>${esc(this.opts.title)}<div class="card-sub" data-count>กำลังโหลด...</div></div></div>
          <div class="toolbar">
            <div class="search-inline"><input class="input" type="search" placeholder="ค้นหาชื่อ / เลขสมาชิก" data-q aria-label="ค้นหาในตาราง" value="${esc(this.state.q)}">${Icons.search}</div>
            <button class="icon-btn" data-tool="search" title="ค้นหา" aria-label="ค้นหา">${Icons.search}</button>
            ${canEdit ? `<button class="icon-btn" data-tool="edit" title="แก้ไขรายการที่เลือก" aria-label="แก้ไข">${Icons.edit}</button>` : ''}
            ${canDel ? `<button class="icon-btn danger" data-tool="delete" title="ลบรายการที่เลือก" aria-label="ลบ">${Icons.trash}</button>` : ''}
            <button class="icon-btn ${this.showFilter ? 'active' : ''}" data-tool="filter" title="ตัวกรอง" aria-label="ตัวกรอง">${Icons.filter}</button>
            ${this.opts.showAdd && canEdit ? `<a class="btn btn-primary" href="member-form.html">${Icons.plus}รับสมาชิก</a>` : ''}
          </div>
        </div>
        <div class="filter-panel" data-filters ${this.showFilter ? '' : 'hidden'}></div>
        <div class="bulk-bar" data-bulk hidden></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th class="col-check"><label class="check"><input type="checkbox" data-all aria-label="เลือกทั้งหมด"></label></th>
              ${COLS.map(c => `<th class="sortable" data-sort="${c.key}">${c.label}<span class="arrow">▾</span></th>`).join('')}
              <th class="col-act"></th>
            </tr></thead>
            <tbody data-body><tr><td colspan="8">${UI.loadingHtml()}</td></tr></tbody>
          </table>
        </div>
        ${this.opts.pagination ? '<div class="table-foot"><span data-info></span><div class="pager" data-pager></div></div>' : ''}`;

      const $ = (s) => this.el.querySelector(s);
      this.$ = $;
      $('[data-q]').addEventListener('input', debounce((e) => { this.state.q = e.target.value.trim(); this.state.page = 1; this.load(); }, 350));
      this.el.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => this.tool(b.dataset.tool, b)));
      this.el.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
        const k = th.dataset.sort;
        this.state.order = this.state.sort === k && this.state.order === 'asc' ? 'desc' : 'asc';
        this.state.sort = k; this.state.page = 1; this.load();
      }));
      $('[data-all]').addEventListener('change', (e) => {
        this.items.forEach(m => e.target.checked ? this.selected.add(m.id) : this.selected.delete(m.id));
        this.renderRows(); this.renderBulk();
      });
      this.renderFilters();
    }

    async renderFilters() {
      const meta = await UI.getMeta();
      const s = this.state;
      const box = this.$('[data-filters]');
      box.innerHTML = `
        <select class="select" data-f="year_id" aria-label="ปีการศึกษา">${options(meta.years, { label: 'name', selected: s.year_id, placeholder: 'ทุกปีการศึกษา' })}</select>
        <select class="select" data-f="position_id" aria-label="ตำแหน่ง">${options(meta.positions, { selected: s.position_id, placeholder: 'ทุกตำแหน่ง' })}</select>
        <select class="select" data-f="department_id" aria-label="แผนกวิชา">${options(meta.departments, { selected: s.department_id, placeholder: 'ทุกแผนกวิชา' })}</select>
        <select class="select" data-f="status" aria-label="สถานะ">${options(Object.entries(meta.statuses).map(([k, v]) => ({ id: k, name: v })), { selected: s.status, placeholder: 'ทุกสถานะ' })}</select>
        <select class="select" data-f="level" aria-label="ระดับชั้น">${options(meta.levels, { selected: s.level, placeholder: 'ทุกระดับชั้น' })}</select>
        <label class="check"><input type="checkbox" data-f="incomplete" ${s.incomplete ? 'checked' : ''}> เฉพาะข้อมูลไม่ครบ</label>
        <button class="btn btn-light btn-sm" data-reset>${Icons.refresh}ล้างตัวกรอง</button>`;
      box.querySelectorAll('[data-f]').forEach(el => el.addEventListener('change', () => {
        const k = el.dataset.f;
        this.state[k] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value;
        this.state.page = 1; this.load();
      }));
      box.querySelector('[data-reset]').addEventListener('click', () => {
        ['year_id', 'position_id', 'department_id', 'status', 'level', 'incomplete'].forEach(k => delete this.state[k]);
        this.state.page = 1; this.renderFilters(); this.load();
      });
    }

    async load() {
      const body = this.$('[data-body]');
      this.el.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.toggle('sorted', th.dataset.sort === this.state.sort);
        th.classList.toggle('asc', th.dataset.sort === this.state.sort && this.state.order === 'asc');
      });
      try {
        const r = await API.get('/api/members', this.state);
        this.items = r.items; this.total = r.total; this.pages = r.pages;
        this.$('[data-count]').textContent = `ทั้งหมด ${Fmt.number(r.total)} คน`;
        this.renderRows(); this.renderPager(); this.renderBulk();
        this.opts.onLoad && this.opts.onLoad(r);
      } catch (e) {
        body.innerHTML = `<tr><td colspan="8">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</td></tr>`;
      }
    }

    renderRows() {
      const body = this.$('[data-body]');
      if (!this.items.length) {
        body.innerHTML = `<tr><td colspan="8">${UI.emptyHtml('ไม่พบข้อมูลสมาชิก', 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง')}</td></tr>`;
        this.$('[data-all]').checked = false;
        return;
      }
      body.innerHTML = this.items.map(m => `
        <tr class="${this.selected.has(m.id) ? 'selected' : ''}" data-id="${m.id}">
          <td><label class="check"><input type="checkbox" data-sel="${m.id}" ${this.selected.has(m.id) ? 'checked' : ''} aria-label="เลือก ${esc(m.full_name)}"></label></td>
          <td><div class="person">${avatar(m)}<div><a class="p-main" href="member-view.html?id=${m.id}">${esc(m.full_name)}</a>
            <div class="p-sub">${m.nickname ? 'ชื่อเล่น ' + esc(m.nickname) + ' · ' : ''}${esc(m.education_level || '')}${m.missing && m.missing.length ? ` · <span style="color:var(--warning)" title="ยังไม่มี: ${esc(m.missing.join(', '))}">ข้อมูลไม่ครบ</span>` : ''}</div></div></div></td>
          <td class="num">${esc(m.member_no)}</td>
          <td>${posBadge(m.position, m.position_color)}</td>
          <td>${esc(m.department || '-')}</td>
          <td>${statusHtml(m.status)}</td>
          <td class="num">${Fmt.phone(m.phone)}</td>
          <td class="col-act"><button class="icon-btn sm" data-menu="${m.id}" aria-label="ตัวเลือก">${Icons.more}</button></td>
        </tr>`).join('');
      body.querySelectorAll('[data-sel]').forEach(cb => cb.addEventListener('change', () => {
        const id = +cb.dataset.sel;
        cb.checked ? this.selected.add(id) : this.selected.delete(id);
        cb.closest('tr').classList.toggle('selected', cb.checked);
        this.renderBulk();
      }));
      body.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => this.rowMenu(b)));
      this.$('[data-all]').checked = this.items.every(m => this.selected.has(m.id));
    }

    renderPager() {
      if (!this.opts.pagination) return;
      const { page, per_page } = this.state;
      const from = this.total ? (page - 1) * per_page + 1 : 0, to = Math.min(page * per_page, this.total);
      this.$('[data-info]').textContent = `แสดง ${from}-${to} จาก ${Fmt.number(this.total)} รายการ`;
      const pages = this.pages || 1;
      const nums = [];
      for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
      }
      const pager = this.$('[data-pager]');
      pager.innerHTML = `<button data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="ก่อนหน้า">‹</button>` +
        nums.map(n => n === '…' ? '<button disabled>…</button>' : `<button data-p="${n}" class="${n === page ? 'active' : ''}">${n}</button>`).join('') +
        `<button data-p="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="ถัดไป">›</button>`;
      pager.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { this.state.page = +b.dataset.p; this.load(); }));
    }

    renderBulk() {
      const bar = this.$('[data-bulk]');
      const n = this.selected.size;
      bar.hidden = n === 0;
      if (!n) return;
      bar.innerHTML = `<span>เลือกแล้ว ${n} รายการ</span>
        ${Auth.can('members.edit') ? `
          <button class="btn btn-sm btn-success" data-b="active">${Icons.check}ตั้งเป็นปกติ</button>
          <button class="btn btn-sm btn-light" data-b="pending">รอตรวจสอบ</button>
          <button class="btn btn-sm btn-light" data-b="inactive">พ้นสภาพ</button>` : ''}
        ${Auth.can('members.delete') ? `<button class="btn btn-sm btn-danger" data-b="delete">${Icons.trash}ลบ</button>` : ''}
        <button class="btn btn-sm btn-light" data-b="clear" style="margin-left:auto">ยกเลิกการเลือก</button>`;
      bar.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.b;
        if (a === 'clear') { this.selected.clear(); this.renderRows(); this.renderBulk(); }
        else if (a === 'delete') this.bulkDelete();
        else this.bulkStatus(a);
      }));
    }

    tool(name, btn) {
      if (name === 'search') { this.$('[data-q]').focus(); return; }
      if (name === 'filter') {
        this.showFilter = !this.showFilter;
        this.$('[data-filters]').hidden = !this.showFilter;
        btn.classList.toggle('active', this.showFilter);
        return;
      }
      if (name === 'edit') {
        if (this.selected.size !== 1) return toast('กรุณาเลือกสมาชิก 1 รายการเพื่อแก้ไข', 'warning');
        Nav.go('member-form.html?id=' + [...this.selected][0]);
        return;
      }
      if (name === 'delete') {
        if (!this.selected.size) return toast('กรุณาเลือกสมาชิกที่ต้องการลบ', 'warning');
        this.bulkDelete();
      }
    }

    bulkDelete() {
      const ids = [...this.selected];
      const names = this.items.filter(m => this.selected.has(m.id)).map(m => m.full_name);
      const preview = names.slice(0, 3).join(', ') + (ids.length > 3 ? ` และอีก ${ids.length - 3} คน` : '');
      confirm(`ต้องการลบสมาชิกที่เลือกทั้งหมด ${ids.length} คนหรือไม่?`, {
        title: 'ลบสมาชิกหลายรายการ', okText: `ลบ ${ids.length} รายการ`,
        item: `${ids.length} คน`, itemSub: preview,
        detail: 'ข้อมูล ประวัติตำแหน่ง ผลงาน และรูปภาพจะถูกลบถาวร ไม่สามารถกู้คืนได้',
        onConfirm: async () => {
          const r = await API.post('/api/members/bulk', { ids, action: 'delete' });
          toast(r.message); this.selected.clear(); this.load();
        },
      });
    }

    async bulkStatus(status) {
      try {
        const r = await API.post('/api/members/bulk', { ids: [...this.selected], action: 'status', status });
        toast(r.message); this.selected.clear(); this.load();
      } catch (e) { toast(e.message, 'error'); }
    }

    rowMenu(btn) {
      const m = this.items.find(x => x.id === +btn.dataset.menu);
      const items = [{ label: 'ดูประวัติ', icon: Icons.eye, onClick: () => Nav.go('member-view.html?id=' + m.id) }];
      if (Auth.can('members.edit')) {
        items.push({ label: 'แก้ไข', icon: Icons.edit, onClick: () => Nav.go('member-form.html?id=' + m.id) });
        items.push({ label: 'ตรวจสอบข้อมูล', icon: Icons.checkCircle, onClick: () => MemberTable.review(m.id, () => this.load()) });
      }
      if (Auth.can('members.delete')) {
        items.push('-');
        items.push({ label: 'ลบ', icon: Icons.trash, danger: true, onClick: () => this.deleteOne(m) });
      }
      popMenu(btn, items);
    }

    deleteOne(m) {
      confirm('ต้องการลบสมาชิกคนนี้หรือไม่?', {
        title: 'ลบสมาชิก', okText: 'ลบสมาชิก',
        item: m.full_name, itemSub: `เลขสมาชิก ${m.member_no} · ${m.position}`,
        detail: 'ข้อมูล ประวัติตำแหน่ง ผลงาน และรูปภาพจะถูกลบถาวร ไม่สามารถกู้คืนได้',
        onConfirm: async () => {
          const r = await API.del('/api/members/' + m.id);
          toast(r.message); this.selected.delete(m.id); this.load();
        },
      });
    }

    /** หน้าต่างตรวจสอบข้อมูลสมาชิก — แสดงรายการที่ขาด และเปลี่ยนสถานะ */
    static async review(id, onDone) {
      const md = modal({ title: 'ตรวจสอบข้อมูลสมาชิก', subtitle: 'ดูความครบถ้วนของข้อมูล และอนุมัติหรือเปลี่ยนสถานะสมาชิก', icon: 'checkCircle', body: UI.loadingHtml(), size: 'lg', footer: '<button class="btn btn-light" data-close>ปิด</button>' });
      try {
        const { member: m } = await API.get('/api/members/' + id);
        const row = (l, v) => `<div class="list-item"><div class="grow text-muted">${l}</div><div style="text-align:right">${v || '<span style="color:var(--danger)">ยังไม่มีข้อมูล</span>'}</div></div>`;
        md.body.innerHTML = `
          <div class="flex" style="margin-bottom:16px">${avatar(m, 'lg')}<div><h3 style="font-size:18px">${esc(m.full_name)}</h3>
            <div class="text-muted text-sm">เลขสมาชิก <span class="mono">${esc(m.member_no)}</span> · ${statusHtml(m.status)}</div></div></div>
          ${m.missing.length ? `<div class="bulk-bar" style="background:#FFF4E5;color:#C2410C">${Icons.alert} ข้อมูลยังไม่ครบ: ${esc(m.missing.join(', '))}</div>`
            : `<div class="bulk-bar" style="background:#E8F9EF;color:#15803D">${Icons.checkCircle} ข้อมูลครบถ้วน</div>`}
          <div class="grid grid-2" style="gap:0 28px">
            <div class="list">
              ${row('เลขประจำตัวนักศึกษา', esc(m.student_id))}
              ${row('ปีการศึกษา', esc(m.academic_year))}
              ${row('แผนกวิชา', esc(m.department))}
              ${row('ระดับชั้น', esc(m.education_level))}
              ${row('ตำแหน่ง', posBadge(m.position, m.position_color))}
            </div>
            <div class="list">
              ${row('เบอร์ติดต่อ', m.phone ? Fmt.phone(m.phone) : '')}
              ${row('อีเมล', esc(m.email))}
              ${row('ที่อยู่', m.address ? esc(m.address.slice(0, 40)) + (m.address.length > 40 ? '…' : '') : '')}
              ${row('รูปถ่าย', m.photo_path ? 'มีแล้ว' : '')}
              ${row('ประวัติส่วนตัว', m.biography ? 'มีแล้ว' : '')}
            </div>
          </div>`;
        md.el.querySelector('.modal-foot').innerHTML = `
          <a class="btn btn-light" href="member-form.html?id=${m.id}" style="margin-right:auto">${Icons.edit}แก้ไขข้อมูล</a>
          <button class="btn btn-danger" data-st="inactive">พ้นสภาพ</button>
          <button class="btn btn-light" data-st="pending">รอตรวจสอบ</button>
          <button class="btn btn-success" data-st="active">${Icons.check}อนุมัติ (ปกติ)</button>`;
        md.el.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', async () => {
          try {
            const r = await API.patch(`/api/members/${m.id}/status`, { status: b.dataset.st });
            toast(r.message); md.close(); onDone && onDone();
          } catch (e) { toast(e.message, 'error'); }
        }));
      } catch (e) { md.body.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message); }
    }
  }

  window.MemberTable = MemberTable;
})();
