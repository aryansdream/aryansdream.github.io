const slider = document.querySelector('#comparison-slider');
const scene = document.querySelector('#scene-comparison');

slider.addEventListener('input', () => {
  scene.style.setProperty('--reveal', `${slider.value}%`);
});
