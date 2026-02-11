const SUPABASE_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnBjaWx2dXJqcm9pZ2Jhb3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM4NTYsImV4cCI6MjA4NTE3OTg1Nn0.sFOB6HQf1yKPeT3xcsG3rhgIn9exJER4yaGkfyRjWSo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Objeto global para armazenar os cálculos realizados no init
let loadedData = {};
let listaGlobalAlunos = [];

async function realizarLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const erroMsg = document.getElementById('erro-login');

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha,
    });

    if (error) {
        erroMsg.style.display = 'block';
        erroMsg.textContent = error.message;
    } else {
        console.log("Login realizado com sucesso!");
        mostrarSistema();
    }
}

function mostrarSistema() {
    // Oculta a tela de login (o modal/overlay)
    const telaLogin = document.getElementById('tela-login');
    if (telaLogin) telaLogin.style.display = 'none';
    
    // Exibe a parte restrita do menu
    const areaRestrita = document.getElementById('area-restrita-menu');
    if (areaRestrita) areaRestrita.style.display = 'flex';
    
    // Oculta o botão de "Entrar" já que já logou
    const btnLoginAbrir = document.getElementById('btn-login-abrir');
    if (btnLoginAbrir) btnLoginAbrir.style.display = 'none';
    
    // Carrega os dados do Supabase
    init(); 
}

async function verificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        // Se estiver logado, libera tudo automaticamente
        mostrarSistema();
    } else {
        // Se NÃO estiver logado, garante que a tela de login esteja oculta
        // e que apenas as abas públicas funcionem.
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('area-restrita-menu').style.display = 'none';
        document.getElementById('btn-login-abrir').style.display = 'block';
        
        // Garante que comece na aba pública
        navegarPara('resumo-geral');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    verificarSessao();
});

async function realizarLogout() {
    await supabaseClient.auth.signOut();
    
    // 1. Esconde os itens privados do menu
    document.getElementById('area-restrita-menu').style.display = 'none';
    
    // 2. Mostra o botão de login novamente
    document.getElementById('btn-login-abrir').style.display = 'block';
    
    navegarPara('resumo-geral');
    
    // 4. Limpa dados sensíveis da memória se necessário
    loadedData = {};
    listaGlobalAlunos = [];
    
    console.log("Usuário deslogado. Mantendo acesso público.");
}

async function init() {
    console.log("Iniciando carregamento...");
    try {
        const [resMun, resCur, resAlu] = await Promise.all([
            supabaseClient.from('municipios').select('*').order('nome', { ascending: true }),
            // Buscamos todas as colunas necessárias da tabela cursos
            supabaseClient.from('cursos').select('*, comunicacao, status, ac_convite, obs').order('curso', { ascending: true }),
            supabaseClient.from('alunos').select('*')
        ]);

        if (resMun.error) throw resMun.error;
        
        const municipios = resMun.data;
        const todosCursos = resCur.data || [];
        const todosAlunos = resAlu.data || [];

        // 1. POPULAR O SELECT
        const municipioSelect = document.getElementById('municipio-select');
        if (municipioSelect) {
            municipioSelect.innerHTML = '<option value="">Selecione um município</option>';
            municipios.forEach(m => {
                const option = document.createElement('option');
                option.value = m.id;
                option.textContent = m.nome;
                municipioSelect.appendChild(option);
            });
        }

        // 2. ORGANIZAR DADOS
        loadedData = {};
        municipios.forEach(mun => {
            const cursosDoMun = todosCursos.filter(c => c.municipio_id === mun.id).map(curso => {
                const alunosDoCurso = todosAlunos.filter(a => a.curso_id === curso.id);
                return { ...curso, alunos: alunosDoCurso };
            });

            let nomesUnicos = new Set();
            let certs = 0;

            cursosDoMun.forEach(curso => {
                curso.alunos.forEach(aluno => {
                    if ((aluno.status || '').toLowerCase().includes('conclu')) {
                        certs++;
                        nomesUnicos.add(aluno.nome);
                    }
                });
            });

            loadedData[mun.id] = { 
                ...mun, 
                cursos: cursosDoMun,
                totalConcluintes: nomesUnicos.size, 
                totalCertificados: certs 
            };
        });
        console.log("Processamento concluído.");
    } catch (err) {
        console.error("Erro crítico no init:", err);
    }

    atualizarEstatisticasGlobais();
    popularPainelEdicoes();
    prepararListaGlobalAlunos();
}

async function carregarDadosMunicipio(municipioId) {
    const mun = loadedData[municipioId];
    if (!mun) return;

    try {
        // Atualiza Informações Básicas
        document.getElementById('nome-mun').textContent = mun.nome;
        document.getElementById('territorio-mun').textContent = mun.territorio || '-';
        document.getElementById('populacao').textContent = mun.populacao || '-';
        document.getElementById('prefeito').textContent = mun.prefeito || '-';
        
        // CORREÇÃO: Preenchimento dos contatos que apareciam vazios
        document.getElementById('email-pref').textContent = mun.email_pref || '-';
        document.getElementById('tel-pref').textContent = mun.telefone_pref || '-';
        document.getElementById('chefe-guarda').textContent = mun.chefe_gm || '-';
        document.getElementById('email-gm').textContent = mun.email_gm || '-';
        document.getElementById('tel-gm').textContent = mun.telefone_gm || '-';
        
        document.getElementById('observacoes').textContent = mun.obs_mun || 'Nenhuma observação.';

        // Lógica do Efetivo e Cobertura
        const efetivo = parseInt(mun.efetivo) || 0;
        const concluintes = mun.totalConcluintes || 0;
        
        if (efetivo > 0) {
            document.getElementById('info-efetivo').style.display = 'flex';
            document.getElementById('efetivo').textContent = efetivo;
            document.getElementById('cobertura').textContent = `${((concluintes / efetivo) * 100).toFixed(1)}%`;
        } else {
            document.getElementById('info-efetivo').style.display = 'none';
            document.getElementById('cobertura').textContent = '0.0%';
        }

        document.getElementById('certificacoes').textContent = mun.totalCertificados;
        document.getElementById('alunos-unicos').textContent = concluintes;

        // Atualização dos Badges (Sim/Não)
        const atualizarBadge = (id, check) => {
            const el = document.getElementById(id);
            if (check) {
                el.innerHTML = '<i class="fa-solid fa-circle-check"></i> Sim';
                el.style.cssText = "color: #28a745; background-color: #d4edda; padding: 4px 10px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;";
            } else {
                el.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Não';
                el.style.cssText = "color: #dc3545; background-color: #f8d7da; padding: 4px 10px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;";
            }
        };

        atualizarBadge('possui-guarda', mun.possui_guarda);
        atualizarBadge('guarda-armada', mun.guarda_armada);

        popularListaCursos(mun.cursos);

    } catch (err) {
        console.error("Erro ao popular interface:", err);
    }
}

function popularListaCursos(cursos) {
    const container = document.getElementById('lista-cursos-container');
    if (!container) return;

    if (!cursos || cursos.length === 0) {
        container.innerHTML = '<p style="padding: 20px;">Nenhum curso registrado para este município.</p>';
        return;
    }

    container.innerHTML = cursos.map(curso => {
        const nomeDoCurso = curso.curso || "Curso sem nome";
        const concluintesNoCurso = curso.alunos.filter(a => 
            (a.status || '').toLowerCase().includes('conclu')
        ).length;

        // Lógica para o badge de convite (ac_convite)
        let badgeConvite = '-'; 
        if (curso.ac_convite !== null && curso.ac_convite !== undefined) {
            if (curso.ac_convite === true || curso.ac_convite === "Sim") {
                badgeConvite = '<span style="background:#d4edda; color:#155724; padding:2px 8px; border-radius:10px; font-size:0.75rem;">Convite: Sim</span>';
            } else {
                badgeConvite = '<span style="background:#f8d7da; color:#721c24; padding:2px 8px; border-radius:10px; font-size:0.75rem;">Convite: Não</span>';
            }
        }
        
        return `
            <div style="border: 1px solid #eee; margin-bottom: 15px; border-radius: 10px; overflow: hidden; font-family: sans-serif; text-align: left; background-color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="background: #fdfdfd; padding: 15px; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <h3 style="margin: 0; color: #333; font-size: 1.1rem; text-transform: uppercase;">${nomeDoCurso}</h3>
                        <span style="font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 5px; background: #1361af; color: #ffffff;">
                            ${(curso.status || 'N/A').toUpperCase()}
                        </span>
                    </div>
                    <div style="margin-top: 8px; display: flex; gap: 10px; align-items: center;">
                        <small style="color: #777;">Concluintes: <strong>${concluintesNoCurso}</strong></small>
                        ${badgeConvite}
                    </div>
                </div>
                
                <div style="padding: 12px; font-size: 0.85rem; color: #555; background: #fff;">
                    <div style="margin-bottom: 5px;"><strong>Comunicação:</strong> ${curso.comunicacao || 'Não informada'}</div>
                    <div style="margin-bottom: 10px; font-style: italic; color: #777;">
                        <strong>Obs:</strong> ${curso.obs || 'Sem observações.'}
                    </div>
                    
                    <details>
                        <summary style="cursor: pointer; color: #007bff; font-weight: bold; list-style: none; display: flex; align-items: center; gap: 5px; border-top: 1px solid #f1f1f1; padding-top: 10px;">
                             <i class="fa-solid fa-users"></i> Ver lista de alunos (${curso.alunos.length})
                        </summary>
                        <ul style="margin-top: 10px; list-style: none; padding-left: 0;">
                            ${curso.alunos.map(aluno => `
                                <li style="padding: 6px 5px; border-bottom: 1px solid #f9f9f9; display: flex; justify-content: space-between;">
                                    <span>${aluno.nome}</span>
                                    <span style="font-weight: bold; color: ${(aluno.status || '').toLowerCase().includes('conclu') ? '#28a745' : '#6c757d'}">
                                        ${aluno.status}
                                    </span>
                                </li>
                            `).join('')}
                        </ul>
                    </details>
                </div>
            </div>
        `;
    }).join('');
}


let chartEdicao = null;
let chartBarras = null;

function atualizarEstatisticasGlobais() {
    const listaMunicipios = Object.values(loadedData);
    
    // FILTRO BASE: Apenas municípios que possuem GCM
    const munComGuarda = listaMunicipios.filter(m => m.possui_guarda === true);

    const certsPorEdicao = {};
    
    munComGuarda.forEach(mun => {
        mun.cursos.forEach(curso => {
            const identificador = `${curso.curso} - ${curso.ano || 'S/D'}`;
            const concluintes = curso.alunos.filter(a => (a.status || '').toLowerCase().includes('conclu')).length;

            if (concluintes === 0) return; // Pula cursos sem concluintes
            certsPorEdicao[identificador] = (certsPorEdicao[identificador] || 0) + concluintes;
        });
    });
    
    renderizarBarrasEdicao(certsPorEdicao);

    // --- 2. ÍNDICE: Certificados por Ano (Gráfico de Barras) ---
    const certsPorAnoBruto = {};
    munComGuarda.forEach(mun => {
        mun.cursos.forEach(curso => {
            const ano = curso.ano || "S/D";
            const concluintes = curso.alunos.filter(a => (a.status || '').toLowerCase().includes('conclu')).length;
            certsPorAnoBruto[ano] = (certsPorAnoBruto[ano] || 0) + concluintes;
        });
    });

    // CORREÇÃO: Filtra apenas os anos que possuem pelo menos 1 concluinte
    const certsPorAnoFiltrado = {};
    Object.keys(certsPorAnoBruto).forEach(ano => {
        if (certsPorAnoBruto[ano] > 0) {
            certsPorAnoFiltrado[ano] = certsPorAnoBruto[ano];
        }
    });

    renderizarBarrasAno(certsPorAnoFiltrado);

    // --- 3. ÍNDICE: Progresso Geral (Barra de Progresso) ---
    const atendidosGeral = munComGuarda.filter(m => m.totalConcluintes > 0).length;
    const totalGeralGCM = munComGuarda.length;
    const percGeral = totalGeralGCM > 0 ? ((atendidosGeral / totalGeralGCM) * 100).toFixed(1) : 0;

    const elementoBarra = document.getElementById('barra-preenchimento');
    if (elementoBarra) {
        elementoBarra.style.width = `${percGeral}%`;
        document.getElementById('texto-progresso-percentual').textContent = `${percGeral}%`;
        document.getElementById('atendidos-count').textContent = atendidosGeral;
        document.getElementById('total-gcm-count').textContent = totalGeralGCM;
    }
}

function renderizarBarrasEdicao(dados) {
    const ctx = document.getElementById('grafico-barras-edicao').getContext('2d');
    if (chartEdicao) chartEdicao.destroy();
    const edicoes = Object.keys(dados);
    const valores = edicoes.map(e => dados[e]);
    chartEdicao = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: edicoes,
            datasets: [{
                label: 'Certificações',
                data: valores,
                backgroundColor: '#E4AD36',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, 
            datalabels: { 
                anchor: 'end', 
                align: 'end', 
                font: { weight: 'bold', size: 14 },
                formatter: function(value) {
                    return value;
                }
            } },
            scales: {
                x: { beginAtZero: true, grace: '20%', ticks: { display: false }, grid: { display: false } },
                y: { ticks: { font: { size: 12, weight: 'bold' } }, grid: { display: false } }
            }
        }
    });
}

function renderizarBarrasAno(dados) {
    const ctx = document.getElementById('grafico-barras-anos').getContext('2d');
    if (chartBarras) chartBarras.destroy();

    const anos = Object.keys(dados).sort();
    const valores = anos.map(a => dados[a]);

    chartBarras = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: anos,
            datasets: [{
                label: 'Certificações',
                data: valores,
                backgroundColor: '#1e3c99',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, 
            datalabels: { 
                anchor: 'end', 
                align: 'top', 
                font: { weight: 'bold', size: 14 },
                formatter: function(value) {
                    return value;
                }
            } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 },
        grace: '40%' } }
        }
    });
}

function popularPainelEdicoes() {
    const container = document.getElementById('lista-cursos-edicoes');
    if (!container) return;

    const todasEdicoes = [];
    
    Object.values(loadedData).forEach(mun => {
        mun.cursos.forEach(curso => {
            const identificador = `${curso.curso} - ${curso.ano || 'S/D'}`;
            let edicaoExistente = todasEdicoes.find(e => e.id_edicao === identificador);
            
            if (!edicaoExistente) {
                edicaoExistente = {
                    id_edicao: identificador,
                    nome: curso.curso,
                    ano: curso.ano,
                    municipios: []
                };
                todasEdicoes.push(edicaoExistente);
            }

            edicaoExistente.municipios.push({
                id: mun.id, // Guardamos o ID para o clique
                nome: mun.nome,
                qtd: curso.alunos.length
            });
        });
    });

    todasEdicoes.sort((a, b) => (b.ano || 0) - (a.ano || 0));

    // Renderização com Accordion e Link de navegação
    container.innerHTML = todasEdicoes.map(edicao => `
        <details class="card-edicao-expansivel">
            <summary class="header-edicao-clicavel">
                <div class="info-titulo">
                    <i class="fa-solid fa-chevron-right seta-expansao"></i>
                    <h3>${edicao.nome} - ${edicao.ano || ''}</h3>
                </div>
                <span class="badge-contador">${edicao.municipios.length} Municípios</span>
            </summary>
            
            <div class="grid-municipios-participantes">
                ${edicao.municipios.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => `
                    <div class="item-municipio-link" onclick="irParaMunicipio('${m.id}')">
                        <span>${m.nome}</span>
                        <span class="contador-alunos-mun">${m.qtd}</span>
                    </div>
                `).join('')}
            </div>
        </details>
    `).join('');
}

// Função para navegar até o município e rolar a tela
function irParaMunicipio(id) {
    const select = document.getElementById('municipio-select');
    if (select) {
        navegarPara('painel-municipio'); // Garante que a seção de municípios esteja visível
        select.value = id;
        carregarDadosMunicipio(id);
        document.getElementById('painel-municipio').scrollIntoView({ behavior: 'smooth' });
    }
}

function prepararListaGlobalAlunos() {
    listaGlobalAlunos = [];
    Object.values(loadedData).forEach(mun => {
        mun.cursos.forEach(curso => {
            curso.alunos.forEach(aluno => {
                listaGlobalAlunos.push({
                    ...aluno,
                    nomeMunicipio: mun.nome,
                    nomeEdicao: `${curso.curso} - ${curso.ano || 'S/D'}`
                });
            });
        });
    });
    renderizarTabelaAlunos(listaGlobalAlunos);
}

function renderizarTabelaAlunos(dados) {
    const corpoTabela = document.getElementById('tabela-corpo-alunos');
    if (!corpoTabela) return;

    if (dados.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center;">Nenhum aluno encontrado.</td></tr>';
        return;
    }

    corpoTabela.innerHTML = dados.map(aluno => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px;">${aluno.nome}</td>
            <td style="padding: 12px;">${aluno.cpf || '-'}</td>
            <td style="padding: 12px; font-size: 0.85rem;">${aluno.nomeEdicao}</td>
            <td style="padding: 12px;">${aluno.nomeMunicipio}</td>
            <td style="padding: 12px;">
                <span style="color: ${(aluno.status || '').toLowerCase().includes('conclu') ? '#28a745' : '#6c757d'}; font-weight: bold;">
                    ${aluno.status}
                </span>
            </td>
        </tr>
    `).join('');
}

function navegarPara(sectionId) {
    // 1. Lista de todos os IDs de seções que você tem no index2.html
    const secoes = [
        'resumo-geral',
        'sobre-nisp',
        'painel-municipio',
        'painel-cursos',
        'painel-busca-alunos',
        'gestao-usuarios'
    ];

    // 2. Oculta todas as seções
    secoes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 3. Exibe a seção desejada
    const secaoAlvo = document.getElementById(sectionId);
    if (secaoAlvo) {
        secaoAlvo.style.display = 'block';
        window.scrollTo(0, 0);
        
        if (sectionId === 'painel-cursos' && typeof popularPainelEdicoes === 'function') {
            popularPainelEdicoes();
        }

        if (sectionId === 'painel-busca-alunos') {
            prepararListaGlobalAlunos();
        }
    }

    // 4. Fecha qualquer dropdown aberto (opcional, para melhor UX)
    console.log(`Navegou para: ${sectionId}`);
}

document.addEventListener('DOMContentLoaded', () => {
    // Mesmo sem login, inicializamos o que for público se necessário
    // Mas o init() completo deve rodar preferencialmente após o login para economizar requests
    verificarSessao();
});

document.addEventListener('DOMContentLoaded', function() {
      const swiper = new Swiper('.mySwiperNisp', {
          loop: true,
          autoplay: {
              delay: 4000,
              disableOnInteraction: false,
          },
          pagination: {
              el: '.swiper-pagination',
              clickable: true,
          },
          navigation: {
              nextEl: '.swiper-button-next',
              prevEl: '.swiper-button-prev',
          },
      });
  });

document.addEventListener('DOMContentLoaded', () => {
    init();

    const select = document.getElementById('municipio-select');
    if (select) {
        select.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id) carregarDadosMunicipio(id);
        });
    }

    const inputBusca = document.getElementById('input-busca-aluno');
    if (inputBusca) {
        inputBusca.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            const filtrados = listaGlobalAlunos.filter(aluno => 
                aluno.nome.toLowerCase().includes(termo) || 
                (aluno.cpf && aluno.cpf.includes(termo))
            );
            renderizarTabelaAlunos(filtrados);
        });
    }
});