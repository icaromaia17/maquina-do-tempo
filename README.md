# Máquina do Tempo da Internet

Escolha uma data e um site. A aplicação mostra **o que acontecia no mundo naquele dia** e **como o site era na internet da época**, cruzando duas APIs públicas em uma única consulta.

## Destaques

- **Duas fontes de dados em paralelo:** Wikimedia (eventos históricos) e Wayback Machine (cópias antigas de sites), consultadas ao mesmo tempo. Se uma falhar, a outra continua aparecendo.
- **Servidor intermediário em Express:** valida a entrada, consulta as APIs externas e devolve um JSON enxuto, sem expor detalhes das fontes ao navegador.
- **Resiliência:** tempo limite, nova tentativa e uma segunda API de reserva (CDX) para quando a Wayback limita os acessos.
- **Interface retrô-futurista:** monitor antigo, grade neon e janelas de sistema clássico sobre o Bootstrap 5, com abordagem mobile first.
- **Sem banco de dados e sem chaves de API:** `npm install`, `npm start` e está rodando.

## Começando

### Requisitos

- [Node.js](https://nodejs.org) 18 ou superior (usa o `fetch` nativo)
- Conexão com a internet (APIs, Bootstrap, ícones e fontes são carregados pela rede)

### Instalação e execução

```bash
git clone https://github.com/icaromaia17/maquina-do-tempo.git
cd maquina-do-tempo
npm install
npm start
```

Abra <http://localhost:3000>. Para parar o servidor, use `Ctrl + C`.

### Configuração

Duas constantes no topo do `server.js`:

| Constante | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `IDIOMA` | `'en'` | Edição da Wikipedia usada nos eventos (ex.: `'pt'`, sujeito à disponibilidade na Wikimedia) |

Mudanças no `server.js` exigem reiniciar o servidor. Mudanças em `public/` só pedem recarregar a página (`Ctrl + F5`).

## Como funciona

```
Navegador (public/)               Servidor Express (server.js)             APIs externas
───────────────────               ────────────────────────────             ─────────────
formulário (data + site)
      │
      ├─ GET /api/eventos ──────► valida a data, filtra por ano ─────────► Wikimedia
      │                                                                    On This Day
      │
      └─ GET /api/arquivo ──────► valida data e site ────────────────────► Wayback Machine
                                  se falhar: espera, tenta de novo         (disponibilidade)
                                  e usa o plano B ───────────────────────► Wayback Machine
                                                                           (CDX)
      ▲
      └─ JSON ◄──────────────── resposta tratada
      │
  DOM: linha do tempo de eventos + janela de navegador com o site arquivado
```

## Referência da API

O servidor segue o estilo REST: recursos em URLs claras, parâmetros na query string, respostas em JSON, códigos de status adequados e nenhum estado guardado entre requisições. As rotas são somente de leitura (`GET`), porque as duas APIs de origem também são.

### `GET /api/eventos`

Eventos que aconteceram no mundo na data informada.

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `data` | sim | `AAAA-MM-DD`, entre 1996-01-01 e hoje |

```bash
curl "http://localhost:3000/api/eventos?data=2014-07-13"
```

```json
{
  "data": "2014-07-13",
  "exato": true,
  "eventos": [
    {
      "ano": 2014,
      "texto": "Germany wins the FIFA World Cup, defeating Argentina in the final 1-0 after extra time.",
      "link": "https://en.wikipedia.org/wiki/..."
    }
  ]
}
```

`exato` é `false` quando a Wikimedia não tem eventos naquele ano; nesse caso a lista traz eventos do mesmo dia em anos próximos. `link` pode ser `null`.

### `GET /api/arquivo`

Cópia da Wayback Machine mais próxima da data para um site.

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `data` | sim | `AAAA-MM-DD`, entre 1996-01-01 e hoje |
| `site` | não | Domínio (padrão `google.com`). `https://`, `www.` e caminhos são removidos automaticamente |

```bash
curl "http://localhost:3000/api/arquivo?data=2014-07-13&site=cnnbrasil.com.br"
```

```json
{
  "site": "cnnbrasil.com.br",
  "link": "https://web.archive.org/web/20140516191902/http://cnnbrasil.com.br/",
  "dataRegistro": "20140516191902"
}
```

`dataRegistro` está no formato `AAAAMMDDhhmmss` e pode diferir da data pedida: a API devolve a cópia mais próxima que existe.

### Códigos de status

| Status | Significado | Exemplo de corpo |
|---|---|---|
| `200` | Sucesso | JSON da resposta |
| `400` | Data ou site inválidos | `{ "erro": "Formato inválido. Use AAAA-MM-DD." }` |
| `404` | Nenhuma cópia do site perto da data (`/api/arquivo`) | `{ "erro": "Nenhum registro de ... perto dessa data." }` |
| `500` | Falha de rede ao consultar a fonte | `{ "erro": "Não foi possível consultar a Wikimedia." }` |
| `502` | A fonte respondeu com erro (ex.: limite de acessos) | `{ "erro": "A Wayback Machine não respondeu corretamente. ..." }` |

### Exemplos rápidos

```powershell
# PowerShell
Invoke-RestMethod "http://localhost:3000/api/eventos?data=2001-09-11"
Invoke-RestMethod "http://localhost:3000/api/arquivo?data=2001-09-11&site=cnn.com"
```

```js
// JavaScript
const resposta = await fetch('/api/eventos?data=2001-09-11');
const { eventos } = await resposta.json();
```

Entradas inválidas para testar o tratamento de erros:

```
/api/eventos?data=2099-01-01              400  data futura
/api/eventos?data=1990-05-10              400  anterior a 1996
/api/eventos?data=2001-02-31              400  data inexistente
/api/arquivo?data=2001-09-11&site=abc     400  site inválido
```

## Estrutura do projeto

```
maquina-do-tempo/
├── public/
│   ├── index.html     Estrutura da página (Bootstrap, formulário, áreas de resultado)
│   ├── style.css      Tema visual, animações e responsividade
│   └── script.js      Consumo das rotas do servidor e montagem do DOM
├── server.js          Servidor Express, rotas e consumo das APIs externas
├── package.json
├── .gitignore
└── README.md
```

### `server.js`

| Elemento | Responsabilidade |
|---|---|
| `validarData(data)` | Exige formato `AAAA-MM-DD`, data existente, não futura e de 1996 em diante. Devolve `{ ano, mes, dia }` ou `{ erro }` |
| `normalizarSite(entrada)` | Reduz o que foi digitado ao domínio. `https://www.cnnbrasil.com.br/esportes` vira `cnnbrasil.com.br` |
| `GET /api/eventos` | Consulta a Wikimedia, filtra pelo ano e simplifica os campos |
| `GET /api/arquivo` | Consulta a Wayback (com nova tentativa e plano B) e devolve a cópia mais próxima |
| `express.static('public')` | Serve o front-end |

### `public/script.js`

| Função | Responsabilidade |
|---|---|
| `pedirJSON(url)` | `fetch` ao servidor; lança erro quando a resposta não é `ok` |
| `criar(tag, classe, texto)` | Atalho para criar elementos do DOM |
| `mostrarCarregando` / `mostrarErro` | Spinner e alerta do Bootstrap |
| `mostrarEventos(dados)` | Linha do tempo com os eventos |
| `mostrarArquivo(dados, data)` | Janela de navegador simulada, com a distância em dias entre a cópia e a data pedida |
| `viajar(data, site)` | Dispara as duas consultas com `Promise.allSettled` e atualiza a tela |

## Decisões técnicas

- **Por que um servidor no meio?** Centraliza a validação, evita problemas de CORS, permite identificar o projeto com `User-Agent` e padroniza as mensagens de erro. O navegador só conhece as duas rotas do projeto.
- **`Promise.allSettled` em vez de `Promise.all`.** Uma fonte fora do ar não pode apagar o resultado da outra; cada bloco da tela trata o próprio erro.
- **Plano B para a Wayback.** A API de disponibilidade responde `429` com frequência. O servidor tenta de novo após 1 segundo e, se persistir, consulta a API CDX, que devolve o mesmo tipo de informação.
- **Guard clauses.** Validações usam retorno antecipado em vez de `if/else` aninhado, o que mantém as rotas planas e fáceis de ler.
- **`textContent` em vez de `innerHTML`.** O texto vindo das APIs nunca é interpretado como HTML.
- **Mobile first.** O CSS base serve o celular; `@media (min-width)` e o grid do Bootstrap ampliam o layout em telas maiores. Animações respeitam `prefers-reduced-motion`.

## Limitações conhecidas

- A Wayback pode limitar acessos (`429`). Aguarde alguns minutos entre tentativas.
- A Wikimedia não filtra por ano; o filtro é feito no servidor, e anos sem registro caem no plano de eventos próximos.
- A cópia devolvida é a mais próxima que existe, não necessariamente a do dia exato.
- O site precisa ter existido (e ter conteúdo) na data escolhida.
- Os eventos vêm em inglês por padrão (`IDIOMA = 'en'`).
- Bootstrap, ícones e fontes vêm de CDN; sem internet a página perde a estilização.

## Ideias futuras

- Cache em memória das consultas para reduzir chamadas e evitar o limite da Wayback
- Seletor de idioma dos eventos
- Histórico de viagens salvo no navegador
- Compartilhamento de uma viagem por link (`?data=...&site=...`)
- Uma terceira fonte de dados, como notícias ou música do dia

## Tecnologias

Node.js, Express, JavaScript (`fetch`, `async/await`, DOM), HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons e Google Fonts (`Press Start 2P`, `Share Tech Mono`).

## Fontes de dados

- [Wikimedia Feed API: On this day](https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day)
- [Internet Archive: Wayback Machine APIs](https://archive.org/help/wayback_api.php)