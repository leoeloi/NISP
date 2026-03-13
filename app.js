// 1. CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS

const SUPABASE_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnBjaWx2dXJqcm9pZ2Jhb3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM4NTYsImV4cCI6MjA4NTE3OTg1Nn0.sFOB6HQf1yKPeT3xcsG3rhgIn9exJER4yaGkfyRjWSo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let loadedData = {};
let listaGlobalAlunos = [];
let chartEdicao = null;
let chartBarras = null;

// ==========================================
// 2. INICIALIZAÇÃO E FLUXO PRINCIPAL
// ==========================================

async function init() {
    console.log("Iniciando carregamento...");
    try {
        // Busca os dados através da ponte segura
        const [municipios, todosCursos, todosAlunos] = await Promise.all([
            apiNISP.buscarTabela('municipios'),
            apiNISP.buscarTabela('cursos'),
            apiNISP.buscarTabela('alunos')
        ]);

        // Processa os dados
        loadedData = apiNISP.processarDados(municipios, todosCursos, todosAlunos);

        // Atualiza a interface com os dados
        popularSelectMunicipios(municipios);
        atualizarEstatisticasGlobais();
        popularPainelEdicoes();
        prepararListaGlobalAlunos();
        processarCidadesAtendidas();

    } catch (err) {
        console.error("Erro crítico no carregamento:", err);
    }
}

// ==========================================
// 3. CONTROLE DE AUTENTICAÇÃO (LOGIN/LOGOUT)
// ==========================================

async function verificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        mostrarSistema();
        verificarPermissoes(); //Verifica se é admin
    } else {
        // 1. Esconde os itens privados do menu
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('area-restrita-menu').style.display = 'none';
        document.getElementById('btn-login-abrir').style.display = 'block';
        navegarPara('sobre-nisp');
    }
}

async function realizarLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const erroMsg = document.getElementById('erro-login');

    try {
        const resultado = await apiNISP.login(email, senha);
        
        if (resultado.role === 'admin') {
            document.getElementById('gestao-usuarios-link').style.display = 'block';
        }
        
        mostrarSistema();
    } catch (error) {
        erroMsg.style.display = 'block';
        erroMsg.textContent = "Erro ao acessar: " + error.message;
    }
}

async function realizarLogout() {
    await apiNISP.logout();
    document.getElementById('area-restrita-menu').style.display = 'none';
    document.getElementById('btn-login-abrir').style.display = 'block';
    
    loadedData = {};
    listaGlobalAlunos = [];
    
    navegarPara('sobre-nisp');
    console.log("Usuário deslogado. Mantendo acesso público.");
}

async function mostrarSistema() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        console.error("Tentativa de acesso não autorizada detectada.");
        alert("Acesso Negado: Nenhuma sessão válida encontrada.");
        window.location.reload(); 
        return; 
    }

    const telaLogin = document.getElementById('tela-login');
    if (telaLogin) telaLogin.style.display = 'none';
    
    const areaRestrita = document.getElementById('area-restrita-menu');
    if (areaRestrita) areaRestrita.style.display = 'flex';
    
    const btnLoginAbrir = document.getElementById('btn-login-abrir');
    if (btnLoginAbrir) btnLoginAbrir.style.display = 'none';
    
    // Carrega os dados do Supabase
    init(); 
    carregarDadosPerfil(); 
    resetarTimer();

    navegarPara('resumo-geral'); 
}

async function verificarPermissoes() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        const isAdmin = await apiNISP.verificarAdmin(user.id);
        if (isAdmin) {
            document.getElementById('gestao-usuarios-link').style.display = 'block';
            if (typeof carregarListaDeUsuarios === 'function') carregarListaDeUsuarios();
        }
    }
}

// ==========================================
// 4. NAVEGAÇÃO E INTERFACE
// ==========================================

function navegarPara(sectionId) {
    // 1. Identifica as seções
    const secoes = [
        'resumo-geral', 'sobre-nisp', 'painel-municipio', 
        'painel-cursos', 'painel-busca-alunos', 'gestao-usuarios', 'perfil-pessoal' 
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
        
        if (sectionId === 'painel-municipio') {
            carregarDadosMunicipio("Abaíra");
        }
        if (sectionId === 'painel-cursos' && typeof popularPainelEdicoes === 'function') {
            popularPainelEdicoes();
        }

        if (sectionId === 'painel-busca-alunos') {
            prepararListaGlobalAlunos();
        }
    }

    const menu = document.getElementById('menu-navegacao');
    if (menu && menu.classList.contains('ativo')) {
        menu.classList.remove('ativo');
    }

    console.log(`Navegou para: ${sectionId}`);
}

function irParaMunicipio(id) {
    const select = document.getElementById('municipio-select');
    if (select) {
        navegarPara('painel-municipio'); // Garante que a seção de municípios esteja visível
        select.value = id;
        carregarDadosMunicipio(id);
        document.getElementById('painel-municipio').scrollIntoView({ behavior: 'smooth' });
    }
}

function toggleMenuMobile() {
    const menu = document.getElementById('menu-navegacao');
    menu.classList.toggle('ativo');
}

// ==========================================
// 5. RENDERIZAÇÃO DO DOM (HTML)
// ==========================================

function popularSelectMunicipios(municipios) {
    const select = document.getElementById('municipio-select');
    if (!select) return;
    
    // Evita duplicar opções caso a função rode duas vezes
    select.innerHTML = '<option value="">Selecione um município...</option>'; 
    
    municipios.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(mun => {
        const option = document.createElement('option');
        option.value = mun.id;
        option.textContent = mun.nome;
        select.appendChild(option);
    });
}

async function carregarDadosMunicipio(municipioId) {
    const mun = loadedData[municipioId];
    if (!mun) return;

    try {
        // Atualiza Informações do Município
        document.getElementById('nome-mun').textContent = mun.nome;
        document.getElementById('territorio-mun').textContent = mun.territorio || '-';
        document.getElementById('populacao').textContent = mun.populacao || '-';
        document.getElementById('prefeito').textContent = mun.prefeito || '-';
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

        //Cores do Status do Curso ---
        const statusTexto = (curso.status || 'N/A').trim().toUpperCase();
        let corFundoStatus = '#6c757d'; // Cinza padrão para status desconhecidos
        let corTextoStatus = '#ffffff'; // Texto branco padrão

        if (statusTexto === 'ATENDIDO') {
            corFundoStatus = '#1361af'; // Azul
        } else if (statusTexto === 'EM ANDAMENTO') {
            corFundoStatus = '#ffc107'; // Amarelo
            corTextoStatus = '#000000'; // Texto preto para garantir boa leitura no fundo amarelo
        } else if (statusTexto === 'NÃO ATENDIDO' || statusTexto === 'NAO ATENDIDO') {
            corFundoStatus = '#dc3545'; // Vermelho
        }
        // ---------------------------------------------

        // Lógica para o badge de convite (ac_convite) corrigida
        let badgeConvite = '-'; 
        if (curso.ac_convite !== null && curso.ac_convite !== undefined && curso.ac_convite !== '') {
            const valorConvite = String(curso.ac_convite).trim().toUpperCase();
            if (valorConvite === 'TRUE' || valorConvite === 'SIM' || valorConvite === '1' || valorConvite === 'T') {
                badgeConvite = '<span style="background:#d4edda; color:#155724; padding:2px 8px; border-radius:10px; font-size:0.75rem;">Aceitou o convite? Sim</span>';
            } else {
                badgeConvite = '<span style="background:#f8d7da; color:#721c24; padding:2px 8px; border-radius:10px; font-size:0.75rem;">Aceitou o convite? Não</span>';
            }
        }
        
        return `
            <div style="border: 1px solid #eee; margin-bottom: 15px; border-radius: 10px; overflow: hidden; font-family: sans-serif; text-align: left; background-color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="background: #fdfdfd; padding: 15px; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <h3 style="margin: 0; color: #333; font-size: 1.1rem; text-transform: uppercase;">${nomeDoCurso}</h3>
                        
                        <span style="font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 5px; background: ${corFundoStatus}; color: ${corTextoStatus};">
                            ${statusTexto}
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

function processarCidadesAtendidas() {
const ul = document.getElementById('cidades-atendidas-ul');
    if (!ul) return;

    // 1. Criar um Set para armazenar IDs únicos de municípios presentes na tabela cursos
    const idsMunicipiosAtendidos = new Set();
    
    Object.values(loadedData).forEach(mun => {
        if (mun.cursos && mun.cursos.length > 0) {
            const temCursoAtendido = mun.cursos.some(curso => curso.status === "Atendido");
                if (temCursoAtendido){
                    idsMunicipiosAtendidos.add(mun.id);
                }
        }
    });

    // 2. Converter IDs em nomes e ordenar
    const nomesCidades = Array.from(idsMunicipiosAtendidos)
        .map(id => loadedData[id].nome)
        .sort();

    // 3. Limpar e popular a UL
    ul.innerHTML = '';

    if (nomesCidades.length === 0) {
        ul.innerHTML = '<li>Nenhuma cidade encontrada.</li>';
        return;
    }

    nomesCidades.forEach(cidade => {
        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.padding = "8px 0";
        li.style.borderBottom = "1px solid #eee";
        li.innerHTML = `
            <i class="fa-solid fa-location-dot" style="color: #1e3c99; margin-right: 10px;"></i>
            <span>${cidade}</span>
        `;
        ul.appendChild(li);
    });
}

// ==========================================
// 6. GRÁFICOS (CHART.JS) E ESTATÍSTICAS
// ==========================================
function atualizarEstatisticasGlobais() {
    const listaMunicipios = Object.values(loadedData);
    const munComGuarda = listaMunicipios.filter(m => m.possui_guarda === true);
    const certsPorEdicao = {};
    const certsPorAnoBruto = {};
    
    munComGuarda.forEach(mun => {
        mun.cursos.forEach(curso => {
            const concluintes = curso.alunos.filter(a => (a.status || '').toLowerCase().includes('conclu')).length;
            if (concluintes === 0) return; 

            // Dados para gráfico de edição
            const idEdicao = `${curso.curso}`;
            certsPorEdicao[idEdicao] = (certsPorEdicao[idEdicao] || 0) + concluintes;

            // Dados para gráfico de anos
            const ano = curso.ano || "S/D";
            certsPorAnoBruto[ano] = (certsPorAnoBruto[ano] || 0) + concluintes;
        });
    });
    
    renderizarBarrasEdicao(certsPorEdicao);

    const certsPorAnoFiltrado = {};
    Object.keys(certsPorAnoBruto).forEach(ano => {
        if (certsPorAnoBruto[ano] > 0) certsPorAnoFiltrado[ano] = certsPorAnoBruto[ano];
    });

    renderizarBarrasAno(certsPorAnoFiltrado);

    // Barra de Progresso
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
    const ctx = document.getElementById('grafico-barras-edicao')?.getContext('2d');
    if (!ctx) return;
    if (chartEdicao) chartEdicao.destroy();
    const edicoes = Object.keys(dados);
    const valores = edicoes.map(e => dados[e]);
    chartEdicao = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: { labels: edicoes, datasets: [{ label: 'Certificações', data: valores, backgroundColor: '#E4AD36', borderRadius: 4 }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', font: { weight: 'bold', size: 14 } } },
            scales: { x: { beginAtZero: true, grace: '20%', ticks: { display: false }, grid: { display: false } }, y: { ticks: { font: { size: 12, weight: 'bold' } }, grid: { display: false } } }
        }
    });
}

function renderizarBarrasAno(dados) {
    const ctx = document.getElementById('grafico-barras-anos')?.getContext('2d');
    if (!ctx) return;
    if (chartBarras) chartBarras.destroy();
    const anos = Object.keys(dados).sort();
    const valores = anos.map(a => dados[a]);
    chartBarras = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: { labels: anos, datasets: [{ label: 'Certificações', data: valores, backgroundColor: '#1e3c99', borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', font: { weight: 'bold', size: 14 } } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grace: '40%' } }
        }
    });
}


// ==========================================
// 7. EVENTOS DE CARREGAMENTO (CONSOLIDADOS)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Checagem de Sessão (Inicia o sistema se logado)
    verificarSessao();

    // 2. Inicialização do Carrossel (Swiper)
    if (typeof Swiper !== 'undefined') {
        new Swiper('.mySwiperNisp', {
            loop: true,
            autoplay: { delay: 4000, disableOnInteraction: false },
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        });
    }

    // 3. Listeners de Interface
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

// ==========================================
// 8. TIMER DE INATIVIDADE E PERFIL
// ==========================================

let timerInatividade;
const TEMPO_LIMITE_MS = 30 * 60 * 1000; // 30 minutos

function resetarTimer() {
    clearTimeout(timerInatividade);
    timerInatividade = setTimeout(async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            console.log("Sua sessão expirou devido a 30 minutos de inatividade. Por segurança, faça o login novamente.");
            realizarLogout();
        }
    }, TEMPO_LIMITE_MS);
}

// Escuta os movimentos do mouse e teclado na tela inteira
['mousemove', 'keydown', 'scroll', 'click'].forEach(evento => {
    document.addEventListener(evento, resetarTimer);
});

async function carregarDadosPerfil() {
    const perfil = await apiNISP.buscarMeuPerfil();
    if (perfil && perfil.nome) {
        document.getElementById('nome-usuario-logado').textContent = perfil.nome;
    }
}

async function alterarMinhaSenha() {
    const senha1 = document.getElementById('nova-senha-input').value;
    const senha2 = document.getElementById('confirma-senha-input').value;
    const msg = document.getElementById('msg-perfil');
    
    if (senha1.length < 6) {
        msg.textContent = "A senha deve ter no mínimo 6 caracteres."; msg.style.color = "red"; return;
    }
    if (senha1 !== senha2) {
        msg.textContent = "As senhas não coincidem. Digite novamente."; msg.style.color = "red"; return;
    }

    try {
        msg.textContent = "Atualizando..."; msg.style.color = "#1e3c99";
        await apiNISP.mudarMinhaSenha(senha1);
        msg.textContent = "Senha atualizada com sucesso!"; msg.style.color = "green";
        document.getElementById('nova-senha-input').value = "";
        document.getElementById('confirma-senha-input').value = "";
    } catch (error) {
        msg.textContent = "Erro ao atualizar: " + error.message; msg.style.color = "red";
    }
}

// ==========================================
// 9. GESTÃO DE USUÁRIOS (ADMIN)
// ==========================================

async function carregarListaDeUsuarios() {
    const corpoTabela = document.getElementById('tabela-corpo-usuarios');
    if (!corpoTabela) return;

    try {
        const usuarios = await apiNISP.listarUsuarios();
        corpoTabela.innerHTML = usuarios.map(u => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${u.nome || '-'}</td>
                <td style="padding: 12px;">${u.email}</td>
                <td style="padding: 12px;"><span style="background: ${u.role === 'admin' ? '#1e3c99' : '#6c757d'}; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem;">${u.role.toUpperCase()}</span></td>
                <td style="padding: 12px; text-align: center;">
                    <button onclick="abrirModalEditar('${u.id}', '${u.nome}', '${u.role}')" style="background: #e68f1d; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button onclick="deletarUsuario('${u.id}', '${u.nome}')" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i> Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        corpoTabela.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">Erro ao carregar usuários.</td></tr>`;
    }
}

function abrirModalUsuario() { document.getElementById('modal-novo-usuario').style.display = 'flex'; }
function fecharModalUsuario() { document.getElementById('modal-novo-usuario').style.display = 'none'; }

async function salvarNovoUsuario() {
    const nome = document.getElementById('novo-nome').value;
    const email = document.getElementById('novo-email').value;
    const senha = document.getElementById('novo-senha').value;
    const role = document.getElementById('novo-role').value;

    if (!nome || !email || !senha) return alert("Preencha todos os campos!");

    try {
        await apiNISP.gerenciarUsuario('create', { nome, email, password: senha, role });
        alert("Usuário criado com sucesso!");
        fecharModalUsuario();
        document.getElementById('novo-nome').value = ''; document.getElementById('novo-email').value = ''; document.getElementById('novo-senha').value = '';
        carregarListaDeUsuarios();
    } catch (error) { alert("Erro ao criar usuário: " + error.message); }
}

// Ações de Edição
function abrirModalEditar(id, nome, role) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-nome').value = nome;
    document.getElementById('edit-role').value = role;
    document.getElementById('modal-editar-usuario').style.display = 'flex';
}
function fecharModalEditar() { document.getElementById('modal-editar-usuario').style.display = 'none'; }

async function confirmarEdicaoUsuario() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value;
    const role = document.getElementById('edit-role').value;

    try {
        await apiNISP.gerenciarUsuario('update', { userId: id, nome, role });
        alert("Usuário atualizado com sucesso!");
        fecharModalEditar();
        carregarListaDeUsuarios();
    } catch (error) { alert("Erro ao atualizar: " + error.message); }
}

// Ação de Excluir
async function deletarUsuario(id, nome) {
    if (confirm(`Atenção! Você tem certeza que deseja EXCLUIR definitivamente o acesso do usuário ${nome}?`)) {
        try {
            await apiNISP.gerenciarUsuario('delete', { userId: id });
            alert("Usuário excluído com sucesso.");
            carregarListaDeUsuarios();
        } catch (error) { alert("Erro ao excluir: " + error.message); }
    }
}