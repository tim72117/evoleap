(() => {
  // live character counts, so the 40 / ~64 character limits stay accurate after edits
  document.querySelectorAll("[data-count]").forEach((el) => {
    const src = document.getElementById(el.dataset.count);
    if (!src) return;
    const n = [...src.innerText.trim()].length;
    el.textContent = el.dataset.max ? `${n} 字 / ${el.dataset.max}` : `${n} 字`;
  });

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  };

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const label = btn.textContent;
    btn.addEventListener("click", async () => {
      const el = document.getElementById(btn.dataset.copy);
      const ok = await copyText(el.innerText.trim());
      btn.textContent = ok ? "已複製 ✓" : "複製失敗，請手動選取";
      btn.classList.toggle("copied", ok);
      setTimeout(() => { btn.textContent = label; btn.classList.remove("copied"); }, 1600);
    });
  });
})();
