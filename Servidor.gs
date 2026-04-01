/**
 * funçao principal escutada pelo Google Apps Script para renderizar a interface web
 */
function doGet(e) { 
  return HtmlService.createTemplateFromFile('Cliente') 
    .evaluate() 
    .setTitle('Gestão de Processos - Desafio Banestes') 
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * busca pela chave especifica
 * @param {string} name - Nome exato da aba (ex: "Processos", "Clientes")
 * @returns {Sheet|null} - Objeto da aba ou nulo se não encontrada
 */
function getSheetByName(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

/**
 * le todos os dados de uma aba e os converte num array de objetos baseado no cabeçalho
 * @param {string} sheetName - Nome da aba
 * @returns {Array<Object>} - Lista de registros
 */
function getSheetDataAsObjects(sheetName) {
  var sheet = getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var cellVal = row[j];
      if (cellVal instanceof Date) {
        cellVal = cellVal.toLocaleDateString('pt-BR'); 
      }
      obj[headers[j]] = cellVal;
    }
    obj['_rowIndex'] = i + 1;
    result.push(obj);
  }
  return result;
}

/**
 * agrupa os dados de todas as abas, resolve as chaves relacionais e aplica as Regras de Negócio
 * @returns {Object} Dict contendo status da requisição e as listas das entidades
 */
function getInitialData() {
  try {
    var processos = getSheetDataAsObjects('Processos') || [];
    var clientes = getSheetDataAsObjects('Clientes') || [];
    var unidades = getSheetDataAsObjects('Unidades') || [];
    var produtos = getSheetDataAsObjects('Produtos') || [];
    
    // mapeamentos de chaves relacionais
    var clienteMap = {};
    clientes.forEach(function(c) { 
        var id = c['ID'] || c['id'] || c['CLIENTE ID'] || c['ID CLIENTE'];
        clienteMap[id] = c['Nome'] || c['NOME'] || c['Nome do Cliente'] || c['NOME DO CLIENTE'] || c['CLIENTE'] || 'Desconhecido'; 
    });
    
    var unidadeMap = {};
    unidades.forEach(function(u) { 
        var id = u['ID'] || u['id'] || u['UNIDADE ID'] || u['ID UNIDADE'];
        unidadeMap[id] = u['Nome'] || u['NOME'] || u['Nome da Unidade'] || u['NOME DA UNIDADE'] || u['UNIDADE'] || 'Desconhecida'; 
    });
    
    var produtoMap = {};
    produtos.forEach(function(p) { 
        var id = p['ID'] || p['id'] || p['PRODUTO ID'] || p['ID PRODUTO'];
        produtoMap[id] = p['Nome'] || p['NOME'] || p['Nome do Produto'] || p['NOME DO PRODUTO'] || p['PRODUTO'] || 'Desconhecido'; 
    });
    
    var processosEnriquecidos = processos.map(function(p) {
      if (!p['ID'] && !p['id']) return null; // Ignora em branco
      
      var valorRaw = p['VALOR DO CONTRATO'] || p['Valor_Divida'] || p['Valor Divida'] || 0;
      if (typeof valorRaw === 'string') {
        valorRaw = valorRaw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      }
      var valor = parseFloat(valorRaw) || 0;
      
      var garRaw = (p['Garantia_Real'] || p['Garantia Real'] || p['Garantia'] || p['TIPO DE GARANTIA'] || 'Não').toString().trim().toUpperCase();
      var mapGarantia = { 'NENHUMA': 'Não', 'NÃO': 'Não', 'CARRO': 'Carro', 'MOTO': 'Moto', 'IMÓVEL': 'Imóvel', 'EQUIPAMENTO': 'Equipamento' };
      var garantiaOrig = mapGarantia[garRaw] || garRaw;
      
      // REGRA DE NEGÓCIO: Garantias Reais aumentam a prioridade
      var temGarantia = ['Sim', 'Carro', 'Moto', 'Imóvel', 'Equipamento'].indexOf(garantiaOrig) !== -1;
      var prioridade = temGarantia;
      
      // REGRA DE NEGÓCIO: Viabilidade Financeira para dívidas >= R$ 15.000,00
      var viabilidade = valor >= 15000;
      
      var cid = p['ID_Cliente'] || p['ID Cliente'] || p['CLIENTE ID'] || '';
      var uid = p['ID_Unidade'] || p['ID Unidade'] || p['UNIDADE ID'] || '';
      var pid = p['ID_Produto'] || p['ID Produto'] || p['PRODUTO ID'] || '';

      var statusRaw = (p['Status'] || p['ANDAMENTO'] || 'Iniciado').toString().trim().toUpperCase();
      var mapStatus = { 'INICIADO': 'Iniciado', 'ANALISANDO': 'Analisando', 'PENDENTE': 'Pendente', 'PARALISADO': 'Paralisado', 'FINALIZADO': 'Finalizado' };
      var statusOrig = mapStatus[statusRaw] || statusRaw;

      return {
        id: p['ID'] || p['id'] || p['id'],
        cliente_id: cid,
        cliente_nome: clienteMap[cid] || 'Sem cliente associado',
        unidade_id: uid,
        unidade_nome: unidadeMap[uid] || 'Sem unidade',
        produto_id: pid,
        produto_nome: produtoMap[pid] || 'Sem produto',
        valor_divida: valor,
        status: statusOrig,
        garantia_real: garantiaOrig,
        row_index: p['_rowIndex'],
        viabilidade_financeira: viabilidade,
        prioridade_alta: prioridade
      };
    }).filter(function(p) { return p !== null; });
    
    return {
      success: true,
      processos: processosEnriquecidos,
      clientes: clientes,
      unidades: unidades,
      produtos: produtos
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * create ou update
 * @param {Object} dados - Dicionário submetido via frontend contendo os inputs do usuário.
 * @returns {Object} JSON de sucesso ou erro
 */
function salvarProcesso(dados) {
  try {
    var sheet = getSheetByName('Processos');
    if (!sheet) throw new Error("Aba 'Processos' não encontrada na planilha.");
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    if (dados.row_index) {
      // update
      var rowIndex = parseInt(dados.row_index);
      var range = sheet.getRange(rowIndex, 1, 1, headers.length);
      var valoresAtuais = range.getValues()[0];
      
      var novaLinha = [];
      headers.forEach(function(h, idx) {
        var header = h.toString().trim().toUpperCase();
        if (header === 'ID') novaLinha.push(valoresAtuais[idx]);
        else if (header === 'ID_CLIENTE' || header === 'ID CLIENTE' || header === 'CLIENTE ID') novaLinha.push(dados.cliente_id);
        else if (header === 'ID_UNIDADE' || header === 'ID UNIDADE' || header === 'UNIDADE ID') novaLinha.push(dados.unidade_id);
        else if (header === 'ID_PRODUTO' || header === 'ID PRODUTO' || header === 'PRODUTO ID') novaLinha.push(dados.produto_id);
        else if (header === 'VALOR_DIVIDA' || header === 'VALOR DIVIDA' || header === 'VALOR DO CONTRATO') novaLinha.push(dados.valor_divida);
        else if (header === 'STATUS' || header === 'ANDAMENTO') novaLinha.push(dados.status.toUpperCase());
        else if (header === 'GARANTIA_REAL' || header === 'GARANTIA REAL' || header === 'GARANTIA' || header === 'TIPO DE GARANTIA') {
           var garParaSalvar = dados.garantia_real === 'Não' ? 'NENHUMA' : dados.garantia_real.toUpperCase();
           novaLinha.push(garParaSalvar);
        }
        else if (header === 'DATA DA ATUALIZAÇÃO' || header === 'DATA DA ATUALIZACAO') novaLinha.push(new Date());
        else novaLinha.push(valoresAtuais[idx]);
      });
      
      range.setValues([novaLinha]);
      return { success: true, message: "Sucesso" };
      
    } else {
      // create
      // gerando ID numérico dinâmico simples
      var num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      var novoId = 'PROC-' + num;
      
      var novaLinha = [];
      headers.forEach(function(h) {
        var header = h.toString().trim().toUpperCase();
        
        // REGRA DE FORMATAÇÃO: Salvando com aspas simples para proteger o dado no Sheets
        if (header === 'ID') novaLinha.push("'" + novoId);
        else if (header === 'ID_CLIENTE' || header === 'ID CLIENTE' || header === 'CLIENTE ID') novaLinha.push(dados.cliente_id);
        else if (header === 'ID_UNIDADE' || header === 'ID UNIDADE' || header === 'UNIDADE ID') novaLinha.push(dados.unidade_id);
        else if (header === 'ID_PRODUTO' || header === 'ID PRODUTO' || header === 'PRODUTO ID') novaLinha.push(dados.produto_id);
        else if (header === 'VALOR_DIVIDA' || header === 'VALOR DIVIDA' || header === 'VALOR DO CONTRATO') novaLinha.push(parseFloat(dados.valor_divida));
        else if (header === 'STATUS' || header === 'ANDAMENTO') novaLinha.push((dados.status || 'INICIADO').toUpperCase());
        else if (header === 'GARANTIA_REAL' || header === 'GARANTIA REAL' || header === 'GARANTIA' || header === 'TIPO DE GARANTIA') {
            var garParaSalvar = dados.garantia_real === 'Não' ? 'NENHUMA' : (dados.garantia_real || 'NENHUMA').toUpperCase();
            novaLinha.push(garParaSalvar);
        }
        else if (header === 'DATA DA CRIAÇÃO' || header === 'DATA DA CRIACAO' || header === 'DATA DA ATUALIZAÇÃO' || header === 'DATA DA ATUALIZACAO') novaLinha.push(new Date());
        else novaLinha.push('');
      });
      
      sheet.appendRow(novaLinha);
      return { success: true, message: "Sucesso" };
    }
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * delete 
 * @param {number|string} rowIndex - indice nativo na planilha
 * @returns {Object} JSON de sucesso ou erro
 */
function excluirProcesso(rowIndex) {
  try {
    var sheet = getSheetByName('Processos');
    if (!sheet) throw new Error("Aba 'Processos' ausente.");
    sheet.deleteRow(parseInt(rowIndex));
    return { success: true, message: "Processo excluído" };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
