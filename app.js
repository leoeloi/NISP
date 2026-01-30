/* global Papa, supabase */

const SUPABASE_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnBjaWx2dXJqcm9pZ2Jhb3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM4NTYsImV4cCI6MjA4NTE3OTg1Nn0.sFOB6HQf1yKPeT3xcsG3rhgIn9exJER4yaGkfyRjWSo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let loadedData = {};

// --- INIT ---
async function init() {
  const overlay = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');

  try {
    txt.innerText = 'Carregando dados atualizados...';

    const { data: dbData, error } = await supabaseClient
      .from('municipios')
      .select(`
        *,
        cursos (
          *,
          alunos (*)
        )
      `);

    if (error) throw error;

    loadedData = {};

    if (dbData && Array.isArray(dbData)) {
      dbData.forEach(m => {
        loadedData[m.id] = m;
        loadedData[m.id].courses = m.cursos || [];

        let uniqueGrads = new Set();
        let totalCerts = 0;

        loadedData[m.id].courses.forEach(c => {
          // compatibilidade com schema novo (curso/ano/status)
          c.nome = c.nome ?? c.curso;
          c.data_realizacao = c.data_realizacao ?? c.ano;
          c.situacao = c.situacao ?? c.status;

          c.students = c.alunos || [];
          c.concluintes = 0;

          c.students.forEach(s => {
            if ((s.status || '').toUpperCase().includes('CONCLU')) {
              c.concluintes++;
              totalCerts++;
              uniqueGrads.add(s.cpf || s.nome);
            }
          });
        });

        loadedData[m.id].uniqueGraduates = uniqueGrads.size;
        loadedData[m.id].totalCertifications = totalCerts;
      });

      populateDatalists(dbData);
      loadCityList(dbData);
    } else {
      loadCityList([]);
    }
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

  document.getElementById('view-email-gm').innerText = data.email_gm || '-';
  document.getElementById('view-tel-gm').innerText = data.telefone_gm || '-';

  setBooleanBadge('badge-possui', data.possui_guarda);
  setBooleanBadge('badge-armada', data.guarda_armada);

  const coverage = data.efetivo > 0 ? ((data.uniqueGraduates / data.efetivo) * 100).toFixed(1) : 0;
  document.getElementById('view-total-certs').innerText = data.totalCertifications;
  document.getElementById('view-unique-grads').innerText = data.uniqueGraduates;
  document.getElementById('view-coverage-pct').innerText = coverage + '%';

  renderCityCourses(data.courses);
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
  const muniNome = document.getElementById('cc-municipio').value;
  const cursoNome = document.getElementById('cc-curso').value;
  const ano = document.getElementById('cc-ano').value;

  const muniEntry = Object.values(loadedData).find(m => m.nome === muniNome);
  if (!muniEntry) return alert('Município inválido.');

  const { error } = await supabaseClient.from('cursos').upsert({
    municipio_id: muniEntry.id,
    curso: cursoNome,
    ano: parseInt(String(ano).replace(/\D/g, ''), 10) || null,
    status: 'Em Andamento',
    comunicacao: 'Inserção Manual'
  }, { onConflict: 'municipio_id,curso,ano' });

  if (!error) { alert('Salvo!'); init(); } else alert('Erro ao salvar.');
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
  if (confirm('Apagar curso e todos alunos?')) {
    await supabaseClient.from('cursos').delete().eq('id', id);
    init();
  }
}

async function deleteStudent(id) {
  if (confirm('Apagar aluno?')) {
    await supabaseClient.from('alunos').delete().eq('id', id);
    init();
  }
}

// --- Render (Controls) ---
function renderControlCities() {
  const tbody = document.getElementById('control-cities-table');
  tbody.innerHTML = '';
  Object.values(loadedData).forEach(m => {
    if (m.courses) m.courses.forEach(c => {
      tbody.insertAdjacentHTML('beforeend', `
        <tr class="bg-white border-b">
          <td class="px-4 py-2 font-bold">${m.nome}</td>
          <td class="px-4 py-2 text-xs">${c.nome}</td>
          <td class="px-4 py-2 text-xs">${c.ano ?? c.data_realizacao}</td>
          <td class="px-4 py-2 text-xs">${c.situacao}</td>
          <td class="px-4 py-2 text-center"><button onclick="deleteCourse(${c.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td>
        </tr>
      `);
    });
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
        if (count > 50 && term === '') return;
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

// Start
init();
