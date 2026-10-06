let previousCleanup = null;

export function enhanceTableNavigation(container) {
  previousCleanup?.();
  if (!container) return () => {};

  const document = container.ownerDocument;
  const view = document.defaultView;
  const entries = [];
  let frame = 0;
  let disposed = false;

  function update() {
    frame = 0;
    for (const {wrap, tools, leftButton, rightButton} of entries) {
      const maximum = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      tools.hidden = maximum <= 1;
      leftButton.disabled = wrap.scrollLeft <= 1;
      rightButton.disabled = wrap.scrollLeft >= maximum - 1;
    }
  }

  function queueUpdate() {
    if (!disposed && !frame) frame = view.requestAnimationFrame(update);
  }

  for (const wrap of container.querySelectorAll('.table-wrap')) {
    const tools = document.createElement('div');
    tools.className = 'table-scroll-tools';
    tools.hidden = true;
    tools.setAttribute('role', 'group');
    tools.setAttribute('aria-label', 'Гортання таблиці розкладу');

    const label = document.createElement('span');
    label.className = 'table-scroll-label';
    label.textContent = wrap.querySelector('.week-matrix') ? 'Гортайте дні' : 'Гортайте класи';
    tools.append(label);

    const buttons = document.createElement('div');
    buttons.className = 'table-scroll-buttons';
    tools.append(buttons);

    function scroll(direction) {
      const rail = wrap.querySelector('thead th:first-child');
      const railStyle = rail ? view.getComputedStyle(rail) : null;
      const railWidth = railStyle?.position === 'sticky' && railStyle.left !== 'auto'
        ? rail.getBoundingClientRect().width : 0;
      const maximum = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      const current = Math.max(0, Math.min(maximum, wrap.scrollLeft));
      const visibleWidth = Math.max(1, wrap.clientWidth - railWidth);
      const table = wrap.querySelector('table');
      const tableLeft = table?.getBoundingClientRect().left ?? 0;
      const boundaries = [...new Set([
        0,
        ...Array.from(wrap.querySelectorAll('thead tr:first-child > th')).slice(1).map(header =>
          Math.max(0, Math.min(maximum, header.getBoundingClientRect().left - tableLeft - railWidth))
        ),
        maximum
      ])].sort((a, b) => a - b);
      // Advance by complete columns, keeping the next column beside the sticky rail.
      const candidates = boundaries.filter(position => direction > 0
        ? position > current + 1 : position < current - 1);
      const target = direction > 0
        ? candidates.filter(position => position <= current + visibleWidth + 1).at(-1) ?? candidates[0] ?? maximum
        : candidates.find(position => position >= current - visibleWidth - 1) ?? candidates.at(-1) ?? 0;
      wrap.scrollBy({
        left: target - current,
        behavior: view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      });
      queueUpdate();
    }

    function makeButton(direction, text, accessibleLabel) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-scroll-button';
      button.setAttribute('aria-label', accessibleLabel);
      button.title = accessibleLabel;
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = text;
      button.append(arrow);
      const onClick = () => scroll(direction);
      button.addEventListener('click', onClick);
      buttons.append(button);
      return {button, onClick};
    }

    const left = makeButton(-1, '←', 'Прокрутити таблицю ліворуч');
    const right = makeButton(1, '→', 'Прокрутити таблицю праворуч');
    wrap.before(tools);
    wrap.addEventListener('scroll', queueUpdate, {passive: true});
    entries.push({wrap, tools, leftButton: left.button, rightButton: right.button, left, right});
  }

  const observer = view.ResizeObserver ? new view.ResizeObserver(queueUpdate) : null;
  for (const {wrap} of entries) {
    observer?.observe(wrap);
    const table = wrap.querySelector('table');
    if (table) observer?.observe(table);
  }
  view.addEventListener('resize', queueUpdate);
  update();

  function cleanup() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    view.removeEventListener('resize', queueUpdate);
    if (frame) view.cancelAnimationFrame(frame);
    for (const {wrap, tools, left, right} of entries) {
      wrap.removeEventListener('scroll', queueUpdate);
      left.button.removeEventListener('click', left.onClick);
      right.button.removeEventListener('click', right.onClick);
      tools.remove();
    }
    if (previousCleanup === cleanup) previousCleanup = null;
  }

  previousCleanup = cleanup;
  return cleanup;
}
