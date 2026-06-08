const apiNISP = {
    // 1. BUSCA DE DADOS VIA EDGE FUNCTION (Chaves Protegidas)
    async buscarTabela(nomeTabela) {
            const { data, error } = await supabaseClient.from(nomeTabela).select('*');

            if (error) {
                console.error(`Erro ao buscar ${nomeTabela}:`, error);
                throw error;
            }
            return data;
        },

    // 2. AUTENTICAÇÃO E PERMISSÕES
    async login(email, senha) {
        // Faz o login no Supabase Auth
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });
        
        if (error) throw error;

        // Busca o nível de acesso na tabela 'users'
        const { data: userData } = await supabaseClient
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single();

        return { user: data.user, role: userData?.role || 'user' };
    },

    // Executa a saída do sistema
    async logout() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    // Verifica se o usuário atual tem o papel de admin na tabela 'users'
    async verificarAdmin(userId) {
        const { data } = await supabaseClient.from('users').select('role').eq('id', userId).single();
        return data?.role === 'admin';
    },

    // 3. PROCESSAMENTO DE DADOS (Lógica do NISP)
    processarDados(municipios, todosCursos, todosAlunos) {
        let dataMap = {};
        
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

            dataMap[mun.id] = { 
                ...mun, 
                cursos: cursosDoMun,
                totalConcluintes: nomesUnicos.size, 
                totalCertificados: certs 
            };
        });
        
        return dataMap;
    },

    // 4. GESTÃO DE USUARIO E PERFIL

    async mudarMinhaSenha(novaSenha) {
        const { error } = await supabaseClient.auth.updateUser({ password: novaSenha });
        if (error) throw error;
    },

    // Lista todos os usuários cadastrados (Apenas Admins conseguem por causa do RLS)
    async listarUsuarios() {
        const { data, error } = await supabaseClient.from('users').select('*').order('nome');
        if (error) throw error;
        return data;
    },

    // Altera o cargo de um usuário (Admin <-> Usuario)
    async mudarCargoUsuario(userId, novoCargo) {
        const { error } = await supabaseClient.from('users').update({ role: novoCargo }).eq('id', userId);
        if (error) throw error;
    },

    // Chama a nova Edge Function para criar um usuário sem deslogar o Admin
    async criarNovoUsuario(nome, email, senha, role) {
            const { data, error } = await supabaseClient.functions.invoke('manage-users', {
                body: { action: 'create', nome, email, password: senha, role }
            });
            
            if (error) throw error; // Erro de conexão
            
            // Se a função rodou mas devolveu nossa mensagem de erro inteligente:
            if (data && data.error) {
                throw new Error(data.error); 
            }
            
            return data;
    },
    
    async buscarMeuPerfil() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;
        const { data } = await supabaseClient.from('users').select('nome').eq('id', user.id).single();
        return data;
    },

    async mudarMinhaSenha(novaSenha) {
        const { error } = await supabaseClient.auth.updateUser({ password: novaSenha });
        if (error) throw error;
    },

    async listarUsuarios() {
        const { data, error } = await supabaseClient.from('users').select('*').order('nome');
        if (error) throw error;
        return data;
    },

    // A função generalizada que fala com a Edge Function
    async gerenciarUsuario(action, payload) {
        const { data, error } = await supabaseClient.functions.invoke('manage-users', {
            body: { action: action, ...payload }
        });
        
        if (error) throw error; 
        if (data && data.error) throw new Error(data.error); 
        return data;
    },

    async getCidadesAtendidas() {
        const { data, error } = await supabaseClient.functions.invoke('get-cidades-atendidas');
        if (error) throw error;
        return data;
    },

    async getEstatisticasGlobais() {
    const { data, error } = await supabaseClient.functions.invoke('get-estatisticas-globais');
    if (error) throw error;
    return data;
    },

    async getEdicoes() {
    const { data, error } = await supabaseClient.functions.invoke('get-edicoes');
    if (error) throw error;
    return data;
    },

    async getAlunosCompletos() {
    const { data, error } = await supabaseClient.functions.invoke('get-alunos-completos');
    if (error) throw error;
    return data;
    },

async getMunicipioCompleto(id) {
  const { data, error } = await supabaseClient.functions.invoke('get-municipio-completo', {
    body: { id }
  });
  if (error) throw error;
  return data;
}
};