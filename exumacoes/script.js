// --- CONFIGURAÇÃO E INICIALIZAÇÃO FIREBASE ---
const firebaseConfig = { apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs", authDomain: "funeraria-niteroi.firebaseapp.com", projectId: "funeraria-niteroi", storageBucket: "funeraria-niteroi.firebasestorage.app", messagingSenderId: "232673521828", appId: "1:232673521828:web:f25a77f27ba1924cb77631" };
let db = null, unsubscribe = null, equipeUnsubscribe = null, logsUnsubscribe = null, chartInstances = {}, dadosEstatisticasExportacao = [], usuarioLogado = null, dadosAtendimentoAtual = null;
window.dadosLiberacaoAtual = null; window.telCount = 1; window.contribuintesMap = {};
let signaturePad = null, isDrawing = false, assinaturaResponsavelImg = null, assinaturaAtendenteImg = null, tipoAssinaturaAtual = ''; 

try { if (typeof firebase !== 'undefined') { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } } catch (e) { console.error("Erro Firebase:", e); }
function getDB() { if (!db && typeof firebase !== 'undefined') { try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } catch(e) { if(firebase.apps.length) db = firebase.firestore(); } } return db; }

// --- HELPERS (Atalhos de Código) ---
const _el = id => document.getElementById(id);
const _val = id => _el(id) ? _el(id).value.trim() : '';
const _setVal = (id, v) => { if(_el(id)) _el(id).value = v || ''; };
const safeDisplay = (id, d) => { if(_el(id)) _el(id).style.display = d; };
const formatarDataInversa = (dStr) => dStr ? dStr.split('-').reverse().join('/') : "";
const pegarDataISO = () => new Date().toISOString().split('T')[0];

// Normalização BLINDADA contra acentos e campos vazios
const normalizeStr = (str) => {
    if (str == null) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

window.gerarProtocolo = () => { const a = new Date(); return `${a.getFullYear()}${String(a.getMonth()+1).padStart(2,'0')}${String(a.getDate()).padStart(2,'0')}-${String(a.getHours()).padStart(2,'0')}${String(a.getMinutes()).padStart(2,'0')}`; };

// --- LÓGICA DE MESCLAGEM DE PDFS (MODAL DA TABELA) ---
window.abrirModalUnir = p => { _setVal('unir-protocolo-row', p || 'N/A'); _setVal('input-pdfs-row', ''); safeDisplay('modal-unir', 'block'); };
window.fecharModalUnir = () => safeDisplay('modal-unir', 'none');
async function processarMesclagem(inputId, proc) {
    const files = _el(inputId).files;
    if (!files || files.length === 0) return alert("Selecione os arquivos PDF primeiro.");
    if (files.length === 1) return alert("Selecione pelo menos 2 arquivos para unir.");
    try {
        const { PDFDocument } = window.PDFLib; const mergedPdf = await PDFDocument.create();
        for (let file of files) {
            const pdf = await PDFDocument.load(await file.arrayBuffer());
            (await mergedPdf.copyPages(pdf, pdf.getPageIndices())).forEach(page => mergedPdf.addPage(page));
        }
        const blob = new Blob([await mergedPdf.save()], { type: 'application/pdf' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = proc && proc !== 'N/A' ? `E-CIGA_${proc}.pdf` : (dadosAtendimentoAtual?.protocolo ? `E-CIGA_${dadosAtendimentoAtual.protocolo}.pdf` : `Documentos_Unidos_E-CIGA.pdf`);
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
        _el(inputId).value = ""; alert("PDFs unidos com sucesso!");
        if(inputId === 'input-pdfs-row') window.fecharModalUnir();
    } catch (e) { console.error(e); alert("Erro ao processar. Certifique-se de usar apenas PDFs."); }
}
window.mesclarPDFsRow = () => processarMesclagem('input-pdfs-row', _val('unir-protocolo-row'));

// --- WHATSAPP E TELEFONES ---
window.enviarWhatsApp = () => {
    const d = dadosAtendimentoAtual; if (!d) return alert("Nenhum atendimento selecionado.");
    let tel = d.telefone ? d.telefone.replace(/\D/g, '') : '';
    if (!tel) return alert("Nenhum telefone cadastrado.");
    if (tel.length === 10 || tel.length === 11) tel = "55" + tel;
    const cem = d.cemiterio === 'OUTRO' ? d.cemiterio_outro : d.cemiterio;
    let msg = `*COORDENAÇÃO DOS CEMITÉRIOS DE NITERÓI*\n\nOlá, *${d.resp_nome ? d.resp_nome.toUpperCase() : 'Requerente'}*.\nEste é o resumo do seu atendimento:\n\n📄 *Protocolo:* ${d.protocolo || 'N/A'}\n👤 *Falecido(a):* ${d.nome_falecido?.toUpperCase() || '-'}\n📍 *Cemitério:* ${cem?.toUpperCase() || '-'}\n🛠️ *Serviço(s):* ${d.servico_requerido?.toUpperCase() || '-'}\n🪦 *Sepultura:* Nº ${d.sepul || '-'} / QD ${d.qd || '-'}\n`;
    if (d.processo || d.grm) msg += `\n*DADOS ADMINISTRATIVOS:*\n${d.processo ? `📂 *Processo:* ${d.processo}\n` : ''}${d.grm ? `🧾 *GRM:* ${d.grm}\n` : ''}`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg + "\n_Aguarde enquanto o atendente envia o(s) documento(s) em anexo por aqui._")}`, '_blank');
}

window.addTelefone = (val = "") => {
    window.telCount++; const newId = 'telefone' + window.telCount; if(_el(newId)) return;
    const box = _el('box-telefones'), inp = document.createElement('input');
    inp.type = 'text'; inp.id = newId; inp.style.marginTop = '5px'; inp.placeholder = 'Telefone Adicional'; inp.maxLength = 15; inp.value = val;
    inp.oninput = function() { window.mascaraTelefone(this) }; box.appendChild(inp);
}
window.mascaraTelefone = el => { let v = el.value.replace(/\D/g, ''); el.value = !v ? '' : v.length <= 10 ? v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2") : v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").substring(0, 15); };
window.aplicarMascaraCpfCnpj = el => { let v = el.value.replace(/\D/g, ""); el.value = v.length <= 11 ? v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2") : v.substring(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2"); };
window.toggleCemiterioOutro = () => { const sel = _el('cemiterio'), inp = _el('cemiterio_outro'), tSep = _el('tipo_sepultura'), nSep = _el('sepul'); if(sel && inp) { const isOutro = sel.value === 'OUTRO'; inp.style.display = isOutro ? 'block' : 'none'; inp.required = isOutro; if(!isOutro) inp.value = ''; if(tSep) tSep.required = !isOutro; if(nSep) nSep.required = !isOutro; } };

// --- GRM & ASSINATURA ---
window.abrirModalGRM = () => safeDisplay('modal-grm', 'block');
window.fecharModalGRM = () => safeDisplay('modal-grm', 'none');

function setupSignaturePad() {
    const canvas = _el('signature-pad'); if (!canvas) return; const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    const getPos = (e) => { const r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) * (canvas.width / r.width), y: (t.clientY - r.top) * (canvas.height / r.height) }; };
    const startDraw = e => { if(e.type==='touchstart') e.preventDefault(); isDrawing=true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const draw = e => { if(!isDrawing) return; if(e.type==='touchmove') e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const endDraw = e => { if(e.type==='touchend') e.preventDefault(); isDrawing=false; };
    ['mousedown','touchstart'].forEach(e => canvas.addEventListener(e, startDraw, {passive:false}));
    ['mousemove','touchmove'].forEach(e => canvas.addEventListener(e, draw, {passive:false}));
    ['mouseup','mouseout','touchend'].forEach(e => canvas.addEventListener(e, endDraw));
}
window.abrirModalAssinatura = tipo => { tipoAssinaturaAtual = tipo; if(_el('titulo-assinatura')) _el('titulo-assinatura').innerText = tipo === 'responsavel' ? 'Assinatura do Requerente' : 'Assinatura da Equipe'; safeDisplay('modal-assinatura', 'flex'); window.limparAssinatura(); setTimeout(setupSignaturePad, 200); };
window.fecharModalAssinatura = () => safeDisplay('modal-assinatura', 'none');
window.limparAssinatura = () => { const canvas = _el('signature-pad'); if(canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); };
window.salvarAssinatura = () => {
    const canvas = _el('signature-pad');
    if (canvas && dadosAtendimentoAtual?.id) {
        const img = canvas.toDataURL('image/png'), update = tipoAssinaturaAtual === 'responsavel' ? { assinatura_responsavel: img } : { assinatura_atendente: img };
        if(tipoAssinaturaAtual === 'responsavel') assinaturaResponsavelImg = img; else assinaturaAtendenteImg = img;
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado?.nome || 'Anon', acao: "ASSINATURA", detalhe: `Req ID: ${dadosAtendimentoAtual.id} (${tipoAssinaturaAtual})`, sistema: "Exumacao" });
        getDB().collection("requerimentos_exumacao").doc(dadosAtendimentoAtual.id).update(update).then(() => window.visualizarDocumentos(dadosAtendimentoAtual.id));
        window.fecharModalAssinatura();
    }
}

// --- BUSCAS E INTEGRAÇÕES ---
window.buscarCep = () => {
    const cep = _val('cep').replace(/\D/g, ''); if (cep.length !== 8) return;
    _el('endereco').placeholder = "Buscando...";
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then(r => r.json()).then(d => {
        if (!d.erro) { _setVal('endereco', d.logradouro); _setVal('bairro', d.bairro); _setVal('municipio', `${d.localidade}/${d.uf}`); _setVal('complemento', d.complemento); _el('numero').focus(); } 
        else { alert("CEP não encontrado."); _setVal('cep', ""); }
    }).finally(() => _el('endereco').placeholder = "");
};

window.buscarRequerentePorCPF = () => {
    const cpf = _val('cpf'); if (cpf.length < 14) return;
    _el('resp_nome').placeholder = "Buscando...";
    getDB().collection("requerimentos_exumacao").where("cpf", "==", cpf).get().then(snap => {
        if (!snap.empty) {
            let d = snap.docs.map(doc => doc.data()).sort((a,b) => (b.data_registro ? new Date(b.data_registro) : 0) - (a.data_registro ? new Date(a.data_registro) : 0))[0];
            ['resp_nome','telefone','rg','endereco','bairro','municipio','cep','numero','complemento','parentesco'].forEach(k => _setVal(k, d[k]));
            let idx = 2; while(d['telefone'+idx]) { window.addTelefone(d['telefone'+idx]); idx++; }
        }
    }).finally(() => _el('resp_nome').placeholder = "");
};

// --- AUTENTICAÇÃO E ADMIN ---
window.fazerLogin = () => {
    const u = _val('login-usuario'), p = _val('login-senha');
    if (p === "2026" && u === "admin") return window.liberarAcesso({nome:"Admin", login:"admin"});
    
    firebase.auth().signInWithEmailAndPassword(u, p).then(() => {
        getDB().collection("equipe").where("email", "==", u).get().then(snap => {
            if (!snap.empty) window.liberarAcesso(snap.docs[0].data()); 
            else window.liberarAcesso({nome: u.split('@')[0], login: u, email: u});
        });
    }).catch(err => {
        safeDisplay('msg-erro-login', 'block');
    });
}
window.checarLoginEnter = e => { if(e.key==='Enter') window.fazerLogin(); };
window.liberarAcesso = (usr) => {
    usuarioLogado = usr || usuarioLogado; sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    safeDisplay('tela-bloqueio', 'none');
    _el('user-display').innerHTML = `<div class="user-info" style="margin-right: 15px; text-align: left;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogado.nome)}&background=random&color=fff&bold=true" class="user-avatar" style="width: 36px; height: 36px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div style="line-height: 1.2;"><div style="font-weight: 800; color: #3699ff; font-size: 13px; text-transform: uppercase;">${usuarioLogado.nome}</div><div style="font-size: 10px; color: #888;">${usuarioLogado.email || 'Atendente'}</div></div></div>`;
    if(!_val('filtro-data') && !_val('filtro-status')) _setVal('filtro-data', pegarDataISO());
    carregarTabela();
}
window.fazerLogout = () => { 
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        firebase.auth().signOut().then(() => {
            sessionStorage.removeItem('usuarioLogado'); window.location.reload(); 
        });
    } else {
        sessionStorage.removeItem('usuarioLogado'); window.location.reload(); 
    }
}
window.abrirAdmin = () => { safeDisplay('modal-admin', 'block'); window.abrirAba('tab-equipe'); }
window.fecharModalAdmin = () => safeDisplay('modal-admin', 'none');
window.abrirAba = id => {
    document.querySelectorAll('.tab-pane').forEach(e => e.classList.remove('active')); _el(id).classList.add('active');
    document.querySelectorAll('.tab-header .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-header .tab-btn[onclick="abrirAba('${id}')"]`)?.classList.add('active');
    if(id==='tab-equipe') window.listarEquipe(); if(id==='tab-logs') window.carregarLogs(); if(id==='tab-stats') window.carregarEstatisticas('hoje'); if(id==='tab-contribuintes') setTimeout(() => _el('busca-contribuinte-admin').focus(), 100);
}

// --- ADMIN: CONTRIBUINTES ---
window.buscarContribuintesAdmin = () => {
    const termoOriginal = _val('busca-contribuinte-admin');
    const termo = normalizeStr(termoOriginal);
    const tb = _el('lista-contribuintes');
    
    if (termoOriginal.length < 3) return tb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Digite pelo menos 3 caracteres para buscar.</td></tr>';
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Buscando...</td></tr>';
    
    const termoLimpo = termo.replace(/[\.\-\/\(\)\s]/g, '');
    const database = getDB();

    database.collection("requerimentos_exumacao")
        .orderBy("data_registro", "desc")
        .limit(1000)
        .get()
        .then((snap) => {
            window.contribuintesMap = {};
            
            snap.forEach(doc => {
                let d = doc.data(); if (!d.cpf) return;
                
                let textoBusca = `${d.resp_nome || ''} ${d.cpf || ''} ${d.rg || ''} ${d.telefone || ''}`;
                let sb = normalizeStr(textoBusca);
                let sp = sb.replace(/[\.\-\/\(\)\s]/g, '');
                
                if (sb.includes(termo) || (termoLimpo !== '' && sp.includes(termoLimpo))) {
                    if (!window.contribuintesMap[d.cpf]) {
                        window.contribuintesMap[d.cpf] = d;
                    }
                }
            });

            renderizarTabelaContribuintes(Object.values(window.contribuintesMap));
        }).catch(e => {
            tb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:red;">Erro na busca.</td></tr>';
            console.error(e);
        });
}

function renderizarTabelaContribuintes(lista) {
    const tb = _el('lista-contribuintes');
    tb.innerHTML = ''; 
    
    if (lista.length === 0) { 
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum contribuinte encontrado.</td></tr>'; 
        return; 
    }

    lista.forEach(item => {
        let enderecoCompleto = `${item.endereco || ''}, ${item.numero || 'S/N'} - ${item.bairro || ''} - ${item.municipio || ''}`;
        
        tb.innerHTML += `
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

window.editarContribuinteAdmin = cpf => {
    const d = window.contribuintesMap[cpf]; if(!d) return;
    ['resp_nome','cpf','rg','telefone','cep','endereco','numero','complemento','bairro','municipio'].forEach(k => _setVal(`edit-cont-${k.split('_')[1]||k}`, d[k]));
    _el('div-editar-contribuinte').classList.remove('hidden'); _el('edit-cont-nome').focus();
}
window.cancelarEdicaoContribuinte = () => _el('div-editar-contribuinte').classList.add('hidden');
window.salvarEdicaoContribuinte = () => {
    const cpf = _val('edit-cont-cpf'); if(!cpf) return;
    const data = { resp_nome:_val('edit-cont-nome'), rg:_val('edit-cont-rg'), telefone:_val('edit-cont-tel'), cep:_val('edit-cont-cep'), endereco:_val('edit-cont-end'), numero:_val('edit-cont-num'), complemento:_val('edit-cont-comp'), bairro:_val('edit-cont-bairro'), municipio:_val('edit-cont-mun') };
    const db = getDB();
    db.collection("requerimentos_exumacao").where("cpf", "==", cpf).get().then(snap => {
        const batch = db.batch(); snap.forEach(doc => batch.update(doc.ref, data));
        batch.commit().then(() => { alert("Atualizado globalmente com sucesso!"); db.collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado?.nome || 'Anon', acao: "EDIÇÃO", detalhe: `Atualização global do contribuinte CPF: ${cpf}`, sistema: "Exumacao" }); window.cancelarEdicaoContribuinte(); window.buscarContribuintesAdmin(); });
    });
}

// --- ADMIN: EQUIPE ---
window.listarEquipe = () => {
    if (equipeUnsubscribe) equipeUnsubscribe();
    equipeUnsubscribe = getDB().collection("equipe").orderBy("nome").onSnapshot(snap => {
        _el('lista-equipe').innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            _el('lista-equipe').innerHTML += `<tr><td><div class="user-info"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.nome)}&background=random&color=fff&bold=true" class="user-avatar"><div><div style="font-weight: 600; color: #333; font-size: 14px;">${u.nome}</div><div style="font-size: 11px; color: #888;">${u.email||'Sem e-mail'}</div></div></div></td><td><span style="color: #555; font-weight: 500;">${u.login}</span></td><td><div style="display:flex; align-items:center;"><span class="senha-oculta" data-senha="${u.senha}">••••••</span><button type="button" class="btn-action-square btn-action-view" onclick="window.toggleSenha(this)" title="Ver">👁️</button></div></td><td><div class="action-group"><button class="btn-action-square btn-action-edit" onclick="window.editarFuncionario('${doc.id}')" title="Editar">✏️</button><button class="btn-action-square btn-action-del" onclick="window.excluirFuncionario('${doc.id}')" title="Excluir">🗑️</button></div></td></tr>`;
        });
    });
}
window.toggleSenha = btn => { const s = btn.previousElementSibling; if(s.innerText==='••••••'){s.innerText=s.getAttribute('data-senha');s.style.letterSpacing='normal';s.style.fontSize='13px';}else{s.innerText='••••••';s.style.letterSpacing='2px';s.style.fontSize='16px';} }
window.adicionarFuncionario = () => { const nome=_val('novo-nome'), login=_val('novo-login'), email=_val('novo-email'), senha=_val('nova-senha'); if(!nome||!login||!senha) return alert("Preencha nome, login e senha."); getDB().collection("equipe").add({nome,login,email,senha}).then(()=>{alert("Usuário adicionado!"); ['nome','login','email','senha'].forEach(k=>_setVal(`novo-${k}`,'')); }); }
window.excluirFuncionario = id => { if(confirm("Deseja excluir este usuário?")) getDB().collection("equipe").doc(id).delete(); }
window.editarFuncionario = id => getDB().collection("equipe").doc(id).get().then(doc => { if(doc.exists) { const u=doc.data(); _setVal('edit-id', doc.id); ['nome','login','email','senha'].forEach(k=>_setVal(`edit-${k}`,u[k]||'')); _el('box-novo-usuario').classList.add('hidden'); _el('div-editar-usuario').classList.remove('hidden'); } });
window.salvarEdicaoUsuario = () => { const id=_val('edit-id'), nome=_val('edit-nome'), email=_val('edit-email'), senha=_val('edit-senha'); if(!nome||!senha) return alert("Nome e senha obrigatórios."); getDB().collection("equipe").doc(id).update({nome,email,senha}).then(()=>{alert("Usuário atualizado!"); window.cancelarEdicao();}); }
window.cancelarEdicao = () => { ['id','nome','login','email','senha'].forEach(k=>_setVal(`edit-${k}`,'')); _el('div-editar-usuario').classList.add('hidden'); _el('box-novo-usuario').classList.remove('hidden'); }

// --- ADMIN: LOGS E EXPORTAÇÕES ---
window.carregarLogs = () => {
    if (logsUnsubscribe) logsUnsubscribe();
    logsUnsubscribe = getDB().collection("auditoria").limit(300).orderBy("data_log", "desc").onSnapshot(snap => {
        let count = 0, tb = _el('tabela-logs'); tb.innerHTML = '';
        snap.forEach(doc => {
            const l = doc.data(); if(l.sistema !== "Exumacao") return; count++;
            let dh = l.data_log ? new Date(l.data_log) : null;
            tb.innerHTML += `<tr><td>${dh ? `${String(dh.getDate()).padStart(2,'0')}/${String(dh.getMonth()+1).padStart(2,'0')}/${dh.getFullYear()}<br><span style="font-size:11px; color:#666;">${String(dh.getHours()).padStart(2,'0')}:${String(dh.getMinutes()).padStart(2,'0')}</span>` : '-'}</td><td><b>${l.usuario}</b></td><td><span style="color:${l.acao==='EXCLUSÃO'?'red':'#333'}; font-weight:bold;">[${l.acao}]</span> ${l.detalhe}</td></tr>`;
        });
        if(count===0) tb.innerHTML = '<tr><td colspan="3">Nenhum registro.</td></tr>';
    });
}
window.gerarBackupJSON = () => getDB().collection("requerimentos_exumacao").get().then(snap => { let d=[]; snap.forEach(doc=>{let i=doc.data(); i._id=doc.id; d.push(i);}); const a=document.createElement('a'); a.href="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(d,null,2)); a.download=`Backup_${pegarDataISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); getDB().collection("auditoria").add({data_log:new Date().toISOString(),usuario:usuarioLogado?.nome||'Anon',acao:"BACKUP",detalhe:`Backup JSON gerado`,sistema:"Exumacao"}); });
window.exportarDadosExcel = () => { if(typeof XLSX === 'undefined') return alert("Erro: Biblioteca Excel ausente."); getDB().collection("requerimentos_exumacao").orderBy("data_registro","desc").get().then(snap=>{ let d=[]; snap.forEach(doc=>{ let i=doc.data(); d.push({"Nome":i.resp_nome?.toUpperCase()||"-","CPF":i.cpf||"-","Nº Processo":i.processo||"-","Nº GRM":i.grm||"-"});}); XLSX.writeFile({SheetNames:["Dados"],Sheets:{Dados:XLSX.utils.json_to_sheet(d)}},`Processos_${pegarDataISO()}.xlsx`); getDB().collection("auditoria").add({data_log:new Date().toISOString(),usuario:usuarioLogado?.nome||'Anon',acao:"EXPORTAÇÃO",detalhe:`Exportação Excel`,sistema:"Exumacao"}); }); }
window.exportarDadosPDF = () => { if(!window.jspdf) return alert("Erro: Biblioteca PDF ausente."); const doc=new window.jspdf.jsPDF(); getDB().collection("requerimentos_exumacao").orderBy("data_registro","desc").get().then(snap=>{ let b=[]; snap.forEach(doc=>{let i=doc.data(); b.push([i.resp_nome?.toUpperCase()||"-",i.cpf||"-",i.processo||"-",i.grm||"-"]);}); doc.text("Relatório de Processos",14,15); doc.setFontSize(10); doc.text(`Gerado em: ${new Date().toLocaleString()}`,14,22); doc.autoTable({head:[['Nome Completo','CPF','Nº Processo','Nº GRM']],body:b,startY:28,styles:{fontSize:9},headStyles:{fillColor:[54,153,255]}}); doc.save(`Processos_${pegarDataISO()}.pdf`); getDB().collection("auditoria").add({data_log:new Date().toISOString(),usuario:usuarioLogado?.nome||'Anon',acao:"EXPORTAÇÃO",detalhe:`Exportação PDF`,sistema:"Exumacao"}); }); }
window.baixarLogsExcel = () => getDB().collection("auditoria").limit(1000).orderBy("data_log","desc").get().then(snap=>{ let d=[]; snap.forEach(doc=>{let i=doc.data(); if(i.sistema==="Exumacao") d.push({"Data/Hora":i.data_log?new Date(i.data_log).toLocaleString():'-',"Usuário":i.usuario,"Ação":i.acao,"Detalhes":i.detalhe});}); XLSX.writeFile({SheetNames:["Logs"],Sheets:{Logs:XLSX.utils.json_to_sheet(d)}},`Logs_${pegarDataISO()}.xlsx`); });
window.baixarLogsPDF = () => { const doc=new window.jspdf.jsPDF(); getDB().collection("auditoria").limit(1000).orderBy("data_log","desc").get().then(snap=>{ let b=[]; snap.forEach(doc=>{let i=doc.data(); if(i.sistema==="Exumacao") b.push([i.data_log?new Date(i.data_log).toLocaleString():'-',i.usuario,`[${i.acao}] ${i.detalhe}`]);}); doc.text("Auditoria",14,10); doc.autoTable({head:[['Data/Hora','Usuário','Ação/Detalhes']],body:b,startY:20}); doc.save(`Logs_${pegarDataISO()}.pdf`); }); }
window.baixarRelatorioCompleto = () => { if(confirm("Baixar todos os requerimentos?")) getDB().collection("requerimentos_exumacao").get().then(snap=>{ let d=[]; snap.forEach(doc=>{ let i=doc.data(); d.push([i.protocolo, i.data_registro?new Date(i.data_registro).toLocaleDateString():'-', i.resp_nome, i.nome_falecido, i.cemiterio, i.servico_requerido, i.processo, i.grm, i.atendente_sistema]);}); XLSX.writeFile({SheetNames:["Req"],Sheets:{Req:XLSX.utils.aoa_to_sheet([["Protocolo","Data","Requerente","Falecido","Cemitério","Serviço","Processo","GRM","Atendente"], ...d])}},`Requerimentos.xlsx`); }); }
window.baixarExcel = () => { if(dadosEstatisticasExportacao.length) XLSX.writeFile({SheetNames:["Stats"],Sheets:{Stats:XLSX.utils.json_to_sheet(dadosEstatisticasExportacao)}},`Stats.xlsx`); }

// --- ADMIN: ESTATÍSTICAS ---
window.carregarEstatisticas = (modo) => {
    let dInicio = new Date(), ds = "", de = "";
    
    if (modo === 'mes') { 
        dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1); 
        ds = dInicio.toISOString(); 
    } else if (modo === 'ano') { 
        dInicio = new Date(dInicio.getFullYear(), 0, 1); 
        ds = dInicio.toISOString(); 
    } else if (modo === 'tudo') { 
        ds = "2000-01-01T00:00:00.000Z"; 
    } else if (modo === 'hoje') {
        dInicio.setHours(0,0,0,0);
        ds = dInicio.toISOString();
    } else if (modo === 'custom') {
        let dtI = _val('data-inicio-stats');
        let dtF = _val('data-fim-stats');
        if(!dtI || !dtF) return alert("Preencha as duas datas para filtrar o período específico.");
        ds = new Date(dtI + "T00:00:00").toISOString();
        de = new Date(dtF + "T23:59:59.999Z").toISOString();
    } else { 
        dInicio.setDate(dInicio.getDate() - parseInt(modo)); 
        ds = dInicio.toISOString(); 
    }
    
    let diffDays = 0;
    if(de && ds) {
        diffDays = (new Date(de) - new Date(ds)) / (1000 * 3600 * 24);
    } else if(ds && modo !== 'tudo') {
        diffDays = (new Date() - new Date(ds)) / (1000 * 3600 * 24);
    } else if(modo === 'tudo') {
        diffDays = 9999;
    }
    
    let query = getDB().collection("requerimentos_exumacao").where("data_registro", ">=", ds);
    if(de) query = query.where("data_registro", "<=", de);

    query.onSnapshot(snap => {
        let servicos = {}, cemiterios = {}, evolucao = {}, total = 0;
        snap.forEach(doc => {
            const d = doc.data(); total++;
            if(d.servico_requerido) d.servico_requerido.split(',').forEach(s => { let k = s.trim().toUpperCase(); if(k) servicos[k] = (servicos[k]||0)+1; });
            let c = d.cemiterio?.toUpperCase() || "N/A"; if(c==='OUTRO') c = d.cemiterio_outro?.toUpperCase() || c; cemiterios[c] = (cemiterios[c]||0)+1;
            
            if(d.data_registro) {
                let dateStr = d.data_registro.split('T')[0];
                if (diffDays > 1000) dateStr = dateStr.substring(0, 4); 
                else if (diffDays > 90) dateStr = dateStr.substring(0, 7);
                evolucao[dateStr] = (evolucao[dateStr]||0)+1;
            }
        });
        if(_el('kpi-total')) _el('kpi-total').innerText = total;
        
        const buildChart = (id, type, dataObj, color) => {
            const sort = Object.entries(dataObj).sort((a,b)=>b[1]-a[1]).slice(0,10);
            if(_el(id) && window.Chart) {
                if(chartInstances[id]) chartInstances[id].destroy();
                chartInstances[id] = new Chart(_el(id), { type, data: { labels: sort.map(x=>x[0]), datasets: [{ data: sort.map(x=>x[1]), backgroundColor: color, borderRadius: type==='bar'?6:0 }] }, options: { maintainAspectRatio: false, indexAxis: type==='bar'?'y':'x', plugins: { legend: { display: type==='doughnut', position:'bottom' } } } });
            } return sort;
        };
        
        const buildTimelineChart = (id, type, dataObj, color) => {
            const sortedKeys = Object.keys(dataObj).sort();
            const labels = sortedKeys.map(k => {
                let p = k.split('-');
                if(p.length === 1) return p[0];
                if(p.length === 2) return `${p[1]}/${p[0]}`;
                return `${p[2]}/${p[1]}/${p[0]}`;
            });
            const values = sortedKeys.map(k => dataObj[k]);
            
            if(_el(id) && window.Chart) {
                if(chartInstances[id]) chartInstances[id].destroy();
                chartInstances[id] = new Chart(_el(id), { 
                    type, 
                    data: { labels, datasets: [{ label: 'Atendimentos', data: values, backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: 'rgba(37, 99, 235, 1)', fill: true, tension: 0.3, borderWidth: 2, pointBackgroundColor: 'rgba(37, 99, 235, 1)' }] }, 
                    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } 
                });
            }
        };

        buildTimelineChart('grafico-evolucao', 'line', evolucao, 'rgba(37, 99, 235, 0.85)');
        dadosEstatisticasExportacao = buildChart('grafico-servicos', 'bar', servicos, 'rgba(54, 153, 255, 0.85)').map(([c,q]) => ({"Serviço": c, "Quantidade": q}));
        buildChart('grafico-cemiterios', 'doughnut', cemiterios, ['#3699ff', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6']);
    });
}

// --- FILTRO DE STATUS NA TELA INICIAL ---
window.filtrarPorStatus = () => {
    const fs = _val('filtro-status');
    if (!fs) {
        if(!_val('filtro-data')) _setVal('filtro-data', pegarDataISO());
        return window.carregarTabela();
    }
    
    _setVal('filtro-data', '');
    _setVal('input-busca', '');
    
    if(unsubscribe) unsubscribe(); 
    
    unsubscribe = getDB().collection("requerimentos_exumacao")
        .orderBy("data_registro", "desc")
        .limit(2000)
        .onSnapshot(snap => {
            let lista = [];
            snap.forEach(doc => {
                let d = doc.data(); d.id = doc.id;
                if (d[fs] === true) lista.push(d);
            }); 
            renderizarTabela(lista);
        });
}

// --- TABELA PRINCIPAL E BUSCA ---
window.carregarTabela = () => {
    if (unsubscribe) unsubscribe(); 
    const fd = _val('filtro-data');
    let q = getDB().collection("requerimentos_exumacao").orderBy("data_registro", "desc");
    if (fd) q = q.where("data_registro", ">=", fd).where("data_registro", "<=", fd + "T23:59:59.999Z"); else q = q.limit(50);
    unsubscribe = q.onSnapshot(snap => renderizarTabela(snap.docs.map(doc => ({...doc.data(), id: doc.id}))));
}

window.realizarBusca = () => {
    const termoOriginal = _val('input-busca'); 
    const termo = normalizeStr(termoOriginal);
    const fd = _el('filtro-data');
    
    if(!termoOriginal) { 
        if(!_val('filtro-data') && !_val('filtro-status')) _setVal('filtro-data', pegarDataISO()); 
        if(_val('filtro-status')) return window.filtrarPorStatus();
        return carregarTabela(); 
    }
    
    _setVal('filtro-data', ''); 
    _setVal('filtro-status', ''); 
    if(unsubscribe) unsubscribe(); 
    const tl = termo.replace(/[\.\-\/\(\)\s]/g, '');
    
    unsubscribe = getDB().collection("requerimentos_exumacao").orderBy("data_registro", "desc").limit(1000).onSnapshot(snap => {
        let lista = [];
        snap.forEach(doc => {
            let d = doc.data(); d.id = doc.id;
            
            let textoBusca = `${d.protocolo||''} ${d.resp_nome||''} ${d.nome_falecido||''} ${d.cpf||''} ${d.rg||''} ${d.telefone||''} ${d.processo||''} ${d.cemiterio||''}`;
            let idx = 2; 
            while(d['telefone'+idx]) { textoBusca += ' ' + d['telefone'+idx]; idx++; }
            
            let sb = normalizeStr(textoBusca);
            
            if (sb.includes(termo) || (tl && sb.replace(/[\.\-\/\(\)\s]/g, '').includes(tl))) {
                lista.push(d);
            }
        }); 
        renderizarTabela(lista);
    });
}

function renderizarTabela(lista) {
    const tb = _el('tabela-corpo'); if(!tb) return; tb.innerHTML = ''; 
    if (!lista.length) return tb.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center;">Nenhum registro encontrado.</td></tr>';
    lista.forEach(i => {
        let tl = i.telefone || ''; let tIdx = 2; while(i['telefone'+tIdx]) { tl += ' / ' + i['telefone'+tIdx]; tIdx++; }
        
        let cemDisplay = i.cemiterio==='OUTRO'?i.cemiterio_outro:i.cemiterio;
        
        let rowBorder = "border-left: 4px solid transparent;";
        let statusHtml = "";
        
        if (i.chk_doc_ausentes) { 
            rowBorder = "border-left: 4px solid #e74c3c;"; 
            statusHtml += `<span style="background:#fce8e6; color:#e74c3c; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;" title="${i.doc_ausentes_desc||''}">Doc Ausentes</span>`; 
        }
        else if (i.chk_arquivado) { rowBorder = "border-left: 4px solid #95a5a6;"; statusHtml += `<span style="background:#f2f4f5; color:#7f8c8d; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Arquivado</span>`; }
        else if (i.chk_aguardando) { rowBorder = "border-left: 4px solid #f39c12;"; statusHtml += `<span style="background:#fcf3cf; color:#f39c12; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Aguardando</span>`; }
        else if (i.chk_procedido) { rowBorder = "border-left: 4px solid #3498db;"; statusHtml += `<span style="background:#e1f0ff; color:#3498db; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Procedido</span>`; }
        else if (i.chk_deferido) { rowBorder = "border-left: 4px solid #2ecc71;"; statusHtml += `<span style="background:#e8f8f5; color:#2ecc71; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">Deferido</span>`; }

        tb.innerHTML += `<tr onclick="window.visualizarDocumentos('${i.id}')" style="${rowBorder}">
            <td style="vertical-align:middle;"><b>${i.resp_nome?.toUpperCase()||'-'}</b><div style="margin-top:4px; margin-bottom:4px;">${statusHtml}</div><span style="font-size:11px; color:#555;">📞 ${tl||'-'}</span></td>
            <td style="vertical-align:middle;">👤 <b>${i.nome_falecido?.toUpperCase()||'-'}</b></td>
            <td style="vertical-align:middle;">📍 ${cemDisplay}</td>
            <td style="vertical-align:middle;">${i.servico_requerido||'-'}</td>
            <td style="vertical-align:middle; font-size:13px; line-height: 1.5;">
                <div style="color: #3699ff;"><b>Prot:</b> <span style="font-weight:bold;">${i.protocolo||'-'}</span></div>
                ${i.processo ? `<div style="color: #d35400;"><b>Proc:</b> <span style="font-weight:bold;">${i.processo}</span></div>` : ''}
                <div style="color: #27ae60;"><b>GRM:</b> <span style="font-weight:bold;">${i.grm||'-'}</span></div>
            </td>
            <td style="vertical-align:middle;">${i.data_registro?formatarDataInversa(i.data_registro.split('T')[0]):'-'}</td>
            <td style="text-align:right; vertical-align:middle;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-icon btn-editar-circle" title="Editar Requerimento" onclick="event.stopPropagation();window.editar('${i.id}')">✏️</button>
                    <button class="btn-icon btn-liberar-circle" title="Preencher Liberação" onclick="event.stopPropagation();window.abrirLiberacao('${i.id}')">📝</button>
                    <button class="btn-icon btn-unir-circle" title="Unir PDFs" onclick="event.stopPropagation();window.abrirModalUnir('${i.protocolo}')">📁</button>
                    <button class="btn-icon btn-excluir-circle" title="Excluir" onclick="event.stopPropagation();window.excluir('${i.id}')">🗑️</button>
                </div>
            </td></tr>`;
    });
}

// --- MODAIS GERAIS DO REQUERIMENTO ---
window.abrirModal = () => {
    _el('form-atendimento').reset(); _setVal('docId',''); _setVal('protocolo','');
    const bx = _el('box-telefones'); if(bx) { const inps = bx.querySelectorAll('input'); for(let i=1; i<inps.length; i++) bx.removeChild(inps[i]); window.telCount = 1; }
    window.toggleCemiterioOutro(); 
    if(_el('div_doc_ausentes')) _el('div_doc_ausentes').style.display = 'none';
    if(usuarioLogado) _setVal('atendente_sistema', usuarioLogado.nome); 
    safeDisplay('modal', 'block');
}
window.fecharModal = () => safeDisplay('modal', 'none');
window.fecharModalVisualizar = () => safeDisplay('modal-visualizar', 'none');
window.editar = id => getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
    if(doc.exists) {
        const d = doc.data(); const bx = _el('box-telefones');
        if(bx) { const inps = bx.querySelectorAll('input'); for(let i=1; i<inps.length; i++) bx.removeChild(inps[i]); window.telCount = 1; }
        let idx = 2; while(d['telefone'+idx]) { window.addTelefone(d['telefone'+idx]); idx++; }
        Object.keys(d).forEach(k => { 
            const el = _el(k); 
            if(el && el.type!=='file') { 
                if(el.type === 'checkbox') {
                    el.checked = !!d[k];
                    if(el.onchange) el.onchange(); 
                } else if(el.tagName==='SELECT' && el.multiple) {
                    Array.from(el.options).forEach(o=>o.selected = d[k]?.includes(o.value)); 
                } else {
                    el.value = d[k]; 
                }
            } 
        });
        window.toggleCemiterioOutro(); _setVal('docId', doc.id); safeDisplay('modal', 'block');
    }
});

const form = _el('form-atendimento');
if(form) form.onsubmit = e => {
    e.preventDefault(); const id = _val('docId'), d = {};
    Array.from(form.elements).forEach(el => { 
        if(el.id && el.type!=='submit' && el.type!=='button') {
            if(el.type === 'checkbox') {
                d[el.id] = el.checked;
            } else if(el.tagName==='SELECT' && el.multiple) {
                d[el.id] = Array.from(el.selectedOptions).map(o=>o.value).join(', ');
            } else {
                d[el.id] = el.value; 
            }
        }
    });
    if(!id) { d.data_registro = new Date().toISOString(); d.protocolo = window.gerarProtocolo(); }
    getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado?.nome||'Anon', acao: id?"EDIÇÃO":"CRIAÇÃO", detalhe: `Protocolo: ${d.protocolo} | Falecido: ${d.nome_falecido}`, sistema: "Exumacao" });
    if(id) getDB().collection("requerimentos_exumacao").doc(id).update(d).then(() => window.fecharModal()); else getDB().collection("requerimentos_exumacao").add(d).then(() => window.fecharModal());
}

// --- TEXTO REFERENTE A (INTELIGÊNCIA AUTOMÁTICA) ---
window.preencherReferenteAutomatico = () => { if (window.dadosLiberacaoAtual) _setVal('referente_a', window.gerarTextoReferenteA(window.dadosLiberacaoAtual)); else alert("Aguarde os dados carregarem..."); }
window.gerarTextoReferenteA = d => {
    let s = d.servico_requerido?.toUpperCase()||"", sArr = s.split(',').map(x=>x.trim()).filter(x=>x), sProc = [];
    const up = t => t ? t.toUpperCase() : '', dt = formatarDataInversa(d.data_sepultamento)||"(DATA)", fal = up(d.nome_falecido)||"(NOME)", ts = up(d.tipo_sepultura)||"(TIPO DE SEPULTURA)", sep = d.sepul||"XXX", qd = d.qd ? `DA QUADRA ${up(d.qd)}` : "", cemO = d.cemiterio==="OUTRO" ? up(d.cemiterio_outro)||"(OUTRO)" : up(d.cemiterio)||"(CEM. ORIGEM)", cemD = up(d.cemiterio_destino)||"(CEM. DESTINO)", lacre = d.lacre||"", dTipo = up(d.destino_tipo_sepultura)||"(TIPO DESTINO)", dNro = d.destino_local_nro||"XXX", dLiv = d.destino_livro||"X", dFls = d.destino_fls||"X", dProp = up(d.destino_proprietario)||"(NOME DONO)", pOrig = up(d.proprietario)||"(NOME DONO)", proc = d.processo||"XXX/XXX", ass = up(d.assunto)||"(MOTIVO)", sRef = up(d.servico_reforma)||"MÁRMORE OU GRANITO";
    let tp = "", te = [];
    
    if (s.includes("EXUMAÇÃO") && s.includes("SAÍDA DE OSSOS")) { tp = `EXUMAÇÃO E SAÍDA DE OSSOS DA ${ts} N° ${sep} ${qd} ONDE FOI INUMADO ${fal} NO DIA ${dt} DO CEMITÉRIO MUNICIPAL ${cemO} PARA O CEMITÉRIO ${cemD}`; sProc.push("EXUMAÇÃO", "SAÍDA DE OSSOS"); }
    else if (s.includes("EXUMAÇÃO") && s.includes("RECOLHIMENTO")) { tp = !d.destino_local_nro && (d.processo||!d.destino_tipo_sepultura) ? `EXUMAÇÃO DA ${ts} N° ${sep} ${qd} ONDE FOI INUMADO ${fal} NO DIA ${dt} E RECOLHER AO NICHO A SER ADQUIRIDO ATRAVÉS DO PROCESSO N° ${proc} NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:cemO}` : dTipo===ts && dNro===sep ? `EXUMAÇÃO DA ${ts} PERPÉTUA N° ${sep} ${qd} ONDE FOI INUMADO ${fal} NO DIA ${dt} E RECOLHER A PRÓPRIA SEPULTURA REGISTRADA NO LIVRO ${dLiv} AS FOLHAS N° ${dFls} EM NOME DE ${pOrig} NO CEMITÉRIO MUNICIPAL ${cemO}` : `EXUMAÇÃO DA ${ts} N° ${sep} ${qd} ONDE FOI INUMADO ${fal} NO DIA ${dt} E RECOLHER AO ${dTipo} PERPÉTUO N° ${dNro} REGISTRADO NO LIVRO ${dLiv} AS FOLHAS N° ${dFls} EM NOME DE ${dProp} NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:cemO}`; sProc.push("EXUMAÇÃO", "RECOLHIMENTO"); }
    else if (s.includes("EXUMAÇÃO") && s.includes("PERMISSÃO DE USO")) { tp = `EXUMAÇÃO DA ${ts} N° ${sep} ${qd} ONDE FOI INUMADO ${fal} NO DIA ${dt} E PERMISSÃO DE USO DE 1 (UM) NICHO NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:cemO}`; sProc.push("EXUMAÇÃO", "PERMISSÃO DE USO"); }
    else if ((s.includes("ENTRADA DE OSSOS") || s.includes("ENTRADA DE CINZAS")) && s.includes("PERMISSÃO DE USO")) { tp = `ENTRADA DE OSSOS/CINZAS DE ${fal} VINDAS DO CEMITÉRIO ${cemO} E PERMISSÃO DE USO DE 1 (UM) NICHO NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:"(CEMITÉRIO)"}`; sProc.push("ENTRADA DE OSSOS / CINZAS", "PERMISSÃO DE USO"); }
    else if ((s.includes("ENTRADA DE OSSOS") || s.includes("ENTRADA DE CINZAS")) && s.includes("RECOLHIMENTO")) { tp = `ENTRADA DE OSSOS/CINZAS DE ${fal} VINDAS DO CEMITÉRIO ${cemO} E RECOLHER AO ${dTipo} PERPÉTUO N° ${dNro} REGISTRADO NO LIVRO ${dLiv} AS FOLHAS N° ${dFls} EM NOME DE ${dProp} NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:"(CEMITÉRIO)"}`; sProc.push("ENTRADA DE OSSOS / CINZAS", "RECOLHIMENTO"); }
    else if (s.includes("RECOLHIMENTO") && lacre!=="") { tp = `RECOLHIMENTO DOS RESTOS MORTAIS DE ${fal} IDENTIFICADOS PELO LACRE ${lacre} QUE SE ENCONTRAVAM NA ${ts} N° ${sep} AO ${dTipo} PERPÉTUO N° ${dNro} REGISTRADO NO LIVRO ${dLiv} AS FOLHAS N° ${dFls} EM NOME DE ${dProp} NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:cemO}`; sProc.push("RECOLHIMENTO"); }
    else if (s.includes("PERMUTA")) { tp = `PERMUTA DA SEPULTURA/NICHO PERPÉTUO N° ${sep} POR MOTIVO DE ${ass} REGISTRADO NO LIVRO ${dLiv!=='X'?dLiv:(d.livro||'X')} AS FOLHAS N° ${dFls!=='X'?dFls:(d.fls||'X')} EM NOME DE ${pOrig} POR OUTRA VAGA NO CEMITÉRIO MUNICIPAL ${cemD!=='(CEM. DESTINO)'?cemD:cemO}`; sProc.push("PERMUTA"); }
    
    sArr.forEach(srv => {
        if(!sProc.some(p => srv===p || p.includes(srv))) {
            if(srv.includes("LICENÇA COM ÔNUS")) te.push(dNro!=="XXX"||sep!=="XXX" ? `LICENÇA COM ÔNUS PARA COLOCAÇÃO DE LÁPIDE DE IDENTIFICAÇÃO EM MÁRMORE OU GRANITO COM INSCRIÇÕES DE NOME, FOTO E DATA NO ${dTipo!=='(TIPO DESTINO)'?dTipo:ts} PERPÉTUO N° ${dNro!=='XXX'?dNro:sep} REGISTRADO NO LIVRO ${dLiv!=='X'?dLiv:'(LIVRO)'} AS FOLHAS N° ${dFls!=='X'?dFls:'(FLS)'} EM NOME DE ${dProp!=='(NOME DO DONO)'?dProp:pOrig} NO CEMITÉRIO MUNICIPAL ${cemO}` : `LICENÇA COM ÔNUS PARA COLOCAÇÃO DE LÁPIDE DE IDENTIFICAÇÃO EM MÁRMORE OU GRANITO COM INSCRIÇÕES DE NOME, FOTO E DATA NO NICHO A SER ADQUIRIDO ATRAVÉS DO PROCESSO N° ${proc} NO CEMITÉRIO MUNICIPAL ${cemO}`);
            else if(srv.includes("REVESTIMENTO")||srv.includes("REFORMA")) te.push(`SERVIÇO EM ${sRef} NA ${ts} PERPÉTUA N° ${sep} REGISTRADO NO LIVRO ${dLiv!=='X'?dLiv:(d.livro||'X')} AS FOLHAS N° ${dFls!=='X'?dFls:(d.fls||'X')} EM NOME DE ${pOrig} NO CEMITÉRIO MUNICIPAL ${cemO}`);
            else if(srv.includes("CERTIDÃO DE PERMISSÃO")) te.push(`CERTIDÃO DE PERMISSÃO DE USO DA ${ts} N° ${sep} ONDE SE ENCONTRAM OS RESTOS MORTAIS DE ${fal} NO CEMITÉRIO MUNICIPAL ${cemO}`);
            else if(srv==="CERTIDÃO") te.push(`EMISSÃO DE CERTIDÃO REFERENTE AO(A) FALECIDO(A) ${fal} INUMADO NA ${ts} N° ${sep} ${qd} NO CEMITÉRIO MUNICIPAL ${cemO}`);
            else if(srv==="PERMISSÃO DE USO") te.push(`PERMISSÃO DE USO DE 1 (UM) ${ts} NO CEMITÉRIO MUNICIPAL ${cemO}`);
            else if(srv==="EXUMAÇÃO" && !tp) tp = `EXUMAÇÃO DO(A) FALECIDO(A) ${fal} INUMADO(A) NO DIA ${dt} NA ${ts} N° ${sep} ${qd} NO CEMITÉRIO MUNICIPAL ${cemO}`;
            else if(srv==="SAÍDA DE OSSOS" && !tp) tp = `SAÍDA DE OSSOS DO(A) FALECIDO(A) ${fal} DA ${ts} N° ${sep} ${qd} DO CEMITÉRIO MUNICIPAL ${cemO} PARA O CEMITÉRIO ${cemD}`;
            else if(srv==="RECOLHIMENTO" && !tp) tp = `RECOLHIMENTO DE RESTOS MORTAIS DO(A) FALECIDO(A) ${fal} DA ${ts} N° ${sep} ${qd} DO CEMITÉRIO MUNICIPAL ${cemO}`;
            else if((srv==="ENTRADA DE OSSOS / CINZAS") && !tp) tp = `${srv} DO(A) FALECIDO(A) ${fal} VINDAS DO CEMITÉRIO ${cemO} PARA O CEMITÉRIO MUNICIPAL ${cemD}`;
            else if(srv==="OUTROS") te.push(`DIVERSOS/OUTROS SERVIÇOS REFERENTE A ${fal} NA ${ts} N° ${sep} NO CEMITÉRIO MUNICIPAL ${cemO}`);
            else { if(!tp) tp=`${srv} DO(A) FALECIDO(A) ${fal} NA ${ts} N° ${sep} NO CEMITÉRIO MUNICIPAL ${cemO}`; else te.push(srv); }
        }
    });
    return (tp ? tp + (te.length ? " E " + te.join(" E ") : "") : (te.length ? te.join(" E ") : `REFERENTE A ${s.replace(/, /g,' E ')} DO(A) FALECIDO(A) ${fal} NA ${ts} N° ${sep} ${qd} NO CEMITÉRIO MUNICIPAL ${cemO}`)).replace(/\s+/g, ' ').trim() + ".";
}

window.abrirLiberacao = id => getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => { if(doc.exists) { const d=doc.data(); d.id=doc.id; window.dadosLiberacaoAtual=d; _setVal('docIdLiberacao', doc.id); _setVal('processo_lib', d.processo); _setVal('grm_lib', d.grm); _setVal('valor_pago', d.valor_pago); _setVal('referente_a', d.referente_a || window.gerarTextoReferenteA(d)); safeDisplay('modal-liberacao', 'block'); }});
window.fecharModalLiberacao = () => { safeDisplay('modal-liberacao', 'none'); window.dadosLiberacaoAtual = null; }
const formLib = _el('form-liberacao');
if(formLib) formLib.onsubmit = e => { e.preventDefault(); const id=_val('docIdLiberacao'), dadosL={processo:_val('processo_lib'),grm:_val('grm_lib'),valor_pago:_val('valor_pago'),referente_a:_val('referente_a')}; if(id){ getDB().collection("auditoria").add({data_log:new Date().toISOString(),usuario:usuarioLogado?.nome||'Anon',acao:"LIBERAÇÃO",detalhe:`Req ID: ${id} | GRM: ${dadosL.grm}`,sistema:"Exumacao"}); getDB().collection("requerimentos_exumacao").doc(id).update(dadosL).then(()=>window.fecharModalLiberacao()); } }

// --- EVENTOS E IMPRESSÕES ---
window.onclick = e => { if(e.target===_el('modal-visualizar')) window.fecharModalVisualizar(); if(e.target===_el('modal-admin')) window.fecharModalAdmin(); if(e.target===_el('modal-unir')) window.fecharModalUnir(); }
document.addEventListener('DOMContentLoaded', () => { 
    if(_el('filtro-data')) _el('filtro-data').addEventListener('change', () => { _setVal('filtro-status', ''); window.carregarTabela(); }); 
    const s=sessionStorage.getItem('usuarioLogado'); if(s) window.liberarAcesso(JSON.parse(s)); 
});

window.visualizarDocumentos = id => getDB().collection("requerimentos_exumacao").doc(id).get().then(doc => {
    if(doc.exists) {
        let d = doc.data(); d.id = doc.id; dadosAtendimentoAtual = d;
        assinaturaResponsavelImg = d.assinatura_responsavel||null; assinaturaAtendenteImg = d.assinatura_atendente||null;
        let cemD = d.cemiterio==='OUTRO' ? d.cemiterio_outro : d.cemiterio;
        
        let statusHtmlView = "";
        if (d.chk_doc_ausentes) statusHtmlView += `<span style="background:#fce8e6; color:#e74c3c; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:4px;">Doc Ausentes: ${d.doc_ausentes_desc||''}</span>`;
        if (d.chk_arquivado) statusHtmlView += `<span style="background:#f2f4f5; color:#7f8c8d; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:4px;">Arquivado</span>`;
        if (d.chk_aguardando) statusHtmlView += `<span style="background:#fcf3cf; color:#f39c12; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:4px;">Aguardando</span>`;
        if (d.chk_procedido) statusHtmlView += `<span style="background:#e1f0ff; color:#3498db; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:4px;">Procedido</span>`;
        if (d.chk_deferido) statusHtmlView += `<span style="background:#e8f8f5; color:#2ecc71; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:4px;">Deferido</span>`;

        if(_el('resumo-dados')) _el('resumo-dados').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;"><div><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Protocolo</span><br><strong style="color:var(--primary-color);font-size:14px;">${d.protocolo||'N/A'}</strong></div><div><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Requerente</span><br><strong style="font-size:14px;">${d.resp_nome?.toUpperCase()||'-'}</strong></div><div><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Falecido(a)</span><br><strong style="font-size:14px;">${d.nome_falecido?.toUpperCase()||'-'}</strong></div><div><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Cemitério / Serviço</span><br><strong>${cemD?.toUpperCase()||'-'} (${d.servico_requerido?.toUpperCase()||'-'})</strong></div><div><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Localização Sepultura</span><br><strong>Nº ${d.sepul||'-'} / QD ${d.qd||'-'}</strong></div><div><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Administrativo</span><br><strong style="color:var(--danger);">Proc: ${d.processo||'-'} / GRM: ${d.grm||'-'}</strong></div><div style="grid-column:span 3;text-align:center;margin-top:5px;"><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Status de Assinatura</span><br><strong>${d.assinatura_responsavel?'✅ Família Assinou':'⏳ Aguardando Família'} | ${d.assinatura_atendente?'✅ Equipe Assinou':'⏳ Aguardando Equipe'}</strong></div><div style="grid-column:span 3; margin-top:5px; text-align:center;"><span style="color:#888;font-size:10px;text-transform:uppercase;font-weight:bold;">Andamento do Processo</span><br>${statusHtmlView || '<strong>-</strong>'}</div></div>`;
        safeDisplay('modal-visualizar', 'block');
    }
});

const getPrintStyle = (c='') => `<style>@page{size:A4 portrait;margin:15mm}body{font-family:Arial,sans-serif;font-size:14px;line-height:1.4;color:#000;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;opacity:.1;z-index:-1;pointer-events:none}.header{text-align:center;margin-bottom:10px;border-bottom:2px solid #333;padding-bottom:5px;position:relative}.header img.logo-print{height:50px}.header-subtitle{font-size:12px;font-weight:bold;margin-top:5px;text-transform:uppercase}.doc-title{font-size:17px;font-weight:bold;text-align:center;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}.section{margin-bottom:10px;border:1px solid #ccc;padding:8px;border-radius:4px}.section-title{font-weight:bold;font-size:12px;background-color:#f0f0f0;padding:4px 8px;margin:-8px -8px 8px -8px;border-bottom:1px solid #ccc;border-radius:4px 4px 0 0;text-transform:uppercase;color:#333}.row{display:flex;margin-bottom:6px;gap:15px}.field{display:flex;flex-direction:column;flex:1}.label{font-size:10px;color:#666;font-weight:bold;text-transform:uppercase;margin-bottom:2px}.value{font-size:14px;font-weight:bold;border-bottom:1px solid #000;padding-top:2px;padding-bottom:2px;min-height:16px}.chk-item{font-weight:bold;font-size:14px}.footer-note{font-size:11px;text-align:justify;margin-top:15px;padding:8px;border:1px dashed #999;background-color:#f9f9f9;border-radius:4px;line-height:1.5}.box-protocolo{position:absolute;top:0;right:0;border:2px solid #000;padding:4px 8px;font-weight:bold;font-size:12px;font-family:sans-serif;background:#fff;text-align:left}.legal{font-size:9px;text-align:center;margin-top:15px;font-weight:bold;color:#444}${c}</style>`;
const upper = s => s ? s.toUpperCase() : '-';

window.imprimirRequerimento = () => {
    if (!dadosAtendimentoAtual) return; const d = dadosAtendimentoAtual;
    let tSep = d.tipo_sepultura; if(tSep==='Nicho perpétuo' || tSep==='Sep perpétua') tSep += ' nº ____ L nº ____ Fls nº ____';
    const dr = d.data_registro ? new Date(d.data_registro) : new Date(), dtxt = `Niterói, ${dr.getDate()} de ${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][dr.getMonth()]} de ${dr.getFullYear()}`;
    const blR = assinaturaResponsavelImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    const blA = assinaturaAtendenteImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let endC = upper(`${d.endereco}, Nº ${d.numero||'S/N'}`); if(d.complemento) endC += ` - ${upper(d.complemento)}`;
    let tL = d.telefone||''; let i=2; while(d['telefone'+i]) { tL += ' / ' + d['telefone'+i]; i++; }
    
    const html = `<html><head><title>Requerimento Exumação</title>${getPrintStyle()}</head><body>
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Bras%C3%A3o_de_Niter%C3%B3i%2C_RJ.svg" class="watermark">
        <div class="header"><div class="box-protocolo">PROTOCOLO: ${d.protocolo||'N/A'} ${d.processo?`<br>PROCESSO: ${d.processo}`:''}</div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="logo-print"><div class="header-subtitle">Subsecretaria de Infraestrutura - SSINF<br>Coordenação dos Cemitérios de Niterói</div></div>
        <div class="doc-title">Requerimento de Serviços Cemiteriais</div>
        <div class="section"><div class="section-title">Dados do Requerente</div><div class="row"><div class="field" style="flex:2;"><span class="label">Nome Completo</span><span class="value">${upper(d.resp_nome)}</span></div><div class="field"><span class="label">Grau de Parentesco</span><span class="value">${upper(d.parentesco)}</span></div></div><div class="row"><div class="field" style="flex:2.5;"><span class="label">Endereço</span><span class="value">${endC}</span></div><div class="field" style="flex:0.5;"><span class="label">CEP</span><span class="value">${d.cep||'-'}</span></div></div><div class="row"><div class="field"><span class="label">Bairro</span><span class="value">${upper(d.bairro)}</span></div><div class="field"><span class="label">Município</span><span class="value">${upper(d.municipio)}</span></div><div class="field"><span class="label">Telefone(s)</span><span class="value">${tL}</span></div></div></div>
        <div class="section"><div class="section-title">Dados do Falecido(a)</div><div class="row"><div class="field" style="flex:2;"><span class="label">Nome do(a) Falecido(a)</span><span class="value">${upper(d.nome_falecido)}</span></div><div class="field"><span class="label">Data de Sepultamento</span><span class="value">${formatarDataInversa(d.data_sepultamento)}</span></div><div class="field"><span class="label">Cemitério</span><span class="value">${d.cemiterio==='OUTRO'?upper(d.cemiterio_outro):upper(d.cemiterio)}</span></div></div></div>
        <div class="section"><div class="section-title">Serviços Requeridos e Localização</div><div class="row"><div class="field"><div class="chk-item">( X ) ${upper(d.servico_requerido)}</div></div><div class="field"><div class="chk-item">( X ) ${upper(tSep)}</div></div></div><div class="row" style="margin-top:15px;"><div class="field"><span class="label">Nº da Sepultura</span><span class="value">${d.sepul}</span></div><div class="field"><span class="label">Quadra</span><span class="value">${upper(d.qd)}</span></div><div class="field" style="flex:2;"><span class="label">Proprietário (Se Perpétua)</span><span class="value">${upper(d.proprietario)}</span></div></div><div class="row" style="margin-top:10px;"><div class="field"><span class="label">Assunto / Observações</span><span class="value">${upper(d.assunto)}</span></div></div></div>
        
        <div class="section"><div class="section-title">Destino</div><div class="row"><div class="field"><span class="label">Cemitério</span><span class="value">${upper(d.cemiterio_destino)}</span></div><div class="field"><span class="label">Tipo</span><span class="value">${upper(d.destino_tipo_sepultura)}</span></div><div class="field"><span class="label">Nº Sepultura/Nicho</span><span class="value">${upper(d.destino_local_nro)}</span></div><div class="field"><span class="label">Quadra</span><span class="value">${upper(d.destino_qd)}</span></div></div><div class="row" style="margin-top:10px;"><div class="field"><span class="label">Livro Nº</span><span class="value">${upper(d.destino_livro)}</span></div><div class="field"><span class="label">Fls Nº</span><span class="value">${upper(d.destino_fls)}</span></div><div class="field" style="flex:2;"><span class="label">Proprietário (Destino)</span><span class="value">${upper(d.destino_proprietario)}</span></div></div></div>

        <div class="footer-note"><b>EM TEMPO:</b> Ao assinar este requerimento, declaro estar ciente que depois de passados <b>90 (noventa) dias</b> do deferimento desse procedimento administrativo, não havendo manifestação de minha parte para pagamento e realização do pleiteado, o processo será encerrado e arquivado, sendo considerado como desinteresse de minha parte; os restos mortais, quando for objeto do pedido, serão exumados e recolhidos ao ossuário geral. <br><br><b>OBS.: O comprovante de requerimento (protocolo) deverá ser apresentado no cemitério em até 24h após emissão.</b></div>
        <div style="margin-top:10px; font-size:14px;">Nestes termos, peço deferimento.</div><div style="text-align:right; margin-top:5px; font-size:14px;"><b>${dtxt}</b></div>
        <div style="display:flex; justify-content:space-around; margin-top:30px; text-align:center;"><div>${blA}<div style="border-top:1px solid #000; padding-top:5px; min-width:250px;"><b>${upper(d.atendente_sistema||'ATENDENTE')}</b><br><span style="font-size:11px; color:#555;">(Assinatura do Atendente)</span></div></div><div>${blR}<div style="border-top:1px solid #000; padding-top:5px; min-width:250px;"><b>${upper(d.resp_nome)}</b><br><span style="font-size:11px; color:#555;">(Assinatura do Requerente)</span></div></div></div>
        <div class="legal">Art. 299 do Código Penal - Falsidade ideológica: Omitir, em documento público ou particular, declaração que dele devia constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fatos juridicamente relevante, é crime.</div>
    </body><script>window.onload=()=>setTimeout(()=>window.print(),800)</script></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

window.imprimirLiberacao = () => {
    if (!dadosAtendimentoAtual) return; const d = dadosAtendimentoAtual;
    const dr = d.data_registro ? new Date(d.data_registro) : new Date(), dtxt = `Niterói, ${dr.getDate()} de ${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][dr.getMonth()]} de ${dr.getFullYear()}`;
    let endC = upper(`${d.endereco}, Nº ${d.numero||'S/N'}`); if (d.complemento) endC += ` - ${upper(d.complemento)}`;
    let tL = d.telefone||''; let i=2; while(d['telefone'+i]) { tL += ' / ' + d['telefone'+i]; i++; }
    const blR = assinaturaResponsavelImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    const blA = assinaturaAtendenteImg ? `<div style="text-align:center; height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px; max-width:80%;"></div>` : `<div style="height:45px;"></div>`;

    let servReq = d.servico_requerido ? d.servico_requerido.toUpperCase() : "";
    let avisoNichoHtml = (servReq.includes("EXUMAÇÃO") || servReq.includes("ENTRADA DE OSSOS") || servReq.includes("PERMISSÃO DE USO")) 
        ? `<br><br><div style="text-align:center;"><b>OBSERVAÇÃO: Os nichos tem a capacidade para somente 1 (uma) ossada.</b></div>` 
        : "";

    const html = `<html><head><title>Liberação</title>${getPrintStyle()}</head><body>
        <img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Bras%C3%A3o_de_Niter%C3%B3i%2C_RJ.svg" class="watermark">
        <div class="header"><div class="box-protocolo">PROTOCOLO: ${d.protocolo||'N/A'}</div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="logo-print"><div class="header-subtitle">Secretaria de Mobilidade e Infraestrutura - SEMOBI<br>Subsecretaria de Infraestrutura - SSINF<br>Coordenação dos Cemitérios de Niterói</div></div>
        <div class="doc-title">Liberação</div>
        <div class="section"><div class="section-title">Dados Administrativos</div><div class="row"><div class="field"><span class="label">Processo Nº</span><span class="value">${d.processo||'-'}</span></div><div class="field"><span class="label">GRM Nº</span><span class="value">${d.grm||'-'}</span></div><div class="field"><span class="label">Quantia Paga (R$)</span><span class="value">${upper(d.valor_pago)}</span></div></div></div>
        <div class="section"><div class="section-title">Dados do Requerente e Localização</div><div class="row"><div class="field" style="flex:2;"><span class="label">Nome do Requerente</span><span class="value">${upper(d.resp_nome)}</span></div><div class="field"><span class="label">Cemitério Municipal</span><span class="value">${d.cemiterio==='OUTRO'?upper(d.cemiterio_outro):upper(d.cemiterio)}</span></div></div><div class="row"><div class="field" style="flex:2.5;"><span class="label">Endereço</span><span class="value">${endC}</span></div><div class="field" style="flex:0.5;"><span class="label">CEP</span><span class="value">${d.cep||'-'}</span></div></div><div class="row"><div class="field"><span class="label">Bairro</span><span class="value">${upper(d.bairro)}</span></div><div class="field"><span class="label">Município</span><span class="value">${upper(d.municipio)}</span></div><div class="field"><span class="label">Telefone(s)</span><span class="value">${tL}</span></div></div></div>
        <div class="section"><div class="section-title">Referente A</div><div class="row"><div class="field"><span class="value" style="border:none;text-align:justify;line-height:1.5;text-transform:uppercase;">${d.referente_a?d.referente_a.replace(/\n/g,'<br>'):'__________________________________________________________________________'}</span></div></div></div>
        <div class="footer-note"><b>ESTOU CIENTE QUE O(A) REQUERENTE DEVERÁ COMPARECER NO DIA DA EXUMAÇÃO/ENTRADA E SAÍDA DE OSSOS__________________________________________</b><br><br><div style="text-align:center;text-decoration:underline;"><b>EXUMAÇÃO E ENTRADA/SAÍDA DE OSSOS SÃO FEITAS DE SEGUNDA A SEXTA DAS 8H ÀS 10H, EXCETO FERIADOS.</b></div>${avisoNichoHtml}</div>
        <div style="margin-top:15px; text-align:right; font-size:14px;"><b>${dtxt}</b></div>
        <div style="display:flex; justify-content:space-around; margin-top:40px; text-align:center;"><div>${blA}<div style="border-top:1px solid #000; padding-top:5px; min-width:250px;"><b>${upper(d.atendente_sistema||'ATENDENTE')}</b><br><span style="font-size:11px; color:#555;">Coordenação dos Cemitérios de Niterói</span></div></div><div>${blR}<div style="border-top:1px solid #000; padding-top:5px; min-width:250px;"><b>RESPONSÁVEL</b><br></div></div></div>
        <div style="text-align:center; font-size:10px; color:#666; margin-top:30px;">Rua General Castrioto, 407 - Barreto - Niterói - 24110-256 - Tel.: 3513-6157</div>
    </body><script>window.onload=()=>setTimeout(()=>window.print(),800)</script></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

window.imprimirDeclaracao = () => {
    if (!dadosAtendimentoAtual) return alert("Nenhum atendimento selecionado.");
    const d = dadosAtendimentoAtual, tv = _val('select_declaracao');
    const dr = d.data_registro ? new Date(d.data_registro) : new Date(), dtxt = `${dr.getDate()} de ${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][dr.getMonth()]} de ${dr.getFullYear()}`;
    const blR = assinaturaResponsavelImg ? `<div style="text-align:center;"><img src="${assinaturaResponsavelImg}" style="max-height:60px; margin-bottom:5px;"></div>` : `<div style="height:60px;"></div>`;
    let endC = upper(d.endereco||'___________'); if (d.numero) endC += `, Nº ${d.numero}`;
    let tL = d.telefone||''; let i=2; while(d['telefone'+i]) { tL += ' / ' + d['telefone'+i]; i++; }

    const cpf=d.cpf||"___________", rg=d.rg||"___________", aut=d.autorizado||"O PRÓPRIO REQUERENTE", fal=upper(d.nome_falecido||"___________"), proc=d.processo||"___________", sO=d.sepul||"_____", qO=d.qd||"_____", tO=upper(d.tipo_sepultura||"___________"), cO=d.cemiterio==='OUTRO'?upper(d.cemiterio_outro||"___________"):upper(d.cemiterio||"___________"), cD=upper(d.cemiterio_destino||"___________"), dN=d.destino_local_nro||"_____", dL=d.destino_livro||"_____", dF=d.destino_fls||"_____", dP=upper(d.destino_proprietario||"___________"), lac=d.lacre||"___________", sR=d.servico_reforma||"___________", pO=upper(d.proprietario||'___________'), b = t => `<b>${t}</b>`;
    
    let tit = "", txt = "";
    switch(tv) {
        case "saida_nicho_perpetuo": tit="Saída de ossos do nicho perpétuo"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a retirar os restos mortais do(a) falecido(a) ${b(fal)} no nicho perpétuo nº ${b(sO)} registrado no livro nº ${b(dL)} as fls. ${b(dF)} em nome de ${b(pO)} que se encontra no Cemitério ${b(cO)} para o Cemitério ${b(cD)}.`; break;
        case "exumacao_saida": tit="Exumação e saída dos restos mortais"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a exumar os restos mortais do(a) falecido(a) ${b(fal)} na sepultura (tipo) ${b(tO)} nº ${b(sO)} qd ${b(qO)} que se encontra no Cemitério ${b(cO)} e saída dos ossos para o Cemitério ${b(cD)}.`; break;
        case "exumacao_recolhimento_nicho_perp": tit="Exumação e recolhimento da ossada ao nicho perpétuo"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a exumar os restos mortais do(a) falecido(a) ${b(fal)} na sepultura (tipo) ${b(tO)} nº ${b(sO)} quadra ${b(qO)} que se encontra no Cemitério ${b(cO)} e recolher a ossada ao nicho perpétuo nº ${b(dN)} registrado no livro nº ${b(dL)} as fls. ${b(dF)} em nome de ${b(dP)} no Cemitério do ${b(cD)}.`; break;
        case "exumacao_recolhimento_nicho_adq": tit="Exumação e recolhimento da ossada ao nicho a ser adquirido"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a exumar os restos mortais do(a) falecido(a) ${b(fal)} na sepultura (tipo) ${b(tO)} nº ${b(sO)} quadra ${b(qO)} que se encontra no Cemitério ${b(cO)} e recolher a ossada ao nicho a ser adquirido através do processo n° ${b(proc)} no Cemitério ${b(cD)}.`; break;
        case "exumacao_recolhimento_sep_perp": tit="Exumação e recolhimento da ossada a sepultura perpétua"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a exumar os restos mortais do(a) falecido(a) ${b(fal)} que se encontra inumado na sepultura (tipo) ${b(tO)} nº ${b(sO)} qd ${b(qO)} no Cemitério ${b(cO)} e recolher a ossada a sepultura perpétua nº ${b(dN)} livro nº ${b(dL)} fls. nº ${b(dF)} em nome de ${b(dP)} no Cemitério do ${b(cD)}.`; break;
        case "entrada_recolhimento_nicho_perp": tit="Entrada de restos mortais e recolhimento da ossada ao nicho perpétuo"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a transladar os restos mortais do(a) falecido(a) ${b(fal)} vindos do Cemitério ${b(cO)} e recolher a ossada ao nicho perpétuo nº ${b(dN)} livro nº ${b(dL)} fls nº ${b(dF)} no Cemitério do ${b(cD)}.`; break;
        case "entrada_recolhimento_sep_perp": tit="Entrada de restos mortais e recolhimento da ossada a sepultura perpétua"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a transladar os restos mortais do(a) falecido(a) ${b(fal)} vindos do Cemitério ${b(cO)} e recolher a ossada a sepultura perpétua nº ${b(dN)} QD ${b(qO)} no Cemitério do ${b(cD)}.`; break;
        case "entrada_permissao_nicho": tit="Entrada de restos mortais e permissão de uso de nicho"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a transladar os restos mortais do(a) falecido(a) ${b(fal)} vindos do Cemitério ${b(cO)} e permissão de uso de nicho no Cemitério do ${b(cD)}.`; break;
        case "entrada_cinzas_sep_perp": tit="Entrada de cinzas e recolhimento a sepultura perpétua"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a transladar as cinzas do(a) falecido(a) ${b(fal)} vindos do Cemitério ${b(cO)} e recolher as cinzas a sepultura perpétua nº ${b(dN)} livro nº ${b(dL)} fls nº ${b(dF)} no Cemitério do ${b(cD)}.`; break;
        case "entrada_cinzas_nicho_perp": tit="Entrada de cinzas e recolhimento da ossada ao nicho perpétuo"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a transladar as cinzas do (a) falecido (a) ${b(fal)} vindos do Cemitério ${b(cO)}, e recolher as cinzas ao nicho perpétuo nº ${b(dN)}, livro nº ${b(dL)}, fls nº ${b(dF)}, no Cemitério do ${b(cD)}.`; break;
        case "saida_sep_perp": tit="Saída os ossos da sepultura perpétua"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a retirar os restos mortais do(a) falecido(a) ${b(fal)} na sepultura perpétua (tipo) ${b(tO)}, nº ${b(sO)}, da quadra ${b(qO)}, em nome de ${b(pO)} que se encontra no Cemitério ${b(cO)} para o Cemitério ${b(cD)}.`; break;
        case "permuta_sepultura": tit="Permuta de sepultura"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a permutar a sepultura ${b(tO)} n° ${b(sO)} registrado no livro nº ${b(dL)}, às fls nº ${b(dF)}, em nome de ${b(pO)} que se encontra no Cemitério ${b(cO)} e permutar por outra vaga no Cemitério do ${b(cD)}.`; break;
        case "reparo_diversos": tit="Reparo diversos"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a requerer reparo diversos na sepultura perpétua ${b(tO)} nº ${b(sO)}, registrado no livro nº ${b(dL)}, às fls nº ${b(dF)}, em nome de ${b(pO)} que se encontra no Cemitério ${b(cO)}.`; break;
        case "capacidade_nicho": tit="Termo de responsabilidade para capacidade do nicho e colocação de placa"; txt=`tomo ciência que o nicho a ser adquirido através do processo n° ${b(proc)} possui capacidade somente para uma ossada.<br><br><div style="margin-bottom: 15px;"><input type="checkbox" style="width: 15px; height: 15px; vertical-align: middle;"> <span style="vertical-align: middle; margin-left: 5px;">No momento não desejo iniciar o processo para colocação de lápide.</span></div><b>Informação para quem abriu processo de colocação de placa:</b><br>• Não será aceita placas de identificação que não houver as mesmas dimensões do nicho;<br>• Os funcionários do Cemitério Municipal do Maruí são proibidos de fazer medição de pedra mármore / granito para nicho;<br>• A medição da placa será feita pelo funcionário da marmoraria/loja contratada pela família;<br>• Poderá ser aproveitada lápides oriundas de sepulturas ou de entradas de restos mortais desde que esteja dentro dos padrões mencionados acima;<br>• O funcionário (pedreiro) do Cemitério colocará a placa sem custo adicional;<br>• Não poderá colocar placas de azulejos, plástico ou inox; Só poderá ser placa de mármore/granito;<br>• O recibo entregue após o pagamento tem validade de 90 (NOVENTA) dias.<br><br><b>Obs.:</b> Sendo assim, me responsabilizo por qualquer eventualidade.`; break;
        case "recolhimento_lacre_nicho_perp": tit="Recolhimento da ossada ao nicho perpétuo"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a solicitar o recolhimento dos restos mortais do(a) falecido(a) ${b(fal)} exumados e identificados sob lacre de nº ${b(lacre)} que se encontravam na sepultura (tipo) ${b(tO)}, nº ${b(sO)}, quadra ${b(qO)}, que se encontra no Cemitério ${b(cO)} e recolher a ossada ao nicho perpétuo nº ${b(dN)}, registrado no livro nº ${b(dL)}, as fls. ${b(dF)}, em nome de ${b(dP)} no Cemitério do ${b(cD)}.`; break;
        case "saida_lacre": tit="Saída da ossada sob lacre"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a solicitar o recolhimento dos restos mortais do(a) falecido(a) ${b(fal)} exumados e identificados sob lacre de nº ${b(lacre)} que se encontravam na sepultura (tipo) ${b(tO)}, nº ${b(sO)}, qd ${b(qO)}, que se encontra no Cemitério ${b(cO)} e saída dos ossos para o Cemitério ${b(cD)}.`; break;
        case "permuta_nicho": tit="Permuta de nicho"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a transladar os restos mortais do(a) falecido(a) ${b(fal)} no nicho perpétuo nº ${b(sO)}, registrado no livro nº ${b(dL)}, às fls nº ${b(dF)}, em nome de ${b(pO)} que se encontra no Cemitério ${b(cO)} e permutar por um nicho vago no Cemitério do ${b(cD)}.`; break;
        case "permissao_uso_sepultura": tit="Permissão de uso de sepultura"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a solicitar a permissão de uso da sepultura (tipo) ${b(tO)} n° ${b(sO)} quadra ${b(qO)} onde se encontra os restos mortais de ${b(fal)} no Cemitério ${b(cO)}.`; break;
        case "autorizacao_placa_nicho": tit="Autorização para colocação de placa de identificação no nicho perpétuo"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a dispor de uma placa de identificação no nicho perpétuo nº ${b(dN)}, registrado no livro nº ${b(dL)}, as fls. ${b(dF)}, em nome de ${b(dP)} no Cemitério do ${b(cD)}.`; break;
        case "servico_reforma_sep_perp": tit="Serviço na sepultura perpétua"; txt=`Autorizo o(a) Sr(a) ${b(aut)} a requerer serviço em ${b(sR)} na sepultura perpétua ${b(tO)} nº ${b(sO)}, registrado no livro nº ${b(dL)}, às fls nº ${b(dF)}, em nome de ${b(pO)} que se encontra no Cemitério ${b(cO)}.`; break;
        case "declaracao_residencia": tit="De residência"; txt=`Declaro para devidos fins que tenho domicílio a ${b(endC)}, bairro ${b(upper(d.bairro))}, município ${b(upper(d.municipio))}, CEP ${b(d.cep||'___________')}.`; break;
        case "cancelamento_processo": tit="Termo de cancelamento"; txt=`Venho por meio desta, como ${b(upper(d.parentesco))} do falecido(a) ${b(fal)} sepultado na sepultura ${b(tO)} n° ${b(sO)} no cemitério ${b(cO)}, solicitar o cancelamento do meu processo nº ${b(proc)}.<br><br>Sugiro o arquivamento.`; break;
        case "termo_entrada_ossos_mumificados": tit="Termo de responsabilidade – Entrada de ossos mumificados"; txt=`Venho por meio desta, como ${b(upper(d.parentesco))} do falecido(a) ${b(fal)}, sepultado em ${b(tO)} nº ${b(sO)} no cemitério ${b(cO)}, me responsabilizar perante a Prefeitura Municipal de Niterói, que caso seja constatado que a ossada encontra-se em estado de mumificação, a mesma não poderá, sob nenhuma hipótese, ser retirada do cemitério de origem, ficando impedida a entrada de ossos nos cemitérios Municipais de Niterói. Comprometo-me a respeitar as orientações e determinações técnicas dos órgãos responsáveis e eximo a Prefeitura Municipal de Niterói de qualquer responsabilidade quanto à impossibilidade de remoção ou traslado da ossada nessas condições.<br><br>Sendo assim me responsabilizo por qualquer eventualidade.<br>Aguardo o deferimento do meu pedido.`; break;
        case "termo_capacidade_nicho_perpetuo": tit="Termo de responsabilidade – Capacidade do nicho perpétuo"; txt=`Venho por meio desta, como ${b(upper(d.parentesco))} do falecido(a) ${b(fal)}, sepultado em ${b(tO)} nº ${b(sO)} no cemitério ${b(cO)}, Declaro-me responsável perante a Prefeitura Municipal de Niterói e ciente de que, caso o nicho perpétuo nº ${b(dN!=='_____'?dN:sO)} não possua capacidade física para receber a ossada, comprometo-me, por minha conta, a providenciar a aquisição de um novo nicho que atenda às exigências e normas vigentes do cemitério ou a dar outro destino adequado aos restos mortais.<br><br>Sendo assim, me responsabilizo por qualquer eventualidade.<br>Aguardo o deferimento do meu pedido.`; break;
        case "termo_lapide_perpetuo": tit="Termo de responsabilidade para colocação de lápide em perpétuos"; txt=`tomo ciência que:<br><br>• Não será aceita placas de identificação que não houver as mesmas dimensões do nicho ou sepultura;<br>• Os funcionários do Cemitério Municipal do Maruí são proibidos de fazer medição de pedra mármore / granito para nicho ou sepultura;<br>• A medição da placa será feita pelo funcionário da marmoraria contratada pela família;<br>• Poderá ser aproveitada lápides oriundas de sepulturas ou de entradas de restos mortais desde que esteja dentro dos padrões mencionados acima;<br>• O funcionário do Cemitério colocará a placa sem custo adicional;<br>• Não poderá colocar placas de azulejos, plástico ou inox;<br>• Só poderá ser placa de mármore/granito.<br>• O recibo entregue após o pagamento tem validade de 90 (NOVENTA) dias.<br><br>Sendo assim, me responsabilizo por qualquer eventualidade.<br>Aguardo o deferimento do meu pedido.`; break;
        case "termo_reforma_perpetuo": tit="Termo de responsabilidade para reformas ou serviços em perpétuos"; txt=`tomo ciência que:<br><br>• O Cemitério NÃO guardará as ossadas que estão na sepultura durante o serviço / reforma;<br>• Os funcionários do Cemitério NÃO poderão fazer qualquer tipo de mão de obra na sepultura perpétua;<br>• NÃO fazemos indicações de profissionais, a família deverá trazer o profissional de sua escolha e confiança.<br><br>Sendo assim, me responsabilizo por qualquer eventualidade.<br>Aguardo o deferimento do meu pedido.`; break;
    }

    let txtI = `Eu, ${b(upper(d.resp_nome))}, carteira de identidade nº ${b(rg)}, inscrito(a) sob o CPF nº ${b(cpf)}, residente à ${b(endC)}, bairro ${b(upper(d.bairro))}, município ${b(upper(d.municipio))}, contato telefônico ${b(tL||'___________')}, `;
    if (tv === "capacidade_nicho" || tv === "termo_lapide_perpetuo" || tv === "termo_reforma_perpetuo") {
        txtI = `Eu, ${b(upper(d.resp_nome))}, inscrito(a) sob o CPF n° ${b(cpf)}, `;
    } else if (tv === "declaracao_residencia" || tv === "cancelamento_processo" || tv === "termo_entrada_ossos_mumificados" || tv === "termo_capacidade_nicho_perpetuo") {
        txtI = `Eu, ${b(upper(d.resp_nome))}, ${tv==="declaracao_residencia"?'carteira de identidade':'portador(a) da carteira de identidade'} nº ${b(rg)}, inscrito(a) sob o CPF nº ${b(cpf)}.<br><br>`;
    }

    const html = `<html><head><title>${tit}</title><style>@page{size:A4 portrait;margin:15mm}body{font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}.header{text-align:center;margin-bottom:25px}.header img{height:60px;margin-bottom:10px}.header-title{font-weight:bold;font-size:14px;margin-top:5px}.doc-title{font-weight:bold;font-size:20px;text-transform:uppercase;margin-top:20px;text-decoration:underline}.content{text-align:justify;margin-top:30px}.footer{margin-top:50px;text-align:center}.legal{font-size:11px;text-align:center;margin-top:40px;font-weight:bold;line-height:1.2}</style></head><body>
        <div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" alt="Logo Prefeitura"><div class="header-title">SECRETARIA DE MOBILIDADE E INFRAESTRUTURA - SEMOBI</div><div class="header-title">SUBSECRETARIA DE INFRAESTRUTURA - SSINFRA</div><div class="doc-title">DECLARAÇÃO</div><div style="font-weight:bold;font-size:17px;margin-top:10px;">${tit}</div></div>
        <div class="content">${txtI} ${txt}</div>
        <div class="footer"><div>Niterói, ${dtxt}</div><div style="margin-top:50px;display:flex;flex-direction:column;align-items:center;"><div style="width:350px;text-align:center;">${blR}<div style="border-top:1px solid #000;padding-top:5px;font-weight:bold;">Assinatura conforme documento apresentado</div></div><div style="margin-top:15px;font-weight:bold;font-size:14px;">*ANEXAR XEROX DO RG</div></div></div>
        <div class=\"legal\">Art. 299 do Código Penal - Falsidade ideológica: Omitir, em documento público ou particular, declaração que dele devia constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fatos juridicamente relevante, é crime.</div>
    </body><script>window.onload=()=>setTimeout(()=>window.print(),800)</script></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}