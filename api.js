// api.js
const SUPABASE_FUNCTIONS_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co/functions/v1';

// Função auxiliar para chamar as Edge Functions
async function callFunction(functionName, body, requireAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (requireAuth) {
    const token = localStorage.getItem('supabase_token');
    if (!token) throw new Error('Token não encontrado');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data;
}

export const apiNISP = {
  // Autenticação
  async login(email, senha) {
    const data = await callFunction('auth-login', { email, password: senha }, false);
    if (data.session?.access_token) {
      localStorage.setItem('supabase_token', data.session.access_token);
      localStorage.setItem('supabase_refresh_token', data.session.refresh_token);
    }
    return { user: data.user, role: data.role };
  },

  async logout() {
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_refresh_token');
    // Opcional: chamar uma função de logout no servidor
  },

  // Sessão
  async getSession() {
    const token = localStorage.getItem('supabase_token');
    if (!token) return { user: null };
    try {
      return await callFunction('get-session', {}, true);
    } catch {
      return { user: null };
    }
  },

  // Perfil
  async buscarMeuPerfil() {
    return await callFunction('get-meu-perfil', {});
  },

  async mudarMinhaSenha(novaSenha) {
    return await callFunction('mudar-senha', { novaSenha });
  },

  // Dados específicos (usando as funções já existentes)
  async getCidadesAtendidas() {
    return await callFunction('get-cidades-atendidas', {});
  },

  async getEstatisticasGlobais() {
    return await callFunction('get-estatisticas-globais', {});
  },

  async getEdicoes() {
    return await callFunction('get-edicoes', {});
  },

  async getAlunosCompletos() {
    return await callFunction('get-alunos-completos', {});
  },

  async getMunicipioCompleto(id) {
    return await callFunction('get-municipio-completo', { id });
  },

  // Gestão de usuários
  async listarUsuarios() {
    return await callFunction('manage-users', { action: 'list' });
  },

  async gerenciarUsuario(action, payload) {
    return await callFunction('manage-users', { action, ...payload });
  },

  // Método genérico (se ainda precisar)
  async buscarTabela(nomeTabela, filtros = {}) {
    return await callFunction('buscar-tabela', { tabela: nomeTabela, filtros });
  }
};