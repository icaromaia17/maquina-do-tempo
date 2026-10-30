const formulario = document.getElementById('formulario');
const campoData = document.getElementById('data');
const campoSite = document.getElementById('site');
const botao = document.getElementById('botao');
const status = document.getElementById('status');
const divEventos = document.getElementById('eventos');
const divArquivo = document.getElementById('arquivo');
const atalhos = document.getElementById('atalhos');
const flash = document.getElementById('flash');

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto) elemento.textContent = texto;
  return elemento;
}

function hojeLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatarData(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function pedirJSON(url) {
  const resposta = await fetch(url);
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro desconhecido.');
  }
  return dados;
}

function mostrarCarregando(bloco) {
  const caixa = criar('div', 'vazio');
  const spinner = criar('div', 'spinner-border text-info');
  spinner.setAttribute('role', 'status');
  caixa.append(spinner, criar('p', 'mt-3 mb-0', 'Buscando no passado...'));
  bloco.replaceChildren(caixa);
}

function mostrarErro(bloco, mensagem) {
  const alerta = criar('div', 'alert alert-warning d-flex align-items-start gap-2 mb-0');
  alerta.setAttribute('role', 'alert');
  alerta.append(criar('i', 'bi bi-exclamation-triangle-fill'), criar('span', null, mensagem));
  bloco.replaceChildren(alerta);
}

function mostrarEventos(dados) {
  const itens = [];

  if (!dados.exato) {
    const aviso = criar('div', 'alert alert-info mb-3', 'Nada registrado nesse ano. Veja eventos do mesmo dia em anos próximos:');
    aviso.setAttribute('role', 'alert');
    itens.push(aviso);
  }

  const lista = criar('ol', 'linha-tempo');

  dados.eventos.forEach((evento, indice) => {
    const li = criar('li');
    li.style.animationDelay = `${indice * 90}ms`;
    li.append(criar('span', 'ano', String(evento.ano)), criar('p', 'mb-2 mt-2', evento.texto));

    if (evento.link) {
      const link = criar('a', 'btn btn-sm btn-outline-info', 'Saiba mais ');
      link.href = evento.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(criar('i', 'bi bi-box-arrow-up-right'));
      li.append(link);
    }
    lista.append(li);
  });

  itens.push(lista);
  divEventos.replaceChildren(...itens);
}

function mostrarArquivo(dados, dataPedida) {
  const t = dados.dataRegistro;
  const registro = new Date(Number(t.slice(0, 4)), Number(t.slice(4, 6)) - 1, Number(t.slice(6, 8)));
  const [ano, mes, dia] = dataPedida.split('-').map(Number);
  const pedida = new Date(ano, mes - 1, dia);

  const dias = Math.round(Math.abs(registro - pedida) / 86400000);
  const dataRegistro = `${t.slice(6, 8)}/${t.slice(4, 6)}/${t.slice(0, 4)}`;

  const topo = criar('div', 'navegador-topo');
  topo.append(
    criar('span', 'ponto ponto-vermelho'),
    criar('span', 'ponto ponto-amarelo'),
    criar('span', 'ponto ponto-verde'),
    criar('div', 'barra-endereco', `🔒 ${dados.site}`)
  );

  const corpo = criar('div', 'navegador-corpo');
  const selo = criar(
    'span',
    dias <= 7 ? 'badge text-bg-success mb-3' : 'badge text-bg-warning mb-3',
    dias === 0 ? 'Registro exato do dia' : `Registro a ${dias} dia(s) da data pedida`
  );
  const link = criar('a', 'btn btn-neon mt-3', 'Abrir a página da época ');
  link.href = dados.link;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.append(criar('i', 'bi bi-box-arrow-up-right'));

  corpo.append(
    selo,
    criar('p', 'mb-1 text-secondary', 'Salvo em'),
    criar('p', 'data-grande mb-0', dataRegistro),
    link
  );

  const navegador = criar('div', 'navegador');
  navegador.append(topo, corpo);
  divArquivo.replaceChildren(navegador);
}

async function viajar(data, site) {
  flash.classList.remove('ativo');
  void flash.offsetWidth;
  flash.classList.add('ativo');

  botao.disabled = true;
  status.textContent = `Calibrando para ${formatarData(data)}...`;
  mostrarCarregando(divEventos);
  mostrarCarregando(divArquivo);

  const [eventos, arquivo] = await Promise.allSettled([
    pedirJSON(`/api/eventos?data=${data}`),
    pedirJSON(`/api/arquivo?data=${data}&site=${encodeURIComponent(site)}`),
  ]);

  if (eventos.status === 'fulfilled') {
    mostrarEventos(eventos.value);
  } else {
    mostrarErro(divEventos, eventos.reason.message);
  }

  if (arquivo.status === 'fulfilled') {
    mostrarArquivo(arquivo.value, data);
  } else {
    mostrarErro(divArquivo, arquivo.reason.message);
  }

  status.textContent = `Destino alcançado: ${formatarData(data)}`;
  botao.disabled = false;
}

campoData.max = hojeLocal();

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  viajar(campoData.value, campoSite.value.trim());
});

atalhos.addEventListener('click', (evento) => {
  const atalho = evento.target.closest('button[data-data]');
  if (!atalho) return;
  campoData.value = atalho.dataset.data;
  campoSite.value = atalho.dataset.site;
  formulario.requestSubmit();
});