// --- CONFIGURAÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs",
  authDomain: "funeraria-niteroi.firebaseapp.com",
  projectId: "funeraria-niteroi",
  storageBucket: "funeraria-niteroi.firebasestorage.app",
  messagingSenderId: "232673521828",
  appId: "1:232673521828:web:f25a77f27ba1924cb77631"
};

let db = null;
let dadosConsulta = null;

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    }
} catch (e) { 
    console.error("Erro Firebase:", e); 
}

// --- FUNÇÃO AUXILIAR DE EXUMAÇÃO ---
function renderizarDadosExumacao(doc) {
    dadosConsulta = doc.data();
    dadosConsulta.isExumacao = true;
    
    document.getElementById('res-nome').innerText = dadosConsulta.nome || dadosConsulta.nome_falecido || dadosConsulta.falecido || dadosConsulta.requerente || 'Não informado';
    
    let localTxt = `${dadosConsulta.cemiterio || dadosConsulta.local || 'Cemitério não informado'}`;
    localTxt += `<br>Sepultura: ${dadosConsulta.sepultura || dadosConsulta.sepul || '?'} | QD: ${dadosConsulta.quadra || dadosConsulta.qd || '?'}`;
    localTxt += `<br><span style="color:#6f42c1; font-weight:bold;">(Protocolo de Exumação)</span>`;
    
    document.getElementById('res-local').innerHTML = localTxt;
    
    let rawData = dadosConsulta.data_exumacao || dadosConsulta.data_agendamento || dadosConsulta.data || dadosConsulta.data_ficha || '';
    const dataF = rawData.includes('-') ? rawData.split('-').reverse().join('/') : (rawData || '--/--/----');
    const horaF = dadosConsulta.hora_exumacao || dadosConsulta.hora || '--:--';
    
    document.getElementById('res-data').innerText = `${dataF} às ${horaF}`;

    const btnMapa = document.getElementById('btn-mapa');
    const cleanCoords = dadosConsulta.geo_coords ? dadosConsulta.geo_coords.replace(/\s/g, '') : '';
    if (cleanCoords && cleanCoords.includes(',')) {
        btnMapa.style.display = 'inline-block';
        btnMapa.onclick = function() { window.open(`https://maps.google.com/?q=${cleanCoords}`, '_blank'); };
    } else {
        btnMapa.style.display = 'none';
    }

    document.getElementById('resultado-area').style.display = 'block';
}

// --- FUNÇÃO DE CONSULTA ---
function consultarProtocolo() {
    const protocoloInput = document.getElementById('input-protocolo').value.trim();
    const areaRes = document.getElementById('resultado-area');
    const msgErro = document.getElementById('msg-erro');
    const btnMapa = document.getElementById('btn-mapa');

    if (!protocoloInput) { 
        alert("Digite o número do protocolo."); 
        return; 
    }

    areaRes.style.display = 'none';
    msgErro.style.display = 'none';

    // 1. Busca primeiro na coleção de Sepultamentos (atendimentos)
    db.collection("atendimentos").where("protocolo", "==", protocoloInput).get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                
                // 2. Se não achou, busca na coleção correta de Exumações (requerimentos_exumacao)
                db.collection("requerimentos_exumacao").where("protocolo", "==", protocoloInput).get()
                    .then((exumSnapshot) => {
                        if (exumSnapshot.empty) {
                            msgErro.style.display = 'block';
                            dadosConsulta = null;
                        } else {
                            renderizarDadosExumacao(exumSnapshot.docs[0]);
                        }
                    })
                    .catch((error) => {
                        console.error("Erro exumações:", error);
                        alert("Erro interno no Firebase (Exumações): " + error.message);
                    });

            } else {
                // Lógica original de Sepultamentos
                const doc = querySnapshot.docs[0];
                dadosConsulta = doc.data();
                
                document.getElementById('res-nome').innerText = dadosConsulta.nome;
                
                let localTxt = `${dadosConsulta.local || 'Cemitério do Maruí'} - ${dadosConsulta.cap || ''}`;
                localTxt += `<br>Sepultura: ${dadosConsulta.sepul || '?'} | QD: ${dadosConsulta.qd || '?'}`;
                
                if (dadosConsulta.tipo_sepultura && dadosConsulta.tipo_sepultura.toUpperCase().includes('PERPETU')) {
                    localTxt += `<br><span style="color:blue; font-weight:bold;">Perpétua (L: ${dadosConsulta.livro_perpetua||'-'} F: ${dadosConsulta.folha_perpetua||'-'})</span>`;
                }
                
                document.getElementById('res-local').innerHTML = localTxt;
                
                const dataF = dadosConsulta.data_ficha ? dadosConsulta.data_ficha.split('-').reverse().join('/') : '--/--/----';
                document.getElementById('res-data').innerText = `${dataF} às ${dadosConsulta.hora}`;

                const cleanCoords = dadosConsulta.geo_coords ? dadosConsulta.geo_coords.replace(/\s/g, '') : '';
                if (cleanCoords && cleanCoords.includes(',')) {
                    btnMapa.style.display = 'inline-block';
                    btnMapa.onclick = function() { window.open(`https://maps.google.com/?q=${cleanCoords}`, '_blank'); };
                } else {
                    btnMapa.style.display = 'none';
                }

                areaRes.style.display = 'block';
            }
        })
        .catch((error) => {
            console.error("Erro conexao principal:", error);
            alert("Erro de conexão com o banco de dados: " + error.message);
        });
}

// --- GERAR 2ª VIA ---
function gerar2ViaPublica() {
    if (!dadosConsulta) return;

    // =========================================================================
    // 1. LÓGICA DE IMPRESSÃO PARA EXUMAÇÃO (Requerimento Oficial Cemiterial)
    // =========================================================================
    if (dadosConsulta.isExumacao) {
        const d = dadosConsulta;
        const fd = (dataStr) => { if (!dataStr) return "-"; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

        const protocolo = d.protocolo || "";
        
        const req_nome = (d.requerente || d.resp_nome || d.nome_requerente || '-').toUpperCase();
        const req_grau = (d.parentesco || d.grau_parentesco || '-').toUpperCase();
        const req_end = (d.endereco || '-').toUpperCase();
        const req_cep = d.cep || '-';
        const req_bairro = (d.bairro || '-').toUpperCase();
        const req_mun = (d.municipio || d.cidade || 'NITERÓI/RJ').toUpperCase();
        const req_tel = d.telefone || '-';

        const fal_nome = (d.falecido || d.nome_falecido || d.nome || '-').toUpperCase();
        const fal_data_sep = d.data_sepultamento ? (d.data_sepultamento.includes('-') ? fd(d.data_sepultamento) : d.data_sepultamento) : '-';
        const cemiterio = (d.cemiterio || d.local || '-').toUpperCase();

        const sepultura = d.sepultura || d.sepul || '-';
        const quadra = d.quadra || d.qd || '-';
        const proprietario = (d.proprietario || d.proprietario_perpetua || '-').toUpperCase();
        const obs = (d.observacoes || d.assunto || d.obs || '-').toUpperCase();
        
        const servico_carneiro = (d.tipo_carneiro || d.tipo_sepultura || 'CARNEIRO DE ADULTO').toUpperCase();
        
        const atendente = (d.atendente || d.atendente_sistema || '').toUpperCase();

        const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const hoje = new Date();
        const dataRodape = `Niterói, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

        const htmlExumacao = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Requerimento de Serviços Cemiteriais</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; color: #000; position: relative; }
                
                .watermark { position: absolute; top: 15%; left: 50%; transform: translateX(-50%); width: 70%; opacity: 0.1; z-index: -1; }
                
                .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; position: relative; }
                .logo-area { text-align: center; flex: 1; }
                .logo-area img { max-height: 80px; }
                .sub-title { font-size: 11px; font-weight: bold; margin-top: 5px; }
                .protocol-box { position: absolute; top: 0; right: 0; border: 2px solid #000; padding: 4px 8px; font-size: 11px; font-weight: bold; }
                
                .main-title { text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0 15px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 10px 0; }
                
                .section { border: 1px solid #ccc; margin-bottom: 15px; border-radius: 4px; box-shadow: 2px 2px 0px rgba(0,0,0,0.05); }
                .sec-header { background-color: #f2f2f2; font-weight: bold; font-size: 10px; padding: 6px 10px; border-bottom: 1px solid #ccc; color: #333; }
                .sec-body { padding: 10px; display: flex; flex-wrap: wrap; gap: 15px 10px; }
                
                .field { display: flex; flex-direction: column; }
                .field label { font-size: 9px; color: #555; font-weight: bold; margin-bottom: 2px; }
                .field span { font-size: 12px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                
                .w-100 { width: 100%; }
                .w-70 { width: calc(70% - 5px); }
                .w-30 { width: calc(30% - 5px); }
                .w-60 { width: calc(60% - 5px); }
                .w-40 { width: calc(40% - 5px); }
                .w-50 { width: calc(50% - 5px); }
                .w-25 { width: calc(25% - 5px); }
                
                .checkbox-line { display: flex; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
                
                .disclaimer { font-size: 10px; text-align: justify; margin-top: 15px; line-height: 1.4; }
                .deferimento { margin-top: 20px; font-size: 12px; }
                .data-local { text-align: right; font-weight: bold; font-size: 12px; margin-top: 20px; }
                
                .signature-area { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; }
                .signature-box { width: 45%; }
                .sig-line { border-top: 1px solid #000; padding-top: 5px; margin-bottom: 3px; }
                .sig-name { font-weight: bold; font-size: 12px; text-transform: uppercase; }
                .sig-role { font-size: 10px; color: #666; }
                
                .footer-legal { font-size: 9px; text-align: justify; margin-top: 50px; line-height: 1.3; }
            </style>
        </head>
        <body>
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="watermark">
            
            <div class="header-container">
                <div class="logo-area">
                    <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" alt="Prefeitura de Niterói">
                    <div class="sub-title">SUBSECRETARIA DE INFRAESTRUTURA - SSINF<br>COORDENAÇÃO DOS CEMITÉRIOS DE NITERÓI</div>
                </div>
                <div class="protocol-box">PROTOCOLO: ${protocolo}</div>
            </div>

            <div class="main-title">REQUERIMENTO DE SERVIÇOS CEMITERIAIS</div>

            <div class="section">
                <div class="sec-header">DADOS DO REQUERENTE</div>
                <div class="sec-body">
                    <div class="field w-70"><label>NOME COMPLETO</label><span>${req_nome}</span></div>
                    <div class="field w-30"><label>GRAU DE PARENTESCO</label><span>${req_grau}</span></div>
                    <div class="field w-70"><label>ENDEREÇO</label><span>${req_end}</span></div>
                    <div class="field w-30"><label>CEP</label><span>${req_cep}</span></div>
                    <div class="field w-30"><label>BAIRRO</label><span>${req_bairro}</span></div>
                    <div class="field w-40"><label>MUNICÍPIO</label><span>${req_mun}</span></div>
                    <div class="field w-30"><label>TELEFONE</label><span>${req_tel}</span></div>
                </div>
            </div>

            <div class="section">
                <div class="sec-header">DADOS DO FALECIDO(A)</div>
                <div class="sec-body">
                    <div class="field w-50"><label>NOME DO(A) FALECIDO(A)</label><span>${fal_nome}</span></div>
                    <div class="field w-25"><label>DATA DE SEPULTAMENTO</label><span>${fal_data_sep}</span></div>
                    <div class="field w-25"><label>CEMITÉRIO</label><span>${cemiterio}</span></div>
                </div>
            </div>

            <div class="section">
                <div class="sec-header">SERVIÇOS REQUERIDOS E LOCALIZAÇÃO</div>
                <div class="sec-body">
                    <div class="checkbox-line w-50">( X ) EXUMAÇÃO</div>
                    <div class="checkbox-line w-50">( X ) ${servico_carneiro}</div>
                    
                    <div class="field w-30"><label>Nº DA SEPULTURA</label><span>${sepultura}</span></div>
                    <div class="field w-25"><label>QUADRA</label><span>${quadra}</span></div>
                    <div class="field w-40"><label>PROPRIETÁRIO (SE PERPÉTUA)</label><span>${proprietario}</span></div>
                    <div class="field w-100"><label>ASSUNTO / OBSERVAÇÕES</label><span>${obs}</span></div>
                </div>
            </div>

            <div class="disclaimer">
                <b>EM TEMPO:</b> Ao assinar este requerimento, declaro estar ciente que depois de passados <b>90 (noventa) dias</b> do deferimento desse procedimento administrativo, não havendo manifestação de minha parte para pagamento e realização do pleiteado, o processo será encerrado e arquivado, sendo considerado como desinteresse de minha parte; os restos mortais, quando for objeto do pedido, serão exumados e recolhidos ao ossuário geral.<br><br>
                <b>OBS.: O comprovante de requerimento (protocolo) deverá ser apresentado no cemitério em até 24h após emissão.</b>
            </div>

            <div class="deferimento">Nestes termos, peço deferimento.</div>
            <div class="data-local">${dataRodape}</div>

            <div class="signature-area">
                <div class="signature-box">
                    <div class="sig-line"></div>
                    <div class="sig-name">${atendente || '________________________'}</div>
                    <div class="sig-role">(Assinatura do Atendente)</div>
                </div>
                <div class="signature-box">
                    <div class="sig-line"></div>
                    <div class="sig-name">${req_nome}</div>
                    <div class="sig-role">(Assinatura do Requerente)</div>
                </div>
            </div>

            <div class="footer-legal">
                <b>Art. 299 do Código Penal - Falsidade ideológica:</b> Omitir, em documento público ou particular, declaração que dele devia constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fatos juridicamente relevante, é crime.
            </div>

        </body>
        <script>window.onload=function(){window.print()}<\/script>
        </html>
        `;

        const wExum = window.open('','_blank'); 
        wExum.document.write(htmlExumacao); 
        wExum.document.close();
        return; 
    }

    // =========================================================================
    // 2. LÓGICA DE IMPRESSÃO ORIGINAL PARA SEPULTAMENTO (Intacta)
    // =========================================================================
    const d = dadosConsulta;
    
    const chk = (cond) => cond ? '(X)' : '( )';
    const chkEC = (val) => (d.estado_civil === val) ? '(X)' : '( )';
    const fd = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

    const p = d.protocolo || "";
    let dataHoraAtendimentoTexto = "";
    if (d.data_hora_atendimento) {
        const dateObj = new Date(d.data_hora_atendimento);
        dataHoraAtendimentoTexto = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getFullYear()} AS ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
    } else {
        if (p.length >= 13 && p.indexOf('-') === 8) {
            dataHoraAtendimentoTexto = `${p.substring(6,8)}/${p.substring(4,6)}/${p.substring(0,4)} AS ${p.substring(9,11)}:${p.substring(11,13)}`;
        }
    }

    const im = (d.local && d.local.includes("MARUÍ")); const is = (d.local && d.local.includes("SÃO FRANCISCO")); const ii = (d.local && d.local.includes("ITAIPU")); const cc = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    
    let tempoDecorrido = "";
    if (d.data_obito && d.hora_obito && d.hora && d.data_ficha) { const dtObito = new Date(d.data_obito + 'T' + d.hora_obito); const dtSepul = new Date(d.data_ficha + 'T' + d.hora); const diff = dtSepul - dtObito; if (diff > 0) { const diffHrs = Math.floor(diff / 3600000); const diffMins = Math.round(((diff % 3600000) / 60000)); tempoDecorrido = `${diffHrs}h ${diffMins}min`; } }
    
    const relacao = d.parentesco ? `(${d.parentesco})` : '';
    let txtSep = (d.tipo_sepultura || "").toUpperCase(); 
    const co = d.classificacao_obito || "ADULTO"; 
    let txtHoraObito = d.hora_obito; if (d.ignorar_hora_obito === 'SIM') txtHoraObito += " (IGNORADO)";
    let classificacao = co; if (txtSep.includes("ANJO")) classificacao = "ANJO";
    
    if (txtSep.includes("PERPETUA") || txtSep.includes("PERPETUO")) {
        txtSep = `${txtSep} (LIVRO: ${d.livro_perpetua||'-'} / FOLHA: ${d.folha_perpetua||'-'}) - ${classificacao}`;
    } else if (txtSep.includes("MEMBRO")) {
        txtSep = `MEMBRO AMPUTADO (${d.tipo_membro || 'Não informado'})`;
    } else {
        txtSep = `${txtSep} - ${classificacao}`;
    }

    let dataExumacao = "";
    if (d.data_ficha) {
        const parts = d.data_ficha.split('-');
        let ano = parseInt(parts[0]);
        const mes = parts[1];
        const dia = parts[2];
        const addAnos = (d.classificacao_obito === 'ANJO') ? 2 : 3;
        dataExumacao = `${dia}/${mes}/${ano + addAnos}`;
    }

    let blocoAssinaturaFamilia = "";
    if (d.assinatura_responsavel) {
        blocoAssinaturaFamilia = `<div style="text-align:center; height:45px;"><img src="${d.assinatura_responsavel}" style="max-height:40px; max-width:80%;"></div>`;
    } else {
        blocoAssinaturaFamilia = `<div style="height:45px;"></div>`;
    }

    let blocoAssinaturaAtendente = "";
    if (d.assinatura_atendente) {
        blocoAssinaturaAtendente = `<div style="text-align:center; height:45px;"><img src="${d.assinatura_atendente}" style="max-height:40px; max-width:80%;"></div>`;
    } else {
        blocoAssinaturaAtendente = `<div style="height:45px;"></div>`;
    }

    let nomeAtendente = (d.atendente_sistema || 'N/A').toUpperCase();

    const htmlComprovante = `<html><head><title>2ª Via Comprovante</title><style>@page { size: A4 portrait; margin: 8mm; } body { font-family: Arial, sans-serif; font-size: 14px; margin: 0; padding: 10px; line-height: 1.3; color: #000; } .header { text-align: center; margin-bottom: 25px; position: relative; } .header h2 { font-size: 20px; text-decoration: underline; margin: 0; font-weight: bold; text-transform: uppercase; color: #000; } .protocolo { position: absolute; top: -5px; right: 0; font-size: 14px; font-weight: bold; border: 2px solid #000; padding: 5px 10px; } .content { width: 100%; } .line { margin-bottom: 4px; white-space: nowrap; overflow: hidden; } .bold { font-weight: 900; } .red { color: red; font-weight: bold; } .section-title { font-weight: 900; margin-top: 15px; margin-bottom: 2px; text-transform: uppercase; font-size: 14px; } .two-columns { display: flex; justify-content: space-between; margin-top: 10px; } .col-left { width: 60%; } .col-right { width: 38%; } .assinaturas-block { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 10px; gap: 20px; } .ass-line { text-align: center; padding-top: 2px; flex: 1; font-size: 12px; } .obs-text { font-weight: bold; font-size: 12px; margin-top: 5px; } .box-lateral { border: 2px solid #000; padding: 5px; font-weight: 900; font-size: 12px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; } .termo-juridico { text-align: justify; font-size: 12px; line-height: 1.3; } .footer-line { margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; font-weight: 900; font-size: 12px; } .aviso-final { border: 2px solid #000; padding: 5px; margin-top: 10px; font-weight: 900; text-align: justify; font-size: 12px; line-height: 1.3; } .spacer { margin-left: 10px; } .marca-dagua { position:absolute; top:40%; left:50%; transform:translate(-50%, -50%) rotate(-45deg); font-size:100px; color:rgba(0,0,0,0.05); font-weight:bold; z-index:-1; white-space:nowrap; } </style></head><body><div class="marca-dagua">2ª VIA DO CLIENTE</div><div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 60px; margin-bottom: 5px;"><h2>Comprovante de Atendimento</h2><div class="protocolo">PROTOCOLO: ${p}</div></div><div class="content"><div class="line"><span class="bold">Nome do FALECIDO:</span> ${(d.nome || d.nome_falecido || d.falecido || 'Não Informado').toUpperCase()}</div><div class="line"><span class="bold">Nome do RESPONSÁVEL:</span> ${(d.resp_nome || '').toUpperCase()} <span style="margin-left:5px; font-weight:normal;">${relacao}</span></div><div class="line"><span class="bold">Funerária:</span> ${(d.funeraria || 'N/A').toUpperCase()} <span style="margin-left:15px">(Rep: ${d.func_funeraria || 'N/A'})</span></div><div class="line"><span class="bold">Atendente Responsável:</span> ${nomeAtendente}<span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dataHoraAtendimentoTexto}</div><div class="line"><span class="bold">Data:</span> ${fd(d.data_ficha)} <span class="bold spacer">Hora:</span> ${d.hora} <span class="bold spacer">SEPULTURA:</span> ${d.sepul} <span class="bold spacer">${(d.local && d.local.includes("MARUÍ")) ? "QUADRA:" : "RUA:"}</span> ${d.qd} <span class="bold spacer">CAPELA:</span> ${d.cap}</div><div class="line"><span class="bold">COM CAPELA</span> ${chk(cc)} <span class="bold">SEM CAPELA</span> ${chk(!cc)} <span class="bold spacer">DATA DO FALECIMENTO:</span> ${fd(d.data_obito)} AS ${txtHoraObito} <span class="red spacer">[${tempoDecorrido}]</span></div><div class="line"><span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div><div class="line">${chkEC('SOLTEIRO')} SOLTEIRO ${chkEC('CASADO')} CASADO ${chkEC('VIUVO')} VÍUVO ${chkEC('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${chkEC('DIVORCIADO')} DIVORCIADO ${chkEC('IGNORADO')} IGNORADO</div><div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div><div class="line" style="margin-top:5px; font-size:14px; border: 1px solid #000; padding: 5px;"><span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${txtSep}</div><div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${d.tanato==='SIM'?'X':' '}) SIM (${d.tanato==='NAO'?'X':' '}) NÃO</div><div class="assinaturas-block"><div class="ass-line">${blocoAssinaturaAtendente}<div style="border-top:1px solid #000;">Acolhimento / Atendente:<br><b>${nomeAtendente}</b></div></div><div class="ass-line">${blocoAssinaturaFamilia}<div style="border-top:1px solid #000;">Assinatura do responsável/família<br><b>${(d.resp_nome||'').toUpperCase()}</b></div></div></div><div class="obs-box">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div><div class="obs-box">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div><div class="line" style="margin-top: 15px; border: 2px solid #000; padding: 5px;"><span class="bold">PREVISÃO DE EXUMAÇÃO:</span> A partir de <span class="red" style="font-size:16px;">${dataExumacao}</span><br><span style="font-size:10px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças até 11 anos)</span><div style="margin-top: 15px; text-align: center;">${blocoAssinaturaFamilia}<div style="border-top: 1px solid #000; width: 60%; margin: 0 auto;">Assinatura do Responsável (Ciência do Prazo)</div></div></div><div class="two-columns"><div class="col-left"><div style="text-align:center; font-weight:bold; text-decoration:underline; margin-bottom:5px;">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div><div class="termo-juridico">Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.</div><div class="assinaturas-block" style="margin-top: 40px;"><div style="flex:1;"></div><div class="ass-line">${blocoAssinaturaFamilia}<div style="border-top: 1px solid #000;">Assinatura funcionário/família</div></div></div></div><div class="col-right"><div class="box-lateral"><div>CAPELAS MUNICIPAIS E PARTICULARES:</div><br><div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div><br><br><div>CLIENTE: _____________________</div></div></div></div><div class="footer-line">MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome || '').toUpperCase()}</div><div style="font-weight:bold; font-size:12px; margin-top:5px;">TEL: ${d.telefone||''}</div><div class="aviso-final"><span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span></div></div></body><script>window.onload=function(){window.print()}<\/script></html>`;
    
    const w = window.open('','_blank'); w.document.write(htmlComprovante); w.document.close();
}

function abrirMapaPublico() {
    if(dadosConsulta && dadosConsulta.geo_coords) {
        const clean = dadosConsulta.geo_coords.replace(/\s/g, '');
        window.open(`https://maps.google.com/?q=${clean}`, '_blank');
    }
}
