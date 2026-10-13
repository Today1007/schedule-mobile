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
  function currentDays() { return view === 'day' ? [selected] : Array.from({length:7}, (_,i) => addDays(monday(selected), i)); }
  function render() { renderStats(); renderCalendar(); renderUpcoming(); }

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
      row.className = `week-row${key === today() ? ' today' : ''}`;
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'week-day';
      label.setAttribute('aria-label', `${shortDate(day)} ${dow[day.getDay()]}，查看当天时间轴`);
      const number = document.createElement('strong'); number.textContent = day.getDate();
      const weekday = document.createElement('span'); weekday.textContent = dow[day.getDay()];
      label.append(number, weekday);
      label.addEventListener('click', () => { selected = day; view = 'day'; renderCalendar(); });

      const items = document.createElement('div');
      items.className = 'week-items';
      const dayEvents = sorted(events.filter(e => e.date === key && (filter === 'all' || e.type === filter)));
      if (dayEvents.length) {
        dayEvents.forEach(e => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = `week-event ${e.type}${e.status === 'done' ? ' done' : ''}`;
          item.setAttribute('aria-label', `${e.start} ${e.title}，查看详情`);
          const time = document.createElement('span'); time.className = 'week-event-time'; time.textContent = e.start;
          const title = document.createElement('span'); title.className = 'week-event-title'; title.textContent = e.title;
          item.append(time, title);
          item.addEventListener('click', () => openEdit(e.id));
          items.append(item);
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
    const days = currentDays(), first = days[0], last = days[days.length - 1];
    $('monthTitle').textContent = first.getMonth() === last.getMonth() ? `${first.getFullYear()}年 ${first.getMonth()+1}月` : `${first.getMonth()+1}月 — ${last.getMonth()+1}月`;
    $('weekView').classList.toggle('active', view === 'week'); $('dayView').classList.toggle('active', view === 'day');
    document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    const calendar = $('calendar'); calendar.className = `calendar ${view === 'day' ? 'day-mode' : 'week-mode'}`;
    $('calendarScroll').classList.toggle('week-scroll', view === 'week');
    calendar.style.setProperty('--cols', days.length);
    calendar.replaceChildren();
    if (view === 'week') { renderWeekOverview(calendar, days); return; }
    const heads = document.createElement('div'); heads.className='day-heads';
    const corner = document.createElement('div'); corner.className='time-head'; heads.append(corner);
    const dow = ['周日','周一','周二','周三','周四','周五','周六'];
    days.forEach(d => { const b=document.createElement('button'); b.type='button'; b.className=`day-head${dateKey(d)===today()?' today':''}${dateKey(d)===dateKey(selected)?' selected':''}`; b.innerHTML=`<span class="dow">${dow[d.getDay()]}</span><span class="date-num">${d.getDate()}</span>`; b.addEventListener('click',()=>{ selected=d; view='day'; renderCalendar(); }); heads.append(b); });
    calendar.append(heads);
    const shown = events.filter(e => (filter==='all'||e.type===filter) && days.some(d=>dateKey(d)===e.date));
    let startHour = 7, endHour = 23;
    shown.forEach(e => { startHour=Math.min(startHour,Math.floor(minutes(e.start)/60)); endHour=Math.max(endHour,Math.ceil(minutes(e.end)/60)); });
    endHour = Math.min(24,endHour); const hourCount=endHour-startHour;
    const body=document.createElement('div'); body.className='time-body'; body.style.height=`calc(var(--hour) * ${hourCount})`;
    const labels=document.createElement('div'); labels.className='time-labels';
    for(let h=startHour;h<endHour;h++){ const el=document.createElement('div'); el.className='hour-label'; el.textContent=`${pad(h)}:00`; labels.append(el); }
    body.append(labels);
    days.forEach(d => {
      const col=document.createElement('div'); col.className=`day-column${dateKey(d)===today()?' today-column':''}`; col.dataset.date=dateKey(d);
      col.addEventListener('click', ev => { if(ev.target.closest('.calendar-event')) return; const rect=col.getBoundingClientRect(); const y=ev.clientY-rect.top; const hourPx=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour')) || 52; const minute=Math.max(0,Math.min(23*60+30,Math.round((startHour*60+y/hourPx*60)/30)*30)); openNew(dateKey(d),`${pad(Math.floor(minute/60))}:${pad(minute%60)}`); });
      const dayEvents=sorted(shown.filter(e=>e.date===dateKey(d)));
      const lanes=[], laneById=new Map();
      dayEvents.forEach(e => { const a=minutes(e.start), z=minutes(e.end); let lane=lanes.findIndex(end=>end<=a); if(lane<0){lane=lanes.length;lanes.push(z);}else lanes[lane]=z; laneById.set(e.id,lane); });
      const laneCount=Math.max(1,lanes.length);
      dayEvents.forEach(e => {
        const card=document.createElement('button'); card.type='button'; card.className=`calendar-event ${e.type}${e.status==='done'?' done':''}`;
        const duration=Math.max(20,minutes(e.end)-minutes(e.start)); if(duration<44)card.classList.add('short');
        card.style.top=`calc(var(--hour) * ${(minutes(e.start)-startHour*60)/60} + 2px)`;
        card.style.height=`calc(var(--hour) * ${duration/60} - 4px)`;
        if(laneCount>1){ card.style.left=`calc(${laneById.get(e.id)/laneCount*100}% + 3px)`; card.style.width=`calc(${100/laneCount}% - 6px)`; card.style.right='auto'; }
        const t=document.createElement('span'); t.className='event-time'; t.textContent=`${e.start} — ${e.end}`;
        const title=document.createElement('span'); title.className='event-title'; title.textContent=e.title;
        card.append(t,title);
        if(e.location){const loc=document.createElement('span');loc.className='event-place';loc.textContent=`⌖ ${e.location}`;card.append(loc);}
        card.title=`${e.title}\n${e.start}–${e.end}${e.location?'\n'+e.location:''}`;
        card.addEventListener('click',ev=>{ev.stopPropagation();openEdit(e.id);}); col.append(card);
      });
      if(dateKey(d)===today()) { const now=new Date(); const pos=(now.getHours()*60+now.getMinutes()-startHour*60)/60; if(pos>=0&&pos<=hourCount){const line=document.createElement('div');line.className='now-line';line.style.top=`calc(var(--hour) * ${pos})`;col.append(line);} }
      body.append(col);
    });
    if(!shown.length){const empty=document.createElement('div');empty.className='empty-grid';empty.textContent='当天暂无安排，点击时间格添加';body.append(empty);}
    calendar.append(body);
  }

  function renderUpcoming() {
    const root=$('upcomingList');root.replaceChildren();
    const now=new Date(); const upcoming=sorted(events.filter(e=>e.status!=='done'&&new Date(`${e.date}T${e.end}:00`)>=now)).slice(0,5);
    if(!upcoming.length){const empty=document.createElement('div');empty.className='side-empty';empty.textContent='暂无即将到来的日程。添加一场考试，开始规划吧。';root.append(empty);return;}
    upcoming.forEach(e=>{
      const d=fromKey(e.date),item=document.createElement('div');item.className='upcoming-item';
      const date=document.createElement('div');date.className='upcoming-date';date.innerHTML=`<strong>${d.getDate()}</strong><small>${d.getMonth()+1}月</small>`;
      const content=document.createElement('div');content.className='upcoming-content';
      const title=document.createElement('button');title.type='button';title.textContent=e.title;title.addEventListener('click',()=>openEdit(e.id));
      const meta=document.createElement('div');meta.className='upcoming-meta';meta.textContent=`${e.start}—${e.end}${e.location?' · '+e.location:''}`;
      const pill=document.createElement('span');pill.className=`type-pill ${e.type}`;pill.textContent=TYPE[e.type].label;
      content.append(title,meta,pill);item.append(date,content);root.append(item);
    });
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
  $('prevWeek').addEventListener('click',()=>{selected=addDays(selected,view==='day'?-1:-7);renderCalendar();});
  $('nextWeek').addEventListener('click',()=>{selected=addDays(selected,view==='day'?1:7);renderCalendar();});
  $('todayButton').addEventListener('click',()=>{selected=new Date();renderCalendar();});
  $('weekView').addEventListener('click',()=>{view='week';renderCalendar();});$('dayView').addEventListener('click',()=>{view='day';renderCalendar();});
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderCalendar();}));

  function download(name,contents,type){const blob=new Blob([contents],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  $('exportJson').addEventListener('click',()=>{download(`日程安排备份-${today()}.json`,JSON.stringify({app:'日程安排',version:1,exportedAt:new Date().toISOString(),events},null,2),'application/json;charset=utf-8');notify('备份已下载');});
  $('importJson').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async ev=>{
    const file=ev.target.files[0];if(!file)return;
    try{const data=JSON.parse(await file.text());if(!Array.isArray(data.events)||!data.events.every(safe))throw Error('invalid');if(!confirm(`将用备份中的 ${data.events.length} 项日程替换当前数据，继续吗？`))return;if(!persist(data.events))return;events=data.events;render();notify('备份已导入');}catch{notify('导入失败：请选择有效的日程备份文件');}finally{ev.target.value='';}
  });
  const icsEscape=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
  $('exportIcs').addEventListener('click',()=>{
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Schedule Planner//CN','CALSCALE:GREGORIAN','X-WR-CALNAME:日程安排'];
    events.forEach(e=>{const day=e.date.replace(/-/g,'');lines.push('BEGIN:VEVENT',`UID:${e.id}@gankao-schedule`,`DTSTAMP:${stamp}`,`DTSTART:${day}T${e.start.replace(':','')}00`,`DTEND:${day}T${e.end.replace(':','')}00`,`SUMMARY:${icsEscape(e.title)}`,`DESCRIPTION:${icsEscape(e.notes)}`,`LOCATION:${icsEscape(e.location)}`,'END:VEVENT');});
    lines.push('END:VCALENDAR');download(`日程安排-${today()}.ics`,lines.join('\r\n'),'text/calendar;charset=utf-8');notify('日历文件已下载');
  });
  render();
  if (!storageAvailable) notify('当前浏览器不能保存日程，请换用 Chrome 或系统浏览器');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
