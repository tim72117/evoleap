const js = document.querySelector('.js')
const exp = document.getElementById('exp')
const T = {
  bObj: ['hl-obj', '物件 { }', '一包有名字的資料，用大括號包起來。整份回應是一個物件，每個商品也是一個物件。'],
  bKey: ['hl-key', '鍵（名稱）', '雙引號裡的名字，像表格的欄位名稱。前端靠它找資料：拼錯一個字就拿不到。'],
  bVal: ['hl-val', '值', '冒號後面的內容：文字要加引號，數字和 true／false 不用。'],
  bArr: ['hl-arr', '陣列 [ ]', '用中括號包起來的一串東西，例如好幾個商品。'],
}
for (const [id, [cls, title, body]] of Object.entries(T)) {
  document.getElementById(id).addEventListener('click', (e) => {
    js.className = 'js mono ' + cls
    for (const b of document.querySelectorAll('.btns .btn')) b.classList.toggle('on', b === e.currentTarget)
    exp.innerHTML = '<b>' + title + '</b>' + body
  })
}
