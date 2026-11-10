// 「怎麼使用兒童課程」示範用的假網頁(假資料,不連伺服器)。kids-setup 與 kids-later 兩個版本各放一份,內容相同。
// 瀏覽器演員依腳本的 click、fill 重播操作,這裡照操作改畫面:
//   #add 新增孩子、#change 換頭像、.pick 選頭像、.slot 排課(每週最多 3 堂,排滿其他格子變淡)、#minutes 每次上課幾分鐘、
//   #save 儲存上課設定、#start 開啟兒童模式、#kidCap 打開孩子的膠囊選單、#leave 離開兒童模式、.card 打開一課(時段外看到「還沒到上課時間」)。
const $ = (id) => document.getElementById(id);
const DAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
const TIMES = ['09:00', '10:00', '14:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
const MAX = 3;

const week = $('week');
const picked = new Set((week.dataset.picked || '').split(',').filter(Boolean));
let dirty = false;

// 課表:每一列是一個時間,每一欄是星期幾
const corner = document.createElement('span');
week.appendChild(corner);
for (const d of DAYS) {
  const el = document.createElement('span');
  el.className = 'day';
  el.textContent = d;
  week.appendChild(el);
}
for (const t of TIMES) {
  const label = document.createElement('span');
  label.className = 'time';
  label.textContent = t;
  week.appendChild(label);
  DAYS.forEach((_, d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.id = `s${d}-${t.replace(':', '')}`;
    b.dataset.key = `${d}-${t}`;
    b.addEventListener('click', () => {
      const k = b.dataset.key;
      if (picked.has(k)) picked.delete(k);
      else if (picked.size < MAX) picked.add(k);
      else return;
      dirty = true;
      paint();
    });
    week.appendChild(b);
  });
}

function paint() {
  const full = picked.size >= MAX;
  for (const b of week.querySelectorAll('.slot')) {
    const on = picked.has(b.dataset.key);
    b.classList.toggle('on', on);
    b.classList.toggle('off', full && !on);
    b.textContent = on ? '✓' : '';
  }
  $('count').textContent = `已排 ${picked.size}／${MAX} 堂`;
  $('save').disabled = !dirty;
  $('start').disabled = dirty || picked.size === 0 || !$('weekList') || $('weekList').hidden;
  if (dirty) $('saved').hidden = true;
}

const setAvatar = (a) => {
  for (const el of document.querySelectorAll('.kid-av')) el.textContent = a;
  for (const p of document.querySelectorAll('.pick')) p.classList.toggle('on', p.textContent === a);
};
const setName = (n) => {
  for (const el of document.querySelectorAll('.kid-name')) el.textContent = n;
};

const on = (id, f) => {
  const el = $(id);
  if (el) el.addEventListener('click', f);
};

// 新增孩子
on('add', () => {
  const name = $('kid-name').value.trim();
  if (!name) return;
  setName(name);
  $('child').hidden = false;
  $('kid-name').value = '';
});

// 換頭像
on('change', () => {
  const open = $('picker').hidden;
  $('picker').hidden = !open;
  $('change').textContent = open ? '收起' : '換頭像';
});
for (const p of document.querySelectorAll('.pick')) {
  p.addEventListener('click', () => {
    setAvatar(p.textContent);
    $('picker').hidden = true;
    $('change').textContent = '換頭像';
  });
}

// 每次上課幾分鐘:兒童模式的「到幾點結束」跟著改
const minutes = $('minutes');
const showEnd = () => {
  const m = 16 * 60 + Number(minutes.value);
  const end = $('endsAt');
  if (end) end.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
minutes.addEventListener('change', () => {
  dirty = true;
  showEnd();
  paint();
});

// 儲存上課設定
on('save', () => {
  if (!dirty) return;
  dirty = false;
  $('saved').hidden = false;
  $('weekList').hidden = false;
  paint();
});

// 開啟兒童模式:整個畫面換成孩子的
const kidsMode = (yes) => {
  $('member').hidden = yes;
  $('kids').hidden = !yes;
  $('parentCap').hidden = yes;
  $('kidWrap').hidden = !yes;
  $('kmenu').hidden = true;
  const closed = $('closed');
  if (closed) closed.hidden = true;
  const home = $('kidsHome');
  if (home) home.hidden = false;
};
on('start', () => {
  if (!$('start').disabled) kidsMode(true);
});
on('kidCap', () => {
  $('kmenu').hidden = !$('kmenu').hidden;
});
on('leave', () => kidsMode(false));

// 時段外打開一課:只看到「還沒到上課時間」
for (const c of document.querySelectorAll('.card[data-title]')) {
  c.addEventListener('click', () => {
    if (c.classList.contains('lock')) return;
    $('closedLesson').textContent = c.dataset.title;
    $('kidsHome').hidden = true;
    $('closed').hidden = false;
  });
}
on('back', () => {
  $('closed').hidden = true;
  $('kidsHome').hidden = false;
});

showEnd();
paint();
