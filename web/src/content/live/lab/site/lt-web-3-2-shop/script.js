// 狀態與畫面:按鈕只改狀態,畫面一律由 render() 照著狀態畫出來
const state = { cartCount: 0, isLoggedIn: false, isMenuOpen: false };
let renders = 0;
let changed = '';
const $ = (id) => document.getElementById(id);
function set(key, value) {
  state[key] = value;
  changed = key;
  render();
}
function render() {
  // 網頁上的畫面
  $('count').textContent = state.cartCount;
  $('login').textContent = state.isLoggedIn ? '嗨，小美' : '登入';
  $('login').classList.toggle('in', state.isLoggedIn);
  $('drawer').hidden = !state.isMenuOpen;
  $('menu').classList.toggle('on', state.isMenuOpen);
  // 幕後的狀態面板(只有 state 版本有)
  if ($('panel')) {
    $('v-cart').textContent = state.cartCount;
    $('v-login').textContent = state.isLoggedIn ? '是' : '否';
    $('v-menu').textContent = state.isMenuOpen ? '是' : '否';
    $('v-renders').textContent = renders;
    $('st-cart').classList.toggle('changed', changed === 'cartCount');
    $('st-login').classList.toggle('changed', changed === 'isLoggedIn');
    $('st-menu').classList.toggle('changed', changed === 'isMenuOpen');
  }
  renders += 1;
}
$('add').addEventListener('click', () => set('cartCount', state.cartCount + 1));
$('login').addEventListener('click', () => set('isLoggedIn', !state.isLoggedIn));
$('menu').addEventListener('click', () => set('isMenuOpen', !state.isMenuOpen));
render();
