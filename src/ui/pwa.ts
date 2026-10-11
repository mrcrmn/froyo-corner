/** Installierbare Web-App: Service Worker, Installations-Dialog, App-Modus erkennen. */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallPrompt | null = null;

export function initPwa(): void {
  // Android/Chrome: Installationsdialog merken, damit wir ihn per Knopf zeigen können
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => { deferred = null; });
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
  // im Dev-Server keinen Cache: alten Worker (z.B. von `vite preview`) abmelden
  else navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
}

/** läuft als installierte App (ohne Browserleiste) */
export function isInstalled(): boolean {
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Install-Knopf sinnvoll? (Dialog verfügbar oder iPhone/iPad mit manueller Anleitung) */
export function canInstall(): boolean {
  return !isInstalled() && (!!deferred || isIos());
}

/** Installationsdialog öffnen; false, wenn keiner verfügbar ist (iOS → Anleitung zeigen) */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const d = deferred;
  deferred = null;
  await d.prompt();
  await d.userChoice.catch(() => {});
  return true;
}
