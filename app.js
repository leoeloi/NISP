/* global Papa, supabase */

const SUPABASE_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnBjaWx2dXJqcm9pZ2Jhb3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM4NTYsImV4cCI6MjA4NTE3OTg1Nn0.sFOB6HQf1yKPeT3xcsG3rhgIn9exJER4yaGkfyRjWSo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Escuta o formulário de login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorDiv.innerText = "Credenciais inválidas ou sem acesso.";
    errorDiv.classList.remove('hidden');
  } else {
    checkSession(); // Verifica e libera o acesso
  }
});

// 2. Verifica se o usuário já está logado ao carregar a página
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const overlay = document.getElementById('login-overlay');

  if (session) {
    overlay.classList.add('hidden'); // Esconde o login e mostra o site
    init(); // Só carrega os dados do banco após o login
  } else {
    overlay.classList.remove('hidden');
  }
}

// 3. Função de Logout (Adicione um botão no HTML se desejar)
async function handleLogout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

let loadedData = {};

let editingCursoId = null;

const STATUS_OPCOES = ["Atendido", "Não Atendido", "Em Andamento"];
const CONVITE_OPCOES = ["Solicitado pelo Município", "Aguardando resposta", "Sim", "Não"];

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function optionsHtml(list, selected) {
  const sel = String(selected ?? '');
  return list.map(v => {
    const isSel = v === sel ? 'selected' : '';
    return `<option value="${escapeHtml(v)}" ${isSel}>${escapeHtml(v)}</option>`;
  }).join('');
}

// --- INIT ---
async function init() {
  const overlay = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');

  try {
    txt.innerText = 'Carregando dados atualizados...';

    // 1) Busca municipios
// 1) Busca municipios
const { data: munis, error: errM } = await supabaseClient
  .from('municipios')
  .select('*')
  .order('nome', { ascending: true });

if (errM) throw errM;

// 2) Busca cursos (ordem inversa = mais recentes primeiro)
const { data: cursos, error: errC } = await supabaseClient
  .from('cursos')
  .select('*')
  .order('id', { ascending: false });

if (errC) throw errC;

// 3) Busca alunos (opcional ordenar por id desc)
const { data: alunos, error: errA } = await supabaseClient
  .from('alunos')
  .select('*')
  .range (0, 100000) // limite alto para evitar cortes
  .order('id', { ascending: false });

if (errA) throw errA;


// --- Montagem em memória ---
loadedData = {};

// index de municipios
munis.forEach(m => {
  loadedData[m.id] = {
    ...m,
    cursos: [],
    courses: [],
    uniqueGraduates: 0,
    totalCertifications: 0
  };
});

// index de cursos por municipio_id
const cursosByMuni = new Map();
cursos.forEach(c => {
  const mid = c.municipio_id;
  if (!cursosByMuni.has(mid)) cursosByMuni.set(mid, []);
  cursosByMuni.get(mid).push({ ...c, alunos: [], students: [] });
});

// index de alunos por curso_id
const alunosByCurso = new Map();
alunos.forEach(a => {
  const cid = a.curso_id;
  if (!alunosByCurso.has(cid)) alunosByCurso.set(cid, []);
  alunosByCurso.get(cid).push(a);
});

// ligar tudo
Object.values(loadedData).forEach(m => {
  const listCursos = cursosByMuni.get(m.id) || [];

  // listCursos já vem em id desc (ordem invertida)
  listCursos.forEach(c => {
    const listAlunos = alunosByCurso.get(c.id) || [];
    c.alunos = listAlunos;
    c.students = listAlunos;

    // compat com seu código de UI
    c.nome = c.nome ?? c.curso;
    c.data_realizacao = c.data_realizacao ?? c.ano;
    c.situacao = c.situacao ?? c.status;

    m.cursos.push(c);
    m.courses.push(c);
  });

  // cálculos (iguais aos seus)
  let uniqueGrads = new Set();
  let totalCerts = 0;

  m.courses.forEach(c => {
    c.concluintes = 0;
    (c.students || []).forEach(s => {
      if ((s.status || '').toUpperCase().includes('CONCLU')) {
        c.concluintes++;
        totalCerts++;
        uniqueGrads.add(s.cpf || s.nome);
      }
    });
  });

  m.uniqueGraduates = uniqueGrads.size;
  m.totalCertifications = totalCerts;
});

// UI
populateDatalists(munis);
loadCityList(munis);
populateCourseDatalist();


   
  } catch (e) {
    console.error('Erro init:', e);
    alert('Erro ao conectar ao Banco de Dados.\nDetalhe: ' + (e?.message || e));
  } finally {
    setTimeout(() => {
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 500);
      }
    }, 300);
  }
}

// --- NAVEGAÇÃO ---
function navigateTo(pageId) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');

  if (pageId === 'page-cursos-view') renderGlobalCourses();
  if (pageId === 'page-alunos-view') renderGlobalStudents();
  if (pageId === 'page-controle-cidades') renderControlCities();
  if (pageId === 'page-controle-alunos') renderControlStudents();
}

// --- DATALISTS / SELECT ---
function populateDatalists(data) {
  const dl = document.getElementById('city-datalist');
  const dl2 = document.getElementById('city-datalist-st');
  dl.innerHTML = '';
  dl2.innerHTML = '';

  if (!data) return;

  data.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.nome;
    dl.appendChild(opt);
    dl2.appendChild(opt.cloneNode(true));
  });
}

function loadCityList(data) {
  const select = document.getElementById('city-selector');
  select.innerHTML = '<option value="" disabled selected>Selecione...</option>';

  if (!data || data.length === 0) {
    const opt = document.createElement('option');
    opt.innerText = '(Importe os dados primeiro)';
    select.appendChild(opt);
    return;
  }

  data.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.innerText = m.nome;
    select.appendChild(opt);
  });

  if (data.length > 0) {
    select.value = data[0].id;
    loadCity(data[0].id);
  }
}

function loadCity(id) {
  if (!id) return;
  const data = loadedData[id];
  if (!data) return;

  document.getElementById('view-municipio').innerText = data.nome;
  document.getElementById('view-territorio').innerText = data.territorio || '-';
  document.getElementById('view-populacao').innerText = (data.populacao || 0).toLocaleString('pt-BR');
  document.getElementById('view-efetivo').innerText = data.efetivo || 0;

  document.getElementById('view-prefeito').innerText = data.prefeito || '-';
  document.getElementById('view-email-pref').innerText = data.email_pref || '-';
  document.getElementById('view-tel-pref').innerText = data.telefone_pref || '-';
  document.getElementById('view-chefe-gm').innerText = data.chefe_gm || '-';
  document.getElementById('view-email-gm').innerText = data.email_gm || '-';
  document.getElementById('view-tel-gm').innerText = data.telefone_gm || '-';
  document.getElementById('view-obs-mun').innerText = data.obs_mun || 'Nenhuma observação registrada.';

  setBooleanBadge('badge-possui', data.possui_guarda);
  setBooleanBadge('badge-armada', data.guarda_armada);

  const coverage = data.efetivo > 0 ? ((data.uniqueGraduates / data.efetivo) * 100).toFixed(1) : 0;
  document.getElementById('view-total-certs').innerText = data.totalCertifications;
  document.getElementById('view-unique-grads').innerText = data.uniqueGraduates;
  document.getElementById('view-coverage-pct').innerText = coverage + '%';

   renderCityCourses(data.courses || data.cursos);

}

function setBooleanBadge(id, val) {
  const el = document.getElementById(id);
  el.innerHTML = val ? 'SIM <i class="fas fa-check ml-1"></i>' : 'NÃO <i class="fas fa-times ml-1"></i>';
  el.className = val ? 'status-badge bg-green-100 text-green-700' : 'status-badge bg-gray-100 text-gray-500';
}

function renderCityCourses(courses) {
  const container = document.getElementById('courses-container');
  container.innerHTML = '';

  if (!courses || courses.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">Sem histórico.</div>';
    return;
  }

  courses.forEach(c => {
    const color = (c.situacao || '').includes('Atendido') ? 'text-green-600' : 'text-yellow-600';

    let studentsHtml = '';
    if (c.students && c.students.length > 0) {
      studentsHtml = `<div class="mt-2 pt-2 border-t"><table class="w-full text-xs">
        ${c.students.map(s => `<tr><td class="py-1">${s.nome}</td><td class="text-right">${s.status}</td></tr>`).join('')}
      </table></div>`;
    }

    const comunicacao = c.comunicacao || '-';

    container.insertAdjacentHTML('beforeend', `
      <details class="bg-white rounded border border-gray-200 p-3 group">
        <summary class="flex justify-between text-sm font-bold cursor-pointer">
          <span>${c.nome}</span>
          <span class="${color} text-xs uppercase">${c.situacao} <i class="fas fa-chevron-down ml-1"></i></span>
        </summary>
        <div class="mt-2 text-xs text-gray-600 space-y-1">
          <div>Data: ${c.data_realizacao || '-'}</div>
          <div class="font-mono bg-gray-50 p-1 inline-block rounded">Comunicação: ${comunicacao}</div>
          ${c.obs ? `<div class="italic text-gray-500 mt-1">Obs: ${c.obs}</div>` : ''}
          ${studentsHtml}
        </div>
      </details>
    `);
  });
}

// --- IMPORTAÇÃO DE DADOS ---
async function processAndUploadFiles() {
  if (!confirm('Esta ação vai APAGAR e REESCREVER todo o banco de dados com base nos CSVs. Confirma?')) return;

  const f1 = document.getElementById('file-municipios').files[0];
  const f2 = document.getElementById('file-cidades').files[0];
  const f3 = document.getElementById('file-alunos').files[0];

  if (!f1 || !f2 || !f3) return alert('Selecione os 3 arquivos.');

  const loader = document.getElementById('loading-overlay');
  loader.style.display = 'flex';
  loader.style.opacity = '1';
  document.getElementById('loading-text').innerText = 'Processando importação...';

  try {
    console.log('Iniciando limpeza...');
    const { error: e1 } = await supabaseClient.from('alunos').delete().neq('id', 0);
    if (e1) console.warn('Erro ao limpar alunos (pode estar vazio):', e1);

    const { error: e2 } = await supabaseClient.from('cursos').delete().neq('id', 0);
    if (e2) console.warn('Erro ao limpar cursos:', e2);

    const { error: e3 } = await supabaseClient.from('municipios').delete().neq('id', 0);
    if (e3) console.warn('Erro ao limpar municipios:', e3);

    const config = { delimiter: ';', header: true, skipEmptyLines: true };
    const [pMuni, pCid, pAlu] = await Promise.all([parseFile(f1, config), parseFile(f2, config), parseFile(f3, config)]);

    // Municípios
    const muniPayload = pMuni.map(r => {
      const nome = r['Municipio'] || r['Município'];
      if (!nome) return null;
      return {
        nome,
        territorio: r['REGIÃO'] || '-',
        populacao: cleanNumber(r['População']),
        efetivo: cleanNumber(r['Efetivo']),
        possui_guarda: (r['Guarda oficial'] || '').includes('SIM'),
        guarda_armada: (r['Guarda Armada'] || '').includes('SIM'),
        prefeito: r['Prefeito'],
        email_pref: r['Email da Prefeitura'],
        telefone_pref: r['Telefone da Prefeitura'],
        email_gm: r['E-mail da Guarda'],
        telefone_gm: r['Telefone da Guarda']
      };
    }).filter(Boolean);

    const { data: insertedMunis, error: errM } = await supabaseClient
      .from('municipios')
      .upsert(muniPayload, { onConflict: 'nome' })
      .select();

    if (errM) throw errM;

    const muniMap = {};
    insertedMunis.forEach(m => { muniMap[m.nome] = m.id; });

    // Cursos
    const cursoTempMap = new Map();
    pCid.forEach(r => {
      const mId = muniMap[r['MUNICIPIO']];
      if (!mId) return;

      const ano = parseInt(String(r['ANO'] || '').replace(/\D/g, ''), 10) || null;
      const cursoNome = String(r['CURSO'] || '').trim();
      const key = `${mId}__${cursoNome}__${ano}`;

      if (!cursoTempMap.has(key)) {
        cursoTempMap.set(key, {
          municipio_id: mId,
          curso: cursoNome,
          ano,
          comunicacao: r['CANAL DE COMUNICAÇÃO'] || null,
          ac_convite: r['AC_CONVITE'] || r['AC CONVITE'] || null,
          status: r['STATUS'] || null,
          obs: r['OBSERVAÇÕES'] || null
        });
      }
    });

    const { data: insertedCursos, error: errC } = await supabaseClient
      .from('cursos')
      .upsert(Array.from(cursoTempMap.values()), { onConflict: 'municipio_id,curso,ano' })
      .select('id, municipio_id, curso, ano');

    if (errC) throw errC;

    const cursoLookup = {};
    insertedCursos.forEach(c => {
      cursoLookup[`${c.municipio_id}__${c.curso}__${c.ano}`] = c.id;
    });

    // Alunos
    const alunosPayload = [];
    pAlu.forEach(r => {
      const muniNome = String(r['MUNICIPIO'] || '').trim();
      const mId = muniMap[muniNome];
      if (!mId) return;

      const cursoNome = String(r['CURSO'] || '').trim();
      const ano = parseInt(String(r['ANO'] || '').replace(/\D/g, ''), 10) || null;

      const cId = cursoLookup[`${mId}__${cursoNome}__${ano}`];
      if (!cId) return;

      const cpf = String(r['CPF'] || '').replace(/\D/g, '') || null;

      alunosPayload.push({
        curso_id: cId,
        nome: String(r['ALUNO'] || '').trim(),
        cpf,
        email: r['EMAIL'] || null,
        tel: r['TEL'] || null,
        status: r['STATUS'] || null,
        obs: r['OBS'] || r['OBSERVAÇÕES'] || null
      });
    });

    const comCpf = alunosPayload.filter(a => a.cpf);
    const semCpf = alunosPayload.filter(a => !a.cpf);

    // com CPF -> upsert
    for (let i = 0; i < comCpf.length; i += 1000) {
      const chunk = comCpf.slice(i, i + 1000);
      const { error } = await supabaseClient.from('alunos').upsert(chunk, { onConflict: 'curso_id,cpf' });
      if (error) throw error;
    }

    // sem CPF -> insert
    for (let i = 0; i < semCpf.length; i += 1000) {
      const chunk = semCpf.slice(i, i + 1000);
      const { error } = await supabaseClient.from('alunos').insert(chunk);
      if (error) throw error;
    }

    alert('Importação Concluída com Sucesso!');
    location.reload();
  } catch (e) {
    console.error(e);
    alert('Erro Fatal: ' + (e?.message || e));
    loader.style.display = 'none';
  }
}

// --- CRUD ---
async function addCityControl() {
  const muniNome = document.getElementById('cc-municipio').value.trim();
  const cursoNome = document.getElementById('cc-curso').value.trim();
  const status = document.getElementById('cc-status').value.trim();
  const obs = document.getElementById('cc-obs').value.trim() || null;
  const comunicacao = document.getElementById('cc-comunicacao').value.trim() || null;
  const acConvite = document.getElementById('cc-ac-convite').value;


  const muniEntry = Object.values(loadedData).find(m => m.nome === muniNome);
  if (!muniEntry) return alert('Município inválido.');

  if (!cursoNome) return alert('Informe o curso.');
  if (!status) return alert('Informe o status.');

  const ano = extractYearFromCourseName(cursoNome); // ✅ derivado do nome

  const payload = {
    municipio_id: muniEntry.id,
    curso: cursoNome,
    ano,                 // pode ser null se não achar, mas recomendo padronizar o nome com ano
    status,
    obs,
    comunicacao: comunicacao,
    ac_convite: acConvite
  };

  const { error } = await supabaseClient
    .from('cursos')
    .upsert(payload, { onConflict: 'municipio_id,curso,ano' });

  if (error) return alert('Erro ao salvar: ' + (error.message || error));

  // limpa campos
        document.getElementById('cc-comunicacao').value = '';
        document.getElementById('cc-ac-convite').value = '';
        document.getElementById('cc-obs').value = '';
        document.getElementById('cc-status').value = '';
        document.getElementById('cc-curso').value = '';

  alert('Salvo!');
  await init(); // recarrega e repopula o datalist de cursos
  renderControlCities();
}


function populateCourseDatalist() {
  const dl = document.getElementById('course-datalist');
  if (!dl) return;
  dl.innerHTML = '';

  const set = new Set();

  Object.values(loadedData).forEach(m => {
    (m.courses || m.cursos || []).forEach(c => {
      const nome = (c.curso ?? c.nome ?? '').trim();
      if (nome) set.add(nome);
    });
  });

  Array.from(set).sort((a, b) => a.localeCompare(b)).forEach(nome => {
    const opt = document.createElement('option');
    opt.value = nome;
    dl.appendChild(opt);
  });
}


function extractYearFromCourseName(courseName) {
  const s = String(courseName || '');

  // pega o último ano 20xx que aparecer no texto
  const m = s.match(/(20\d{2})/g);
  if (!m || m.length === 0) return null;

  const year = parseInt(m[m.length - 1], 10);
  return Number.isFinite(year) ? year : null;
}

async function addStudentControl() {
  const muniNome = document.getElementById('ca-municipio').value;
  const cursoNome = document.getElementById('ca-curso').value;
  const nome = document.getElementById('ca-nome').value;
  const cpf = document.getElementById('ca-cpf').value;

  const muniEntry = Object.values(loadedData).find(m => m.nome === muniNome);
  if (!muniEntry) return alert('Município inválido');

  const cursoEntry = muniEntry.courses
    .filter(c => (c.nome ?? c.curso) === cursoNome)
    .sort((a, b) => (b.ano ?? b.data_realizacao) - (a.ano ?? a.data_realizacao))[0];

  if (!cursoEntry) return alert('Curso não existe.');

  const { error } = await supabaseClient.from('alunos').insert({
    curso_id: cursoEntry.id,
    nome,
    cpf: cpf ? cpf.replace(/\D/g, '') : null,
    status: 'Matriculado'
  });

  if (!error) { alert('Aluno matriculado!'); init(); } else alert('Erro ao salvar.');
}

async function deleteCourse(id) {
  if (!confirm('Apagar curso e todos alunos?')) return;

  const { error } = await supabaseClient
    .from('cursos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Erro ao apagar: ' + error.message);
    return;
  }

  await init();             // <-- aqui é o principal
  renderControlCities();    // agora renderiza com loadedData atualizado
}
async function deleteStudent(id) {
  if (confirm('Apagar aluno?')) {
    await supabaseClient.from('alunos').delete().eq('id', id);
    init();
  }
}

function clearControlCityFilters() {
  const ids = ['filter-cc-municipio', 'filter-cc-curso', 'filter-cc-ano', 'filter-cc-status'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderControlCities();
}


function setSelectOptions(selectEl, values) {
  if (!selectEl) return;

  const current = selectEl.value;
  const firstOpt = selectEl.querySelector('option')?.outerHTML || '<option value="">Todos</option>';

  const uniq = Array.from(new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== '')))
    .map(v => String(v))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  selectEl.innerHTML = firstOpt + uniq.map(v => `<option value="${v}">${v}</option>`).join('');
  // mantém seleção, se ainda existir
  selectEl.value = uniq.includes(current) ? current : '';
}

function getFiltrosControleParticipacao() {
  return {
    municipio: document.getElementById('filter-cc-municipio')?.value || '',
    curso: document.getElementById('filter-cc-curso')?.value || '',
    ano: document.getElementById('filter-cc-ano')?.value || '',
    status: document.getElementById('filter-cc-status')?.value || '',
  };
}

function popularFiltrosControleParticipacao(rows) {
  setSelectOptions(document.getElementById('filter-cc-municipio'), rows.map(r => r.municipioNome));
  setSelectOptions(document.getElementById('filter-cc-curso'), rows.map(r => r.cursoNome));
  setSelectOptions(document.getElementById('filter-cc-ano'), rows.map(r => r.ano));
  setSelectOptions(document.getElementById('filter-cc-status'), rows.map(r => r.status));
}


// --- Render (Controls) ---
function renderControlCities() {
  const tbody = document.getElementById('control-cities-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = [];
  Object.values(loadedData).forEach(m => {
    (m.courses || m.cursos || []).forEach(c => {
    rows.push({
  cursoId: c.id,
  municipioNome: m.nome,
  cursoNome: (c.curso ?? c.nome ?? '').trim(),
  ano: c.ano ?? c.data_realizacao ?? null,          // <-- ADD
  status: c.status ?? c.situacao ?? '',
  comunicacao: c.comunicacao ?? '',
  ac_convite: c.ac_convite ?? '',
  obs: c.obs ?? ''
        });
    });
  });

  rows.sort((a, b) => (b.cursoId || 0) - (a.cursoId || 0));
    // 1) popular selects com base nos dados atuais
    popularFiltrosControleParticipacao(rows);

    // 2) ler filtros selecionados
    const f = getFiltrosControleParticipacao();

    // 3) filtrar
    const rowsFiltradas = rows.filter(r => {
    if (f.municipio && r.municipioNome !== f.municipio) return false;
    if (f.curso && r.cursoNome !== f.curso) return false;
    if (f.status && String(r.status || '') !== f.status) return false;

    if (f.ano) {
        const anoR = String(r.ano ?? '');
        if (anoR !== String(f.ano)) return false;
    }
    return true;
    });

  rowsFiltradas.forEach(r => {
    const emEdicao = (editingCursoId === r.cursoId);

    if (!emEdicao) {
      tbody.insertAdjacentHTML('beforeend', `
        <tr class="bg-white border-b">
          <td class="px-4 py-2 font-bold">${escapeHtml(r.municipioNome)}</td>
          <td class="px-4 py-2 text-xs">${escapeHtml(r.cursoNome)}</td>
          <td class="px-4 py-2 text-xs">${escapeHtml(r.comunicacao || '-')}</td>
          <td class="px-4 py-2 text-xs">${escapeHtml(r.ac_convite || '-')}</td>
          <td class="px-4 py-2 text-xs">${escapeHtml(r.status || '-')}</td>
          <td class="px-4 py-2 text-xs">${escapeHtml(r.obs || '-')}</td>
          <td class="px-4 py-2 text-center whitespace-nowrap">
            <button onclick="startEditCurso(${r.cursoId})" class="text-blue-600 mr-2" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteCourse(${r.cursoId})" class="text-red-500" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `);
    } else {
      tbody.insertAdjacentHTML('beforeend', `
        <tr class="bg-yellow-50 border-b">
          <td class="px-4 py-2 font-bold">${escapeHtml(r.municipioNome)}</td>
          <td class="px-4 py-2 text-xs">${escapeHtml(r.cursoNome)}</td>

          
          <td class="px-4 py-2 text-xs">
          <input id="ed-comunicacao-${r.cursoId}" class="w-full border p-1 rounded text-xs"
          value="${escapeHtml(r.comunicacao)}" placeholder="Canal...">
          </td>
          
          <td class="px-4 py-2 text-xs">
          <select id="ed-convite-${r.cursoId}" class="w-full border p-1 rounded text-xs">
          ${optionsHtml(CONVITE_OPCOES, r.ac_convite)}
          </select>
          </td>
          <td class="px-4 py-2 text-xs">
            <select id="ed-status-${r.cursoId}" class="w-full border p-1 rounded text-xs">
              ${optionsHtml(STATUS_OPCOES, r.status)}
            </select>
          </td>

          <td class="px-4 py-2 text-xs">
            <input id="ed-obs-${r.cursoId}" class="w-full border p-1 rounded text-xs"
                   value="${escapeHtml(r.obs)}" placeholder="Obs...">
          </td>

          <td class="px-4 py-2 text-center whitespace-nowrap">
            <button onclick="saveEditCurso(${r.cursoId})" class="text-green-700 mr-2" title="Salvar">
              <i class="fas fa-check"></i>
            </button>
            <button onclick="cancelEditCurso()" class="text-gray-700 mr-2" title="Cancelar">
              <i class="fas fa-times"></i>
            </button>
            <button onclick="deleteCourse(${r.cursoId})" class="text-red-500" title="Excluir">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `);
    }
  });
}


function renderControlStudents() {
  const filter = document.getElementById('control-student-search').value.toLowerCase();
  const tbody = document.getElementById('control-students-table');
  tbody.innerHTML = '';
  let count = 0;

  Object.values(loadedData).forEach(m => {
    if (m.courses) m.courses.forEach(c => {
      if (c.students) c.students.forEach(s => {
        if (count > 50 && filter === '') return;
        if (s.nome.toLowerCase().includes(filter) || m.nome.toLowerCase().includes(filter)) {
          tbody.insertAdjacentHTML('beforeend', `
            <tr class="bg-white border-b">
              <td class="px-4 py-2 text-xs">${m.nome}</td>
              <td class="px-4 py-2 text-xs">${c.nome}</td>
              <td class="px-4 py-2 font-bold">${s.nome}</td>
              <td class="px-4 py-2 text-xs font-mono">${s.cpf || '-'}</td>
              <td class="px-4 py-2 text-xs">${s.status || '-'}</td>
              <td class="px-4 py-2 text-center"><button onclick="deleteStudent(${s.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td>
            </tr>
          `);
          count++;
        }
      });
    });
  });
}

function renderGlobalCourses() {
  const container = document.getElementById('global-courses-list');
  container.innerHTML = '';
  const map = {};

  Object.values(loadedData).forEach(m => {
    if (m.courses) m.courses.forEach(c => {
      if (!map[c.nome]) map[c.nome] = [];
      map[c.nome].push({ cityName: m.nome, cityId: m.id, count: c.students.length });
    });
  });

  Object.keys(map).sort().forEach(cName => {
    const list = map[cName];
    container.insertAdjacentHTML('beforeend', `
      <details class="group bg-white rounded border border-gray-200">
        <summary class="flex justify-between p-4 cursor-pointer hover:bg-blue-50">
          <div>
            <span class="font-bold text-blue-900">${cName}</span>
            <div class="text-xs text-gray-500">${list.length} Cidades</div>
          </div>
        </summary>
        <div class="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          ${list.map(i => `
            <div onclick="loadCity(${i.cityId}); navigateTo('page-municipios')" class="bg-gray-50 p-2 border rounded cursor-pointer hover:bg-white">
              ${i.cityName} (${i.count})
            </div>
          `).join('')}
        </div>
      </details>
    `);
  });
}

function renderGlobalStudents() {
  filterStudents();
}

function filterStudents() {
  const term = document.getElementById('student-search').value.toLowerCase();
  const tbody = document.getElementById('global-students-table');
  tbody.innerHTML = '';
  let count = 0;

  for (const id in loadedData) {
    const m = loadedData[id];
    if (m.courses) m.courses.forEach(c => {
      if (c.students) c.students.forEach(s => {
        
        if (term === '' || s.nome.toLowerCase().includes(term) || (s.cpf || '').includes(term)) {
          tbody.insertAdjacentHTML('beforeend', `
            <tr class="bg-white border-b hover:bg-gray-50">
              <td class="px-4 py-2 font-bold">${s.nome}</td>
              <td class="px-4 py-2 font-mono text-xs">${s.cpf || '-'}</td>
              <td class="px-4 py-2 text-xs text-blue-600">${m.nome}</td>
              <td class="px-4 py-2 text-xs">${c.nome}</td>
              <td class="px-4 py-2 text-xs">${s.status}</td>
            </tr>
          `);
          count++;
        }
      });
    });
  }

  document.getElementById('student-count').innerText = `Exibindo ${count} resultados`;
}

// --- Utils ---
function parseFile(f, c) {
  return new Promise((res, rej) => Papa.parse(f, { ...c, complete: r => res(r.data), error: rej }));
}

function cleanNumber(v) {
  return parseInt(String(v || 0).replace(/\./g, '').replace(/,/g, ''), 10) || 0;
}

function toggleModal(id) {
  const m = document.getElementById(id);
  m.classList.toggle('opacity-0');
  m.classList.toggle('pointer-events-none');
}


function startEditCurso(cursoId) {
  editingCursoId = cursoId;
  renderControlCities();
}

function cancelEditCurso() {
  editingCursoId = null;
  renderControlCities();
}

async function saveEditCurso(cursoId) {
  const status = document.getElementById(`ed-status-${cursoId}`)?.value || null;
  const comunicacao = document.getElementById(`ed-comunicacao-${cursoId}`)?.value.trim() || null;
  const acConvite = document.getElementById(`ed-convite-${cursoId}`)?.value || null;
  const obs = document.getElementById(`ed-obs-${cursoId}`)?.value.trim() || null;

  // validações básicas
  if (status && !STATUS_OPCOES.includes(status)) return alert("Status inválido.");
  if (acConvite && !CONVITE_OPCOES.includes(acConvite)) return alert("Opção de convite inválida.");

  const { error } = await supabaseClient
    .from('cursos')
    .update({
      status,
      comunicacao,
      ac_convite: acConvite,
      obs
    })
    .eq('id', cursoId);

  if (error) {
    console.error(error);
    return alert("Erro ao salvar: " + (error.message || error));
  }

  editingCursoId = null;

  // atualiza dados e re-render sem F5
  await init();
  renderControlCities();
}


// Expor funções para onclick no HTML
window.navigateTo = navigateTo;
window.toggleModal = toggleModal;
window.loadCity = loadCity;
window.processAndUploadFiles = processAndUploadFiles;
window.addCityControl = addCityControl;
window.addStudentControl = addStudentControl;
window.deleteCourse = deleteCourse;
window.deleteStudent = deleteStudent;
window.renderControlStudents = renderControlStudents;
window.filterStudents = filterStudents;
window.clearControlCityFilters = clearControlCityFilters;
window.renderControlCities = renderControlCities;



// Start
init();

