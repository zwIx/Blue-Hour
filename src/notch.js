const panel = document.querySelector('main');
const meter = document.querySelector('.meter');
const details = document.querySelector('.details');
const artwork = document.querySelector('.artwork');
const title = document.querySelector('.metadata strong');
const subtitle = document.querySelector('.metadata small');
const play = document.querySelector('[data-control="play"]');
const playIcon = document.querySelector('#play-icon');
const fallback = 'assets/icon.png';

artwork.addEventListener('error', () => {
  if (artwork.getAttribute('src') !== fallback) artwork.src = fallback;
});

window.blueHour.on('notch-state', state => {
  panel.classList.toggle('expanded', state.expanded);
  panel.classList.toggle('playing', state.playing);
  meter.setAttribute('aria-hidden', String(state.expanded));
  details.inert = !state.expanded;
  title.textContent = state.title;
  subtitle.textContent = state.album && state.album !== 'Unknown album' ? state.album : state.artist || 'Blue Hour';
  const cover = state.artwork ? 'bluehour://artwork/' + encodeURIComponent(state.id) : fallback;
  if (artwork.getAttribute('src') !== cover) artwork.src = cover;
  play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  playIcon.setAttribute('d', state.playing ? 'M6 4h4v16H6Zm8 0h4v16h-4Z' : 'm7 4 14 8-14 8Z');
});

for (const button of document.querySelectorAll('[data-control]')) {
  button.addEventListener('click', () => window.blueHour.notchControl(button.dataset.control));
}
