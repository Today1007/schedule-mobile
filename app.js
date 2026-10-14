(() => {
  'use strict';
  const KEY = 'kaoshi-rili-events-v1';
  const TYPE = { written: { label: '笔试', icon: '✎' }, interview: { label: '面试', icon: '◉' }, deadline: { label: '其他事项', icon: '✳' } };
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const monday = d => addDays(d, (1 - (d.getDay() || 7)));
  const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const today = () => dateKey(new Date());
  const safe = e => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && /^\d{2}:\d{2}$/.test(e.start) && /^\d{2}:\d{2}$/.test(e.end) && TYPE[e.type] && minutes(e.end) > minutes(e.start);

  let events = [];
  let storageAvailable = true;
  try {
    const saved = localStorage.getItem(KEY);
    events = saved === null ? [] : JSON.parse(saved).filter(safe);
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch { storageAvailable = false; }
  let selected = new Date();
  let view = 'week';
  let filter = 'all';
  let editing = null;
  let toastTimer;

  function persist(next) { try { localStorage.setItem(KEY, JSON.stringify(next)); storageAvailable = true; return true; } catch { storageAvailable = false; notify('保存失败：请检查浏览器存储权限'); return false; } }
  function notify(message) { const el = $('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2800); }
  function eventDate(e) { return new Date(`${e.date}T${e.start}:00`); }
  function sorted(list) { return [...list].sort((a,b) => eventDate(a) - eventDate(b)); }
  function shortDate(d) { return `${d.getMonth()+1}月${d.getDate()}日`; }
  function currentDays() { return Array.from({length:7}, (_,i) => addDays(monday(selected), i)); }
  function render() { renderStats(); renderCalendar(); }

  function renderStats() {
    const now = new Date();
    const future = events.filter(e => e.status !== 'done' && new Date(`${e.date}T${e.end}:00`) >= now);
    const data = [
      { icon:'▦', cls:'total', label:'待参加日程', value:future.length, unit:'项' },
      { icon:'✎', cls:'written', label:'笔试安排', value:future.filter(e=>e.type==='written').length, unit:'场' },
      { icon:'◉', cls:'interview', label:'面试安排', value:future.filter(e=>e.type==='interview').length, unit:'场' }
    ];
    const root = $('stats'); root.replaceChildren();
    data.forEach(s => { const card = document.createElement('div'); card.className='stat-card'; card.innerHTML=`<div class="stat-icon ${s.cls}">${s.icon}</div><div class="stat-text"><span>${s.label}</span><strong>${s.value}<small>${s.unit}</small></strong></div>`; root.append(card); });
  }

  function renderWeekOverview(calendar, days) {
    const dow = ['周日','周一','周二','周三','周四','周五','周六'];
    const overview = document.createElement('div');
    overview.className = 'week-overview';
    days.forEach(day => {
      const key = dateKey(day);
      const row = document.createElement('div');
      row.className = `week-row${key === today() ? ' today' : ''}${key === dateKey(selected) ? ' selected' : ''}`;
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'week-day';
      label.setAttribute('aria-label', `${shortDate(day)} ${dow[day.getDay()]}，添加日程`);
      const number = document.createElement('strong'); number.textContent = day.getDate();
      const weekday = document.createElement('span'); weekday.textContent = dow[day.getDay()];
      label.append(number, weekday);
      label.addEventListener('click', () => { selected = day; openNew(key); });

      const items = document.createElement('div');
      items.className = 'week-items';
      const dayEvents = sorted(events.filter(e => e.date === key && (filter === 'all' || e.type === filter)));
      if (dayEvents.length) {
        dayEvents.forEach(e => {
          const entry = document.createElement('div');
          entry.className = 'week-event-entry';
          const item = document.createElement('button');
          item.type = 'button';
          item.className = `week-event ${e.type}${e.status === 'done' ? ' done' : ''}`;
          item.setAttribute('aria-label', `${e.start}到${e.end} ${e.title}，查看详情`);
          const time = document.createElement('span'); time.className = 'week-event-time'; time.textContent = `${e.start}—${e.end}`;
          const title = document.createElement('span'); title.className = 'week-event-title'; title.textContent = e.title;
          item.append(time, title);
          item.addEventListener('click', () => openEdit(e.id));
          const complete = document.createElement('button');
          complete.type = 'button';
          complete.className = `week-complete${e.status === 'done' ? ' is-done' : ''}`;
          complete.textContent = e.status === 'done' ? '撤销' : '完成';
          complete.setAttribute('aria-label', `${e.status === 'done' ? '撤销已完成' : '标记已完成'}：${e.title}`);
          complete.addEventListener('click', () => toggleDone(e.id));
          entry.append(item, complete);
          items.append(entry);
        });
      } else {
        const empty = document.createElement('span');
        empty.className = 'week-empty';
        empty.textContent = '暂无安排';
        items.append(empty);
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'week-add';
      add.textContent = '+';
      add.title = `${shortDate(day)}添加日程`;
      add.setAttribute('aria-label', `${shortDate(day)}添加日程`);
      add.addEventListener('click', () => openNew(key));
      row.append(label, items, add);
      overview.append(row);
    });
    calendar.append(overview);
  }

  function renderCalendar() {
    const days = currentDays(), first = days[0], last = days[6];
    $('monthTitle').textContent = view === 'month'
      ? `${selected.getFullYear()}年 ${selected.getMonth()+1}月`
      : first.getMonth() === last.getMonth()
        ? `${first.getFullYear()}年 ${first.getMonth()+1}月 · ${first.getDate()}—${last.getDate()}日`
        : `${first.getMonth()+1}月${first.getDate()}日 — ${last.getMonth()+1}月${last.getDate()}日`;
    $('weekView').classList.toggle('active', view === 'week');
    $('monthView').classList.toggle('active', view === 'month');
    $('prevWeek').setAttribute('aria-label', view === 'month' ? '上个月' : '上一周');
    $('nextWeek').setAttribute('aria-label', view === 'month' ? '下个月' : '下一周');
    document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    const calendar = $('calendar');
    calendar.className = `calendar ${view}-mode`;
    $('calendarScroll').classList.toggle('week-scroll', view === 'week');
    calendar.replaceChildren();
    if (view === 'week') renderWeekOverview(calendar, days);
    else renderMonthOverview(calendar);
  }

  function renderMonthOverview(calendar) {
    const year = selected.getFullYear(), month = selected.getMonth();
    const first = new Date(year, month, 1);
    const start = monday(first);
    const last = new Date(year, month + 1, 0);
    const count = Math.ceil((Math.round((last - start) / 86400000) + 1) / 7) * 7;
    const grid = document.createElement('div'); grid.className = 'month-overview';
    ['一','二','三','四','五','六','日'].forEach(name => {
      const head = document.createElement('span'); head.className = 'month-weekday'; head.textContent = name; grid.append(head);
    });
    for (let i = 0; i < count; i++) {
      const day = addDays(start, i), key = dateKey(day);
      const dayEvents = sorted(events.filter(e => e.date === key && (filter === 'all' || e.type === filter)));
      const cell = document.createElement('button'); cell.type = 'button';
      cell.className = `month-day${day.getMonth() !== month ? ' outside' : ''}${key === today() ? ' today' : ''}${key === dateKey(selected) ? ' selected' : ''}`;
      cell.setAttribute('aria-label', `${day.getFullYear()}年${shortDate(day)}，${dayEvents.length}项安排，查看所在周`);
      const num = document.createElement('strong'); num.textContent = day.getDate(); cell.append(num);
      dayEvents.slice(0, 2).forEach(e => {
        const item = document.createElement('span'); item.className = `month-event ${e.type}`;
        item.textContent = e.title; item.title = `${e.start} ${e.title}`; cell.append(item);
      });
      if (dayEvents.length > 2) {
        const more = document.createElement('small'); more.textContent = `另有 ${dayEvents.length - 2} 项`; cell.append(more);
      }
      cell.addEventListener('click', () => { selected = day; view = 'week'; renderCalendar(); });
      grid.append(cell);
    }
    calendar.append(grid);
    const hint = document.createElement('p'); hint.className = 'month-hint'; hint.textContent = '点日期查看那一周，再点 ＋ 添加日程'; calendar.append(hint);
  }

  let pickerMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  function renderPicker() {
    const year = pickerMonth.getFullYear(), month = pickerMonth.getMonth();
    $('pickerTitle').textContent = `${year}年 ${month + 1}月`;
    const grid = $('pickerDays'); grid.replaceChildren();
    const first = new Date(year, month, 1), start = monday(first);
    const last = new Date(year, month + 1, 0);
    const count = Math.ceil((Math.round((last - start) / 86400000) + 1) / 7) * 7;
    for (let i = 0; i < count; i++) {
      const day = addDays(start, i), key = dateKey(day);
      const button = document.createElement('button'); button.type = 'button';
      button.className = `picker-day${day.getMonth() !== month ? ' outside' : ''}${key === today() ? ' today' : ''}${key === dateKey(selected) ? ' selected' : ''}`;
      button.textContent = day.getDate();
      button.setAttribute('aria-label', `${day.getFullYear()}年${shortDate(day)}${events.some(e => e.date === key) ? '，有日程' : ''}`);
      if (events.some(e => e.date === key)) button.classList.add('has-events');
      button.addEventListener('click', () => { selected = day; view = 'week'; $('datePicker').close(); renderCalendar(); });
      grid.append(button);
    }
  }

  function toggleDone(id) {
    const current = events.find(e => e.id === id);
    if (!current) return;
    const done = current.status !== 'done';
    const updated = events.map(e => e.id === id ? { ...e, status: done ? 'done' : 'planned' } : e);
    if (!persist(updated)) return;
    events = updated;
    render();
    notify(done ? '已标记完成' : '已恢复为待参加');
  }

  const dialog=$('eventDialog'), form=$('eventForm');
  function openNew(date=today(),start='09:00') { editing=null; form.reset(); form.elements.title.value=''; form.elements.date.value=date; form.elements.start.value=start; const end=Math.min(23*60+59,minutes(start)+60); form.elements.end.value=`${pad(Math.floor(end/60))}:${pad(end%60)}`; $('dialogTitle').textContent='新建日程'; $('deleteEvent').hidden=true; $('formError').hidden=true; dialog.showModal(); setTimeout(()=>form.elements.title.focus(),30); }
  function openEdit(id) { const e=events.find(item=>item.id===id); if(!e)return; editing=id; for(const k of ['title','type','status','date','location','start','end','notes'])form.elements[k].value=e[k]||''; $('dialogTitle').textContent='编辑日程'; $('deleteEvent').hidden=false; $('formError').hidden=true; dialog.showModal(); }
  function closeDialog(){dialog.close();}
  function setError(text){const el=$('formError');el.textContent=text;el.hidden=false;}
  form.addEventListener('submit',ev=>{
    ev.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    data.title=data.title.trim();data.location=data.location.trim();data.notes=data.notes.trim();
    if(!data.title||!data.date||!data.start||!data.end){setError('请填写名称、日期和起止时间。');return;}
    if(minutes(data.end)<=minutes(data.start)){setError('结束时间需要晚于开始时间。');return;}
    const next={...data,id:editing||crypto.randomUUID()};
    const updated=editing?events.map(e=>e.id===editing?next:e):[...events,next];
    if(!persist(updated)){setError('这台设备无法保存日程，请改用正常浏览器打开。');return;}
    events=updated; selected=fromKey(data.date); render(); closeDialog(); notify(editing?'日程已更新':'日程已添加');
  });
  $('deleteEvent').addEventListener('click',()=>{const e=events.find(e=>e.id===editing);if(!e)return;if(!confirm(`删除「${e.title}」？`))return;const updated=events.filter(e=>e.id!==editing);if(!persist(updated))return;events=updated;render();closeDialog();notify('日程已删除');});
  $('closeDialog').addEventListener('click',closeDialog);$('cancelDialog').addEventListener('click',closeDialog);
  $('addTop').addEventListener('click',()=>openNew(dateKey(selected)));$('addSide').addEventListener('click',()=>openNew(dateKey(selected)));
  $('prevWeek').addEventListener('click',()=>{selected=view==='month'?new Date(selected.getFullYear(),selected.getMonth()-1,1):addDays(selected,-7);renderCalendar();});
  $('nextWeek').addEventListener('click',()=>{selected=view==='month'?new Date(selected.getFullYear(),selected.getMonth()+1,1):addDays(selected,7);renderCalendar();});
  $('todayButton').addEventListener('click',()=>{pickerMonth=new Date(selected.getFullYear(),selected.getMonth(),1);renderPicker();$('datePicker').showModal();});
  $('pickerPrev').addEventListener('click',()=>{pickerMonth=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()-1,1);renderPicker();});
  $('pickerNext').addEventListener('click',()=>{pickerMonth=new Date(pickerMonth.getFullYear(),pickerMonth.getMonth()+1,1);renderPicker();});
  $('pickerToday').addEventListener('click',()=>{selected=new Date();view='week';$('datePicker').close();renderCalendar();});
  $('pickerClose').addEventListener('click',()=>$('datePicker').close());
  $('weekView').addEventListener('click',()=>{view='week';renderCalendar();});
  $('monthView').addEventListener('click',()=>{view='month';renderCalendar();});
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderCalendar();}));

  render();
  if (!storageAvailable) notify('当前浏览器不能保存日程，请换用 Chrome 或系统浏览器');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
