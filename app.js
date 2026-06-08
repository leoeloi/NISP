// 1. CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS
import { apiNISP } from "./api.js";

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
        const municipios = await apiNISP.buscarTabela('municipios');
        popularSelectMunicipios(municipios);
         
        // Carrega estatísticas globais    
        const estatisticas = await apiNISP.getEstatisticasGlobais();
        renderizarEstatisticas(estatisticas); 
        
        // Carrega edições para o painel de cursos
        const edicoes = await apiNISP.getEdicoes();
        renderizarEdicoes(edicoes);

        // Carrega alunos completos para a busca
        const alunos = await apiNISP.getAlunosCompletos();
        listaGlobalAlunos = alunos;
        preencherFiltrosAlunos();
        renderizarTabelaAlunos(alunos);

        // Carrega cidades atendidas
        await processarCidadesAtendidas();

    } catch (err) {
        console.error("Erro crítico no carregamento:", err);
    }
}

// ==========================================
// 3. CONTROLE DE AUTENTICAÇÃO (LOGIN/LOGOUT)
// ==========================================

async function verificarSessao() {
    const { user, role} = await apiNISP.getSession();
    
    if (user) {
        mostrarSistema();
        if (role === 'admin') {
            document.getElementById('gestao-usuarios-link').style.display = 'block';
            carregarListaDeUsuarios();
        }

    } else {
        // Esconde os itens privados do menu
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('area-restrita-menu').style.display = 'none';
        document.getElementById('btn-login-abrir').style.display = 'block';
        navegarPara('inicio');
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
        const msg = error.message.toLowerCase();
        
        erroMsg.textContent = msg.includes('credentials') 
            ? "Credenciais inválidas, tente novamente ou solicite auxilio ao administrador."
            : `Erro ao acessar: ${error.message}`;
    }
}

async function realizarLogout() {
    await apiNISP.logout();
    document.getElementById('area-restrita-menu').style.display = 'none';
    document.getElementById('btn-login-abrir').style.display = 'block';
    
    listaGlobalAlunos = [];
    
    navegarPara('sobre-nisp');
    console.log("Usuário deslogado. Mantendo acesso público.");
}

async function mostrarSistema() {
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

    navegarPara('inicio'); 
}

// ==========================================
// 4. NAVEGAÇÃO E INTERFACE
// ==========================================

function navegarPara(sectionId) {
    const secoes = [
        'inicio', 'resumo-geral', 'sobre-nisp', 'painel-municipio', 
        'painel-cursos', 'painel-busca-alunos', 'gestao-usuarios', 'perfil-pessoal', 'tela-login' 
    ];

    secoes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const secaoAlvo = document.getElementById(sectionId);
    if (secaoAlvo) {
        secaoAlvo.style.display = 'block';
        window.scrollTo(0, 0);
        
        // Força o estado 'todos' e carrega os dados globais ao entrar no dash
        if (sectionId === 'resumo-geral') {
            const select = document.getElementById('municipio-select');
            if (select) select.value = 'todos';
            carregarEstatisticasTodosMunicipios();
        }
        
        if (sectionId === 'painel-municipio') {
            const select = document.getElementById('municipio-select');
            if (select && select.value) {
                if (select.value === 'todos') {
                    carregarEstatisticasTodosMunicipios();
                } else {
                    carregarDadosMunicipio(select.value);
                }
            }
        }
        if (sectionId === 'painel-cursos' && typeof popularPainelEdicoes === 'function') {
            popularPainelEdicoes();
        }
        if (sectionId === 'painel-busca-alunos') {
            // Caso precise de preparações adicionais
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
        // 1. Atualiza o valor do select PRIMEIRO
        select.value = id; 
        
        // 2. Chama a navegação (que agora vai ler o ID correto e carregar os dados certos)
        navegarPara('painel-municipio'); 
        
        // 3. Rola a tela para o topo do painel
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
    
    // Verificação de segurança: checa se realmente recebemos uma lista
    if (!Array.isArray(municipios)) {
        console.error("Erro ao carregar municípios para o select. Resposta da API:", municipios);
        select.innerHTML = '<option value="todos">Erro ao carregar</option>';
        return;
    }
    
    // Define a opção padrão como "Todos"
    select.innerHTML = '<option value="todos" selected>Todos os Municípios</option>'; 
    
    // Ordena alfabeticamente e cria as opções
    municipios.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(mun => {
        const option = document.createElement('option');
        option.value = mun.id;
        option.textContent = mun.nome;
        select.appendChild(option);
    });
}


async function carregarEstatisticasTodosMunicipios() {
    document.getElementById('nome-mun').textContent = "Todos os Municípios";
    document.getElementById('territorio-mun').textContent = "Estado da Bahia";

    // Mostra o quadro de Efetivo (que estava escondido na versão anterior)
    const infoEfetivoEl = document.getElementById('info-efetivo');
    if(infoEfetivoEl) infoEfetivoEl.style.display = 'flex';
    
    // ESCONDE o quadro de Contatos (não faz sentido ter contatos do Estado inteiro aqui)
    const contatoMunEl = document.querySelector('.contato-mun');
    if(contatoMunEl) contatoMunEl.style.display = 'none';

    document.getElementById('observacoes').textContent = "Visualizando dados consolidados de todos os municípios do Estado da Bahia.";

    try {
        const estatisticas = await apiNISP.getEstatisticasGlobais();
        
        // Aplica a formatação de números grandes (ex: 15.000.000)
        document.getElementById('populacao').textContent = estatisticas.somaPopulacao.toLocaleString('pt-BR');
        document.getElementById('efetivo').textContent = estatisticas.somaEfetivo.toLocaleString('pt-BR');

        // Atualiza os badges visuais de Guarda com as contagens
        const styleBadge = "color: #1e3c99; background-color: #eef2ff; padding: 4px 10px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;";
        
        const elPossui = document.getElementById('possui-guarda');
        if (elPossui) { 
            elPossui.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${estatisticas.totalMunicipiosComGuarda} Municípios`; 
            elPossui.style.cssText = styleBadge; 
        }
        
        const elArmada = document.getElementById('guarda-armada');
        if (elArmada) { 
            elArmada.innerHTML = `<i class="fa-solid fa-gun"></i> ${estatisticas.totalGuardaArmada} Municípios`; 
            elArmada.style.cssText = styleBadge; 
        }

        // Estatísticas da barra inferior
        let totalCertificacoes = 0;
        if (estatisticas.certsPorAno) {
            totalCertificacoes = Object.values(estatisticas.certsPorAno).reduce((acc, curr) => acc + curr, 0);
        }

        document.getElementById('certificacoes').textContent = totalCertificacoes;
        document.getElementById('alunos-unicos').textContent = estatisticas.totalAlunosUnicos;
        document.getElementById('cobertura').textContent = `${estatisticas.coberturaEfetivo}%`;

        // Limpa a lista de cursos detalhados e avisa o usuário
        const container = document.getElementById('lista-cursos-container');
        if (container) {
            container.innerHTML = `
                <div style="background: white; padding: 30px; text-align: center; border-radius: 8px; border: 1px dashed #ccc; color: #666;">
                    <i class="fa-solid fa-map-location-dot" style="font-size: 2rem; color: #1e3c99; margin-bottom: 10px;"></i>
                    <p style="margin: 0; font-size: 1.1rem;">Selecione um município específico no menu acima para ver o detalhamento dos cursos e a lista nominal de alunos.</p>
                </div>`;
        }
    } catch (error) {
        console.error("Erro ao processar visão geral:", error);
    }
}

async function carregarDadosMunicipio(municipioId) {
    if (!municipioId || municipioId === 'todos') return; 

    try {
        // MOSTRA novamente o quadro de contatos (se estivesse escondido pela visão global)
        const contatoMunEl = document.querySelector('.contato-mun');
        if (contatoMunEl) contatoMunEl.style.display = 'block';

        const mun = await apiNISP.getMunicipioCompleto(municipioId);
        
        if (!mun || mun.error) {
            console.error("Município não encontrado ou erro na API");
            return;
        }

        document.getElementById('nome-mun').textContent = mun.nome;
        document.getElementById('territorio-mun').textContent = mun.territorio || '-';
        document.getElementById('populacao').textContent = mun.populacao ? parseInt(mun.populacao).toLocaleString('pt-BR') : '-';
        document.getElementById('prefeito').textContent = mun.prefeito || '-';
        document.getElementById('email-pref').textContent = mun.email_pref || '-';
        document.getElementById('tel-pref').textContent = mun.telefone_pref || '-';
        document.getElementById('chefe-guarda').textContent = mun.chefe_gm || '-';
        document.getElementById('email-gm').textContent = mun.email_gm || '-';
        document.getElementById('tel-gm').textContent = mun.telefone_gm || '-';
        
        document.getElementById('observacoes').textContent = mun.obs_mun || 'Nenhuma observação.';

        // ---------------------------------------------------------
        // Consome as estatísticas diretamente do Backend!
        // ---------------------------------------------------------
        const stats = mun.estatisticas || { totalCertificados: 0, totalConcluintes: 0, cobertura: "0.0" };
        
        const efetivo = parseInt(mun.efetivo) || 0;
        const infoEfetivoEl = document.getElementById('info-efetivo');

        if (efetivo > 0) {
            if (infoEfetivoEl) infoEfetivoEl.style.display = 'flex';
            document.getElementById('efetivo').textContent = efetivo.toLocaleString('pt-BR');
            document.getElementById('cobertura').textContent = `${stats.cobertura}%`;
        } else {
            if (infoEfetivoEl) infoEfetivoEl.style.display = 'none';
            document.getElementById('cobertura').textContent = '0.0%';
        }

        document.getElementById('certificacoes').textContent = stats.totalCertificados;
        document.getElementById('alunos-unicos').textContent = stats.totalConcluintes;

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
        console.error("Erro ao carregar município:", err);
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

        const statusTexto = (curso.status || 'N/A').trim().toUpperCase();
        let corFundoStatus = '#6c757d'; 
        let corTextoStatus = '#ffffff'; 

        if (statusTexto === 'ATENDIDO') {
            corFundoStatus = '#1361af'; 
        } else if (statusTexto === 'EM ANDAMENTO') {
            corFundoStatus = '#ffc107'; 
            corTextoStatus = '#000000'; 
        } else if (statusTexto === 'NÃO ATENDIDO' || statusTexto === 'NAO ATENDIDO') {
            corFundoStatus = '#dc3545'; 
        }

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

function renderizarEdicoes(edicoes) {
    const container = document.getElementById('lista-cursos-edicoes');
    if (!container) return;

    // 1. Ordenação cronológica decrescente (mais recentes no topo)
    const edicoesOrdenadas = [...edicoes].sort((a, b) => {
        const getAnoMes = (str) => {
            const match = (str || '').match(/(\d{2})\/(\d{4})/);
            return match ? match[2] + match[1] : "000000";
        };
        return getAnoMes(b.nome).localeCompare(getAnoMes(a.nome)); 
    });

    // 2. Renderização usando a lista ordenada
    container.innerHTML = edicoesOrdenadas.map(edicao => {
        let totalAtendidos = 0;
        let totalNaoAtendidos = 0;
        let totalConcluintes = 0;

        if (edicao.municipios && Array.isArray(edicao.municipios)) {
            edicao.municipios.forEach(m => {
                const statusMun = (m.status || '').trim().toUpperCase();
                if (statusMun === 'ATENDIDO') totalAtendidos++;
                else if (statusMun === 'NÃO ATENDIDO' || statusMun === 'NAO ATENDIDO') totalNaoAtendidos++;
                
                totalConcluintes += parseInt(m.concluintes || 0); 
            });
        }

        return `
            <details class="card-edicao-expansivel">
                <summary class="header-edicao-clicavel" style="flex-wrap: wrap; gap: 15px;">
                    <div class="info-titulo" style="flex: 1; min-width: 250px;">
                        <i class="fa-solid fa-chevron-right seta-expansao"></i>
                        <h3>${edicao.nome}</h3> </div>
                    
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        <span class="badge-contador" style="background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1;" title="Total de Municípios Envolvidos">
                            ${edicao.municipios.length} Municípios
                        </span>
                        <span class="badge-contador" style="background: #cce5ff; color: #004085; border: 1px solid #b8daff;" title="Municípios Atendidos">
                            Atendidos: ${totalAtendidos}
                        </span>
                        <span class="badge-contador" style="background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;" title="Municípios Não Atendidos">
                            Não Atendidos: ${totalNaoAtendidos}
                        </span>
                        <span class="badge-contador" style="background: #d4edda; color: #155724; border: 1px solid #c3e6cb;" title="Total de Alunos Concluintes">
                            Concluintes: ${totalConcluintes}
                        </span>
                    </div>
                </summary>
                
                <div class="grid-municipios-participantes">
                    ${edicao.municipios.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => {
                        const qtdConcluintes = m.concluintes !== undefined ? parseInt(m.concluintes) : 0;
                        const temConcluinte = qtdConcluintes > 0;
                        
                        const bgBadge = temConcluinte ? '#d4edda' : '#f8d7da';
                        const corTexto = temConcluinte ? '#155724' : '#721c24';
                        const borderBadge = temConcluinte ? '#c3e6cb' : '#f5c6cb';
                        const icone = temConcluinte ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';

                        return `
                        <div class="item-municipio-link cursor-pointer" data-id="${m.id}">
                            <span style="color: #444; font-weight: 500;">${m.nome}</span>
                            <span class="contador-alunos-mun" title="${temConcluinte ? 'Concluintes' : 'Nenhum concluinte'}" 
                                style="background: ${bgBadge}; color: ${corTexto}; border: 1px solid ${borderBadge}; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">
                                ${qtdConcluintes} ${icone}
                            </span>
                        </div>
                        `;
                    }).join('')}
                </div>
            </details>
        `;
    }).join('');
}



function renderizarTabelaAlunos(dados) {
    const corpoTabela = document.getElementById('tabela-corpo-alunos');
    if (!corpoTabela) return;

    // Atualiza o contador dinamicamente
    const elContador = document.getElementById('contador-resultados-alunos');
    if (elContador) {
        elContador.textContent = `${dados.length} ${dados.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}`;
    }

    if (dados.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center;">Nenhum aluno encontrado.</td></tr>';
        return;
    }

    corpoTabela.innerHTML = dados.map(aluno => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px;">${aluno.nome}</td>
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

async function processarCidadesAtendidas() {
    const ul = document.getElementById('cidades-atendidas-ul');
    if (!ul) return;

    try {
        const cidades = await apiNISP.getCidadesAtendidas(); 
        ul.innerHTML = ''; 

        if (cidades.length === 0) {
            ul.innerHTML = '<li>Nenhuma cidade encontrada.</li>';
            return;
        }

        cidades.forEach(cidade => {
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
    } catch (error) {
        console.error('Erro ao carregar cidades atendidas:', error);
        ul.innerHTML = '<li>Erro ao carregar.</li>';
    }
}

function preencherFiltrosAlunos() {
    const munSet = new Set(), edSet = new Set(), statusSet = new Set();
    
    listaGlobalAlunos.forEach(a => {
        if (a.nomeMunicipio) munSet.add(a.nomeMunicipio);
        if (a.nomeEdicao) edSet.add(a.nomeEdicao);
        if (a.status) statusSet.add(a.status);
    });

    const preencherSelect = (id, set, label) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">${label}</option>` + 
            [...set].sort().map(val => `<option value="${val}">${val}</option>`).join('');
    };

    preencherSelect('filtro-municipio', munSet, 'Todos os Municípios');
    preencherSelect('filtro-edicao', edSet, 'Todas as Edições');
    preencherSelect('filtro-status', statusSet, 'Todos os Status');
}

function aplicarFiltrosAlunos() {
    const termo = (document.getElementById('filtro-nome-cpf')?.value || '').toLowerCase().trim();
    const mun = document.getElementById('filtro-municipio')?.value || '';
    const ed = document.getElementById('filtro-edicao')?.value || '';
    const st = document.getElementById('filtro-status')?.value || '';
    const aptos = document.getElementById('filtro-aptos-avancado')?.checked;

    let filtrados = listaGlobalAlunos;

    // Lógica Exclusiva: Aptos ao Avançado
    if (aptos) {
        const historico = {};
        
        // 1. Mapeia o histórico de cada aluno usando CPF ou Nome
        listaGlobalAlunos.forEach(a => {
            const chave = a.cpf || a.nome;
            if (!historico[chave]) historico[chave] = { temBasico: false, temAvancado: false };
            
            const isConcluido = (a.status || '').toLowerCase().includes('conclu');
            // Remove acentos para evitar falhas por digitação divergente no banco
            const nomeEd = (a.nomeEdicao || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            if (isConcluido && nomeEd.includes('BASICO')) historico[chave].temBasico = true;
            if (isConcluido && nomeEd.includes('AVANCADO')) historico[chave].temAvancado = true;
        });

        // 2. Retém na lista apenas as chaves que possuem Básico, mas não possuem Avançado
        filtrados = filtrados.filter(a => {
            const chave = a.cpf || a.nome;
            return historico[chave].temBasico && !historico[chave].temAvancado;
        });
    }

    // Filtros Textuais e Dropdowns
    if (termo) filtrados = filtrados.filter(a => (a.nome || '').toLowerCase().includes(termo) || (a.cpf || '').toLowerCase().includes(termo));
    if (mun) filtrados = filtrados.filter(a => a.nomeMunicipio === mun);
    if (ed) filtrados = filtrados.filter(a => a.nomeEdicao === ed);
    if (st) filtrados = filtrados.filter(a => a.status === st);

    renderizarTabelaAlunos(filtrados);
}

// ==========================================
// 6. GRÁFICOS (CHART.JS) E ESTATÍSTICAS
// ==========================================

function renderizarEstatisticas(estatisticas) {
    renderizarBarrasEdicao(estatisticas.certsPorEdicao);
    renderizarBarrasAno(estatisticas.certsPorAno);

    const elementoBarra = document.getElementById('barra-preenchimento');
    if (elementoBarra) {
        elementoBarra.style.width = `${estatisticas.percGeral}%`;
        document.getElementById('texto-progresso-percentual').textContent = `${estatisticas.percGeral}%`;
        document.getElementById('atendidos-count').textContent = estatisticas.atendidos;
        document.getElementById('total-gcm-count').textContent = estatisticas.totalMunicipiosComGuarda;
    }

    // Renderiza os dados globais diretamente no painel do dashboard
    let totalCertificacoes = estatisticas.certsPorAno ? Object.values(estatisticas.certsPorAno).reduce((a, b) => a + b, 0) : 0;
    document.getElementById('dash-certificacoes').textContent = totalCertificacoes;
    document.getElementById('dash-alunos-unicos').textContent = estatisticas.totalAlunosUnicos;
    document.getElementById('dash-cobertura').textContent = `${estatisticas.coberturaEfetivo}%`;
}

function renderizarBarrasEdicao(dados) {
    const ctx = document.getElementById('grafico-barras-edicao')?.getContext('2d');
    if (!ctx) return;
    if (chartEdicao) chartEdicao.destroy();
    
    // Extrai o MM/YYYY usando Regex, inverte para YYYYMM e ordena cronologicamente
    const edicoes = Object.keys(dados).sort((a, b) => {
        const getAnoMes = (str) => {
            const match = str.match(/(\d{2})\/(\d{4})/);
            return match ? match[2] + match[1] : "000000";
        };
        return getAnoMes(a).localeCompare(getAnoMes(b));
    });

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
    // 1. Checagem de Sessão
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

    // 3. Bind dos Eventos Estáticos da Interface
    
    // Login & Logout
    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        realizarLogin();
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', realizarLogout);

    const btnLoginAbrir = document.getElementById('btn-login-abrir');
    if (btnLoginAbrir) btnLoginAbrir.addEventListener('click', () => {
        document.getElementById('tela-login').style.display = 'flex';
    });

    // Menu e Navegação
    const btnMenuMobile = document.getElementById('btn-menu-mobile');
    if (btnMenuMobile) btnMenuMobile.addEventListener('click', toggleMenuMobile);

    const linksNavegacao = document.querySelectorAll('.link-navegacao');
    linksNavegacao.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const alvo = link.getAttribute('data-alvo');
            if (alvo) navegarPara(alvo);
        });
    });


    // Inputs e Selects
    const select = document.getElementById('municipio-select');
    if (select) {
        select.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id === 'todos') {
                carregarEstatisticasTodosMunicipios();
            } else if (id) {
                carregarDadosMunicipio(id);
            }
        });
    }

    // Filtros da Tabela de Alunos
    ['filtro-nome-cpf', 'filtro-municipio', 'filtro-edicao', 'filtro-status'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', aplicarFiltrosAlunos);
    });
    document.getElementById('filtro-aptos-avancado')?.addEventListener('change', aplicarFiltrosAlunos);

    // Perfil Pessoal
    const btnAlterarSenha = document.getElementById('btn-alterar-senha');
    if (btnAlterarSenha) btnAlterarSenha.addEventListener('click', alterarMinhaSenha);

    // Gestão de Usuários (Modais e Ações)
    const btnAbrirModalUser = document.getElementById('btn-abrir-modal-usuario');
    if (btnAbrirModalUser) btnAbrirModalUser.addEventListener('click', abrirModalUsuario);

    const btnFecharModalUser = document.getElementById('btn-fechar-modal-usuario');
    if (btnFecharModalUser) btnFecharModalUser.addEventListener('click', fecharModalUsuario);

    const btnSalvarNovoUser = document.getElementById('btn-salvar-novo-usuario');
    if (btnSalvarNovoUser) btnSalvarNovoUser.addEventListener('click', salvarNovoUsuario);

    const btnFecharModalEditar = document.getElementById('btn-fechar-modal-editar');
    if (btnFecharModalEditar) btnFecharModalEditar.addEventListener('click', fecharModalEditar);

    const btnConfirmarEdicaoUser = document.getElementById('btn-confirmar-edicao-usuario');
    if (btnConfirmarEdicaoUser) btnConfirmarEdicaoUser.addEventListener('click', confirmarEdicaoUsuario);

    // 4. Delegação de Eventos para Elementos Gerados Dinamicamente
    
    // Tabela de Usuários (Botões Editar e Excluir)
    const tabelaUsuarios = document.getElementById('tabela-corpo-usuarios');
    if (tabelaUsuarios) {
        tabelaUsuarios.addEventListener('click', (event) => {
            const btnEditar = event.target.closest('.btn-editar-usuario');
            if (btnEditar) {
                abrirModalEditar(
                    btnEditar.getAttribute('data-id'),
                    btnEditar.getAttribute('data-nome'),
                    btnEditar.getAttribute('data-role')
                );
                return;
            }

            const btnExcluir = event.target.closest('.btn-excluir-usuario');
            if (btnExcluir) {
                deletarUsuario(
                    btnExcluir.getAttribute('data-id'),
                    btnExcluir.getAttribute('data-nome')
                );
            }
        });
    }

    // Painel de Edições (Cliques nos municípios dentro dos cards)
    const listaCursosEdicoes = document.getElementById('lista-cursos-edicoes');
    if (listaCursosEdicoes) {
        listaCursosEdicoes.addEventListener('click', (event) => {
            const itemMunicipio = event.target.closest('.item-municipio-link');
            if (itemMunicipio) {
                const id = itemMunicipio.getAttribute('data-id');
                if (id) irParaMunicipio(id);
            }
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
    const { user } = await apiNISP.getSession();
    if (user) {
      console.log("Sessão expirada por inatividade.");
      realizarLogout();
    }
  }, TEMPO_LIMITE_MS);
}

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
    msg.textContent = "";
    
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
                    <button class="btn-editar-usuario" data-id="${u.id}" data-nome="${u.nome}" data-role="${u.role}" style="background: #dba052; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button class="btn-excluir-usuario" data-id="${u.id}" data-nome="${u.nome}" style="background: #e76d79; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i> Excluir</button>
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

function abrirModalEditar(id, nome, role) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-nome').value = nome;
    document.getElementById('edit-role').value = role;
    document.getElementById('edit-senha').value = '';
    document.getElementById('modal-editar-usuario').style.display = 'flex';
}
function fecharModalEditar() { document.getElementById('modal-editar-usuario').style.display = 'none'; }

async function confirmarEdicaoUsuario() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value;
    const role = document.getElementById('edit-role').value;
    const novaSenha = document.getElementById('edit-senha').value;

    const payload = { userId: id, nome, role };
    if (novaSenha && novaSenha.length >= 6) {
        payload.password = novaSenha;
    } else if (novaSenha && novaSenha.length > 0) {
        alert("A nova senha deve ter pelo menos 6 caracteres.");
        return;
    }

    try {
        await apiNISP.gerenciarUsuario('update', payload);
        alert("Usuário atualizado com sucesso!");
        fecharModalEditar();
        carregarListaDeUsuarios();
    } catch (error) { alert("Erro ao atualizar: " + error.message); }
    }

async function deletarUsuario(id, nome) {
    if (confirm(`Atenção! Você tem certeza que deseja EXCLUIR definitivamente o acesso do usuário ${nome}?`)) {
        try {
            await apiNISP.gerenciarUsuario('delete', { userId: id });
            alert("Usuário excluído com sucesso.");
            carregarListaDeUsuarios();
        } catch (error) { alert("Erro ao excluir: " + error.message); }
    }
}