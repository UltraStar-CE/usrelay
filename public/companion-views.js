const labels = {full: 'Full client', catalog: 'Catalog', radio: 'Radio'};

export function renderCompanionViews(code, policy, current) {
  const nav = document.getElementById('companionViews');
  nav.replaceChildren();
  nav.hidden = true;
  if (!/^[A-Z2-9]{4}$/.test(code || '') || !Array.isArray(policy?.enabled)) return;

  for (const view of policy.enabled) {
    if (view === current || !Object.hasOwn(labels, view)) continue;
    if (nav.childNodes.length) nav.append(' · ');
    const link = document.createElement('a');
    link.href = '/' + code + '?view=' + view;
    link.textContent = labels[view];
    nav.append(link);
  }
  nav.hidden = nav.childNodes.length === 0;
}
