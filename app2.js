const SUPABASE_URL = 'https://vwrpcilvurjroigbaoxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cnBjaWx2dXJqcm9pZ2Jhb3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM4NTYsImV4cCI6MjA4NTE3OTg1Nn0.sFOB6HQf1yKPeT3xcsG3rhgIn9exJER4yaGkfyRjWSo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
            document.getElementById('possui-guarda').innerHTML = municipio.possui_guarda ? '<i class="fa-regular fa-circle-check"></i>Sim' : '<i class="fa-regular fa-circle-xmark"></i>Não'; 
            document.getElementById('guarda-armada').innerHTML = municipio.guarda_armada ? '<i class="fa-regular fa-circle-check"></i>Sim' : '<i class="fa-regular fa-circle-xmark"></i>Não';
            document.getElementById


document.addEventListener('DOMContentLoaded', carregarListaMunicipios);