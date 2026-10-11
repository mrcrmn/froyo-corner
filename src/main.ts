import { Game } from './game/game';
import { hasSave, loadState, newState, clearSave, GameState } from './game/state';
import { defaultPlayer } from './entities/appearance';
import { initTouchDetection, isTouch } from './ui/touch';

const app = document.getElementById('app')!;
initTouchDetection();

function startGame(state: GameState, fresh: boolean): void {
  app.innerHTML = '';
  const game = new Game(state, app);
  game.start();
  game.music.start();
  if (fresh || !state.tutorialDone) game.ui.openPanel('hilfe');
  if (isTouch() && innerHeight > innerWidth) game.toast('Tipp: Dreh dein Handy quer – so hast du mehr Überblick.');
  (window as unknown as { game: Game }).game = game;
}

function title(): void {
  const save = hasSave();
  app.innerHTML = `
    <div class="title-screen">
      <div class="title-card card">
        <div class="logo">🍦 Froyo Corner</div>
        <div class="subtitle">Frozen Yogurt · Waffeln · Kaffee · Matcha – mitten in New York</div>
        <div class="menu-list">
          ${save ? '<button class="primary big" data-t="continue">▶ Weiterspielen</button>' : ''}
          <button class="${save ? '' : 'primary big'}" data-t="new">✨ Neues Spiel</button>
        </div>
        <p class="small">Tipp: Kopfhörer auf – es läuft ruhige Lo-Fi-Musik.</p>
        <p class="small th">Am Handy: links laufen, rechts ✋ benutzen – am besten im Querformat.</p>
      </div>
    </div>`;
  app.querySelector('.title-screen')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'continue') {
      const s = loadState();
      if (s) { startGame(s, false); return; }
    }
    if (save && b.dataset.t === 'new') {
      if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = '⚠️ Alten Spielstand überschreiben?'; return; }
      clearSave();
    }
    const s = newState();
    s.player = defaultPlayer();
    startGame(s, true);
  });
}

title();
