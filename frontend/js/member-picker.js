/* ช่องค้นหาและเลือกสมาชิก (ใช้ในหน้าคณะกรรมการ และการเลือกตั้ง)
   MemberPicker.attach(input, { onPick(member), params: () => ({ year_id }) }) */
(function () {
  const { esc, avatar, debounce } = UI;

  function attach(input, { onPick, params } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'picker';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const box = document.createElement('div');
    box.className = 'picker-results';
    box.hidden = true;
    wrap.appendChild(box);
    input.setAttribute('autocomplete', 'off');
    let items = [], active = -1, seq = 0;

    const render = () => {
      box.innerHTML = items.length ? items.map((m, i) => `
        <button type="button" class="picker-item ${i === active ? 'active' : ''}" data-i="${i}">${avatar(m)}
          <span><b>${esc(m.full_name)}</b><small>${esc([m.student_id, m.education_level, m.department].filter(Boolean).join(' · ') || m.member_no)}</small></span>
        </button>`).join('') : '<div class="picker-empty">ไม่พบสมาชิก</div>';
      box.hidden = false;
      box.querySelectorAll('[data-i]').forEach(b => b.addEventListener('mousedown', (e) => { e.preventDefault(); pick(+b.dataset.i); }));
    };
    const pick = (i) => {
      const m = items[i]; if (!m) return;
      box.hidden = true; input.value = m.full_name; input.dataset.picked = '1';
      onPick && onPick(m);
    };
    const search = debounce(async () => {
      const q = input.value.trim();
      if (q.length < 1) { box.hidden = true; return; }
      const my = ++seq;
      try {
        const r = await API.get('/api/members', { q, per_page: 8, sort: 'name', ...(params ? params() : {}) });
        if (my !== seq) return;
        items = r.items; active = items.length ? 0 : -1; render();
      } catch (e) { box.innerHTML = `<div class="picker-empty">${esc(e.message)}</div>`; box.hidden = false; }
    }, 250);

    input.addEventListener('input', () => {
      if (input.dataset.picked) { delete input.dataset.picked; onPick && onPick(null); }   // แก้ข้อความ = ยกเลิกที่เลือกไว้
      search();
    });
    input.addEventListener('keydown', (e) => {
      if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { active = (active + 1) % items.length; render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % items.length; render(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') { box.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    return { clear() { input.value = ''; items = []; box.hidden = true; } };
  }

  window.MemberPicker = { attach };
})();
