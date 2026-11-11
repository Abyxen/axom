// ============================================================================
// AXOM STUDY (Google NotebookLM & Open-Notebook Frontend Controller)
// Fully client-side interactive controller: Notebooks, Sources, Grounded Chat,
// Interactive Citations, Notes, Document Transformations & Audio Overview Studio
// ============================================================================

const AxomStudy = {
  activeNotebookId: null,
  activeNotebook: null,
  notebooks: [],
  activeTab: 'notes', // 'notes' | 'studio'
  chatMessages: [],
  audioPlayer: {
    playing: false,
    episodeId: null,
    currentTurnIndex: 0,
    turns: [],
    speed: 1.0,
    utterance: null
  },

  async init() {
    await this.loadNotebooks();
  },

  async loadNotebooks() {
    try {
      const res = await fetch('/api/study/notebooks');
      if (res.ok) {
        const data = await res.json();
        this.notebooks = data.notebooks || [];
        const list = document.querySelector('#studyNotebooksNav');
        if (list && typeof studySideHTML === 'function') list.innerHTML = studySideHTML();
      }
    } catch (e) {
      console.warn('[STUDY] Failed to load notebooks:', e);
    }
  },

  async loadNotebook(id) {
    try {
      const res = await fetch(`/api/study/notebooks/${encodeURIComponent(id)}`);
      if (res.ok) {
        this.activeNotebook = await res.json();
        this.activeNotebookId = id;
      }
    } catch (e) {
      console.error('[STUDY] Failed to load notebook:', e);
    }
  },

  // --------------------------------------------------------------------------
  // RENDER WORKSPACE HUB OR 3-COLUMN WORKSPACE
  // --------------------------------------------------------------------------

  async render(container) {
    if (!container) return;
    if (this.activeNotebookId) {
      await this.loadNotebook(this.activeNotebookId);
      container.innerHTML = this.buildNotebookWorkspaceHTML();
      this.bindWorkspaceEvents(container);
    } else {
      await this.loadNotebooks();
      container.innerHTML = this.buildHubHTML();
      this.bindHubEvents(container);
    }
  },

  // --------------------------------------------------------------------------
  // 1. NOTEBOOKS HUB (CARDS GRID)
  // --------------------------------------------------------------------------

  buildHubHTML() {
    const isPt = S.lang === 'pt';
    const nbCards = this.notebooks.map(nb => `
      <div class="study-nb-card" data-nb-id="${esc(nb.id)}">
        <div>
          <h3 class="study-nb-card-title">${esc(nb.name)}</h3>
          <p class="study-nb-card-desc">${esc(nb.description || (isPt ? 'Sem descrição.' : 'No description.'))}</p>
        </div>
        <div class="study-nb-card-footer">
          <div class="study-nb-stats">
            <span class="study-nb-stat" title="Sources">${ic('file')} <span>${nb.sources_count || 0}</span></span>
            <span class="study-nb-stat" title="Notes">${ic('clipboard')} <span>${nb.notes_count || 0}</span></span>
            <span class="study-nb-stat" title="Audio Overviews">${ic('mic')} <span>${nb.podcasts_count || 0}</span></span>
          </div>
          <button class="study-source-del" data-act="del-nb" data-nb-id="${esc(nb.id)}" title="${isPt ? 'Eliminar caderno' : 'Delete notebook'}">${ic('x')}</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="study-hub">
        <div class="study-hub-hero">
          <div>
            <h1>${isPt ? 'Cadernos de Estudo' : 'Study Notebooks'}</h1>
            <p>${isPt ? 'Ambiente de investigação estilo NotebookLM. Carregue PDFs, páginas web e notas, converse com citações verificadas e crie visões gerais em áudio com dois apresentadores.' : 'Private NotebookLM study environment. Upload documents, web pages, and notes, chat with grounded citations, and generate multi-speaker audio overviews.'}</p>
          </div>
          <button class="study-create-nb-btn" data-act="open-create-nb">${ic('plus')} <span>${isPt ? 'Novo Caderno' : 'New Notebook'}</span></button>
        </div>
        <div class="study-hub-grid">
          ${nbCards || `<div class="empty" style="grid-column: 1 / -1; padding: 40px 0;"><p>${isPt ? 'Nenhum caderno encontrado. Crie o seu primeiro caderno para começar!' : 'No notebooks found. Create your first notebook to get started!'}</p></div>`}
        </div>
      </div>
    `;
  },

  bindHubEvents(container) {
    container.querySelectorAll('.study-nb-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="del-nb"]')) return;
        const nbId = card.dataset.nbId;
        this.openNotebook(nbId);
      });
    });

    container.querySelectorAll('[data-act="del-nb"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nbId = btn.dataset.nbId;
        const isPt = S.lang === 'pt';
        if (confirm(isPt ? 'Tem a certeza que deseja eliminar este caderno?' : 'Are you sure you want to delete this notebook?')) {
          await fetch(`/api/study/notebooks/${encodeURIComponent(nbId)}`, { method: 'DELETE' });
          this.render(container);
        }
      });
    });

    container.querySelector('[data-act="open-create-nb"]')?.addEventListener('click', () => {
      this.openCreateNotebookModal();
    });
  },

  async openNotebook(id) {
    this.activeNotebookId = id;
    this.chatMessages = [];
    const container = document.querySelector('#studyContainer');
    await this.render(container);
    const list = document.querySelector('#studyNotebooksNav');
    if (list && typeof studySideHTML === 'function') list.innerHTML = studySideHTML();
  },

  async closeNotebook() {
    this.activeNotebookId = null;
    this.activeNotebook = null;
    this.stopPodcast();
    const container = document.querySelector('#studyContainer');
    await this.render(container);
    const list = document.querySelector('#studyNotebooksNav');
    if (list && typeof studySideHTML === 'function') list.innerHTML = studySideHTML();
  },

  // --------------------------------------------------------------------------
  // 2. ACTIVE NOTEBOOK 3-COLUMN WORKSPACE (NotebookLM Signature Layout)
  // --------------------------------------------------------------------------

  buildNotebookWorkspaceHTML() {
    const nb = this.activeNotebook;
    if (!nb) return '<div class="empty"><p>Loading notebook...</p></div>';
    const isPt = S.lang === 'pt';

    const sources = nb.sources || [];
    const notes = nb.notes || [];
    const podcasts = nb.podcasts || [];
    const inContextCount = sources.filter(s => s.in_context).length;

    // Column 1: Sources HTML
    const sourcesHTML = sources.map(src => {
      let icon = ic('file');
      if (src.type === 'pdf') icon = ic('download');
      else if (src.type === 'web') icon = ic('globe');
      else if (src.type === 'text') icon = ic('code');

      return `
        <div class="study-source-item ${src.in_context ? 'active-in-context' : ''}" data-src-id="${esc(src.id)}">
          <input type="checkbox" class="study-source-checkbox" data-act="toggle-src" data-src-id="${esc(src.id)}" ${src.in_context ? 'checked' : ''} title="${isPt ? 'Incluir no contexto de estudo' : 'Include in study context'}">
          <div class="study-source-body" data-act="view-src" data-src-id="${esc(src.id)}">
            <div class="study-source-title" title="${esc(src.title)}">${esc(src.title)}</div>
            <div class="study-source-meta">
              <span class="study-source-tag">${esc(src.type)}</span>
              <span>${src.word_count || 0} ${isPt ? 'palavras' : 'words'}</span>
              ${src.insights?.length ? `<span class="study-source-tag" style="color:#45D483">${src.insights.length} ${isPt ? 'ideias' : 'insights'}</span>` : ''}
            </div>
          </div>
          <button class="study-source-del" data-act="del-src" data-src-id="${esc(src.id)}" title="${isPt ? 'Remover fonte' : 'Remove source'}">${ic('x')}</button>
        </div>
      `;
    }).join('');

    // Column 3: Notes Tab HTML
    const notesHTML = notes.map(note => `
      <div class="study-note-card" data-note-id="${esc(note.id)}">
        <div class="study-note-header">
          <div class="study-note-title">${esc(note.title)}</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="study-note-badge ${note.source_type === 'ai_generated' ? 'ai' : ''}">${note.source_type === 'ai_generated' ? 'AI' : (isPt ? 'Humano' : 'Human')}</span>
            <button class="study-source-del" data-act="del-note" data-note-id="${esc(note.id)}" title="${isPt ? 'Eliminar nota' : 'Delete note'}">${ic('x')}</button>
          </div>
        </div>
        <div class="study-note-text">${esc(note.content)}</div>
      </div>
    `).join('');

    // Column 3: Studio / Audio Overview HTML
    const podcastsHTML = podcasts.map(ep => `
      <div class="study-podcast-card" data-ep-id="${esc(ep.id)}">
        <div class="study-podcast-header">
          <span class="study-podcast-title">${esc(ep.title)}</span>
          <span class="workspace-pill study">Audio Deep Dive</span>
        </div>
        <div class="study-player-controls">
          <button class="study-play-btn" data-act="toggle-audio" data-ep-id="${esc(ep.id)}" title="${isPt ? 'Reproduzir áudio' : 'Play audio'}">
            ${this.audioPlayer.playing && this.audioPlayer.episodeId === ep.id ? ic('stop') : ic('redo')}
          </button>
          <div class="study-audio-track">
            <span class="study-audio-speaker" id="activeSpeakerLabel">${isPt ? 'Dois Apresentadores (Alex e Jordan)' : 'Two Speakers (Alex & Jordan)'}</span>
            <span class="study-audio-line" id="activeSpeakerLine">${ep.transcript?.length || 0} ${isPt ? 'falas de diálogo geradas' : 'dialogue turns generated'}</span>
          </div>
          <button class="study-back-btn" data-act="copy-transcript" data-ep-id="${esc(ep.id)}" title="${isPt ? 'Copiar guião' : 'Copy transcript'}">${ic('copy')}</button>
        </div>
        <div class="study-transcript-box" id="transcript_${esc(ep.id)}">
          ${(ep.transcript || []).map((turn, tIdx) => `
            <div class="study-dialogue-turn" id="turn_${esc(ep.id)}_${tIdx}">
              <div class="study-speaker-label ${turn.speaker.toLowerCase().includes('alex') ? 'alex' : 'jordan'}">${esc(turn.speaker)}:</div>
              <div>${esc(turn.text)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <!-- Top Navigation Header -->
      <div class="study-top-bar">
        <div class="study-top-left">
          <button class="study-back-btn" data-act="back-to-hub">${ic('leftArrow')} <span>${isPt ? 'Todos os Cadernos' : 'All Notebooks'}</span></button>
          <div class="study-title-box">
            <div class="study-title">${esc(nb.name)}</div>
            <div class="study-subtitle">${esc(nb.description || (isPt ? 'Caderno de estudo interativo' : 'Interactive study notebook'))}</div>
          </div>
        </div>
        <div class="study-top-actions">
          <button class="study-back-btn" data-act="open-obsidian" title="${isPt ? 'Abrir no Obsidian' : 'Open in Obsidian'}">${ic('globe')} <span>Obsidian</span></button>
          <button class="study-back-btn" data-act="del-active-nb" style="color:var(--err)" title="${isPt ? 'Eliminar caderno' : 'Delete notebook'}">${ic('x')}</button>
        </div>
      </div>

      <!-- 3-Column Studio Workspace -->
      <div class="study-workspace-cols">
        
        <!-- Column 1: Sources (Left) -->
        <aside class="study-col-sources">
          <div class="study-col-header">
            <span class="study-col-title">${isPt ? 'Fontes' : 'Sources'} <span class="study-col-title-count">${sources.length}</span></span>
            <button class="study-add-source-btn" data-act="open-add-source">${ic('plus')} <span>${isPt ? 'Adicionar' : 'Add'}</span></button>
          </div>
          <div class="study-sources-list">
            ${sourcesHTML || `<div class="empty" style="padding: 24px 8px; text-align: center;"><p style="font-size: 11.5px; color: var(--tx3);">${isPt ? 'Sem fontes ainda. Carregue PDFs, URLs ou texto.' : 'No sources yet. Upload PDFs, URLs, or text.'}</p></div>`}
          </div>
        </aside>

        <!-- Column 2: Grounded Study Chat (Center) -->
        <main class="study-col-chat">
          <div class="study-chat-context-pill">
            ${ic('check')} <span>${isPt ? 'Contexto Ativo:' : 'Active Context:'} <span class="highlight">${inContextCount} ${isPt ? 'fontes selecionadas' : 'sources included'}</span></span>
          </div>

          <div class="study-chat-messages" id="studyChatMessages">
            ${this.chatMessages.length ? this.renderChatMessagesHTML() : `
              <div class="study-chat-empty">
                <h3>${isPt ? 'Converse com as suas Fontes' : 'Chat with your Sources'}</h3>
                <p>${isPt ? 'Faça perguntas sobre os documentos selecionados. Todas as respostas contêm citações rastreáveis e verificáveis.' : 'Ask questions about your selected documents. All answers provide traceable, verifiable inline citations.'}</p>
                <div class="study-chips-grid">
                  <button class="study-prompt-chip" data-act="quick-study" data-t="${isPt ? 'Faça um resumo aprofundado de todas as fontes selecionadas' : 'Provide a deep summary of all selected sources'}">${ic('file')} <span>${isPt ? 'Resumir todas as fontes' : 'Summarize all sources'}</span></button>
                  <button class="study-prompt-chip" data-act="quick-study" data-t="${isPt ? 'Crie um guia de estudo com conceitos-chave e perguntas de revisão' : 'Create a comprehensive study guide with key concepts'}">${ic('clipboard')} <span>${isPt ? 'Criar Guia de Estudo' : 'Create Study Guide'}</span></button>
                  <button class="study-prompt-chip" data-act="quick-study" data-t="${isPt ? 'Quais são as principais ideias e conclusões das fontes?' : 'What are the core insights and key takeaways?'}">${ic('book')} <span>${isPt ? 'Principais Ideias' : 'Key Takeaways'}</span></button>
                  <button class="study-prompt-chip" data-act="quick-study" data-t="${isPt ? 'Gere um FAQ com perguntas frequentes e respostas baseadas nos documentos' : 'Generate an FAQ with questions and detailed answers'}">${ic('code')} <span>${isPt ? 'Perguntas e Respostas (FAQ)' : 'FAQ & Q&A'}</span></button>
                </div>
              </div>
            `}
          </div>

          <!-- Composer Box -->
          <div class="comp" style="padding: 12px 20px 16px;">
            <div class="cbox">
              <textarea id="studyInp" rows="1" placeholder="${isPt ? 'Pergunte sobre as suas fontes no caderno...' : 'Ask about your sources in this notebook...'}" aria-label="Study prompt"></textarea>
              <div class="tools">
                <span class="sp"></span>
                <button class="send" id="studySendBtn" data-act="send-study" title="${isPt ? 'Enviar' : 'Send'}">${ic('up')}</button>
              </div>
            </div>
          </div>
        </main>

        <!-- Column 3: Studio & Notes (Right) -->
        <aside class="study-col-studio">
          <div class="study-tabs-header">
            <button class="study-tab-btn ${this.activeTab === 'notes' ? 'active' : ''}" data-act="switch-tab" data-tab="notes">${isPt ? 'Notas' : 'Notes'} (${notes.length})</button>
            <button class="study-tab-btn ${this.activeTab === 'studio' ? 'active' : ''}" data-act="switch-tab" data-tab="studio">${isPt ? 'Estúdio (Áudio)' : 'Studio (Audio)'} (${podcasts.length})</button>
          </div>

          <div class="study-tab-content">
            ${this.activeTab === 'notes' ? `
              <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
                <button class="study-add-source-btn" data-act="open-create-note">${ic('plus')} <span>${isPt ? 'Escrever Nota' : 'Write Note'}</span></button>
              </div>
              ${notesHTML || `<div class="empty" style="padding: 30px 10px; text-align: center;"><p style="font-size: 11.5px; color: var(--tx3);">${isPt ? 'Sem notas ainda. Clique em "Escrever Nota" ou guarde respostas do chat.' : 'No notes yet. Click "Write Note" or save chat answers.'}</p></div>`}
            ` : `
              <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
                <button class="study-add-source-btn" data-act="generate-audio-overview" style="background:#45D483;color:#000;">${ic('mic')} <span>${isPt ? 'Gerar Visão Geral' : 'Generate Overview'}</span></button>
              </div>
              ${podcastsHTML || `<div class="empty" style="padding: 30px 10px; text-align: center;"><p style="font-size: 11.5px; color: var(--tx3);">${isPt ? 'Sem visões gerais em áudio. Gere um podcast Deep Dive com dois apresentadores.' : 'No audio overviews yet. Generate a two-speaker Deep Dive podcast.'}</p></div>`}
            `}
          </div>
        </aside>

      </div>
    `;
  },

  renderChatMessagesHTML() {
    const isPt = S.lang === 'pt';
    return this.chatMessages.map((m, idx) => {
      if (m.role === 'user') {
        return `
          <div class="msg user in">
            <div class="who">${isPt ? 'Você' : 'You'}</div>
            <div class="bd">${esc(m.text)}</div>
          </div>
        `;
      } else {
        // Parse citations in markdown: replace [source:ID] or [note:ID] with interactive clickable badge
        let formatted = md(m.text);
        formatted = formatted.replace(/\[(source|note):([a-zA-Z0-9_]+)\]/g, (match, type, id) => {
          const item = (m.citations || []).find(c => c.tag === `${type}:${id}`) || { title: id };
          return `<button class="citation-chip" data-act="view-citation" data-type="${type}" data-id="${id}">[${type === 'source' ? 'Source: ' : 'Note: '}${esc(item.title || id)}]</button>`;
        });

        return `
          <div class="msg in">
            <div class="who" style="display:flex;align-items:center;justify-content:space-between;">
              <span>Axom Study</span>
              <button class="save-note-btn" data-act="save-answer-to-note" data-msg-idx="${idx}">${ic('clipboard')} <span>${isPt ? 'Guardar como Nota' : 'Save to Note'}</span></button>
            </div>
            <div class="bd">${formatted}</div>
          </div>
        `;
      }
    }).join('');
  },

  bindWorkspaceEvents(container) {
    // Back to Hub
    container.querySelector('[data-act="back-to-hub"]')?.addEventListener('click', () => {
      this.closeNotebook();
    });

    // Delete Active Notebook
    container.querySelector('[data-act="del-active-nb"]')?.addEventListener('click', async () => {
      const isPt = S.lang === 'pt';
      if (confirm(isPt ? 'Deseja eliminar este caderno permanentemente?' : 'Delete this notebook permanently?')) {
        await fetch(`/api/study/notebooks/${encodeURIComponent(this.activeNotebookId)}`, { method: 'DELETE' });
        this.closeNotebook();
      }
    });

    // Open in Obsidian
    container.querySelector('[data-act="open-obsidian"]')?.addEventListener('click', () => {
      window.open(`obsidian://open?vault=Axom_Brain&file=Study%2F${encodeURIComponent(this.activeNotebook?.name || '')}`, '_blank');
    });

    // Switch Studio Tab
    container.querySelectorAll('[data-act="switch-tab"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        const c = $('#studyContainer');
        this.render(c);
      });
    });

    // Toggle Source Context
    container.querySelectorAll('[data-act="toggle-src"]').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const srcId = cb.dataset.srcId;
        const inContext = cb.checked;
        await fetch('/api/study/sources/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notebook_id: this.activeNotebookId, source_id: srcId, in_context: inContext })
        });
        await this.loadNotebook(this.activeNotebookId);
        const c = $('#studyContainer');
        this.render(c);
      });
    });

    // View Source Details
    container.querySelectorAll('[data-act="view-src"]').forEach(el => {
      el.addEventListener('click', () => {
        const srcId = el.dataset.srcId;
        this.openSourceDetailsModal(srcId);
      });
    });

    // Delete Source from Notebook
    container.querySelectorAll('[data-act="del-src"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const srcId = btn.dataset.srcId;
        const isPt = S.lang === 'pt';
        if (confirm(isPt ? 'Remover esta fonte deste caderno?' : 'Remove this source from this notebook?')) {
          await fetch('/api/study/sources/unlink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notebook_id: this.activeNotebookId, source_id: srcId })
          });
          await this.loadNotebook(this.activeNotebookId);
          const c = $('#studyContainer');
          this.render(c);
        }
      });
    });

    // Open Add Source Modal
    container.querySelector('[data-act="open-add-source"]')?.addEventListener('click', () => {
      this.openAddSourceModal();
    });

    // Quick Study Prompt Chips
    container.querySelectorAll('[data-act="quick-study"]').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.t;
        this.sendStudyChat(prompt);
      });
    });

    // Send Study Chat
    const sendBtn = container.querySelector('#studySendBtn');
    const inp = container.querySelector('#studyInp');
    if (sendBtn && inp) {
      sendBtn.addEventListener('click', () => {
        const text = inp.value.trim();
        if (text) {
          inp.value = '';
          this.sendStudyChat(text);
        }
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn.click();
        }
      });
    }

    // Save Answer to Note
    container.querySelectorAll('[data-act="save-answer-to-note"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = +btn.dataset.msgIdx;
        const msg = this.chatMessages[idx];
        if (msg) {
          const title = msg.text.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '') + '...';
          await fetch('/api/study/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notebook_id: this.activeNotebookId, title, content: msg.text, source_type: 'ai_generated' })
          });
          toast(S.lang === 'pt' ? 'Guardado nas notas do caderno!' : 'Saved to notebook notes!');
          await this.loadNotebook(this.activeNotebookId);
          const c = $('#studyContainer');
          this.render(c);
        }
      });
    });

    // Delete Note
    container.querySelectorAll('[data-act="del-note"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const noteId = btn.dataset.noteId;
        await fetch(`/api/study/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
        await this.loadNotebook(this.activeNotebookId);
        const c = $('#studyContainer');
        this.render(c);
      });
    });

    // Write Note
    container.querySelector('[data-act="open-create-note"]')?.addEventListener('click', () => {
      this.openCreateNoteModal();
    });

    // Generate Audio Overview
    container.querySelector('[data-act="generate-audio-overview"]')?.addEventListener('click', () => {
      this.openGeneratePodcastModal();
    });

    // Toggle Audio Player Play/Pause
    container.querySelectorAll('[data-act="toggle-audio"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const epId = btn.dataset.epId;
        this.togglePodcastPlayback(epId);
      });
    });

    // Copy Transcript
    container.querySelectorAll('[data-act="copy-transcript"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const epId = btn.dataset.epId;
        const ep = (this.activeNotebook?.podcasts || []).find(p => p.id === epId);
        if (ep) {
          const text = (ep.transcript || []).map(t => `${t.speaker}: ${t.text}`).join('\n\n');
          navigator.clipboard.writeText(text);
          toast(S.lang === 'pt' ? 'Guião copiado para a área de transferência!' : 'Transcript copied to clipboard!');
        }
      });
    });

    // View Citation
    container.querySelectorAll('[data-act="view-citation"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        if (type === 'source') {
          this.openSourceDetailsModal(id);
        }
      });
    });
  },

  // --------------------------------------------------------------------------
  // 3. STUDY CHAT EXECUTION
  // --------------------------------------------------------------------------

  async sendStudyChat(userText) {
    if (!userText || !this.activeNotebookId) return;

    this.chatMessages.push({ role: 'user', text: userText });
    const c = $('#studyContainer');
    this.render(c);

    // Scroll chat to bottom
    setTimeout(() => {
      const msgBox = $('#studyChatMessages');
      if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    }, 50);

    try {
      const res = await fetch('/api/study/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebook_id: this.activeNotebookId,
          messages: this.chatMessages.map(m => ({ role: m.role, content: m.text })),
          model: S.model || 'axom:1.1'
        })
      });

      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      this.chatMessages.push({
        role: 'assistant',
        text: data.content,
        citations: data.citations || []
      });

      this.render(c);
      setTimeout(() => {
        const msgBox = $('#studyChatMessages');
        if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
      }, 50);
    } catch (e) {
      toast('Study chat error: ' + e.message);
    }
  },

  // --------------------------------------------------------------------------
  // 4. AUDIO OVERVIEW (PODCAST DEEP DIVE) LIVE PLAYBACK WITH DUAL VOICES
  // --------------------------------------------------------------------------

  togglePodcastPlayback(epId) {
    if (this.audioPlayer.playing && this.audioPlayer.episodeId === epId) {
      this.stopPodcast();
      const c = $('#studyContainer');
      this.render(c);
      return;
    }

    this.stopPodcast();
    const ep = (this.activeNotebook?.podcasts || []).find(p => p.id === epId);
    if (!ep || !ep.transcript?.length) return;

    this.audioPlayer.playing = true;
    this.audioPlayer.episodeId = epId;
    this.audioPlayer.turns = ep.transcript;
    this.audioPlayer.currentTurnIndex = 0;

    const c = $('#studyContainer');
    this.render(c);

    this.speakTurn(0);
  },

  speakTurn(index) {
    if (!this.audioPlayer.playing || index >= this.audioPlayer.turns.length) {
      this.stopPodcast();
      const c = $('#studyContainer');
      this.render(c);
      return;
    }

    this.audioPlayer.currentTurnIndex = index;
    const turn = this.audioPlayer.turns[index];

    // Highlight dialogue turn in UI
    document.querySelectorAll('.study-dialogue-turn').forEach(el => el.classList.remove('speaking'));
    const turnEl = document.getElementById(`turn_${this.audioPlayer.episodeId}_${index}`);
    if (turnEl) {
      turnEl.classList.add('speaking');
      turnEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update player track labels
    const speakerLabel = document.getElementById('activeSpeakerLabel');
    const speakerLine = document.getElementById('activeSpeakerLine');
    if (speakerLabel) speakerLabel.textContent = turn.speaker + ' (Speaking)';
    if (speakerLine) speakerLine.textContent = `"${turn.text}"`;

    if (!('speechSynthesis' in window)) {
      toast('Browser speech synthesis is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(turn.text);

    // Multi-voice pitch & modulation
    const isAlex = turn.speaker.toLowerCase().includes('alex');
    utter.pitch = isAlex ? 1.08 : 0.92;
    utter.rate = isAlex ? 1.02 : 0.96;

    // Pick voices if available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 1) {
      utter.voice = isAlex ? voices[0] : (voices[1] || voices[0]);
    }

    utter.onend = () => {
      if (this.audioPlayer.playing) {
        this.speakTurn(index + 1);
      }
    };

    utter.onerror = (e) => {
      console.warn('[STUDY] Speech synthesis error:', e);
      if (this.audioPlayer.playing) {
        this.speakTurn(index + 1);
      }
    };

    this.audioPlayer.utterance = utter;
    window.speechSynthesis.speak(utter);
  },

  stopPodcast() {
    this.audioPlayer.playing = false;
    this.audioPlayer.episodeId = null;
    this.audioPlayer.currentTurnIndex = 0;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  // --------------------------------------------------------------------------
  // 5. MODALS (Add Source, Source Viewer, Create Notebook, Write Note)
  // --------------------------------------------------------------------------

  openCreateNotebookModal() {
    const isPt = S.lang === 'pt';
    const modal = document.createElement('div');
    modal.className = 'study-modal-overlay';
    modal.innerHTML = `
      <div class="study-modal-box" style="width: 480px;">
        <div class="study-modal-header">
          <h3>${isPt ? 'Criar Novo Caderno de Estudo' : 'Create New Study Notebook'}</h3>
          <button class="study-source-del" data-act="close-modal">${ic('x')}</button>
        </div>
        <div class="study-modal-body">
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Título do Caderno' : 'Notebook Title'}</label>
            <input type="text" id="nbNameInp" class="mi" placeholder="${isPt ? 'ex: Arquitetura de Redes Neuronais' : 'e.g., Deep Learning Architecture'}" autofocus>
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Descrição / Tema de Investigação' : 'Description / Research Topic'}</label>
            <textarea id="nbDescInp" class="mi" rows="3" placeholder="${isPt ? 'Descreva o objetivo deste caderno...' : 'Describe the purpose and scope of this notebook...'}"></textarea>
          </div>
        </div>
        <div class="study-modal-footer">
          <button class="study-back-btn" data-act="close-modal">${isPt ? 'Cancelar' : 'Cancel'}</button>
          <button class="study-create-nb-btn" id="confirmCreateNbBtn">${isPt ? 'Criar Caderno' : 'Create Notebook'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-act="close-modal"]').forEach(b => b.onclick = () => modal.remove());
    modal.querySelector('#confirmCreateNbBtn').onclick = async () => {
      const name = modal.querySelector('#nbNameInp').value.trim();
      const desc = modal.querySelector('#nbDescInp').value.trim();
      if (!name) return;

      const res = await fetch('/api/study/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
      });
      if (res.ok) {
        const nb = await res.json();
        modal.remove();
        await this.loadNotebooks();
        this.openNotebook(nb.id);
      }
    };
  },

  openAddSourceModal() {
    const isPt = S.lang === 'pt';
    const modal = document.createElement('div');
    modal.className = 'study-modal-overlay';
    modal.innerHTML = `
      <div class="study-modal-box">
        <div class="study-modal-header">
          <h3>${isPt ? 'Adicionar Fonte ao Caderno' : 'Add Source to Notebook'}</h3>
          <button class="study-source-del" data-act="close-modal">${ic('x')}</button>
        </div>
        <div class="study-tabs-header">
          <button class="study-tab-btn active" data-act="switch-source-tab" data-tab="tab-upload">${isPt ? 'Carregar Ficheiro' : 'Upload File'}</button>
          <button class="study-tab-btn" data-act="switch-source-tab" data-tab="tab-url">${isPt ? 'Link Web' : 'Web Link'}</button>
          <button class="study-tab-btn" data-act="switch-source-tab" data-tab="tab-text">${isPt ? 'Colar Texto' : 'Paste Text'}</button>
        </div>
        <div class="study-modal-body">
          
          <!-- Tab 1: Upload File -->
          <div id="tab-upload" class="source-tab-pane">
            <div style="border: 2px dashed #2e2e34; border-radius: 10px; padding: 32px 20px; text-align: center; cursor: pointer;" id="dropZone">
              <div style="margin-bottom: 12px; color: #45D483;">${ic('download')}</div>
              <p style="font-size: 13.5px; font-weight: 600; color: #f4f4f5; margin: 0 0 6px 0;">${isPt ? 'Arraste ficheiros ou clique para procurar' : 'Drag & drop files or click to browse'}</p>
              <p style="font-size: 11.5px; color: var(--tx3); margin: 0;">PDF, Word DOCX, TXT, Markdown, CSV, Code</p>
              <input type="file" id="studyFileInput" style="display: none;" accept=".pdf,.docx,.txt,.md,.json,.csv,.py,.js">
            </div>
            <div id="fileSelectedInfo" style="margin-top: 12px; font-size: 12px; color: #45D483; display: none;"></div>
          </div>

          <!-- Tab 2: Web URL -->
          <div id="tab-url" class="source-tab-pane" style="display: none;">
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">URL da Página Web</label>
            <input type="url" id="sourceUrlInp" class="mi" placeholder="https://example.com/article">
            <p style="font-size: 11px; color: var(--tx3); margin-top: 6px;">${isPt ? 'O AXOM extrairá automaticamente o texto principal e removerá elementos de navegação.' : 'AXOM will fetch the web page and extract the article text.'}</p>
          </div>

          <!-- Tab 3: Paste Text -->
          <div id="tab-text" class="source-tab-pane" style="display: none;">
            <div style="margin-bottom: 12px;">
              <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Título da Fonte' : 'Source Title'}</label>
              <input type="text" id="sourceTitleInp" class="mi" placeholder="${isPt ? 'ex: Notas sobre Mecânica Quântica' : 'e.g., Lecture Notes'}">
            </div>
            <div>
              <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Texto / Conteúdo' : 'Text Content'}</label>
              <textarea id="sourceRawTextInp" class="mi" rows="6" placeholder="${isPt ? 'Cole notas, citações ou excertos de texto...' : 'Paste text here...'}"></textarea>
            </div>
          </div>

        </div>
        <div class="study-modal-footer">
          <button class="study-back-btn" data-act="close-modal">${isPt ? 'Cancelar' : 'Cancel'}</button>
          <button class="study-create-nb-btn" id="confirmAddSourceBtn">${isPt ? 'Adicionar Fonte' : 'Add Source'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-act="close-modal"]').forEach(b => b.onclick = () => modal.remove());

    // Switch Tabs
    modal.querySelectorAll('[data-act="switch-source-tab"]').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('[data-act="switch-source-tab"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelectorAll('.source-tab-pane').forEach(p => p.style.display = 'none');
        modal.querySelector('#' + btn.dataset.tab).style.display = 'block';
      };
    });

    // File input trigger
    const dropZone = modal.querySelector('#dropZone');
    const fileInp = modal.querySelector('#studyFileInput');
    const fileInfo = modal.querySelector('#fileSelectedInfo');
    let selectedFile = null;

    dropZone.onclick = () => fileInp.click();
    fileInp.onchange = (e) => {
      if (e.target.files.length) {
        selectedFile = e.target.files[0];
        fileInfo.style.display = 'block';
        fileInfo.textContent = `Ficheiro selecionado: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
      }
    };

    modal.querySelector('#confirmAddSourceBtn').onclick = async () => {
      const activeTabBtn = modal.querySelector('[data-act="switch-source-tab"].active');
      const tab = activeTabBtn.dataset.tab;

      if (tab === 'tab-upload' && selectedFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1];
          await fetch('/api/study/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notebook_id: this.activeNotebookId,
              file_name: selectedFile.name,
              file_base64: base64,
              type: selectedFile.name.endsWith('.pdf') ? 'pdf' : (selectedFile.name.endsWith('.docx') ? 'docx' : 'file')
            })
          });
          modal.remove();
          await this.loadNotebook(this.activeNotebookId);
          this.render($('#studyContainer'));
        };
        reader.readAsDataURL(selectedFile);
      } else if (tab === 'tab-url') {
        const url = modal.querySelector('#sourceUrlInp').value.trim();
        if (url) {
          await fetch('/api/study/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notebook_id: this.activeNotebookId, url, type: 'web' })
          });
          modal.remove();
          await this.loadNotebook(this.activeNotebookId);
          this.render($('#studyContainer'));
        }
      } else if (tab === 'tab-text') {
        const title = modal.querySelector('#sourceTitleInp').value.trim() || 'Custom Note';
        const rawText = modal.querySelector('#sourceRawTextInp').value.trim();
        if (rawText) {
          await fetch('/api/study/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notebook_id: this.activeNotebookId, title, raw_text: rawText, type: 'text' })
          });
          modal.remove();
          await this.loadNotebook(this.activeNotebookId);
          this.render($('#studyContainer'));
        }
      }
    };
  },

  async openSourceDetailsModal(sourceId) {
    const isPt = S.lang === 'pt';
    const src = (this.activeNotebook?.sources || []).find(s => s.id === sourceId);
    if (!src) return;

    const modal = document.createElement('div');
    modal.className = 'study-modal-overlay';
    modal.innerHTML = `
      <div class="study-modal-box" style="width: min(840px, 95vw);">
        <div class="study-modal-header">
          <div>
            <h3>${esc(src.title)}</h3>
            <span style="font-size: 11px; color: var(--tx3); font-family: 'JetBrains Mono', monospace;">ID: ${esc(src.id)} · ${src.type.toUpperCase()} · ${src.word_count} ${isPt ? 'palavras' : 'words'}</span>
          </div>
          <button class="study-source-del" data-act="close-modal">${ic('x')}</button>
        </div>
        <div class="study-tabs-header">
          <button class="study-tab-btn active" data-act="switch-src-modal-tab" data-tab="tab-content">${isPt ? 'Conteúdo Extraído' : 'Extracted Text'}</button>
          <button class="study-tab-btn" data-act="switch-src-modal-tab" data-tab="tab-insights">${isPt ? 'Ideias e Transformações' : 'Insights & Transformations'} (${src.insights?.length || 0})</button>
        </div>
        <div class="study-modal-body">
          
          <div id="tab-content" class="src-modal-pane">
            <div style="background: var(--bg); border: 1px solid var(--bd); border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; max-height: 440px; overflow-y: auto; white-space: pre-wrap;">${esc(src.raw_text)}</div>
          </div>

          <div id="tab-insights" class="src-modal-pane" style="display: none;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
              <button class="study-prompt-chip" data-act="run-transform" data-t="summary">${ic('file')} <span>Resumo Aprofundado</span></button>
              <button class="study-prompt-chip" data-act="run-transform" data-t="key_points">${ic('clipboard')} <span>Principais Ideias</span></button>
              <button class="study-prompt-chip" data-act="run-transform" data-t="study_guide">${ic('book')} <span>Guia de Estudo</span></button>
              <button class="study-prompt-chip" data-act="run-transform" data-t="faq">${ic('code')} <span>Perguntas Frequentes (FAQ)</span></button>
              <button class="study-prompt-chip" data-act="run-transform" data-t="timeline">${ic('chevron')} <span>Linha do Tempo</span></button>
              <button class="study-prompt-chip" data-act="run-transform" data-t="critique">${ic('gear')} <span>Revisão Crítica</span></button>
            </div>
            <div id="insightsContainer" style="display: flex; flex-direction: column; gap: 12px;">
              ${(src.insights || []).map(ins => `
                <div class="study-note-card">
                  <div class="study-note-header">
                    <span class="study-note-title">${esc(ins.title)}</span>
                    <span class="study-note-badge ai">${esc(ins.transformation_type)}</span>
                  </div>
                  <div class="study-note-text" style="max-height: 200px;">${esc(ins.content)}</div>
                </div>
              `).join('') || `<div class="empty" style="padding: 20px;"><p style="font-size: 12px; color: var(--tx3);">Nenhuma ideia gerada ainda. Clique num dos botões acima para transformar esta fonte.</p></div>`}
            </div>
          </div>

        </div>
        <div class="study-modal-footer">
          <button class="study-back-btn" data-act="close-modal">${isPt ? 'Fechar' : 'Close'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-act="close-modal"]').forEach(b => b.onclick = () => modal.remove());

    modal.querySelectorAll('[data-act="switch-src-modal-tab"]').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('[data-act="switch-src-modal-tab"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelectorAll('.src-modal-pane').forEach(p => p.style.display = 'none');
        modal.querySelector('#' + btn.dataset.tab).style.display = 'block';
      };
    });

    modal.querySelectorAll('[data-act="run-transform"]').forEach(btn => {
      btn.onclick = async () => {
        const type = btn.dataset.t;
        toast(isPt ? 'A gerar transformação com o modelo...' : 'Generating transformation with model...');
        btn.disabled = true;
        try {
          const res = await fetch('/api/study/transformations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: src.id, transformation_type: type, model: S.model || 'axom:1.1' })
          });
          if (res.ok) {
            toast(isPt ? 'Ideia gerada com sucesso!' : 'Insight generated successfully!');
            modal.remove();
            await this.loadNotebook(this.activeNotebookId);
            this.openSourceDetailsModal(src.id);
          }
        } catch (e) {
          toast('Error: ' + e.message);
        } finally {
          btn.disabled = false;
        }
      };
    });
  },

  openCreateNoteModal() {
    const isPt = S.lang === 'pt';
    const modal = document.createElement('div');
    modal.className = 'study-modal-overlay';
    modal.innerHTML = `
      <div class="study-modal-box" style="width: 520px;">
        <div class="study-modal-header">
          <h3>${isPt ? 'Escrever Nova Nota' : 'Write New Note'}</h3>
          <button class="study-source-del" data-act="close-modal">${ic('x')}</button>
        </div>
        <div class="study-modal-body">
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Título da Nota' : 'Note Title'}</label>
            <input type="text" id="noteTitleInp" class="mi" placeholder="${isPt ? 'ex: Principais Conclusões do Estudo' : 'e.g., Reading Notes'}" autofocus>
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Conteúdo da Nota (Markdown)' : 'Content (Markdown)'}</label>
            <textarea id="noteContentInp" class="mi" rows="6" placeholder="${isPt ? 'Escreva as suas notas aqui...' : 'Write your notes here...'}"></textarea>
          </div>
        </div>
        <div class="study-modal-footer">
          <button class="study-back-btn" data-act="close-modal">${isPt ? 'Cancelar' : 'Cancel'}</button>
          <button class="study-create-nb-btn" id="confirmCreateNoteBtn">${isPt ? 'Guardar Nota' : 'Save Note'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-act="close-modal"]').forEach(b => b.onclick = () => modal.remove());
    modal.querySelector('#confirmCreateNoteBtn').onclick = async () => {
      const title = modal.querySelector('#noteTitleInp').value.trim();
      const content = modal.querySelector('#noteContentInp').value.trim();
      if (!title || !content) return;

      await fetch('/api/study/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebook_id: this.activeNotebookId, title, content, source_type: 'human' })
      });
      modal.remove();
      await this.loadNotebook(this.activeNotebookId);
      this.render($('#studyContainer'));
    };
  },

  openGeneratePodcastModal() {
    const isPt = S.lang === 'pt';
    const modal = document.createElement('div');
    modal.className = 'study-modal-overlay';
    modal.innerHTML = `
      <div class="study-modal-box" style="width: 520px;">
        <div class="study-modal-header">
          <h3>${isPt ? 'Gerar Visão Geral em Áudio (Podcast)' : 'Generate Audio Overview (Podcast)'}</h3>
          <button class="study-source-del" data-act="close-modal">${ic('x')}</button>
        </div>
        <div class="study-modal-body">
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Título do Episódio' : 'Episode Title'}</label>
            <input type="text" id="podTitleInp" class="mi" value="${esc(this.activeNotebook?.name || 'Study')} - Deep Dive">
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Estilo e Formato' : 'Format & Style'}</label>
            <select id="podStyleSelect" class="mi">
              <option value="deep_dive">${isPt ? 'Deep Dive Conversacional (2 Apresentadores: Alex e Jordan)' : 'Conversational Deep Dive (2 Speakers: Alex & Jordan)'}</option>
              <option value="brief_summary">${isPt ? 'Resumo Executivo Rápido (Alex Solo)' : 'Quick Executive Briefing (Alex Solo)'}</option>
              <option value="debate">${isPt ? 'Debate e Revisão Crítica (Alex e Jordan)' : 'Debate & Critique (Alex & Jordan)'}</option>
            </select>
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 600; color: var(--tx2); display: block; margin-bottom: 6px;">${isPt ? 'Instruções Específicas de Foco (Opcional)' : 'Focus Instructions (Optional)'}</label>
            <textarea id="podInstructionsInp" class="mi" rows="3" placeholder="${isPt ? 'ex: Focar nas implicações práticas e analogias acessíveis...' : 'e.g., Focus on practical implications and real-world analogies...'}"></textarea>
          </div>
        </div>
        <div class="study-modal-footer">
          <button class="study-back-btn" data-act="close-modal">${isPt ? 'Cancelar' : 'Cancel'}</button>
          <button class="study-create-nb-btn" id="confirmGenPodBtn" style="background:#45D483;color:#000;">${ic('mic')} <span>${isPt ? 'Gerar Áudio' : 'Generate Audio'}</span></button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-act="close-modal"]').forEach(b => b.onclick = () => modal.remove());
    modal.querySelector('#confirmGenPodBtn').onclick = async () => {
      const title = modal.querySelector('#podTitleInp').value.trim();
      const style = modal.querySelector('#podStyleSelect').value;
      const instructions = modal.querySelector('#podInstructionsInp').value.trim();
      const btn = modal.querySelector('#confirmGenPodBtn');

      btn.disabled = true;
      btn.innerHTML = `<span>${isPt ? 'A gerar guião e áudio...' : 'Generating dialogue...'}</span>`;

      try {
        const res = await fetch('/api/study/podcasts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notebook_id: this.activeNotebookId, title, style, instructions, model: S.model || 'axom:1.1' })
        });
        if (res.ok) {
          toast(isPt ? 'Visão geral gerada com sucesso!' : 'Audio overview generated successfully!');
          modal.remove();
          this.activeTab = 'studio';
          await this.loadNotebook(this.activeNotebookId);
          this.render($('#studyContainer'));
        } else {
          const err = await res.json();
          toast('Error: ' + (err.error || 'Failed to generate audio overview'));
        }
      } catch (e) {
        toast('Error: ' + e.message);
      } finally {
        btn.disabled = false;
      }
    };
  }
};

window.AxomStudy = AxomStudy;
