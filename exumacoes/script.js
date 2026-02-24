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
window.dadosLiberacaoAtual = null;

// VARIÁVEIS GLOBAIS PARA ASSINATURA E TELEFONE E CONTRIBUINTES
let signaturePad = null;
let isDrawing = false;
let assinaturaResponsavelImg = null;
let assinaturaAtendenteImg = null;
let tipoAssinaturaAtual = ''; 
window.telCount = 1;
window.contribuintesMap = {};

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

const normalizeStr = (str) => {
    return str ? str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

// FUNÇÃO PARA GERAR O PROTOCOLO
window.gerarProtocolo = function() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth()+1).padStart(2,'0');
    const dia = String(agora.getDate()).padStart(2,'0');
    return `${ano}${mes}${dia}-${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}`;
}

// --- LÓGICA DE MESCLAGEM DE PDFS (MODAL PRINCIPAL E ROW) ---
window.abrirModalUnir = function(protocolo) {
    document.getElementById('unir-protocolo-row').value = protocolo || 'N/A';
    document.getElementById('input-pdfs-row').value = '';
    safeDisplay('modal-unir', 'block');
}

window.fecharModalUnir = function() {
    safeDisplay('modal-unir', 'none');
}

window.mesclarPDFsRow = async function() {
    const fileInput = document.getElementById('input-pdfs-row');
    const protocolo = document.getElementById('unir-protocolo-row').value;
    const files = fileInput.files;

    if (!files || files.length === 0) {
        alert("Por favor, selecione os arquivos PDF primeiro clicando em 'Escolher arquivos'.");
        return;
    }
    if (files.length === 1) {
        alert("Selecione pelo menos 2 arquivos para unir (você pode selecionar vários segurando o CTRL).");
        return;
    }

    try {
        const { PDFDocument } = window.PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < files.length; i++) {
            const arrayBuffer = await files[i].arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let nomeArquivo = protocolo !== 'N/A' ? `E-CIGA_${protocolo}.pdf` : `Documentos_Unidos_E-CIGA.pdf`;
        
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        fileInput.value = "";
        alert("PDFs unidos com sucesso!");
        window.fecharModalUnir();

    } catch (error) {
        console.error("Erro ao unir PDFs:", error);
        alert("Ocorreu um erro ao processar os arquivos. Certifique-se de que selecionou apenas arquivos em formato PDF.");
    }
}

window.mesclarPDFs = async function() {
    const fileInput = document.getElementById('input-pdfs');
    const files = fileInput.files;

    if (!files || files.length === 0) {
        alert("Por favor, selecione os arquivos PDF primeiro clicando em 'Escolher arquivos'.");
        return;
    }
    if (files.length === 1) {
        alert("Selecione pelo menos 2 arquivos para unir.");
        return;
    }

    try {
        const { PDFDocument } = window.PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
        }

        const mergedPdfBytes = await mergedPdf.save();
        
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let nomeArquivo = "Documentos_Unidos_E-CIGA.pdf";
        if (dadosAtendimentoAtual && dadosAtendimentoAtual.protocolo) {
            nomeArquivo = `E-CIGA_${dadosAtendimentoAtual.protocolo}.pdf`;
        }
        
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        fileInput.value = "";
        alert("PDFs unidos com sucesso!");

    } catch (error) {
        console.error("Erro ao unir PDFs:", error);
        alert("Ocorreu um erro ao processar os arquivos. Certifique-se de que selecionou apenas arquivos em formato PDF.");
    }
}

// --- ENVIAR PARA WHATSAPP ---
window.enviarWhatsApp = function() {
    if (!dadosAtendimentoAtual) {
        alert("Nenhum atendimento selecionado.");
        return;
    }
    
    const d = dadosAtendimentoAtual;
    
    // Pega o primeiro telefone válido
    let telefone = d.telefone ? d.telefone.replace(/\D/g, '') : '';
    if (!telefone) {
        alert("Nenhum telefone cadastrado para este requerente.");
        return;
    }
    
    // Formata para o padrão internacional (Brasil)
    if (telefone.length === 10 || telefone.length === 11) {
        telefone = "55" + telefone; 
    }

    let cemDisplay = d.cemiterio === 'OUTRO' ? d.cemiterio_outro : d.cemiterio;

    let msg = `*COORDENAÇÃO DOS CEMITÉRIOS DE NITERÓI*\n\n`;
    msg += `Olá, *${d.resp_nome ? d.resp_nome.toUpperCase() : 'Requerente'}*.\n`;
    msg += `Este é o resumo do seu atendimento:\n\n`;
    msg += `📄 *Protocolo:* ${d.protocolo || 'N/A'}\n`;
    msg += `👤 *Falecido(a):* ${d.nome_falecido ? d.nome_falecido.toUpperCase() : '-'}\n`;
    msg += `📍 *Cemitério:* ${cemDisplay ? cemDisplay.toUpperCase() : '-'}\n`;
    msg += `🛠️ *Serviço(s):* ${d.servico_requerido ? d.servico_requerido.toUpperCase() : '-'}\n`;
    msg += `🪦 *Sepultura:* Nº ${d.sepul || '-'} / QD ${d.qd || '-'}\n`;
    
    if (d.processo || d.grm) {
        msg += `\n*DADOS ADMINISTRATIVOS:*\n`;
        if (d.processo) msg += `📂 *Processo:* ${d.processo}\n`;
        if (d.grm) msg += `🧾 *GRM:* ${d.grm}\n`;
    }

    msg += `\n_Aguarde enquanto o atendente envia o(s) documento(s) em anexo por aqui._`;

    const url = `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// --- GESTÃO DE MÚLTIPLOS TELEFONES E CEMITÉRIO EXTERNO ---
window.addTelefone = function(val = "") {
    window.telCount++;
    const newId = 'telefone' + window.telCount;
    if(document.getElementById(newId)) return; 
    
    const box = document.getElementById('box-telefones');
    const input = document.createElement('input');
    input.type = 'text';
    input.id = newId;
    input.style.marginTop = '5px';
    input.placeholder = 'Telefone Adicional';
    input.maxLength = 15;
    input.value = val;
    input.oninput = function() { window.mascaraTelefone(this) };
    box.appendChild(input);
}

window.mascaraTelefone = function(el) {
    let v = el.value.replace(/\D/g, '');
    if(v.length === 0) { el.value = ''; return; }
    if(v.length <= 10) {
        v = v.replace(/(\d{2})(\d)/, "($1) $2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    } else {
        v = v.replace(/(\d{2})(\d)/, "($1) $2");
        v = v.replace(/(\d{5})(\d)/, "$1-$2");
    }
    el.value = v.substring(0, 15);
}

window.toggleCemiterioOutro = function() {
    const select = document.getElementById('cemiterio');
    const input = document.getElementById('cemiterio_outro');
    if (select && input) {
        if (select.value === 'OUTRO') {
            input.style.display = 'block';
            input.required = true;
        } else {
            input.style.display = 'none';
            input.required = false;
            input.value = '';
        }
    }
};

// MASCARA CPF E CNPJ AUTOMÁTICA
window.aplicarMascaraCpfCnpj = function(el) {
    let v = el.value.replace(/\D/g, ""); 
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        v = v.substring(0, 14); 
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    el.value = v;
}

// --- LÓGICA DA EMISSÃO DE GRM (IFRAME ORIGINAL) ---
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
    canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', endDraw); canvas.addEventListener('mouseout', endDraw); canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', endDraw, { passive: false });
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

// --- BUSCAR REQUERENTE POR CPF ---
window.buscarRequerentePorCPF = function() {
    let cpfInput = document.getElementById('cpf');
    if (!cpfInput) return;
    let cpf = cpfInput.value.trim();
    if (cpf.length < 14) return;

    const campoNome = document.getElementById('resp_nome');
    const placeholderOriginal = campoNome.placeholder;
    campoNome.placeholder = "Buscando...";

    const db = getDB();
    db.collection("requerimentos_exumacao")
        .where("cpf", "==", cpf)
        .get()
        .then(snap => {
            if (!snap.empty) {
                let docs = snap.docs.map(doc => doc.data());
                docs.sort((a, b) => {
                    let dataA = a.data_registro ? new Date(a.data_registro) : new Date(0);
                    let dataB = b.data_registro ? new Date(b.data_registro) : new Date(0);
                    return dataB - dataA;
                });
                
                let d = docs[0];

                if (d.resp_nome) document.getElementById('resp_nome').value = d.resp_nome;
                if (d.telefone) document.getElementById('telefone').value = d.telefone;
                
                let idx = 2;
                while(d['telefone'+idx]) {
                    window.addTelefone(d['telefone'+idx]);
                    idx++;
                }

                if (d.rg) document.getElementById('rg').value = d.rg;
                if (d.endereco) document.getElementById('endereco').value = d.endereco;
                if (d.bairro) document.getElementById('bairro').value = d.bairro;
                if (d.municipio) document.getElementById('municipio').value = d.municipio;
                if (d.cep) document.getElementById('cep').value = d.cep;
                if (d.numero) document.getElementById('numero').value = d.numero;
                if (d.complemento) document.getElementById('complemento').value = d.complemento;
                if (d.parentesco) document.getElementById('parentesco').value = d.parentesco;
            }
            campoNome.placeholder = placeholderOriginal;
        })
        .catch(err => {
            console.error("Erro na busca por CPF", err);
            campoNome.placeholder = placeholderOriginal;
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
    
    let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogado.nome)}&background=random&color=fff&bold=true`;
    document.getElementById('user-display').innerHTML = `
        <div class="user-info" style="margin-right: 15px; text-align: left;">
            <img src="${avatarUrl}" class="user-avatar" alt="Avatar" style="width: 36px; height: 36px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="line-height: 1.2;">
                <div style="font-weight: 800; color: #3699ff; font-size: 13px; text-transform: uppercase;">${usuarioLogado.nome}</div>
                <div style="font-size: 10px; color: #888;">${usuarioLogado.email || 'Atendente'}</div>
            </div>
        </div>
    `;
    
    const fd = document.getElementById('filtro-data');
    if(fd && !fd.value) fd.value = pegarDataISO();
    
    carregarTabela();
}

window.fazerLogout = function() { sessionStorage.removeItem('usuarioLogado'); window.location.reload(); }

// --- LÓGICA DO ADMIN COM NOVA ABA CONTRIBUINTES ---
window.abrirAdmin = function() { safeDisplay('modal-admin', 'block'); window.abrirAba('tab-equipe'); }
window.fecharModalAdmin = function() { safeDisplay('modal-admin', 'none'); }

window.abrirAba = function(id) {
    Array.from(document.getElementsByClassName('tab-pane')).forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const buttons = document.querySelectorAll('.tab-header .tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.tab-header .tab-btn[onclick="abrirAba('${id}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if(id==='tab-equipe') window.listarEquipe();
    if(id==='tab-logs') window.carregarLogs();
    if(id==='tab-stats') window.carregarEstatisticas('7');
    if(id==='tab-contribuintes') {
        setTimeout(() => document.getElementById('busca-contribuinte-admin').focus(), 100);
    }
}

// --- BUSCAR CONTRIBUINTES CADASTRADOS (ADMIN) ---
window.buscarContribuintesAdmin = function() {
    const termoOriginal = document.getElementById('busca-contribuinte-admin').value.trim();
    const termo = normalizeStr(termoOriginal);
    const tbody = document.getElementById('lista-contribuintes');
    
    if (!termo || termo.length < 3) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Digite pelo menos 3 caracteres para buscar.</td></tr>';
        return; 
    }
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Buscando...</td></tr>';
    
    const termoLimpo = termo.replace(/[\.\-\/\(\)\s]/g, '');
    const database = getDB();

    database.collection("requerimentos_exumacao")
        .orderBy("data_registro", "desc")
        .limit(1000)
        .get()
        .then((snap) => {
            window.contribuintesMap = {};
            
            snap.forEach(doc => {
                let d = doc.data();
                if (!d.cpf) return; 
                
                let stringBusca = `${d.resp_nome || ''} ${d.cpf || ''} ${d.rg || ''} ${d.telefone || ''}`;
                stringBusca = normalizeStr(stringBusca);
                let stringSemPontuacao = stringBusca.replace(/[\.\-\/\(\)\s]/g, '');

                if (stringBusca.includes(termo) || (termoLimpo !== '' && stringSemPontuacao.includes(termoLimpo))) {
                    if (!window.contribuintesMap[d.cpf]) {
                        window.contribuintesMap[d.cpf] = d;
                    }
                }
            });

            renderizarTabelaContribuintes(Object.values(window.contribuintesMap));
        }).catch(e => {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:red;">Erro na busca.</td></tr>';
            console.error(e);
        });
}

function renderizarTabelaContribuintes(lista) {
    const tbody = document.getElementById('lista-contribuintes');
    tbody.innerHTML = ''; 
    
    if (lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum contribuinte encontrado.</td></tr>'; 
        return; 
    }

    lista.forEach(item => {
        let enderecoCompleto = `${item.endereco || ''}, ${item.numero || 'S/N'} - ${item.bairro || ''} - ${item.municipio || ''}`;
        
        tbody.innerHTML += `
            <tr>
                <td><b style="color:#333;">${item.resp_nome ? item.resp_nome.toUpperCase() : '-'}</b></td>
                <td><span style="color:#3699ff; font-weight:bold;">${item.cpf || '-'}</span><br><span style="font-size:11px; color:#666;"><b>RG:</b> ${item.rg || '-'}</span></td>
                <td>${item.telefone || '-'}</td>
                <td style="font-size:11px; color:#555;">${enderecoCompleto}</td>
                <td style="text-align:right;">
                    <button class="btn-action-square btn-action-edit" onclick="window.editarContribuinteAdmin('${item.cpf}')" title="Editar Contribuinte">✏️</button>
                </td>
            </tr>
        `;
    });
}

window.editarContribuinteAdmin = function(cpf) {
    const d = window.contribuintesMap[cpf];
    if (!d) return;
    
    document.getElementById('edit-cont-nome').value = d.resp_nome || '';
    document.getElementById('edit-cont-cpf').value = d.cpf || '';
    document.getElementById('edit-cont-rg').value = d.rg || '';
    document.getElementById('edit-cont-tel').value = d.telefone || '';
    document.getElementById('edit-cont-cep').value = d.cep || '';
    document.getElementById('edit-cont-end').value = d.endereco || '';
    document.getElementById('edit-cont-num').value = d.numero || '';
    document.getElementById('edit-cont-comp').value = d.complemento || '';
    document.getElementById('edit-cont-bairro').value = d.bairro || '';
    document.getElementById('edit-cont-mun').value = d.municipio || '';
    
    document.getElementById('div-editar-contribuinte').classList.remove('hidden');
    document.getElementById('edit-cont-nome').focus();
}

window.cancelarEdicaoContribuinte = function() {
    document.getElementById('div-editar-contribuinte').classList.add('hidden');
}

window.salvarEdicaoContribuinte = function() {
    const cpf = document.getElementById('edit-cont-cpf').value;
    if (!cpf) return;

    const dadosAtualizados = {
        resp_nome: document.getElementById('edit-cont-nome').value.trim(),
        rg: document.getElementById('edit-cont-rg').value.trim(),
        telefone: document.getElementById('edit-cont-tel').value.trim(),
        cep: document.getElementById('edit-cont-cep').value.trim(),
        endereco: document.getElementById('edit-cont-end').value.trim(),
        numero: document.getElementById('edit-cont-num').value.trim(),
        complemento: document.getElementById('edit-cont-comp').value.trim(),
        bairro: document.getElementById('edit-cont-bairro').value.trim(),
        municipio: document.getElementById('edit-cont-mun').value.trim()
    };

    const database = getDB();
    
    database.collection("requerimentos_exumacao").where("cpf", "==", cpf).get().then(snap => {
        const batch = database.batch();
        snap.forEach(doc => {
            batch.update(doc.ref, dadosAtualizados);
        });
        
        return batch.commit().then(() => {
            alert("Dados do contribuinte atualizados em todos os requerimentos com sucesso!");
            database.collection("auditoria").add({ 
                data_log: new Date().toISOString(), 
                usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', 
                acao: "EDIÇÃO", 
                detalhe: `Atualização global do contribuinte CPF: ${cpf}`,
                sistema: "Exumacao" 
            });
            window.cancelarEdicaoContribuinte();
            window.buscarContribuintesAdmin();
        });
    }).catch(err => {
        console.error(err);
        alert("Erro ao atualizar contribuinte.");
    });
}

// --- FIM LÓGICA CONTRIBUINTES ---

window.listarEquipe = function() {
    const database = getDB();
    const tbody = document.getElementById('lista-equipe');
    if(!database || !tbody) return;
    
    if (equipeUnsubscribe) equipeUnsubscribe();
    equipeUnsubscribe = database.collection("equipe").orderBy("nome").onSnapshot(snap => {
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            
            let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nome)}&background=random&color=fff&bold=true`;
            
            tbody.innerHTML += `<tr>
                <td>
                    <div class="user-info">
                        <img src="${avatarUrl}" class="user-avatar" alt="Avatar">
                        <div>
                            <div style="font-weight: 600; color: #333; font-size: 14px;">${u.nome}</div>
                            <div style="font-size: 11px; color: #888;">${u.email || 'Sem e-mail'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="color: #555; font-weight: 500;">${u.login}</span>
                </td>
                <td>
                    <div style="display:flex; align-items:center;">
                        <span class="senha-oculta" data-senha="${u.senha}">••••••</span>
                        <button type="button" class="btn-action-square btn-action-view" onclick="window.toggleSenha(this)" title="Ver Senha">👁️</button>
                    </div>
                </td>
                <td>
                    <div class="action-group">
                        <button type="button" class="btn-action-square btn-action-edit" onclick="window.editarFuncionario('${doc.id}')" title="Editar">✏️</button>
                        <button type="button" class="btn-action-square btn-action-del" onclick="window.excluirFuncionario('${doc.id}')" title="Excluir">🗑️</button>
                    </div>
                </td>
            </tr>`;
        });
    });
}

window.toggleSenha = function(btn) {
    const span = btn.previousElementSibling;
    if (span.innerText === '••••••') {
        span.innerText = span.getAttribute('data-senha');
        span.style.letterSpacing = 'normal';
        span.style.fontSize = '13px';
    } else {
        span.innerText = '••••••';
        span.style.letterSpacing = '2px';
        span.style.fontSize = '16px';
    }
}

window.adicionarFuncionario = function() {
    const nome = document.getElementById('novo-nome').value.trim();
    const login = document.getElementById('novo-login').value.trim();
    const email = document.getElementById('novo-email').value.trim();
    const senha = document.getElementById('nova-senha').value.trim();
    
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
            document.getElementById('edit-email').value = u.email || '';
            document.getElementById('edit-senha').value = u.senha;
            document.getElementById('box-novo-usuario').classList.add('hidden');
            document.getElementById('div-editar-usuario').classList.remove('hidden');
        }
    });
}

window.salvarEdicaoUsuario = function() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const senha = document.getElementById('edit-senha').value.trim();
    
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
    let contagemCemiterios = {};
    let totalRequerimentos = 0;

    if (modo === 'mes') {
        dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1);
        dString = dInicio.toISOString();
    } else {
        dInicio.setDate(dInicio.getDate() - parseInt(modo));
        dString = dInicio.toISOString();
    }
    
    database.collection("requerimentos_exumacao").where("data_registro", ">=", dString).onSnapshot(snap => {
        let servicos = {};
        contagemCemiterios = {};
        totalRequerimentos = 0;

        snap.forEach(doc => {
            const d = doc.data();
            totalRequerimentos++;
            
            // Contagem de Serviços Múltiplos
            if(d.servico_requerido) { 
                const servicosArray = d.servico_requerido.split(',').map(s => s.trim().toUpperCase());
                servicosArray.forEach(k => {
                    if(k) servicos[k] = (servicos[k] || 0) + 1; 
                });
            }

            // Contagem de Cemitérios
            let cemNome = d.cemiterio ? d.cemiterio.toUpperCase() : "N/A";
            if (cemNome === 'OUTRO' && d.cemiterio_outro) cemNome = d.cemiterio_outro.toUpperCase();
            contagemCemiterios[cemNome] = (contagemCemiterios[cemNome] || 0) + 1;
        });

        // Atualiza KPI Total
        const elTotal = document.getElementById('kpi-total');
        if (elTotal) elTotal.innerText = totalRequerimentos;
        
        // Renderiza Gráfico 1: Serviços
        const sorted = Object.entries(servicos).sort((a,b) => b[1] - a[1]).slice(0, 10);
        const labels = sorted.map(x => x[0]);
        const data = sorted.map(x => x[1]);

        const ctx = document.getElementById('grafico-servicos');
        if(ctx && window.Chart) {
            if(chartInstances['servicos']) chartInstances['servicos'].destroy();
            chartInstances['servicos'] = new Chart(ctx, {
                type: 'bar',
                data: { 
                    labels: labels, 
                    datasets: [{ 
                        label: 'Qtd. de Serviços', 
                        data: data, 
                        backgroundColor: 'rgba(54, 153, 255, 0.85)',
                        borderRadius: 6,
                        barPercentage: 0.6
                    }] 
                },
                options: { 
                    indexAxis: 'y', 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: { 
                        x: { beginAtZero: true, grid: { display: false } },
                        y: { grid: { display: false } }
                    } 
                }
            });
        }

        // Renderiza Gráfico 2: Cemitérios (Doughnut)
        const sortedCem = Object.entries(contagemCemiterios).sort((a,b) => b[1] - a[1]);
        const labelsCem = sortedCem.map(x => x[0]);
        const dataCem = sortedCem.map(x => x[1]);

        const ctxCem = document.getElementById('grafico-cemiterios');
        if(ctxCem && window.Chart) {
            if(chartInstances['cemiterios']) chartInstances['cemiterios'].destroy();
            chartInstances['cemiterios'] = new Chart(ctxCem, {
                type: 'doughnut',
                data: {
                    labels: labelsCem,
                    datasets: [{
                        data: dataCem,
                        backgroundColor: ['#3699ff', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6', '#34495e', '#e67e22'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
                    }
                }
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

// --- TABELA E BUSCA PRINCIPAL MULTI-CAMPOS ---
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
    const termoOriginal = document.getElementById('input-busca').value.trim();
    const termo = normalizeStr(termoOriginal);
    const fd = document.getElementById('filtro-data');
    
    if (!termoOriginal) { 
        if (fd && !fd.value) fd.value = pegarDataISO();
        carregarTabela(); 
        return; 
    }
    
    if (fd) fd.value = "";

    const database = getDB();
    if (unsubscribe) unsubscribe();
    
    const termoSemPontuacao = termo.replace(/[\.\-\/\(\)\s]/g, '');

    unsubscribe = database.collection("requerimentos_exumacao")
        .orderBy("data_registro", "desc")
        .limit(1000)
        .onSnapshot((snap) => {
            let lista = [];
            snap.forEach(doc => { 
                let d = doc.data(); 
                d.id = doc.id; 
                
                let stringBusca = `${d.protocolo || ''} ${d.resp_nome || ''} ${d.nome_falecido || ''} ${d.cpf || ''} ${d.rg || ''} ${d.telefone || ''} `;
                let tSearchIdx = 2;
                while(d['telefone'+tSearchIdx]) { 
                    stringBusca += d['telefone'+tSearchIdx] + ' '; 
                    tSearchIdx++; 
                }
                stringBusca += `${d.processo || ''} ${d.cemiterio || ''}`;
                
                stringBusca = normalizeStr(stringBusca);
                
                let stringSemPontuacao = stringBusca.replace(/[\.\-\/\(\)\s]/g, '');

                if (stringBusca.includes(termo) || (termoSemPontuacao !== '' && stringSemPontuacao.includes(termoSemPontuacao))) {
                    lista.push(d); 
                }
            });
            renderizarTabela(lista);
        });
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo'); if(!tbody) return;
    tbody.innerHTML = ''; 
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center;">Nenhum registro encontrado.</td></tr>'; return; }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizarDocumentos(item.id);
        
        let dataF = item.data_registro ? formatarDataInversa(item.data_registro.split('T')[0]) : '-';

        let telsList = item.telefone || '';
        let tIndex = 2;
        while(item['telefone'+tIndex]) { telsList += ' / ' + item['telefone'+tIndex]; tIndex++; }

        let cemDisplay = item.cemiterio === 'OUTRO' ? item.cemiterio_outro : item.cemiterio;

        tr.innerHTML = `
            <td style="vertical-align:middle;"><b>${item.resp_nome.toUpperCase()}</b><br><span style="font-size:11px;">Tel: ${telsList}</span></td>
            <td style="vertical-align:middle;"><b>${item.nome_falecido.toUpperCase()}</b></td>
            <td style="vertical-align:middle;">${cemDisplay}</td>
            <td style="vertical-align:middle;">${item.servico_requerido}</td>
            <td style="vertical-align:middle; font-size:13px; line-height: 1.5;">
                <div style="color: #3699ff;"><b>Prot:</b> <span style="font-weight:bold;">${item.protocolo || '-'}</span></div>
                <div style="color: #d35400;"><b>Proc:</b> <span style="font-weight:bold;">${item.processo || '-'}</span></div>
                <div style="color: #27ae60;"><b>GRM:</b> <span style="font-weight:bold;">${item.grm || '-'}</span></div>
            </td>
            <td style="vertical-align:middle;">${dataF}</td>
            <td style="text-align:right; vertical-align:middle;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-icon btn-editar-circle" title="Editar Requerimento" onclick="event.stopPropagation();window.editar('${item.id}')">✏️</button>
                    <button class="btn-icon btn-liberar-circle" title="Preencher Liberação" onclick="event.stopPropagation();window.abrirLiberacao('${item.id}')">📝</button>
                    <button class="btn-icon btn-unir-circle" title="Unir PDFs" onclick="event.stopPropagation();window.abrirModalUnir('${item.protocolo}')">📁</button>
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
    
    const box = document.getElementById('box-telefones');
    if (box) {
        const inputs = box.querySelectorAll('input');
        for(let i=1; i<inputs.length; i++) box.removeChild(inputs[i]);
        window.telCount = 1;
    }

    if(document.getElementById('cemiterio_outro')) {
        document.getElementById('cemiterio_outro').style.display = 'none';
        document.getElementById('cemiterio_outro').required = false;
    }

    if (usuarioLogado && usuarioLogado.nome) document.getElementById('atendente_sistema').value = usuarioLogado.nome;
    safeDisplay('modal', 'block');
}

window.fecharModal = function() { safeDisplay('modal', 'none'); }
window.fecharModalVisualizar = function() { safeDisplay('modal-visualizar', 'none'); }

window.editar = function(id) {
    getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            
            const box = document.getElementById('box-telefones');
            if (box) {
                const inputs = box.querySelectorAll('input');
                for(let i=1; i<inputs.length; i++) box.removeChild(inputs[i]);
                window.telCount = 1;
            }
            
            let idx = 2;
            while(d['telefone'+idx]) {
                window.addTelefone(d['telefone'+idx]);
                idx++;
            }

            for (let key in d) { 
                const el = document.getElementById(key); 
                if(el && el.type !== 'file') {
                    if (el.tagName === 'SELECT' && el.multiple) {
                        let values = d[key] ? d[key].split(', ') : [];
                        Array.from(el.options).forEach(opt => {
                            opt.selected = values.includes(opt.value);
                        });
                    } else {
                        el.value = d[key]; 
                    }
                }
            }
            
            window.toggleCemiterioOutro();
            document.getElementById('docId').value = doc.id;
            safeDisplay('modal', 'block');
        }
    });
}

// SALVAR REQUERIMENTO
const form = document.getElementById('form-atendimento');
if(form) {
    form.onsubmit = (e) => {
        e.preventDefault();
        const database = getDB();
        const id = document.getElementById('docId').value;
        let dados = {};
        Array.from(form.elements).forEach(el => {
            if(el.id && el.type !== 'submit' && el.type !== 'button') { 
                if (el.tagName === 'SELECT' && el.multiple) {
                    let values = Array.from(el.selectedOptions).map(opt => opt.value);
                    dados[el.id] = values.join(', ');
                } else {
                    dados[el.id] = el.value; 
                }
            }
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

// --- LÓGICA DE AUTO-PREENCHIMENTO DO TEXTO DE LIBERAÇÃO ---
window.preencherReferenteAutomatico = function() {
    if (window.dadosLiberacaoAtual) {
        document.getElementById('referente_a').value = window.gerarTextoReferenteA(window.dadosLiberacaoAtual);
    } else {
        alert("Aguarde os dados carregarem...");
    }
}

window.gerarTextoReferenteA = function(d) {
    let s = d.servico_requerido ? d.servico_requerido.toUpperCase() : "";
    let servicosSelecionados = s.split(',').map(x => x.trim()).filter(x => x !== "");
    let servicosProcessados = [];
    
    let falecido = d.nome_falecido ? d.nome_falecido.toUpperCase() : "(NOME DO FALECIDO)";
    let dtSepul = formatarDataInversa(d.data_sepultamento) || "(DATA)";
    let tipoSepul = d.tipo_sepultura ? d.tipo_sepultura.toUpperCase() : "(TIPO DE SEPULTURA)";
    let sepul = d.sepul || "XXX";
    let quadra = d.qd ? `DA QUADRA ${d.qd.toUpperCase()}` : "";
    let cemOrigem = d.cemiterio === "OUTRO" ? (d.cemiterio_outro ? d.cemiterio_outro.toUpperCase() : "(OUTRO CEMITÉRIO)") : (d.cemiterio ? d.cemiterio.toUpperCase() : "(CEMITÉRIO DE ORIGEM)");
    let cemDestino = d.cemiterio_destino ? d.cemiterio_destino.toUpperCase() : "(CEMITÉRIO DE DESTINO)";
    let lacre = d.lacre || "";
    
    let destTipo = d.destino_tipo_sepultura ? d.destino_tipo_sepultura.toUpperCase() : "(TIPO DESTINO)";
    let destNro = d.destino_local_nro || "XXX";
    let destLivro = d.destino_livro || "X";
    let destFls = d.destino_fls || "X";
    let destProp = d.destino_proprietario ? d.destino_proprietario.toUpperCase() : "(NOME DO DONO)";
    let propOrigem = d.proprietario ? d.proprietario.toUpperCase() : "(NOME DO DONO)";
    let processo = d.processo || "XXXXXXXX/XXXX";
    let assunto = d.assunto ? d.assunto.toUpperCase() : "(MOTIVO)";
    let servReforma = d.servico_reforma ? d.servico_reforma.toUpperCase() : "MÁRMORE OU GRANITO";

    let textoPrincipal = "";
    let textosExtras = [];

    if (s.includes("EXUMAÇÃO") && s.includes("SAÍDA DE OSSOS")) {
        textoPrincipal = `EXUMAÇÃO E SAÍDA DE OSSOS DA ${tipoSepul} N° ${sepul} ${quadra} ONDE FOI INUMADO ${falecido} NO DIA ${dtSepul} DO CEMITÉRIO MUNICIPAL ${cemOrigem} PARA O CEMITÉRIO ${cemDestino}`;
        servicosProcessados.push("EXUMAÇÃO", "SAÍDA DE OSSOS");
    } 
    else if (s.includes("EXUMAÇÃO") && s.includes("RECOLHIMENTO")) {
        if (!d.destino_local_nro && (d.processo || !d.destino_tipo_sepultura)) {
            textoPrincipal = `EXUMAÇÃO DA ${tipoSepul} N° ${sepul} ${quadra} ONDE FOI INUMADO ${falecido} NO DIA ${dtSepul} E RECOLHER AO NICHO A SER ADQUIRIDO ATRAVÉS DO PROCESSO N° ${processo} NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : cemOrigem}`;
        } else if (destTipo === tipoSepul && destNro === sepul) {
            textoPrincipal = `EXUMAÇÃO DA ${tipoSepul} PERPÉTUA N° ${sepul} ${quadra} ONDE FOI INUMADO ${falecido} NO DIA ${dtSepul} E RECOLHER A PRÓPRIA SEPULTURA REGISTRADA NO LIVRO ${destLivro} AS FOLHAS N° ${destFls} EM NOME DE ${propOrigem} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`;
        } else {
            textoPrincipal = `EXUMAÇÃO DA ${tipoSepul} N° ${sepul} ${quadra} ONDE FOI INUMADO ${falecido} NO DIA ${dtSepul} E RECOLHER AO ${destTipo} PERPÉTUO N° ${destNro} REGISTRADO NO LIVRO ${destLivro} AS FOLHAS N° ${destFls} EM NOME DE ${destProp} NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : cemOrigem}`;
        }
        servicosProcessados.push("EXUMAÇÃO", "RECOLHIMENTO");
    }
    else if (s.includes("EXUMAÇÃO") && s.includes("PERMISSÃO DE USO")) {
        textoPrincipal = `EXUMAÇÃO DA ${tipoSepul} N° ${sepul} ${quadra} ONDE FOI INUMADO ${falecido} NO DIA ${dtSepul} E PERMISSÃO DE USO DE 1 (UM) NICHO NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : cemOrigem}`;
        servicosProcessados.push("EXUMAÇÃO", "PERMISSÃO DE USO");
    }
    else if ((s.includes("ENTRADA DE OSSOS") || s.includes("ENTRADA DE CINZAS")) && s.includes("PERMISSÃO DE USO")) {
        textoPrincipal = `ENTRADA DE OSSOS/CINZAS DE ${falecido} VINDAS DO CEMITÉRIO ${cemOrigem} E PERMISSÃO DE USO DE 1 (UM) NICHO NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : "(CEMITÉRIO)"}`;
        servicosProcessados.push("ENTRADA DE OSSOS / CINZAS", "PERMISSÃO DE USO");
    }
    else if ((s.includes("ENTRADA DE OSSOS") || s.includes("ENTRADA DE CINZAS")) && s.includes("RECOLHIMENTO")) {
        textoPrincipal = `ENTRADA DE OSSOS/CINZAS DE ${falecido} VINDAS DO CEMITÉRIO ${cemOrigem} E RECOLHER AO ${destTipo} PERPÉTUO N° ${destNro} REGISTRADO NO LIVRO ${destLivro} AS FOLHAS N° ${destFls} EM NOME DE ${destProp} NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : "(CEMITÉRIO)"}`;
        servicosProcessados.push("ENTRADA DE OSSOS / CINZAS", "RECOLHIMENTO");
    }
    else if (s.includes("RECOLHIMENTO") && lacre !== "") {
        textoPrincipal = `RECOLHIMENTO DOS RESTOS MORTAIS DE ${falecido} IDENTIFICADOS PELO LACRE ${lacre} QUE SE ENCONTRAVAM NA ${tipoSepul} N° ${sepul} AO ${destTipo} PERPÉTUO N° ${destNro} REGISTRADO NO LIVRO ${destLivro} AS FOLHAS N° ${destFls} EM NOME DE ${destProp} NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : cemOrigem}`;
        servicosProcessados.push("RECOLHIMENTO");
    }
    else if (s.includes("PERMUTA")) {
        textoPrincipal = `PERMUTA DA SEPULTURA/NICHO PERPÉTUO N° ${sepul} POR MOTIVO DE ${assunto} REGISTRADO NO LIVRO ${destLivro !== 'X' ? destLivro : (d.livro||'X')} AS FOLHAS N° ${destFls !== 'X' ? destFls : (d.fls||'X')} EM NOME DE ${propOrigem} POR OUTRA VAGA NO CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : cemOrigem}`;
        servicosProcessados.push("PERMUTA");
    }
    
    // Processa os serviços que sobraram e anexa inteligentemente
    servicosSelecionados.forEach(serv => {
        let alreadyProcessed = servicosProcessados.some(p => serv === p || p.includes(serv));
        if (!alreadyProcessed) {
            if (serv.includes("LICENÇA COM ÔNUS PARA COLOCAÇÃO DE LAPIDE")) {
                if (destNro !== "XXX" || sepul !== "XXX") {
                    let num = destNro !== "XXX" ? destNro : sepul;
                    let tipo = destTipo !== "(TIPO DESTINO)" ? destTipo : tipoSepul;
                    let livro = destLivro !== "X" ? destLivro : "(LIVRO)";
                    let fls = destFls !== "X" ? destFls : "(FLS)";
                    let dono = destProp !== "(NOME DO DONO)" ? destProp : propOrigem;
                    textosExtras.push(`LICENÇA COM ÔNUS PARA COLOCAÇÃO DE LÁPIDE DE IDENTIFICAÇÃO EM MÁRMORE OU GRANITO COM INSCRIÇÕES DE NOME, FOTO E DATA NO ${tipo} PERPÉTUO N° ${num} REGISTRADO NO LIVRO ${livro} AS FOLHAS N° ${fls} EM NOME DE ${dono} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
                } else {
                    textosExtras.push(`LICENÇA COM ÔNUS PARA COLOCAÇÃO DE LÁPIDE DE IDENTIFICAÇÃO EM MÁRMORE OU GRANITO COM INSCRIÇÕES DE NOME, FOTO E DATA NO NICHO A SER ADQUIRIDO ATRAVÉS DO PROCESSO N° ${processo} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
                }
            }
            else if (serv.includes("REVESTIMENTO") || serv.includes("REFORMA")) {
                textosExtras.push(`SERVIÇO EM ${servReforma} NA ${tipoSepul} PERPÉTUA N° ${sepul} REGISTRADO NO LIVRO ${destLivro !== 'X' ? destLivro : (d.livro||'X')} AS FOLHAS N° ${destFls !== 'X' ? destFls : (d.fls||'X')} EM NOME DE ${propOrigem} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
            }
            else if (serv.includes("CERTIDÃO DE PERMISSÃO DE USO")) {
                textosExtras.push(`CERTIDÃO DE PERMISSÃO DE USO DA ${tipoSepul} N° ${sepul} ONDE SE ENCONTRAM OS RESTOS MORTAIS DE ${falecido} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
            }
            else if (serv === "CERTIDÃO") {
                textosExtras.push(`EMISSÃO DE CERTIDÃO REFERENTE AO(A) FALECIDO(A) ${falecido} INUMADO NA ${tipoSepul} N° ${sepul} ${quadra} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
            }
            else if (serv === "PERMISSÃO DE USO") {
                textosExtras.push(`PERMISSÃO DE USO DE 1 (UM) ${tipoSepul} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
            }
            else if (serv === "EXUMAÇÃO" && !textoPrincipal) {
                textoPrincipal = `EXUMAÇÃO DO(A) FALECIDO(A) ${falecido} INUMADO(A) NO DIA ${dtSepul} NA ${tipoSepul} N° ${sepul} ${quadra} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`;
            }
            else if (serv === "SAÍDA DE OSSOS" && !textoPrincipal) {
                textoPrincipal = `SAÍDA DE OSSOS DO(A) FALECIDO(A) ${falecido} DA ${tipoSepul} N° ${sepul} ${quadra} DO CEMITÉRIO MUNICIPAL ${cemOrigem} PARA O CEMITÉRIO ${cemDestino}`;
            }
            else if (serv === "RECOLHIMENTO" && !textoPrincipal) {
                textoPrincipal = `RECOLHIMENTO DE RESTOS MORTAIS DO(A) FALECIDO(A) ${falecido} DA ${tipoSepul} N° ${sepul} ${quadra} DO CEMITÉRIO MUNICIPAL ${cemOrigem}`;
            }
            else if (serv === "ENTRADA DE OSSOS / CINZAS" && !textoPrincipal) {
                textoPrincipal = `${serv} DO(A) FALECIDO(A) ${falecido} VINDAS DO CEMITÉRIO ${cemOrigem} PARA O CEMITÉRIO MUNICIPAL ${cemDestino !== '(CEMITÉRIO DE DESTINO)' ? cemDestino : '(CEMITÉRIO DESTINO)'}`;
            }
            else if (serv === "OUTROS") {
                textosExtras.push(`DIVERSOS/OUTROS SERVIÇOS REFERENTE A ${falecido} NA ${tipoSepul} N° ${sepul} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`);
            }
            else {
                if(!textoPrincipal) {
                    textoPrincipal = `${serv} DO(A) FALECIDO(A) ${falecido} NA ${tipoSepul} N° ${sepul} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`;
                } else {
                    textosExtras.push(`${serv}`);
                }
            }
        }
    });

    let textoFinal = "";
    if (textoPrincipal) {
        textoFinal = textoPrincipal;
        if (textosExtras.length > 0) {
            textoFinal += " E " + textosExtras.join(" E ");
        }
    } else if (textosExtras.length > 0) {
        textoFinal = textosExtras.join(" E ");
    } else {
        let s_fmt = s.replace(/, /g, ' E '); 
        textoFinal = `REFERENTE A ${s_fmt} DO(A) FALECIDO(A) ${falecido} NA ${tipoSepul} N° ${sepul} ${quadra} NO CEMITÉRIO MUNICIPAL ${cemOrigem}`;
    }
    
    return textoFinal.replace(/\s+/g, ' ').trim() + ".";
}

// --- MODAL E LÓGICA EXCLUSIVA DA LIBERAÇÃO ---
window.abrirLiberacao = function(id) {
    document.getElementById('form-liberacao').reset();
    getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            d.id = doc.id;
            window.dadosLiberacaoAtual = d;

            document.getElementById('docIdLiberacao').value = doc.id;
            if(d.processo) document.getElementById('processo_lib').value = d.processo;
            if(d.grm) document.getElementById('grm_lib').value = d.grm;
            if(d.valor_pago) document.getElementById('valor_pago').value = d.valor_pago;
            
            if(d.referente_a) {
                document.getElementById('referente_a').value = d.referente_a;
            } else {
                document.getElementById('referente_a').value = window.gerarTextoReferenteA(d);
            }
            
            safeDisplay('modal-liberacao', 'block');
        }
    });
}

window.fecharModalLiberacao = function() { safeDisplay('modal-liberacao', 'none'); window.dadosLiberacaoAtual = null; }

// SALVAR APENAS OS DADOS DE LIBERAÇÃO
const formLib = document.getElementById('form-liberacao');
if(formLib) {
    formLib.onsubmit = (e) => {
        e.preventDefault();
        const database = getDB();
        const id = document.getElementById('docIdLiberacao').value;
        
        let dadosLiberacao = {
            processo: document.getElementById('processo_lib').value,
            grm: document.getElementById('grm_lib').value,
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
    if (event.target == document.getElementById('modal-unir')) window.fecharModalUnir(); 
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
        
        let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogado.nome)}&background=random&color=fff&bold=true`;
        document.getElementById('user-display').innerHTML = `
            <div class="user-info" style="margin-right: 15px; text-align: left;">
                <img src="${avatarUrl}" class="user-avatar" alt="Avatar" style="width: 36px; height: 36px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="line-height: 1.2;">
                    <div style="font-weight: 800; color: #3699ff; font-size: 13px; text-transform: uppercase;">${usuarioLogado.nome}</div>
                    <div style="font-size: 10px; color: #888;">${usuarioLogado.email || 'Atendente'}</div>
                </div>
            </div>
        `;
        
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
            
            let cemDisplay = d.cemiterio === 'OUTRO' ? d.cemiterio_outro : d.cemiterio;

            const resumoEl = document.getElementById('resumo-dados');
            if(resumoEl) {
                resumoEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Protocolo</span><br><strong style="color:var(--primary-color); font-size:14px;">${d.protocolo || 'N/A'}</strong></div>
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Requerente</span><br><strong style="font-size:14px;">${d.resp_nome ? d.resp_nome.toUpperCase() : '-'}</strong></div>
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Falecido(a)</span><br><strong style="font-size:14px;">${d.nome_falecido ? d.nome_falecido.toUpperCase() : '-'}</strong></div>
                        
                        <div><span style="color:#888; font-size:10px; text-transform:uppercase; font-weight:bold;">Cemitério / Serviço</span><br><strong>${cemDisplay ? cemDisplay.toUpperCase() : '-'} (${d.servico_requerido ? d.servico_requerido.toUpperCase() : '-'})</strong></div>
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

// --- IMPRESSÃO DO REQUERIMENTO COM FONTE AUMENTADA ---
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

    let telsList = d.telefone || '';
    let tIndex = 2;
    while(d['telefone'+tIndex]) { telsList += ' / ' + d['telefone'+tIndex]; tIndex++; }

    let cemOrigem = d.cemiterio === 'OUTRO' ? d.cemiterio_outro : d.cemiterio;

    const html = `<html><head><title>Requerimento Exumação</title><style>
        @page { size: A4 portrait; margin: 15mm; }
        body { 
            font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #000; position: relative; 
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

        .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px; position: relative;}
        .header img.logo-print { height: 50px; }
        .header-subtitle { font-size: 12px; font-weight: bold; margin-top: 5px; text-transform: uppercase; }
        .doc-title { font-size: 17px; font-weight: bold; text-align: center; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .section { margin-bottom: 10px; border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
        .section-title { font-weight: bold; font-size: 12px; background-color: #f0f0f0; padding: 4px 8px; margin: -8px -8px 8px -8px; border-bottom: 1px solid #ccc; border-radius: 4px 4px 0 0; text-transform: uppercase; color: #333; }
        .row { display: flex; margin-bottom: 6px; gap: 15px; }
        .field { display: flex; flex-direction: column; flex: 1; }
        .label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;}
        .value { font-size: 14px; font-weight: bold; border-bottom: 1px solid #000; padding-top: 2px; padding-bottom: 2px; min-height: 16px;}
        .chk-item { font-weight: bold; font-size: 14px; }
        .footer-note { font-size: 11px; text-align: justify; margin-top: 15px; padding: 8px; border: 1px dashed #999; background-color: #f9f9f9; border-radius: 4px;}
        .legal { font-size: 9px; text-align: center; margin-top: 15px; font-weight: bold; color: #444; }
        .box-protocolo { position: absolute; top: 0; right: 0; border: 2px solid #000; padding: 4px 8px; font-weight: bold; font-size: 12px; font-family: sans-serif; background: #fff; }
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
                <div class="field"><span class="label">Telefone(s)</span><span class="value">${telsList}</span></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Dados do Falecido(a)</div>
            <div class="row">
                <div class="field" style="flex: 2;"><span class="label">Nome do(a) Falecido(a)</span><span class="value">${d.nome_falecido.toUpperCase()}</span></div>
                <div class="field"><span class="label">Data de Sepultamento</span><span class="value">${formatarDataInversa(d.data_sepultamento)}</span></div>
                <div class="field"><span class="label">Cemitério</span><span class="value">${cemOrigem ? cemOrigem.toUpperCase() : ''}</span></div>
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

        <div style="margin-top:10px; font-size: 14px;">Nestes termos, peço deferimento.</div>
        <div style="text-align:right; margin-top:5px; font-size: 14px;"><b>${dataTexto}</b></div>

        <div style="display: flex; justify-content: space-around; margin-top: 30px; text-align: center;">
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

// --- IMPRESSÃO DA LIBERAÇÃO COM FONTE AUMENTADA ---
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

    let telsList = d.telefone || '';
    let tIndex = 2;
    while(d['telefone'+tIndex]) { telsList += ' / ' + d['telefone'+tIndex]; tIndex++; }
    
    let cemOrigem = d.cemiterio === 'OUTRO' ? d.cemiterio_outro : d.cemiterio;

    let blocoAssinaturaRequerente = assinaturaResponsavelImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let blocoAssinaturaAtendente = assinaturaAtendenteImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;

    const html = `<html><head><title>Liberação</title><style>
        @page { size: A4 portrait; margin: 20mm; }
        body { 
            font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #000; position: relative;
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

        .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px; position: relative;}
        .header img.logo-print { height: 50px; }
        .header-subtitle { font-size: 12px; font-weight: bold; margin-top: 5px; text-transform: uppercase; }
        .doc-title { font-size: 17px; font-weight: bold; text-align: center; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .section { margin-bottom: 10px; border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
        .section-title { font-weight: bold; font-size: 12px; background-color: #f0f0f0; padding: 4px 8px; margin: -8px -8px 8px -8px; border-bottom: 1px solid #ccc; border-radius: 4px 4px 0 0; text-transform: uppercase; color: #333; }
        .row { display: flex; margin-bottom: 6px; gap: 15px; }
        .field { display: flex; flex-direction: column; flex: 1; }
        .label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;}
        .value { font-size: 14px; font-weight: bold; border-bottom: 1px solid #000; padding-top: 2px; padding-bottom: 2px; min-height: 16px;}
        .footer-note { font-size: 11px; text-align: justify; margin-top: 15px; padding: 8px; border: 1px dashed #999; background-color: #f9f9f9; border-radius: 4px; line-height: 1.5;}
        .box-protocolo { position: absolute; top: 0; right: 0; border: 2px solid #000; padding: 4px 8px; font-weight: bold; font-size: 12px; font-family: sans-serif; background: #fff; }
    </style></head><body>
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Bras%C3%A3o_de_Niter%C3%B3i%2C_RJ.svg" class="watermark">

        <div class="header">
            <div class="box-protocolo">PROTOCOLO: ${d.protocolo || 'N/A'}</div>
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="logo-print">
            <div class="header-subtitle">Secretaria de Mobilidade e Infraestrutura - SEMOBI<br>Subsecretaria de Infraestrutura - SSINF<br>Coordenação dos Cemitérios de Niterói</div>
        </div>
        
        <div class="doc-title">Liberação</div>

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
                <div class="field"><span class="label">Cemitério Municipal</span><span class="value">${cemOrigem ? cemOrigem.toUpperCase() : ''}</span></div>
            </div>
            <div class="row">
                <div class="field" style="flex: 2.5;"><span class="label">Endereço</span><span class="value">${enderecoCompleto}</span></div>
                <div class="field" style="flex: 0.5;"><span class="label">CEP</span><span class="value">${d.cep || '-'}</span></div>
            </div>
            <div class="row">
                <div class="field"><span class="label">Bairro</span><span class="value">${d.bairro.toUpperCase()}</span></div>
                <div class="field"><span class="label">Município</span><span class="value">${d.municipio.toUpperCase()}</span></div>
                <div class="field"><span class="label">Telefone(s)</span><span class="value">${telsList}</span></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Referente A</div>
            <div class="row">
                <div class="field"><span class="value" style="border:none; text-align:justify; line-height: 1.5; text-transform: uppercase;">${d.referente_a ? d.referente_a.replace(/\n/g, '<br>') : '__________________________________________________________________________'}</span></div>
            </div>
        </div>

        <div class="footer-note">
            <b>ESTOU CIENTE QUE O(A) REQUERENTE DEVERÁ COMPARECER NO DIA DA EXUMAÇÃO/ENTRADA E SAÍDA DE OSSOS__________________________________________</b>
            <br><br>
            <div style="text-align: center; text-decoration: underline;"><b>EXUMAÇÃO E ENTRADA/SAÍDA DE OSSOS SÃO FEITAS DE SEGUNDA A SEXTA DAS 8H ÀS 10H, EXCETO FERIADOS.</b></div>
        </div>

        <div style="margin-top:15px; text-align:right; font-size: 14px;"><b>${dataTexto}</b></div>

        <div style="display: flex; justify-content: space-around; margin-top: 40px; text-align: center;">
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
                    <b>RESPONSÁVEL</b><br>
                </div>
            </div>
        </div>
        
        <div style="text-align:center; font-size: 10px; color: #666; margin-top: 30px;">
            Rua General Castrioto, 407 - Barreto - Niterói - 24110-256 - Tel.: 3513-6157
        </div>

    </body><script>window.onload=function(){setTimeout(function(){window.print()},800)}</script></html>`;
    
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

// --- IMPRESSÃO DAS DECLARAÇÕES (NOVOS MOLDES E ALINHAMENTO CORRIGIDO) ---
window.imprimirDeclaracao = function() {
    if (!dadosAtendimentoAtual) {
        alert("Nenhum atendimento selecionado.");
        return;
    }
    
    const d = dadosAtendimentoAtual;
    const tipoVal = document.getElementById('select_declaracao').value;

    const dataReq = d.data_registro ? new Date(d.data_registro) : new Date();
    const mesExtenso = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dataTexto = `${dataReq.getDate()} de ${mesExtenso[dataReq.getMonth()]} de ${dataReq.getFullYear()}`;

    // ASSINATURA CENTRALIZADA
    let blocoAssinaturaRequerente = assinaturaResponsavelImg ? `<div style="text-align:center;"><img src="${assinaturaResponsavelImg}" style="max-height:60px; margin-bottom: 5px;"></div>` : `<div style="height:60px;"></div>`;

    let enderecoCompleto = d.endereco ? d.endereco.toUpperCase() : '___________';
    if (d.numero) enderecoCompleto += `, Nº ${d.numero}`;

    let telsList = d.telefone || '';
    let tIndex = 2;
    while(d['telefone'+tIndex]) { telsList += ' / ' + d['telefone'+tIndex]; tIndex++; }

    // Variáveis auxiliares para as declarações
    const cpf = d.cpf || "___________";
    const rg = d.rg || "___________";
    const aut = d.autorizado || "O PRÓPRIO REQUERENTE";
    const falecido = d.nome_falecido ? d.nome_falecido.toUpperCase() : "___________";
    const proc = d.processo || "___________";
    
    const sepOrigem = d.sepul || "_____";
    const qdOrigem = d.qd || "_____";
    const tipoOrigem = d.tipo_sepultura ? d.tipo_sepultura.toUpperCase() : "___________";
    const cemOrigem = d.cemiterio === 'OUTRO' ? (d.cemiterio_outro ? d.cemiterio_outro.toUpperCase() : '___________') : (d.cemiterio ? d.cemiterio.toUpperCase() : '___________');
    
    const cemDestino = d.cemiterio_destino ? d.cemiterio_destino.toUpperCase() : "___________";
    const destNro = d.destino_local_nro || "_____";
    const destLivro = d.destino_livro || "_____";
    const destFls = d.destino_fls || "_____";
    const destProp = d.destino_proprietario ? d.destino_proprietario.toUpperCase() : "___________";
    
    const lacre = d.lacre || "___________";
    const servicoReforma = d.servico_reforma || "___________";

    let titulo_declaracao = "";
    let texto_dinamico = "";

    switch(tipoVal) {
        case "saida_nicho_perpetuo":
            titulo_declaracao = "Saída de ossos do nicho perpétuo";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a retirar os restos mortais do(a) falecido(a) <b>${falecido}</b> no nicho perpétuo nº <b>${sepOrigem}</b> registrado no livro nº <b>${destLivro}</b> as fls. <b>${destFls}</b> em nome de <b>${d.proprietario ? d.proprietario.toUpperCase() : '___________'}</b> que se encontra no Cemitério <b>${cemOrigem}</b> para o Cemitério <b>${cemDestino}</b>.`;
            break;
        case "exumacao_saida":
            titulo_declaracao = "Exumação e saída dos restos mortais";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a exumar os restos mortais do(a) falecido(a) <b>${falecido}</b> na sepultura (tipo) <b>${tipoOrigem}</b> nº <b>${sepOrigem}</b> qd <b>${qdOrigem}</b> que se encontra no Cemitério <b>${cemOrigem}</b> e saída dos ossos para o Cemitério <b>${cemDestino}</b>.`;
            break;
        case "exumacao_recolhimento_nicho_perp":
            titulo_declaracao = "Exumação e recolhimento da ossada ao nicho perpétuo";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a exumar os restos mortais do(a) falecido(a) <b>${falecido}</b> na sepultura (tipo) <b>${tipoOrigem}</b> nº <b>${sepOrigem}</b> quadra <b>${qdOrigem}</b> que se encontra no Cemitério <b>${cemOrigem}</b> e recolher a ossada ao nicho perpétuo nº <b>${destNro}</b> registrado no livro nº <b>${destLivro}</b> as fls. <b>${destFls}</b> em nome de <b>${destProp}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "exumacao_recolhimento_nicho_adq":
            titulo_declaracao = "Exumação e recolhimento da ossada ao nicho a ser adquirido";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a exumar os restos mortais do(a) falecido(a) <b>${falecido}</b> na sepultura (tipo) <b>${tipoOrigem}</b> nº <b>${sepOrigem}</b> quadra <b>${qdOrigem}</b> que se encontra no Cemitério <b>${cemOrigem}</b> e recolher a ossada ao nicho a ser adquirido através do processo n° <b>${proc}</b> no Cemitério <b>${cemDestino}</b>.`;
            break;
        case "exumacao_recolhimento_sep_perp":
            titulo_declaracao = "Exumação e recolhimento da ossada a sepultura perpétua";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a exumar os restos mortais do(a) falecido(a) <b>${falecido}</b> que se encontra inumado na sepultura (tipo) <b>${tipoOrigem}</b> nº <b>${sepOrigem}</b> qd <b>${qdOrigem}</b> no Cemitério <b>${cemOrigem}</b> e recolher a ossada a sepultura perpétua nº <b>${destNro}</b> livro nº <b>${destLivro}</b> fls. nº <b>${destFls}</b> em nome de <b>${destProp}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "entrada_recolhimento_nicho_perp":
            titulo_declaracao = "Entrada de restos mortais e recolhimento da ossada ao nicho perpétuo";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a transladar os restos mortais do(a) falecido(a) <b>${falecido}</b> vindos do Cemitério <b>${cemOrigem}</b> e recolher a ossada ao nicho perpétuo nº <b>${destNro}</b> livro nº <b>${destLivro}</b> fls nº <b>${destFls}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "entrada_recolhimento_sep_perp":
            titulo_declaracao = "Entrada de restos mortais e recolhimento da ossada a sepultura perpétua";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a transladar os restos mortais do(a) falecido(a) <b>${falecido}</b> vindos do Cemitério <b>${cemOrigem}</b> e recolher a ossada a sepultura perpétua nº <b>${destNro}</b> QD <b>${qdOrigem}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "entrada_permissao_nicho":
            titulo_declaracao = "Entrada de restos mortais e permissão de uso de nicho";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a transladar os restos mortais do(a) falecido(a) <b>${falecido}</b> vindos do Cemitério <b>${cemOrigem}</b> e permissão de uso de nicho no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "entrada_cinzas_sep_perp":
            titulo_declaracao = "Entrada de cinzas e recolhimento a sepultura perpétua";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a transladar as cinzas do(a) falecido(a) <b>${falecido}</b> vindos do Cemitério <b>${cemOrigem}</b> e recolher as cinzas a sepultura perpétua nº <b>${destNro}</b> livro nº <b>${destLivro}</b> fls nº <b>${destFls}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "entrada_cinzas_nicho_perp":
            titulo_declaracao = "Entrada de cinzas e recolhimento da ossada ao nicho perpétuo";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a transladar as cinzas do (a) falecido (a) <b>${falecido}</b> vindos do Cemitério <b>${cemOrigem}</b>, e recolher as cinzas ao nicho perpétuo nº <b>${destNro}</b>, livro nº <b>${destLivro}</b>, fls nº <b>${destFls}</b>, no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "saida_sep_perp":
            titulo_declaracao = "Saída os ossos da sepultura perpétua";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a retirar os restos mortais do(a) falecido(a) <b>${falecido}</b> na sepultura perpétua (tipo) <b>${tipoOrigem}</b>, nº <b>${sepOrigem}</b>, da quadra <b>${qdOrigem}</b>, em nome de <b>${d.proprietario ? d.proprietario.toUpperCase() : '___________'}</b> que se encontra no Cemitério <b>${cemOrigem}</b> para o Cemitério <b>${cemDestino}</b>.`;
            break;
        case "permuta_sepultura":
            titulo_declaracao = "Permuta de sepultura";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a permutar a sepultura <b>${tipoOrigem}</b> n° <b>${sepOrigem}</b> registrado no livro nº <b>${destLivro}</b>, às fls nº <b>${destFls}</b>, em nome de <b>${d.proprietario ? d.proprietario.toUpperCase() : '___________'}</b> que se encontra no Cemitério <b>${cemOrigem}</b> e permutar por outra vaga no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "reparo_diversos":
            titulo_declaracao = "Reparo diversos";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a requerer reparo diversos na sepultura perpétua <b>${tipoOrigem}</b> nº <b>${sepOrigem}</b>, registrado no livro nº <b>${destLivro}</b>, às fls nº <b>${destFls}</b>, em nome de <b>${d.proprietario ? d.proprietario.toUpperCase() : '___________'}</b> que se encontra no Cemitério <b>${cemOrigem}</b>.`;
            break;
        case "capacidade_nicho":
            titulo_declaracao = "Termo de responsabilidade para capacidade do nicho e colocação de placa";
            texto_dinamico = `tomo ciência que o nicho a ser adquirido através do processo n° <b>${proc}</b> possui capacidade somente para uma ossada.<br><br>
            <b>Informação para quem abriu processo de colocação de placa:</b><br>
            • Não será aceita placas de identificação que não houver as mesmas dimensões do nicho;<br>
            • Os funcionários do Cemitério Municipal do Maruí são proibidos de fazer medição de pedra mármore / granito para nicho;<br>
            • A medição da placa será feita pelo funcionário da marmoraria/loja contratada pela família;<br>
            • Poderá ser aproveitada lápides oriundas de sepulturas ou de entradas de restos mortais desde que esteja dentro dos padrões mencionados acima;<br>
            • O funcionário (pedreiro) do Cemitério colocará a placa sem custo adicional;<br>
            • Não poderá colocar placas de azulejos, plástico ou inox; Só poderá ser placa de mármore/granito;<br>
            • O recibo entregue após o pagamento tem validade de 90 (NOVENTA) dias.<br><br>
            <b>Obs.:</b> Sendo assim, me responsabilizo por qualquer eventualidade.`;
            break;
        case "recolhimento_lacre_nicho_perp":
            titulo_declaracao = "Recolhimento da ossada ao nicho perpétuo";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a solicitar o recolhimento dos restos mortais do(a) falecido(a) <b>${falecido}</b> exumados e identificados sob lacre de nº <b>${lacre}</b> que se encontravam na sepultura (tipo) <b>${tipoOrigem}</b>, nº <b>${sepOrigem}</b>, quadra <b>${qdOrigem}</b>, que se encontra no Cemitério <b>${cemOrigem}</b> e recolher a ossada ao nicho perpétuo nº <b>${destNro}</b>, registrado no livro nº <b>${destLivro}</b>, as fls. <b>${destFls}</b>, em nome de <b>${destProp}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "saida_lacre":
            titulo_declaracao = "Saída da ossada sob lacre";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a solicitar o recolhimento dos restos mortais do(a) falecido(a) <b>${falecido}</b> exumados e identificados sob lacre de nº <b>${lacre}</b> que se encontravam na sepultura (tipo) <b>${tipoOrigem}</b>, nº <b>${sepOrigem}</b>, qd <b>${qdOrigem}</b>, que se encontra no Cemitério <b>${cemOrigem}</b> e saída dos ossos para o Cemitério <b>${cemDestino}</b>.`;
            break;
        case "permuta_nicho":
            titulo_declaracao = "Permuta de nicho";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a transladar os restos mortais do(a) falecido(a) <b>${falecido}</b> no nicho perpétuo nº <b>${sepOrigem}</b>, registrado no livro nº <b>${destLivro}</b>, às fls nº <b>${destFls}</b>, em nome de <b>${d.proprietario ? d.proprietario.toUpperCase() : '___________'}</b> que se encontra no Cemitério <b>${cemOrigem}</b> e permutar por um nicho vago no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "permissao_uso_sepultura":
            titulo_declaracao = "Permissão de uso de sepultura";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a solicitar a permissão de uso da sepultura (tipo) <b>${tipoOrigem}</b> n° <b>${sepOrigem}</b> quadra <b>${qdOrigem}</b> onde se encontra os restos mortais de <b>${falecido}</b> no Cemitério <b>${cemOrigem}</b>.`;
            break;
        case "autorizacao_placa_nicho":
            titulo_declaracao = "Autorização para colocação de placa de identificação no nicho perpétuo";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a dispor de uma placa de identificação no nicho perpétuo nº <b>${destNro}</b>, registrado no livro nº <b>${destLivro}</b>, as fls. <b>${destFls}</b>, em nome de <b>${destProp}</b> no Cemitério do <b>${cemDestino}</b>.`;
            break;
        case "servico_reforma_sep_perp":
            titulo_declaracao = "Serviço na sepultura perpétua";
            texto_dinamico = `Autorizo o(a) Sr(a) <b>${aut}</b> a requerer serviço em <b>${servicoReforma}</b> na sepultura perpétua <b>${tipoOrigem}</b> nº <b>${sepOrigem}</b>, registrado no livro nº <b>${destLivro}</b>, às fls nº <b>${destFls}</b>, em nome de <b>${d.proprietario ? d.proprietario.toUpperCase() : '___________'}</b> que se encontra no Cemitério <b>${cemOrigem}</b>.`;
            break;
        case "declaracao_residencia":
            titulo_declaracao = "De residência";
            texto_dinamico = `Declaro para devidos fins que tenho domicílio a <b>${enderecoCompleto}</b>, bairro <b>${d.bairro ? d.bairro.toUpperCase() : '___________'}</b>, município <b>${d.municipio ? d.municipio.toUpperCase() : '___________'}</b>, CEP <b>${d.cep || '___________'}</b>.`;
            break;
        case "cancelamento_processo":
            titulo_declaracao = "Termo de cancelamento";
            texto_dinamico = `Venho por meio desta, como <b>${d.parentesco ? d.parentesco.toUpperCase() : '___________'}</b> do falecido(a) <b>${falecido}</b> sepultado na sepultura <b>${tipoOrigem}</b> n° <b>${sepOrigem}</b> no cemitério <b>${cemOrigem}</b>, solicitar o cancelamento do meu processo nº <b>${proc}</b>.<br><br>Sugiro o arquivamento.`;
            break;
    }

    let textoIntro = `Eu, <b>${d.resp_nome ? d.resp_nome.toUpperCase() : '___________'}</b>, carteira de identidade nº <b>${rg}</b>, inscrito(a) sob o CPF nº <b>${cpf}</b>, residente à <b>${enderecoCompleto}</b>, bairro <b>${d.bairro ? d.bairro.toUpperCase() : '___________'}</b>, município <b>${d.municipio ? d.municipio.toUpperCase() : '___________'}</b>, contato telefônico <b>${telsList || '___________'}</b>, `;

    if (tipoVal === "capacidade_nicho") {
        textoIntro = `Eu, <b>${d.resp_nome ? d.resp_nome.toUpperCase() : '___________'}</b>, inscrito(a) sob o CPF n° <b>${cpf}</b>, `;
    } else if (tipoVal === "declaracao_residencia") {
        textoIntro = `Eu, <b>${d.resp_nome ? d.resp_nome.toUpperCase() : '___________'}</b>, carteira de identidade nº <b>${rg}</b>, inscrito(a) sob o CPF nº <b>${cpf}</b>.<br><br>`;
    } else if (tipoVal === "cancelamento_processo") {
        textoIntro = `Eu, <b>${d.resp_nome ? d.resp_nome.toUpperCase() : '___________'}</b>, portador(a) da carteira de identidade n° <b>${rg}</b>, inscrito(a) sob o CPF n° <b>${cpf}</b>.<br><br>`;
    }

    const html = `<html><head><title>${titulo_declaracao}</title><style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header { text-align: center; margin-bottom: 25px; }
        .header img { height: 60px; margin-bottom: 10px; }
        .header-title { font-weight: bold; font-size: 14px; margin-top: 5px; }
        .doc-title { font-weight: bold; font-size: 20px; text-transform: uppercase; margin-top: 20px; text-decoration: underline; }
        .content { text-align: justify; margin-top: 30px; }
        .footer { margin-top: 50px; text-align: center; }
        .legal { font-size: 11px; text-align: center; margin-top: 40px; font-weight: bold; line-height: 1.2;}
    </style></head><body>
        <div class="header">
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" alt="Logo Prefeitura">
            <div class="header-title">SECRETARIA DE MOBILIDADE E INFRAESTRUTURA - SEMOBI</div>
            <div class="header-title">SUBSECRETARIA DE INFRAESTRUTURA - SSINFRA</div>
            <div class="doc-title">DECLARAÇÃO</div>
            <div style="font-weight: bold; font-size: 17px; margin-top: 10px;">${titulo_declaracao}</div>
        </div>
        
        <div class="content">
            ${textoIntro} ${texto_dinamico}
        </div>

        <div class="footer">
            <div>Niterói, ${dataTexto}</div>
            <div style="margin-top: 50px; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 350px; text-align: center;">
                    ${blocoAssinaturaRequerente}
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">
                        Assinatura conforme documento apresentado
                    </div>
                </div>
                <div style="margin-top: 15px; font-weight: bold; font-size: 14px;">*ANEXAR XEROX DO RG</div>
            </div>
        </div>

        <div class="legal">
            Art. 299 do Código Penal - Falsidade ideológica: Omitir, em documento público ou particular, declaração que dele devia constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fatos juridicamente relevante, é crime.
        </div>
    </body><script>window.onload=function(){setTimeout(function(){window.print()},800)}</script></html>`;
    
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}