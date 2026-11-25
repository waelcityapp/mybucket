export function startStartupSound(): void {
  const chime = new Audio('/audio/mybucket-startup.mp3');

  const stopListening = () => {
    window.removeEventListener('click', retryAfterInteraction, true);
    window.removeEventListener('keydown', retryAfterInteraction, true);
  };

  function retryAfterInteraction(event: Event) {
    if (!event.isTrusted) return;
    stopListening();
    void chime.play().catch(() => {});
  }

  chime.addEventListener('playing', stopListening, { once: true });
  window.addEventListener('click', retryAfterInteraction, true);
  window.addEventListener('keydown', retryAfterInteraction, true);

  void chime.play().catch(error => {
    // Autoplay can be blocked until the user interacts. Other failures need no retry.
    if (error?.name !== 'NotAllowedError') stopListening();
  });
}
