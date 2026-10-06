const motion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const narrowViewport = matchMedia('(max-width: 760px)');
const connection = navigator.connection;
let contentAnimation;

function effectsAllowed() {
  return finePointer.matches && !narrowViewport.matches && !motion.matches && !connection?.saveData;
}

function updateEffectsPreference() {
  const enabled = effectsAllowed();
  document.documentElement.dataset.effects = enabled ? 'full' : 'minimal';
  if (!enabled) {
    contentAnimation?.cancel();
    contentAnimation = undefined;
    document.querySelectorAll('.press-flash').forEach(button => button.classList.remove('press-flash'));
  }
}

updateEffectsPreference();
motion.addEventListener('change', updateEffectsPreference);
finePointer.addEventListener('change', updateEffectsPreference);
narrowViewport.addEventListener('change', updateEffectsPreference);
connection?.addEventListener?.('change', updateEffectsPreference);

// A delegated completion handler needs no timer and retains no removed buttons.
function finishFlash(event) {
  if (event.target instanceof Element && event.target.matches('.press-flash')) {
    event.target.classList.remove('press-flash');
  }
}
document.addEventListener('animationend', finishFlash);
document.addEventListener('animationcancel', finishFlash);

document.addEventListener('click', event => {
  if (!(event.target instanceof Element) || !effectsAllowed()) return;
  const button = event.target.closest('.class-tabs button, .day-tabs button, .view-tabs button, .button, .theme-button, .weekday-title-button, .weekday-column-button');
  if (!button) return;
  // Rapid repeats share the current flash; no forced style or layout flush.
  if (button.isConnected && !button.matches('.view-tabs button')) button.classList.add('press-flash');
  if (button.matches('[data-class], [data-day], [data-view]')) {
    const content = document.querySelector('#schedule-content');
    if (content?.animate) {
      contentAnimation?.cancel();
      const animation = content.animate(
        [{ opacity: .7 }, { opacity: 1 }],
        { duration: 180, easing: 'ease-out' }
      );
      contentAnimation = animation;
      animation.onfinish = () => {
        if (contentAnimation === animation) contentAnimation = undefined;
      };
    }
  }
});
