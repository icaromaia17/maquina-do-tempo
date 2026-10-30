// Importa o framework Express para criar o servidor web
const express = require('express');

// Cria a aplicação Express
const app = express();

// Define a porta: usa a da hospedagem (variável PORT) ou 3000 no seu computador
const PORT = process.env.PORT || 3000;

// Define o idioma da Wikipedia usado na API da Wikimedia (teste 'pt' depois)
const IDIOMA = 'en';

// Serve os arquivos estáticos (HTML, CSS e JS do front-end) da pasta "public"
app.use(express.static('public'));

// Função que valida uma data no formato AAAA-MM-DD e devolve o ano, mês e dia ou um erro
function validarData(data) {
  // Guard clause: se a data não foi enviada, devolve erro
  if (!data) {
    // Devolve um objeto com a mensagem de erro
    return { erro: 'Informe a data no formato AAAA-MM-DD.' };
  }
  // Guard clause: testa o formato com expressão regular (4 dígitos, hífen, 2, hífen, 2)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    // Devolve erro de formato
    return { erro: 'Formato inválido. Use AAAA-MM-DD.' };
  }
  // Separa a string em partes e converte cada uma para número
  const [ano, mes, dia] = data.split('-').map(Number);
  // Cria um objeto Date com essa data (o mês no JavaScript começa em 0)
  const objeto = new Date(ano, mes - 1, dia);
  // Guard clause: se o Date "corrigiu" a data, ela não existe (ex.: 31/02)
  if (objeto.getFullYear() !== ano || objeto.getMonth() !== mes - 1 || objeto.getDate() !== dia) {
    // Devolve erro de data inexistente
    return { erro: 'Essa data não existe.' };
  }
  // Guard clause: não permite datas futuras
  if (objeto > new Date()) {
    // Devolve erro de data futura
    return { erro: 'A máquina do tempo ainda não viaja para o futuro.' };
  }
  // Guard clause: o arquivo da internet quase não tem registros antes de 1996
  if (ano < 1996) {
    // Devolve erro de data muito antiga
    return { erro: 'O arquivo da internet só começa em 1996.' };
  }
  // Se passou por todas as validações, devolve as partes da data
  return { ano, mes, dia };
}

// Função que limpa o que o usuário digitou e devolve só o domínio
// Exemplo: "https://www.cnnbrasil.com.br/esportes" vira "cnnbrasil.com.br"
function normalizarSite(entrada) {
  // Converte para texto, tira espaços das pontas e deixa tudo minúsculo
  let site = String(entrada || '').trim().toLowerCase();
  // Remove o protocolo (http:// ou https://) do começo
  site = site.replace(/^https?:\/\//, '');
  // Remove o "www." do começo
  site = site.replace(/^www\./, '');
  // Corta tudo a partir da primeira barra, interrogação ou cerquilha (caminho da página)
  site = site.split(/[/?#]/)[0];
  // Devolve o domínio limpo
  return site;
}

// Rota GET /api/eventos: busca na Wikimedia o que aconteceu no mundo naquele dia
app.get('/api/eventos', async (req, res) => {
  // Extrai o ano, mês, dia e o possível erro da validação da data enviada na URL
  const { erro, ano, mes, dia } = validarData(req.query.data);
  // Guard clause: se houve erro de validação, responde 400 (requisição inválida)
  if (erro) {
    // Responde com status 400 e a mensagem de erro em JSON
    return res.status(400).json({ erro });
  }
  // Abre um bloco try para capturar falhas de rede
  try {
    // Monta o mês com 2 dígitos (ex.: 3 vira "03")
    const mm = String(mes).padStart(2, '0');
    // Monta o dia com 2 dígitos
    const dd = String(dia).padStart(2, '0');
    // Monta a URL da API "On This Day" da Wikimedia
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/${IDIOMA}/onthisday/events/${mm}/${dd}`;
    // Faz a requisição à API externa, identificando o projeto no cabeçalho User-Agent
    const resposta = await fetch(url, { headers: { 'User-Agent': 'MaquinaDoTempo/1.0 (projeto didatico)' } });
    // Guard clause: se a Wikimedia não respondeu com sucesso, responde 502 (falha no serviço externo)
    if (!resposta.ok) {
      // Responde com status 502 e uma mensagem de erro
      return res.status(502).json({ erro: 'A Wikimedia não respondeu corretamente.' });
    }
    // Converte o corpo da resposta de texto para objeto JavaScript
    const dados = await resposta.json();
    // Pega a lista de eventos (ou uma lista vazia, se não existir)
    const todos = dados.events || [];
    // Filtra apenas os eventos que aconteceram exatamente no ano pedido
    let lista = todos.filter((evento) => evento.year === ano);
    // Guarda se encontramos eventos do ano exato
    let exato = true;
    // Se não houve nenhum evento no ano exato, usa um plano B
    if (lista.length === 0) {
      // Marca que o resultado não é do ano exato
      exato = false;
      // Ordena pelos anos mais próximos do pedido e fica com os 5 primeiros
      lista = [...todos].sort((a, b) => Math.abs(a.year - ano) - Math.abs(b.year - ano)).slice(0, 5);
    }
    // Transforma cada evento em um objeto simples, só com o que o front-end precisa
    const eventos = lista.map((evento) => ({
      // Ano do evento
      ano: evento.year,
      // Texto que descreve o evento
      texto: evento.text,
      // Link da página da Wikipedia sobre o primeiro assunto relacionado (ou null)
      link: evento.pages?.[0]?.content_urls?.desktop?.page || null,
    }));
    // Responde com sucesso (status 200 é o padrão) enviando o JSON final
    res.json({ data: req.query.data, exato, eventos });
  } catch (e) {
    // Em caso de falha de rede, responde 500 (erro interno)
    res.status(500).json({ erro: 'Não foi possível consultar a Wikimedia.' });
  }
});

// Rota GET /api/arquivo: busca na Wayback Machine como um site estava naquela data
app.get('/api/arquivo', async (req, res) => {
  // Limpa o site digitado; se ficar vazio, usa google.com como padrão
  const site = normalizarSite(req.query.site) || 'google.com';
  // Extrai o ano, mês, dia e o possível erro da validação da data
  const { erro, ano, mes, dia } = validarData(req.query.data);
  // Guard clause: data inválida responde 400
  if (erro) {
    // Responde com status 400 e a mensagem de erro
    return res.status(400).json({ erro });
  }
  // Guard clause: o site precisa parecer um domínio (ex.: uol.com.br)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) {
    // Responde 400 com mensagem de site inválido
    return res.status(400).json({ erro: 'Site inválido. Exemplo: google.com' });
  }
  // Abre um bloco try para capturar falhas de rede
  try {
    // Monta o timestamp no formato AAAAMMDD que a Wayback espera
    const timestamp = `${ano}${String(mes).padStart(2, '0')}${String(dia).padStart(2, '0')}`;
    // Monta a URL da API de disponibilidade da Wayback Machine
    const url = `https://archive.org/wayback/available?url=${encodeURIComponent(site)}&timestamp=${timestamp}`;
    // Função interna que consulta a Wayback identificando o projeto e com limite de 10 segundos
    const consultar = () => fetch(url, {
      // Identifica o projeto no cabeçalho User-Agent
      headers: { 'User-Agent': 'MaquinaDoTempo/1.0 (projeto didatico)' },
      // Cancela a requisição se ela demorar mais de 10 segundos
      signal: AbortSignal.timeout(10000),
    });
    // Primeira tentativa de consulta (let porque o valor pode ser trocado na segunda tentativa)
    let resposta = await consultar();
    // A API da Wayback é instável: se falhou, espera 1 segundo e tenta mais uma vez
    if (!resposta.ok) {
      // Mostra no terminal qual status a Wayback devolveu, para ajudar a descobrir o problema
      console.log(`Wayback respondeu com status ${resposta.status}. Tentando de novo...`);
      // Aguarda 1 segundo antes da nova tentativa
      await new Promise((resolver) => setTimeout(resolver, 1000));
      // Segunda tentativa de consulta
      resposta = await consultar();
    }
    // Variável que guarda o registro encontrado (url e timestamp), venha de qual API vier
    let registro = null;
    // Se a API de disponibilidade respondeu com sucesso, usa o resultado dela
    if (resposta.ok) {
      // Converte a resposta para objeto JavaScript
      const dados = await resposta.json();
      // Pega o registro mais próximo da data, se existir
      registro = dados.archived_snapshots?.closest || null;
    } else {
      // Mostra no terminal o status da segunda tentativa e avisa que vai usar o plano B
      console.log(`Wayback falhou de novo com status ${resposta.status}. Usando a API CDX como plano B...`);
      // Monta a URL da API CDX, que devolve o registro mais próximo da data pedida
      const urlCdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(site)}&output=json&limit=1&sort=closest&closest=${timestamp}&filter=statuscode:200`;
      // Faz a consulta ao plano B, também com User-Agent e limite de 10 segundos
      const respostaCdx = await fetch(urlCdx, {
        // Identifica o projeto no cabeçalho User-Agent
        headers: { 'User-Agent': 'MaquinaDoTempo/1.0 (projeto didatico)' },
        // Cancela a requisição se ela demorar mais de 10 segundos
        signal: AbortSignal.timeout(10000),
      });
      // Guard clause: se o plano B também falhou, responde 502
      if (!respostaCdx.ok) {
        // Mostra no terminal o status do plano B
        console.log(`API CDX também falhou com status ${respostaCdx.status}.`);
        // Responde com status 502 e uma mensagem de erro
        return res.status(502).json({ erro: 'A Wayback Machine não respondeu corretamente. Tente novamente em instantes.' });
      }
      // Lê o corpo como texto, porque quando não há registros ele pode vir vazio
      const texto = await respostaCdx.text();
      // Converte o texto em lista (ou usa lista vazia se o corpo veio vazio)
      const linhas = texto ? JSON.parse(texto) : [];
      // A primeira linha é o cabeçalho; se existe uma segunda, ela é o registro
      if (linhas.length > 1) {
        // Pega o timestamp e o endereço original da página arquivada
        const [, timestampCdx, original] = linhas[1];
        // Monta o mesmo formato de registro que a outra API devolveria
        registro = { url: `https://web.archive.org/web/${timestampCdx}/${original}`, timestamp: timestampCdx };
      }
    }
    // Guard clause: se não há registro, responde 404 (não encontrado)
    if (!registro) {
      // Responde com status 404 e uma mensagem amigável
      return res.status(404).json({ erro: `Nenhum registro de ${site} perto dessa data.` });
    }
    // Responde com o site, o link do registro e a data real em que ele foi salvo
    res.json({ site, link: registro.url, dataRegistro: registro.timestamp });
  } catch (e) {
    // Mostra no terminal o erro real (rede fora do ar, tempo esgotado etc.)
    console.error('Erro na consulta à Wayback:', e.message);
    // Em caso de falha de rede, responde 500
    res.status(500).json({ erro: 'Não foi possível consultar a Wayback Machine.' });
  }
});

// Inicia o servidor na porta definida
app.listen(PORT, () => {
  // Mostra no terminal o endereço para acessar o projeto
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});