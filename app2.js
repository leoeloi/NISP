const SUPABASE_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnBjaWx2dXJqcm9pZ2Jhb3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM4NTYsImV4cCI6MjA4NTE3OTg1Nn0.sFOB6HQf1yKPeT3xcsG3rhgIn9exJER4yaGkfyRjWSo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


async function init() {
    try {
        const { data: municipios, error } = await supabaseClient
            .from('municipios')
            .select('*')
            .order('nome', { ascending: true });
        if (error) throw error;
        console.log('Dados carregados:', municipios);
    } catch (error) {
        console.error('Erro ao carregar dados:', error.message);
    }

    try {
        const {data: cursos, error} = await supabaseClient
            .from('cursos')
            .select('*')
            .order('id', { ascending: false });
        if (error) throw error;
        console.log('Cursos carregados:', cursos);
    } catch (error) {
        console.error('Erro ao carregar cursos:', error.message);
    }

        try {
        const {data: alunos, error} = await supabaseClient
            .from('alunos')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;
        console.log('Alunos carregados:', alunos);
    } catch (error) {
        console.error('Erro ao carregar alunos:', error.message);
    }

    loadedData

     const { alunosConcluintes, error } = await supabaseClient
        .from('alunos')
        .select('nome')
        .eq('municipio', municipioDoSeletor)
        .eq('status', true);

        const totalUnicos = new Set(alunosConcluintes.map(item => item.nome)).size;
        document.getElementById('alunos-unicos').textContent = totalUnicos;

}

async function carregarListaMunicipios() {
    try {
        const { data: municipios, error } = await supabaseClient
            .from('municipios')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;

        const municipioSelect = document.getElementById('municipio-select');

        if (municipios) {
            municipioSelect.innerHTML = '<option value="">Selecione um município</option>';
            municipios.forEach(municipio => {
                const option = document.createElement('option');
                option.value = municipio.id;
                option.textContent = municipio.nome;
                municipioSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar municípios:', error.message);
    }
}



async function carregarDadosMunicipio(municipioId) {
    try {
        const { data: municipio, error } = await supabaseClient
            .from('municipios')
            .select('*')
            .eq('id', municipioId)
            .single();
        if (error) throw error;
        if (municipio) {
            document.getElementById('nome-mun').textContent = municipio.nome;
            const PossuiGuarda = document.getElementById('possui-guarda');
            if (municipio.possui_guarda) {
                PossuiGuarda.innerHTML = '<i class="fa-regular fa-circle-check"></i> Sim';
                PossuiGuarda.style.color = 'green';
                PossuiGuarda.style.backgroundColor = 'lightgreen';

            } else {
                PossuiGuarda.innerHTML = '<i class="fa-regular fa-circle-xmark"></i> Não';
                PossuiGuarda.style.color = 'white';
                PossuiGuarda.style.backgroundColor = 'lightcoral';
            }

            const GuardaArmada = document.getElementById('guarda-armada');
            if (municipio.guarda_armada) {
                GuardaArmada.innerHTML = '<i class="fa-regular fa-circle-check"></i> Sim';
                GuardaArmada.style.color = 'green';
                GuardaArmada.style.backgroundColor = 'lightgreen';
            } else {
                GuardaArmada.innerHTML = '<i class="fa-regular fa-circle-xmark"></i> Não';
                GuardaArmada.style.color = 'white';
                GuardaArmada.style.backgroundColor = 'lightcoral';
            }
            document.getElementById('territorio-mun').textContent = municipio.territorio;
            if (municipio.efetivo === null || municipio.efetivo === undefined) {
                document.getElementById('info-efetivo').style.display = 'none';
            } else {
                document.getElementById('info-efetivo').style.display = 'flex';
                document.getElementById('efetivo').textContent = municipio.efetivo;
            }
            document.getElementById('populacao').textContent = municipio.populacao;
            document.getElementById('prefeito').textContent = municipio.prefeito;
            document.getElementById('email-pref').textContent = municipio.email_pref;
            document.getElementById('tel-pref').textContent = municipio.telefone_pref;
            document.getElementById('chefe-guarda').textContent = municipio.chefe_gm;
            document.getElementById('email-gm').textContent = municipio.email_gm;
            document.getElementById('tel-gm').textContent = municipio.telefone_gm;
            document.getElementById('observacoes').textContent = municipio.obs_mun || 'Nenhuma observação registrada.';
        }
    } catch (error) {
        console.error('Erro ao carregar dados do município:', error.message);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    carregarListaMunicipios();

    const municipioSelect = document.getElementById('municipio-select');
    
    if (municipioSelect) {
        municipioSelect.addEventListener('change', (event) => {
            const municipioId = event.target.value;
            if (municipioId) {
                carregarDadosMunicipio(municipioId);
                carregarDados(municipioId);
            }
        });
    } else {
        console.error("Erro: Elemento 'municipio-select' não foi encontrado no HTML.");
    }
});