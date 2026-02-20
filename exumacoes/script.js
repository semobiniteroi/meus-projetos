// --- CONFIGURAÇÃO E INICIALIZAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs",
    authDomain: "funeraria-niteroi.firebaseapp.com",
    projectId: "funeraria-niteroi",
    storageBucket: "funeraria-niteroi.firebasestorage.app",
    messagingSenderId: "232673521828",
    appId: "1:232673521828:web:f25a77f27ba1924cb77631"
};

let db = null;
let unsubscribe = null;
let equipeUnsubscribe = null;
let logsUnsubscribe = null;
let chartInstances = {};
let dadosEstatisticasExportacao = [];
let usuarioLogado = null; 
let dadosAtendimentoAtual = null;

// VARIÁVEIS GLOBAIS PARA ASSINATURA
let signaturePad = null;
let isDrawing = false;
let assinaturaResponsavelImg = null;
let assinaturaAtendenteImg = null;
let tipoAssinaturaAtual = ''; 

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    }
} catch (e) { console.error("Erro Firebase:", e); }

function getDB() {
    if (!db && typeof firebase !== 'undefined') {
        try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } 
        catch(e) { if(firebase.apps.length) db = firebase.firestore(); }
    }
    return db;
}

// --- UTILITÁRIOS ---
function safeDisplay(id, displayType) { const el = document.getElementById(id); if (el) el.style.display = displayType; }
function pegarDataAtualLocal() { const agora = new Date(); return `${String(agora.getDate()).padStart(2,'0')}/${String(agora.getMonth()+1).padStart(2,'0')}/${agora.getFullYear()}`; }
function formatarDataInversa(dataStr) { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

function pegarDataISO() { 
    const agora = new Date(); 
    return `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`; 
}

// FUNÇÃO PARA GERAR O PROTOCOLO
window.gerarProtocolo = function() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth()+1).padStart(2,'0');
    const dia = String(agora.getDate()).padStart(2,'0');
    return `${ano}${mes}${dia}-${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}`;
}

// --- LÓGICA DA EMISSÃO DE GRM (RETORNO AO IFRAME SEGURO DA PREFEITURA) ---
window.abrirModalGRM = function() { 
    safeDisplay('modal-grm', 'block'); 
}

window.fecharModalGRM = function() { 
    safeDisplay('modal-grm', 'none'); 
}

// --- LÓGICA DE ASSINATURA DIGITAL ---
function setupSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    function getPos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (evt.touches && evt.touches.length > 0) { clientX = evt.touches[0].clientX; clientY = evt.touches[0].clientY; } 
        else { clientX = evt.clientX; clientY = evt.clientY; }
        const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function startDraw(e) { if(e.type === 'touchstart') e.preventDefault(); isDrawing = true; const pos = getPos(canvas, e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
    function draw(e) { if (!isDrawing) return; if(e.type === 'touchmove') e.preventDefault(); const pos = getPos(canvas, e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    function endDraw(e) { if(e.type === 'touchend') e.preventDefault(); isDrawing = false; }

    canvas.removeEventListener('mousedown', startDraw); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', endDraw); canvas.removeEventListener('mouseout', endDraw); canvas.removeEventListener('touchstart', startDraw); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', endDraw);
    canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', endDraw); canvas.addEventListener('mouseout', endDraw); canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touch সম্মেলন', endDraw, { passive: false });
}

window.abrirModalAssinatura = function(tipo) {
    tipoAssinaturaAtual = tipo;
    const titulo = document.getElementById('titulo-assinatura');
    if(titulo) { titulo.innerText = (tipo === 'responsavel') ? 'Assinatura do Requerente' : 'Assinatura da Equipe'; }
    safeDisplay('modal-assinatura', 'flex');
    window.limparAssinatura(); 
    setTimeout(setupSignaturePad, 200); 
}

window.fecharModalAssinatura = function() { safeDisplay('modal-assinatura', 'none'); }
window.limparAssinatura = function() { const canvas = document.getElementById('signature-pad'); if(canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); } }

window.salvarAssinatura = function() {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        const imgData = canvas.toDataURL('image/png');
        const db = getDB();
        
        if (dadosAtendimentoAtual && dadosAtendimentoAtual.id) {
            let updateData = {};
            if (tipoAssinaturaAtual === 'responsavel') {
                assinaturaResponsavelImg = imgData; 
                dadosAtendimentoAtual.assinatura_responsavel = imgData; 
                updateData = { assinatura_responsavel: imgData };
            } else {
                assinaturaAtendenteImg = imgData; 
                dadosAtendimentoAtual.assinatura_atendente = imgData; 
                updateData = { assinatura_atendente: imgData };
            }
            
            db.collection("auditoria").add({ 
                data_log: new Date().toISOString(), 
                usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', 
                acao: "ASSINATURA", 
                detalhe: `Req ID: ${dadosAtendimentoAtual.id} (${tipoAssinaturaAtual})`,
                sistema: "Exumacao" 
            });
            
            db.collection("requerimentos_exumacao").doc(dadosAtendimentoAtual.id).update(updateData).then(() => {
                console.log("Assinatura salva.");
                window.visualizarDocumentos(dadosAtendimentoAtual.id);
            }).catch(err => console.error(err));
        }
        window.fecharModalAssinatura();
    }
}

// --- BUSCAR CEP ---
window.buscarCep = function() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    const campoEnd = document.getElementById('endereco');
    const placeholderOriginal = campoEnd.placeholder;
    campoEnd.placeholder = "Buscando...";

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(res => res.json())
        .then(data => {
            if (!data.erro) {
                document.getElementById('endereco').value = data.logradouro;
                document.getElementById('bairro').value = data.bairro;
                document.getElementById('municipio').value = data.localidade + "/" + data.uf;
                if (data.complemento) { document.getElementById('complemento').value = data.complemento; }
                document.getElementById('numero').focus();
            } else {
                alert("CEP não encontrado.");
                document.getElementById('cep').value = "";
            }
            campoEnd.placeholder = placeholderOriginal;
        })
        .catch(() => {
            console.error("Erro na busca do CEP");
            campoEnd.placeholder = placeholderOriginal;
        });
}

// --- LOGIN ---
window.fazerLogin = function() {
    const u = document.getElementById('login-usuario').value.trim();
    const p = document.getElementById('login-senha').value.trim();
    if (p === "2026" && u === "admin") { usuarioLogado={nome:"Admin", login:"admin"}; window.liberarAcesso(); return; }
    
    const database = getDB();
    if (!database) { alert("Sem conexão com banco."); return; }
    
    database.collection("equipe").where("login", "==", u).where("senha", "==", p).get().then(snap => {
        if (!snap.empty) { usuarioLogado = snap.docs[0].data(); window.liberarAcesso(); } 
        else { document.getElementById('msg-erro-login').style.display = 'block'; }
    });
}

window.checarLoginEnter = function(e) { if(e.key==='Enter') window.fazerLogin(); }

window.liberarAcesso = function() {
    safeDisplay('tela-bloqueio', 'none');
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    document.getElementById('user-display').innerText = usuarioLogado.nome;
    
    const fd = document.getElementById('filtro-data');
    if(fd && !fd.value) fd.value = pegarDataISO();
    
    carregarTabela();
}

window.fazerLogout = function() { sessionStorage.removeItem('usuarioLogado'); window.location.reload(); }

// --- LÓGICA DO ADMIN ---
window.abrirAdmin = function() { safeDisplay('modal-admin', 'block'); window.abrirAba('tab-equipe'); }
window.fecharModalAdmin = function() { safeDisplay('modal-admin', 'none'); }

window.abrirAba = function(id) {
    Array.from(document.getElementsByClassName('tab-pane')).forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const buttons = document.querySelectorAll('.tab-header .tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (id === 'tab-equipe') buttons[0].classList.add('active');
    if (id === 'tab-stats') buttons[1].classList.add('active');
    if (id === 'tab-logs') buttons[2].classList.add('active');

    if(id==='tab-equipe') window.listarEquipe();
    if(id==='tab-logs') window.carregarLogs();
    if(id==='tab-stats') window.carregarEstatisticas('7');
}

window.listarEquipe = function() {
    const database = getDB();
    const ul = document.getElementById('lista-equipe');
    if(!database || !ul) return;
    
    if (equipeUnsubscribe) equipeUnsubscribe();
    equipeUnsubscribe = database.collection("equipe").orderBy("nome").onSnapshot(snap => {
        ul.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            ul.innerHTML += `<li>
                <span style="flex-grow:1;"><b>${u.nome}</b> <span style="color:#888; font-size:11px;">(${u.login})</span></span>
                <div>
                    <button class="btn-icon" onclick="window.editarFuncionario('${doc.id}')" style="margin-right:5px; cursor:pointer;" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="window.excluirFuncionario('${doc.id}')" style="color:red; cursor:pointer;" title="Excluir">🗑️</button>
                </div>
            </li>`;
        });
    });
}

window.adicionarFuncionario = function() {
    const nome = document.getElementById('novo-nome').value;
    const login = document.getElementById('novo-login').value;
    const email = document.getElementById('novo-email').value;
    const senha = document.getElementById('nova-senha').value;
    if(!nome || !login || !senha) { alert("Preencha nome, login e senha."); return; }
    getDB().collection("equipe").add({ nome, login, email, senha }).then(() => {
        alert("Usuário adicionado!");
        document.getElementById('novo-nome').value = ""; document.getElementById('novo-login').value = "";
        document.getElementById('novo-email').value = ""; document.getElementById('nova-senha').value = "";
    }).catch(e => alert("Erro: " + e));
}

window.excluirFuncionario = function(id) { if(confirm("Tem certeza que deseja excluir este usuário?")) { getDB().collection("equipe").doc(id).delete(); } }

window.editarFuncionario = function(id) {
    getDB().collection("equipe").doc(id).get().then(doc => {
        if(doc.exists) {
            const u = doc.data();
            document.getElementById('edit-id').value = doc.id;
            document.getElementById('edit-nome').value = u.nome;
            document.getElementById('edit-login').value = u.login;
            document.getElementById('edit-email').value = u.email;
            document.getElementById('edit-senha').value = u.senha;
            document.getElementById('box-novo-usuario').classList.add('hidden');
            document.getElementById('div-editar-usuario').classList.remove('hidden');
        }
    });
}

window.salvarEdicaoUsuario = function() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value;
    const email = document.getElementById('edit-email').value;
    const senha = document.getElementById('edit-senha').value;
    if(!nome || !senha) { alert("Nome e senha são obrigatórios."); return; }
    getDB().collection("equipe").doc(id).update({ nome, email, senha }).then(() => { alert("Usuário atualizado!"); window.cancelarEdicao(); }).catch(e => alert("Erro: " + e));
}

window.cancelarEdicao = function() {
    document.getElementById('edit-id').value = ""; document.getElementById('edit-nome').value = "";
    document.getElementById('edit-login').value = ""; document.getElementById('edit-email').value = ""; document.getElementById('edit-senha').value = "";
    document.getElementById('div-editar-usuario').classList.add('hidden'); document.getElementById('box-novo-usuario').classList.remove('hidden');
}

window.carregarLogs = function() {
    const database = getDB();
    const tbody = document.getElementById('tabela-logs');
    if(!database || !tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    
    if (logsUnsubscribe) logsUnsubscribe();
    
    logsUnsubscribe = database.collection("auditoria").limit(300).orderBy("data_log", "desc").onSnapshot(snap => {
        tbody.innerHTML = '';
        let count = 0;
        
        snap.forEach(doc => {
            const log = doc.data();
            if (log.sistema !== "Exumacao") return; 
            
            count++;
            let displayDataHora = '-';
            if (log.data_log) {
                const dh = new Date(log.data_log);
                if(!isNaN(dh)) {
                    displayDataHora = `${dh.getDate().toString().padStart(2,'0')}/${(dh.getMonth()+1).toString().padStart(2,'0')}/${dh.getFullYear()} <br> <span style="font-size:11px; color:#666;">${dh.getHours().toString().padStart(2,'0')}:${dh.getMinutes().toString().padStart(2,'0')}</span>`;
                }
            }
            let color = "#333";
            if(log.acao === "EXCLUSÃO") color = "var(--danger)";
            if(log.acao === "EDIÇÃO" || log.acao === "LIBERAÇÃO") color = "var(--excel-red)";

            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${displayDataHora}</td><td><b>${log.usuario}</b></td><td><span style="color:${color}; font-weight:bold;">[${log.acao}]</span> ${log.detalhe}</td>`;
            tbody.appendChild(tr);
        });
        
        if(count === 0) { tbody.innerHTML = '<tr><td colspan="3">Nenhum registro encontrado neste sistema.</td></tr>'; }
    });
}

window.baixarLogsExcel = function() {
    if(typeof XLSX === 'undefined') { alert("Erro: Biblioteca Excel ausente."); return; }
    const db = getDB();
    db.collection("auditoria").limit(1000).orderBy("data_log", "desc").get().then(snap => {
        let dados = [];
        snap.forEach(doc => {
            const d = doc.data();
            if(d.sistema !== "Exumacao") return; 
            const dt = d.data_log ? new Date(d.data_log).toLocaleString() : '-';
            dados.push({ "Data/Hora": dt, "Usuário": d.usuario, "Ação": d.acao, "Detalhes": d.detalhe });
        });
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria Exumacoes");
        XLSX.writeFile(wb, "Logs_Auditoria_Exumacoes.xlsx");
    });
}

window.baixarLogsPDF = function() {
    if(!window.jspdf) { alert("Erro: Biblioteca PDF ausente."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const db = getDB();
    db.collection("auditoria").limit(1000).orderBy("data_log", "desc").get().then(snap => {
        let body = [];
        snap.forEach(doc => {
            const d = doc.data();
            if(d.sistema !== "Exumacao") return; 
            const dt = d.data_log ? new Date(d.data_log).toLocaleString() : '-';
            body.push([dt, d.usuario, `[${d.acao}] ${d.detalhe}`]);
        });
        doc.text("Relatório de Auditoria - Exumações", 14, 10);
        doc.autoTable({ head: [['Data/Hora', 'Usuário', 'Ação/Detalhes']], body: body, startY: 20, });
        doc.save("Logs_Auditoria_Exumacoes.pdf");
    });
}

window.carregarEstatisticas = function(modo) {
    const database = getDB();
    if(!database) return;
    
    let dInicio = new Date();
    let dString = "";

    if (modo === 'mes') {
        dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1);
        dString = dInicio.toISOString();
    } else {
        dInicio.setDate(dInicio.getDate() - parseInt(modo));
        dString = dInicio.toISOString();
    }
    
    database.collection("requerimentos_exumacao").where("data_registro", ">=", dString).onSnapshot(snap => {
        let servicos = {};
        snap.forEach(doc => {
            const d = doc.data();
            if(d.servico_requerido) { 
                const k = d.servico_requerido.trim().toUpperCase(); 
                servicos[k] = (servicos[k] || 0) + 1; 
            }
        });
        
        const sorted = Object.entries(servicos).sort((a,b) => b[1] - a[1]).slice(0, 10);
        const labels = sorted.map(x => x[0]);
        const data = sorted.map(x => x[1]);

        const ctx = document.getElementById('grafico-servicos');
        if(ctx && window.Chart) {
            if(chartInstances['servicos']) chartInstances['servicos'].destroy();
            chartInstances['servicos'] = new Chart(ctx, {
                type: 'bar',
                data: { labels: labels, datasets: [{ label: 'Qtd. de Serviços', data: data, backgroundColor: '#3699ff' }] },
                options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true } } }
            });
        }
        dadosEstatisticasExportacao = sorted.map(([c,q]) => ({"Serviço": c, "Quantidade": q}));
    });
}

window.baixarRelatorioCompleto = function() {
    if(!getDB()) return; if(!confirm("Baixar relatório de todos os requerimentos?")) return;
    if(typeof XLSX === 'undefined') { alert("Biblioteca Excel não carregada."); return; }
    getDB().collection("requerimentos_exumacao").get().then(snap => {
        let dados = [];
        snap.forEach(doc => {
            let d = doc.data();
            let dtReg = d.data_registro ? new Date(d.data_registro).toLocaleDateString() : '-';
            dados.push([d.protocolo, dtReg, d.resp_nome, d.nome_falecido, d.cemiterio, d.servico_requerido, d.processo, d.grm, d.atendente_sistema]);
        });
        const ws = XLSX.utils.aoa_to_sheet([["Protocolo","Data","Requerente","Falecido","Cemitério","Serviço","Processo","GRM","Atendente"], ...dados]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Requerimentos");
        XLSX.writeFile(wb, "Relatorio_Requerimentos.xlsx");
    });
}

window.baixarExcel = function() {
    if(typeof XLSX === 'undefined' || dadosEstatisticasExportacao.length === 0) { alert("Sem dados para exportar ou biblioteca falhou."); return; }
    const ws = XLSX.utils.json_to_sheet(dadosEstatisticasExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stats_Servicos");
    XLSX.writeFile(wb, "Estatisticas_Exumacao.xlsx");
}

// --- TABELA E BUSCA PRINCIPAL COM FILTRO DE DATA ---
window.carregarTabela = function() {
    const database = getDB(); if(!database) return;
    if (unsubscribe) unsubscribe();
    
    const fd = document.getElementById('filtro-data');
    const dataFiltro = fd ? fd.value : "";
    
    let query = database.collection("requerimentos_exumacao").orderBy("data_registro", "desc");
    
    if (dataFiltro) {
        query = query.where("data_registro", ">=", dataFiltro)
                     .where("data_registro", "<=", dataFiltro + "T23:59:59.999Z");
    } else {
        query = query.limit(50);
    }
    
    unsubscribe = query.onSnapshot((snap) => {
        let lista = [];
        snap.forEach(doc => { let d = doc.data(); d.id = doc.id; lista.push(d); });
        renderizarTabela(lista);
    });
}

window.realizarBusca = function() {
    const termo = document.getElementById('input-busca').value.trim();
    const fd = document.getElementById('filtro-data');
    
    if (!termo) { 
        if (fd && !fd.value) fd.value = pegarDataISO();
        carregarTabela(); 
        return; 
    }
    
    // Limpa a data para buscar globalmente
    if (fd) fd.value = "";

    const database = getDB();
    if (unsubscribe) unsubscribe();
    
    if (/^\d/.test(termo)) {
        unsubscribe = database.collection("requerimentos_exumacao")
            .orderBy("protocolo")
            .startAt(termo)
            .endAt(termo + "\uf8ff")
            .onSnapshot((snap) => {
                let lista = [];
                snap.forEach(doc => { let d = doc.data(); d.id = doc.id; lista.push(d); });
                renderizarTabela(lista);
            });
    } else {
        unsubscribe = database.collection("requerimentos_exumacao")
            .orderBy("nome_falecido")
            .startAt(termo)
            .endAt(termo + "\uf8ff")
            .onSnapshot((snap) => {
                let lista = [];
                snap.forEach(doc => { let d = doc.data(); d.id = doc.id; lista.push(d); });
                renderizarTabela(lista);
            });
    }
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo'); if(!tbody) return;
    tbody.innerHTML = ''; 
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center;">Nenhum registro.</td></tr>'; return; }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizarDocumentos(item.id);
        
        let dataF = item.data_registro ? formatarDataInversa(item.data_registro.split('T')[0]) : '-';

        tr.innerHTML = `
            <td style="vertical-align:middle;"><b>${item.resp_nome.toUpperCase()}</b><br><span style="font-size:11px;">Tel: ${item.telefone}</span></td>
            <td style="vertical-align:middle;"><b>${item.nome_falecido.toUpperCase()}</b></td>
            <td style="vertical-align:middle;">${item.cemiterio}</td>
            <td style="vertical-align:middle;">${item.servico_requerido}</td>
            <td style="vertical-align:middle; font-size:11px;">
                <b>Prot: <span style="font-family:monospace; color:var(--primary-color);">${item.protocolo || '-'}</span></b><br>
                Proc: ${item.processo || '-'}<br>
                GRM: ${item.grm || '-'}
            </td>
            <td style="vertical-align:middle;">${dataF}</td>
            <td style="text-align:right; vertical-align:middle;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-icon btn-editar-circle" title="Editar Requerimento" onclick="event.stopPropagation();window.editar('${item.id}')">✏️</button>
                    <button class="btn-icon btn-liberar-circle" title="Preencher Liberação" onclick="event.stopPropagation();window.abrirLiberacao('${item.id}')">📝</button>
                    <button class="btn-icon btn-excluir-circle" title="Excluir" onclick="event.stopPropagation();window.excluir('${item.id}')">🗑️</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

// --- MODAIS DO REQUERIMENTO ---
window.abrirModal = function() {
    document.getElementById('form-atendimento').reset();
    document.getElementById('docId').value = "";
    document.getElementById('protocolo').value = "";
    if (usuarioLogado && usuarioLogado.nome) document.getElementById('atendente_sistema').value = usuarioLogado.nome;
    safeDisplay('modal', 'block');
}

window.fecharModal = function() { safeDisplay('modal', 'none'); }
window.fecharModalVisualizar = function() { safeDisplay('modal-visualizar', 'none'); }

window.editar = function(id) {
    getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            for (let key in d) { const el = document.getElementById(key); if(el) el.value = d[key]; }
            document.getElementById('docId').value = doc.id;
            safeDisplay('modal', 'block');
        }
    });
}

// SALVAR REQUERIMENTO (COM AUDITORIA ISOLADA)
const form = document.getElementById('form-atendimento');
if(form) {
    form.onsubmit = (e) => {
        e.preventDefault();
        const database = getDB();
        const id = document.getElementById('docId').value;
        let dados = {};
        Array.from(form.elements).forEach(el => {
            if(el.id && el.type !== 'submit' && el.type !== 'button') { dados[el.id] = el.value; }
        });

        if(!id) {
            dados.data_registro = new Date().toISOString();
            dados.protocolo = window.gerarProtocolo();
        }

        if(id) {
            database.collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "EDIÇÃO", detalhe: `Req ID: ${id} | Falecido: ${dados.nome_falecido}`, sistema: "Exumacao" });
            database.collection("requerimentos_exumacao").doc(id).update(dados).then(() => window.fecharModal());
        } else {
            database.collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "CRIAÇÃO", detalhe: `Protocolo: ${dados.protocolo} | Falecido: ${dados.nome_falecido}`, sistema: "Exumacao" });
            database.collection("requerimentos_exumacao").add(dados).then(() => window.fecharModal());
        }
    }
}

// --- MODAL E LÓGICA EXCLUSIVA DA LIBERAÇÃO ---
window.abrirLiberacao = function(id) {
    document.getElementById('form-liberacao').reset();
    getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            document.getElementById('docIdLiberacao').value = doc.id;
            if(d.processo) document.getElementById('processo').value = d.processo;
            if(d.grm) document.getElementById('grm').value = d.grm;
            if(d.valor_pago) document.getElementById('valor_pago').value = d.valor_pago;
            if(d.referente_a) document.getElementById('referente_a').value = d.referente_a;
            
            safeDisplay('modal-liberacao', 'block');
        }
    });
}

window.fecharModalLiberacao = function() { safeDisplay('modal-liberacao', 'none'); }

// SALVAR APENAS OS DADOS DE LIBERAÇÃO (COM AUDITORIA ISOLADA)
const formLib = document.getElementById('form-liberacao');
if(formLib) {
    formLib.onsubmit = (e) => {
        e.preventDefault();
        const database = getDB();
        const id = document.getElementById('docIdLiberacao').value;
        
        let dadosLiberacao = {
            processo: document.getElementById('processo').value,
            grm: document.getElementById('grm').value,
            valor_pago: document.getElementById('valor_pago').value,
            referente_a: document.getElementById('referente_a').value
        };

        if(id) {
            database.collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "LIBERAÇÃO", detalhe: `Req ID: ${id} | GRM: ${dadosLiberacao.grm}`, sistema: "Exumacao" });
            database.collection("requerimentos_exumacao").doc(id).update(dadosLiberacao).then(() => window.fecharModalLiberacao());
        }
    }
}

// --- AÇÕES GERAIS ---
window.excluir = function(id) {
    if(confirm('Tem certeza que deseja excluir este requerimento?')) {
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "EXCLUSÃO", detalhe: `Req ID excluido: ${id}`, sistema: "Exumacao" });
        getDB().collection("requerimentos_exumacao").doc(id).delete();
    }
}

// Fechar modais ao clicar fora
window.onclick = function(event) { 
    if (event.target == document.getElementById('modal-visualizar')) window.fecharModalVisualizar(); 
    if (event.target == document.getElementById('modal-admin')) window.fecharModalAdmin(); 
}

// Inicializa Eventos do DOM
document.addEventListener('DOMContentLoaded', () => {
    const fd = document.getElementById('filtro-data');
    if (fd) {
        fd.addEventListener('change', () => window.carregarTabela());
    }

    const sessao = sessionStorage.getItem('usuarioLogado');
    if (sessao) { 
        usuarioLogado = JSON.parse(sessao); 
        safeDisplay('tela-bloqueio', 'none'); 
        document.getElementById('user-display').innerText = usuarioLogado.nome;
        
        if(fd && !fd.value) fd.value = pegarDataISO();
        carregarTabela(); 
    }
});

// --- VISUALIZAÇÃO E PREENCHIMENTO DO RESUMO ---
window.visualizarDocumentos = function(id) {
    assinaturaResponsavelImg = null;
    assinaturaAtendenteImg = null;
    
    getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
        if(doc.exists) {
            let d = doc.data();
            d.id = doc.id;
            dadosAtendimentoAtual = d;
            
            if(d.assinatura_responsavel) assinaturaResponsavelImg = d.assinatura_responsavel;
            if(d.assinatura_atendente) assinaturaAtendenteImg = d.assinatura_atendente;

            const resumoEl = document.getElementById('resumo-dados');
            if(resumoEl) {
                resumoEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Protocolo</span><br><strong style="color:var(--primary-color); font-size:14px; font-family:monospace;">${d.protocolo || 'N/A'}</strong></div>
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Requerente</span><br><strong style="font-size:14px;">${d.resp_nome ? d.resp_nome.toUpperCase() : '-'}</strong></div>
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Falecido(a)</span><br><strong style="font-size:14px;">${d.nome_falecido ? d.nome_falecido.toUpperCase() : '-'}</strong></div>
                        
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Cemitério / Serviço</span><br><strong>${d.cemiterio ? d.cemiterio.toUpperCase() : '-'} (${d.servico_requerido ? d.servico_requerido.toUpperCase() : '-'})</strong></div>
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Localização Sepultura</span><br><strong>Nº ${d.sepul || '-'} / QD ${d.qd || '-'}</strong></div>
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Administrativo</span><br><strong style="color:var(--danger);">Proc: ${d.processo || '-'} / GRM: ${d.grm || '-'}</strong></div>
                        
                        <div style="grid-column: span 3; text-align: center; margin-top: 5px;"><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Status de Assinatura</span><br><strong>${d.assinatura_responsavel ? '✅ Família Assinou' : '⏳ Aguardando Família'} | ${d.assinatura_atendente ? '✅ Equipe Assinou' : '⏳ Aguardando Equipe'}</strong></div>
                    </div>
                `;
            }

            safeDisplay('modal-visualizar', 'block');
        }
    });
}

// --- IMPRESSÃO DO REQUERIMENTO ---
window.imprimirRequerimento = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    
    let txtTipoSepultura = d.tipo_sepultura;
    if (txtTipoSepultura === 'Nicho perpétuo' || txtTipoSepultura === 'Sep perpétua') {
        txtTipoSepultura += ' nº ____ L nº ____ Fls nº ____';
    }
    
    const dataReq = d.data_registro ? new Date(d.data_registro) : new Date();
    const mesExtenso = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dataTexto = `Niterói, ${dataReq.getDate()} de ${mesExtenso[dataReq.getMonth()]} de ${dataReq.getFullYear()}`;

    let blocoAssinaturaRequerente = assinaturaResponsavelImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let blocoAssinaturaAtendente = assinaturaAtendenteImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    
    let enderecoCompleto = `${d.endereco}, Nº ${d.numero || 'S/N'}`.toUpperCase();
    if (d.complemento) {
        enderecoCompleto += ` - ${d.complemento.toUpperCase()}`;
    }

    const html = `<html><head><title>Requerimento Exumação</title><style>
        @page { size: A4 portrait; margin: 15mm; }
        body { 
            font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #000; position: relative; 
            -webkit-print-color-adjust: exact; print-color-adjust: exact; 
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            opacity: 0.1;
            z-index: -1;
            pointer-events: none;
        }

        .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; position: relative;}
        .header img.logo-print { height: 55px; }
        .header-subtitle { font-size: 12px; font-weight: bold; margin-top: 5px; text-transform: uppercase; }
        .doc-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
        .section { margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
        .section-title { font-weight: bold; font-size: 11px; background-color: #f0f0f0; padding: 4px 8px; margin: -10px -10px 10px -10px; border-bottom: 1px solid #ccc; border-radius: 4px 4px 0 0; text-transform: uppercase; color: #333; }
        .row { display: flex; margin-bottom: 8px; gap: 15px; }
        .field { display: flex; flex-direction: column; flex: 1; }
        .label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;}
        .value { font-size: 13px; font-weight: bold; border-bottom: 1px solid #000; padding-top: 2px; padding-bottom: 2px; min-height: 16px;}
        .chk-item { font-weight: bold; font-size: 13px; }
        .footer-note { font-size: 10px; text-align: justify; margin-top: 20px; padding: 10px; border: 1px dashed #999; background-color: #f9f9f9; border-radius: 4px;}
        .legal { font-size: 9px; text-align: center; margin-top: 20px; font-weight: bold; color: #444; }
        .box-protocolo { position: absolute; top: 0; right: 0; border: 2px solid #000; padding: 4px 8px; font-weight: bold; font-size: 12px; font-family: monospace; background: #fff; }
    </style></head><body>
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Bras%C3%A3o_de_Niter%C3%B3i%2C_RJ.svg" class="watermark">
        
        <div class="header">
            <div class="box-protocolo">PROTOCOLO: ${d.protocolo || 'N/A'}</div>
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="logo-print">
            <div class="header-subtitle">Subsecretaria de Infraestrutura - SSINF<br>Coordenação dos Cemitérios de Niterói</div>
        </div>
        
        <div class="doc-title">Requerimento de Serviços Cemiteriais</div>
        
        <div class="section">
            <div class="section-title">Dados do Requerente</div>
            <div class="row">
                <div class="field" style="flex: 2;"><span class="label">Nome Completo</span><span class="value">${d.resp_nome.toUpperCase()}</span></div>
                <div class="field"><span class="label">Grau de Parentesco</span><span class="value">${d.parentesco.toUpperCase()}</span></div>
            </div>
            <div class="row">
                <div class="field" style="flex: 2.5;"><span class="label">Endereço</span><span class="value">${enderecoCompleto}</span></div>
                <div class="field" style="flex: 0.5;"><span class="label">CEP</span><span class="value">${d.cep || '-'}</span></div>
            </div>
            <div class="row">
                <div class="field"><span class="label">Bairro</span><span class="value">${d.bairro.toUpperCase()}</span></div>
                <div class="field"><span class="label">Município</span><span class="value">${d.municipio.toUpperCase()}</span></div>
                <div class="field"><span class="label">Telefone</span><span class="value">${d.telefone}</span></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Dados do Falecido(a)</div>
            <div class="row">
                <div class="field" style="flex: 2;"><span class="label">Nome do(a) Falecido(a)</span><span class="value">${d.nome_falecido.toUpperCase()}</span></div>
                <div class="field"><span class="label">Data de Sepultamento</span><span class="value">${formatarDataInversa(d.data_sepultamento)}</span></div>
                <div class="field"><span class="label">Cemitério</span><span class="value">${d.cemiterio.toUpperCase()}</span></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Serviços Requeridos e Localização</div>
            <div class="row">
                <div class="field"><div class="chk-item">( X ) ${d.servico_requerido.toUpperCase()}</div></div>
                <div class="field"><div class="chk-item">( X ) ${txtTipoSepultura.toUpperCase()}</div></div>
            </div>
            <div class="row" style="margin-top: 15px;">
                <div class="field"><span class="label">Nº da Sepultura</span><span class="value">${d.sepul}</span></div>
                <div class="field"><span class="label">Quadra</span><span class="value">${d.qd ? d.qd.toUpperCase() : '-'}</span></div>
                <div class="field" style="flex: 2;"><span class="label">Proprietário (Se Perpétua)</span><span class="value">${d.proprietario ? d.proprietario.toUpperCase() : '-'}</span></div>
            </div>
            <div class="row" style="margin-top: 10px;">
                <div class="field"><span class="label">Assunto / Observações</span><span class="value">${d.assunto ? d.assunto.toUpperCase() : '-'}</span></div>
            </div>
        </div>

        <div class="footer-note">
            <b>EM TEMPO:</b> Ao assinar este requerimento, declaro estar ciente que depois de passados <b>90 (noventa) dias</b> do deferimento desse procedimento administrativo, não havendo manifestação de minha parte para pagamento e realização do pleiteado, o processo será encerrado e arquivado, sendo considerado como desinteresse de minha parte; os restos mortais, quando for objeto do pedido, serão exumados e recolhidos ao ossuário geral. <br><br><b>OBS.: O comprovante de requerimento (protocolo) deverá ser apresentado no cemitério em até 24h após emissão.</b>
        </div>

        <div style="margin-top:15px; font-size: 13px;">Nestes termos, peço deferimento.</div>
        <div style="text-align:right; margin-top:5px; font-size: 13px;"><b>${dataTexto}</b></div>

        <div style="display: flex; justify-content: space-around; margin-top: 40px; text-align: center;">
            <div>
                ${blocoAssinaturaAtendente}
                <div style="border-top: 1px solid #000; padding-top: 5px; min-width: 250px;">
                    <b>${(d.atendente_sistema || 'ATENDENTE').toUpperCase()}</b><br>
                    <span style="font-size: 11px; color: #555;">(Assinatura do Atendente)</span>
                </div>
            </div>
            <div>
                ${blocoAssinaturaRequerente}
                <div style="border-top: 1px solid #000; padding-top: 5px; min-width: 250px;">
                    <b>${d.resp_nome.toUpperCase()}</b><br>
                    <span style="font-size: 11px; color: #555;">(Assinatura do Requerente)</span>
                </div>
            </div>
        </div>

        <div class="legal">
            Art. 299 do Código Penal - Falsidade ideológica: Omitir, em documento público ou particular, declaração que dele devia constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fatos juridicamente relevante, é crime.
        </div>
    </body><script>window.onload=function(){setTimeout(function(){window.print()},800)}</script></html>`;
    
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

// --- IMPRESSÃO DA LIBERAÇÃO ---
window.imprimirLiberacao = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    
    const dataReq = d.data_registro ? new Date(d.data_registro) : new Date();
    const mesExtenso = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dataTexto = `Niterói, ${dataReq.getDate()} de ${mesExtenso[dataReq.getMonth()]} de ${dataReq.getFullYear()}`;

    let enderecoCompleto = `${d.endereco}, Nº ${d.numero || 'S/N'}`.toUpperCase();
    if (d.complemento) {
        enderecoCompleto += ` - ${d.complemento.toUpperCase()}`;
    }

    let blocoAssinaturaRequerente = assinaturaResponsavelImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let blocoAssinaturaAtendente = assinaturaAtendenteImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;

    const html = `<html><head><title>Liberação Exumação</title><style>
        @page { size: A4 portrait; margin: 20mm; }
        body { 
            font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #000; position: relative;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            opacity: 0.1;
            z-index: -1;
            pointer-events: none;
        }

        .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; position: relative;}
        .header img.logo-print { height: 55px; }
        .header-subtitle { font-size: 12px; font-weight: bold; margin-top: 5px; text-transform: uppercase; }
        .doc-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
        .section { margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
        .section-title { font-weight: bold; font-size: 11px; background-color: #f0f0f0; padding: 4px 8px; margin: -10px -10px 10px -10px; border-bottom: 1px solid #ccc; border-radius: 4px 4px 0 0; text-transform: uppercase; color: #333; }
        .row { display: flex; margin-bottom: 8px; gap: 15px; }
        .field { display: flex; flex-direction: column; flex: 1; }
        .label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;}
        .value { font-size: 13px; font-weight: bold; border-bottom: 1px solid #000; padding-top: 2px; padding-bottom: 2px; min-height: 16px;}
        .footer-note { font-size: 11px; text-align: justify; margin-top: 20px; padding: 10px; border: 1px dashed #999; background-color: #f9f9f9; border-radius: 4px; line-height: 1.6;}
        .box-protocolo { position: absolute; top: 0; right: 0; border: 2px solid #000; padding: 4px 8px; font-weight: bold; font-size: 12px; font-family: monospace; background: #fff; }
    </style></head><body>
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Bras%C3%A3o_de_Niter%C3%B3i%2C_RJ.svg" class="watermark">

        <div class="header">
            <div class="box-protocolo">PROTOCOLO: ${d.protocolo || 'N/A'}</div>
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="logo-print">
            <div class="header-subtitle">Secretaria de Mobilidade e Infraestrutura - SEMOBI<br>Subsecretaria de Infraestrutura - SSINF<br>Coordenação dos Cemitérios de Niterói</div>
        </div>
        
        <div class="doc-title">Liberação de Exumação</div>

        <div class="section">
            <div class="section-title">Dados Administrativos</div>
            <div class="row">
                <div class="field"><span class="label">Processo Nº</span><span class="value">${d.processo || '-'}</span></div>
                <div class="field"><span class="label">GRM Nº</span><span class="value">${d.grm || '-'}</span></div>
                <div class="field"><span class="label">Quantia Paga (R$)</span><span class="value">${d.valor_pago ? d.valor_pago.toUpperCase() : '-'}</span></div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Dados do Requerente e Localização</div>
            <div class="row">
                <div class="field" style="flex: 2;"><span class="label">Nome do Requerente</span><span class="value">${d.resp_nome.toUpperCase()}</span></div>
                <div class="field"><span class="label">Cemitério Municipal</span><span class="value">${d.cemiterio.toUpperCase()}</span></div>
            </div>
            <div class="row">
                <div class="field" style="flex: 2.5;"><span class="label">Endereço</span><span class="value">${enderecoCompleto}</span></div>
                <div class="field" style="flex: 0.5;"><span class="label">CEP</span><span class="value">${d.cep || '-'}</span></div>
            </div>
            <div class="row">
                <div class="field"><span class="label">Bairro</span><span class="value">${d.bairro.toUpperCase()}</span></div>
                <div class="field"><span class="label">Município</span><span class="value">${d.municipio.toUpperCase()}</span></div>
                <div class="field"><span class="label">Telefone</span><span class="value">${d.telefone}</span></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Referente A</div>
            <div class="row">
                <div class="field"><span class="value" style="border:none; text-align:justify; line-height: 1.6; text-transform: uppercase;">${d.referente_a ? d.referente_a.replace(/\n/g, '<br>') : '__________________________________________________________________________'}</span></div>
            </div>
        </div>

        <div class="footer-note">
            <b>ESTOU CIENTE QUE O(A) REQUERENTE DEVERÁ COMPARECER NO DIA DA EXUMAÇÃO/ENTRADA E SAÍDA DE OSSOS__________________________________________</b>
            <br><br>
            <div style="text-align: center; text-decoration: underline;"><b>EXUMAÇÃO E ENTRADA/SAÍDA DE OSSOS SÃO FEITAS DE SEGUNDA A SEXTA DAS 8H ÀS 10H, EXCETO FERIADOS.</b></div>
        </div>

        <div style="margin-top:20px; text-align:right; font-size: 13px;"><b>${dataTexto}</b></div>

        <div style="display: flex; justify-content: space-around; margin-top: 50px; text-align: center;">
            <div>
                ${blocoAssinaturaAtendente}
                <div style="border-top: 1px solid #000; padding-top: 5px; min-width: 250px;">
                    <b>${(d.atendente_sistema || 'ATENDENTE').toUpperCase()}</b><br>
                    <span style="font-size: 11px; color: #555;">Coordenação dos Cemitérios de Niterói</span>
                </div>
            </div>
            <div>
                ${blocoAssinaturaRequerente}
                <div style="border-top: 1px solid #000; padding-top: 5px; min-width: 250px;">
                    <b>${d.resp_nome.toUpperCase()}</b><br>
                    <span style="font-size: 11px; color: #555;">(Assinatura do Requerente)</span>
                </div>
            </div>
        </div>
        
        <div style="text-align:center; font-size: 10px; color: #666; margin-top: 40px;">
            Rua General Castrioto, 407 - Barreto - Niterói - 24110-256 - Tel.: 3513-6157
        </div>

    </body><script>window.onload=function(){setTimeout(function(){window.print()},800)}</script></html>`;
    
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}