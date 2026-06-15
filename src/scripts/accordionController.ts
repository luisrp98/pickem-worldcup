export function mountAccordion(rootSelector: string): void {
  const accordions = document.querySelectorAll<HTMLElement>(rootSelector);
  accordions.forEach((accordion) => {
    accordion.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const trigger = target.closest<HTMLButtonElement>('[data-accordion-trigger]');
      if (!trigger || !accordion.contains(trigger)) return;

      const item = trigger.closest<HTMLElement>('[data-accordion-item]');
      if (!item) return;
      const panel = item.querySelector<HTMLElement>('[data-accordion-panel]');
      const icon = item.querySelector<HTMLElement>('[data-accordion-icon]');
      if (!panel) return;

      accordion.querySelectorAll<HTMLElement>('[data-accordion-item]').forEach((other) => {
        if (other === item) return;
        const t = other.querySelector<HTMLButtonElement>('[data-accordion-trigger]');
        const p = other.querySelector<HTMLElement>('[data-accordion-panel]');
        if (!t || !p) return;
        t.setAttribute('aria-expanded', 'false');
        p.style.gridTemplateRows = '0fr';
      });

      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        trigger.setAttribute('aria-expanded', 'false');
        panel.style.gridTemplateRows = '0fr';
        icon?.classList.remove('rotate-180');
      } else {
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.gridTemplateRows = '1fr';
        icon?.classList.add('rotate-180');
      }
    });
  });
}
