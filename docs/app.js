const demo = document.querySelector('[data-demo]');

if (demo) {
  const branchButtons = [...demo.querySelectorAll('[data-branch]')];
  const mapBranches = [...demo.querySelectorAll('[data-map-branch]')];
  const runButton = demo.querySelector('[data-run]');
  const terminal = demo.querySelector('[data-terminal]');
  const terminalState = demo.querySelector('[data-terminal-state]');
  const result = demo.querySelector('[data-result]');
  const resultUrl = demo.querySelector('[data-result-url]');
  const resultProject = demo.querySelector('[data-result-project]');
  let selectedBranch = 'feat/auth';
  let running = false;

  const branchData = {
    'feat/auth': { slug: 'feat-auth', port: 43120 },
    'fix/mobile-nav': { slug: 'fix-mobile-nav', port: 44781 },
    'chore/api-v2': { slug: 'chore-api-v2', port: 46204 },
  };

  const setSelectedBranch = (branch) => {
    if (running) return;
    selectedBranch = branch;
    branchButtons.forEach((button) => {
      const active = button.dataset.branch === branch;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    mapBranches.forEach((item) => item.classList.toggle('is-selected', item.dataset.mapBranch === branch));
    terminal.innerHTML = `<p><span class="prompt">$</span> work-containers plan --json</p><p class="terminal-muted">Selected ${branch}. Ready to resolve its environment.</p>`;
    terminalState.textContent = 'ready';
    result.hidden = true;
  };

  branchButtons.forEach((button) => button.addEventListener('click', () => setSelectedBranch(button.dataset.branch)));

  const appendLine = (html) => {
    const line = document.createElement('p');
    line.innerHTML = html;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  };

  const pause = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  runButton.addEventListener('click', async () => {
    if (running) return;
    running = true;
    runButton.disabled = true;
    runButton.textContent = 'Starting…';
    terminalState.textContent = 'working';
    result.hidden = true;

    const data = branchData[selectedBranch];
    const selectedMap = mapBranches.find((item) => item.dataset.mapBranch === selectedBranch);
    const selectedStatus = selectedMap.querySelector('[data-map-status]');
    selectedStatus.textContent = 'planning';

    terminal.innerHTML = `<p><span class="prompt">$</span> work-containers up --services web --json</p>`;
    await pause(350);
    appendLine('<span class="info">↳</span> worktree identity: ' + selectedBranch);
    await pause(420);
    appendLine('<span class="info">↳</span> dependency closure: web → api → postgres');
    await pause(420);
    appendLine('<span class="info">↳</span> compose project: commerce-platform-' + data.slug);
    selectedStatus.textContent = 'starting';
    await pause(480);
    appendLine('<span class="ok">✓</span> postgres healthy on 127.0.0.1:' + (data.port + 2));
    await pause(330);
    appendLine('<span class="ok">✓</span> api healthy on 127.0.0.1:' + (data.port + 1));
    await pause(330);
    appendLine('<span class="ok">✓</span> web healthy on 127.0.0.1:' + data.port);
    await pause(280);
    appendLine('<span class="ok">✓</span> preview ready: http://127.0.0.1:' + data.port);

    selectedMap.classList.add('is-running');
    selectedStatus.textContent = 'healthy';
    terminalState.textContent = 'healthy';
    resultUrl.textContent = 'http://127.0.0.1:' + data.port;
    resultProject.textContent = 'commerce-platform-' + data.slug;
    result.hidden = false;
    runButton.disabled = false;
    runButton.innerHTML = 'Restart preview <span aria-hidden="true">→</span>';
    running = false;
  });
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select text';
    }
    window.setTimeout(() => { button.textContent = original; }, 1400);
  });
});
