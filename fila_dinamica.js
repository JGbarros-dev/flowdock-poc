/*
 * FlowDock - Prova de Conceito (Quest #6)
 *
 * Valida UMA hipótese técnica: reordenar a fila de caminhões automaticamente
 * pelo ETA (tempo estimado de chegada) reduz a espera e a ociosidade das docas
 * em comparação com uma agenda estática.
 *
 * Não há backend, interface, banco de dados nem localização real: é um módulo
 * JavaScript puro, que roda no navegador ou no Node.js, com dados simulados.
 * O mesmo módulo é usado pelo aplicativo web (frontend) do MVP.
 *
 * Como executar (Node.js 18 ou superior, sem dependências):
 *   node fila_dinamica.js            roda os 3 cenários
 *   node fila_dinamica.js --pausar   espera ENTER entre cenários (live demo)
 *   node fila_dinamica.js --testar   verificações automáticas
 *
 * Cenários:
 *   1. O caminhão A atrasa (exemplo do relatório M1): B e C avançam.
 *   2. Quem chega fora da janela não passa na frente de quem chegou no prazo (RN06).
 *   3. Carga perigosa com certificado vencido é bloqueada no agendamento (RN01, RF07).
 *
 * Premissas da simulação (constantes abaixo):
 *   - 1 doca, 30 minutos por atendimento, tolerância de atraso de 15 minutos.
 *   - Agenda estática = ordem fixa pelo horário reservado, sem considerar o ETA.
 *   - Horários em minutos desde a meia-noite (hm(10, 30) = 10h30).
 */

// ----------------------------------------------------------------- parâmetros
const DIA = "2026-11-12";            // dia da operação (AAAA-MM-DD)
const DURACAO = 30;                  // minutos de atendimento na doca
const TOLERANCIA = 15;               // RN03: atraso aceito antes de perder a vez
const DOCAS = 1;
const CERTIFICADOS = ["MOPP", "CIV", "CIPP", "RNTRC"];   // RN01

const hm = (h, m = 0) => h * 60 + m;
const fmt = (min) =>
  String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
const dataBr = (iso) => iso.split("-").reverse().join("/");

// ------------------------------------------------------------------ regras
/** Chega até a tolerância depois do horário reservado. */
const noPrazo = (v) => v.eta <= v.janela + TOLERANCIA;

/** RN06: quem chega dentro da janela passa na frente de quem chega depois. */
function comparar(a, b) {
  const ga = noPrazo(a) ? 0 : 1;
  const gb = noPrazo(b) ? 0 : 1;
  if (ga !== gb) return ga - gb;
  return ga === 0 ? a.janela - b.janela : a.eta - b.eta;
}

/** RN01 / RF06 / RF07: devolve o primeiro certificado vencido ou ausente. */
function certificadoProblema(v) {
  if (!v.perigosa) return null;
  for (const nome of CERTIFICADOS) {
    const validade = (v.certificados || {})[nome];
    if (!validade) return `${nome} ausente`;
    if (validade < DIA) return `${nome} vencido em ${dataBr(validade)}`;
  }
  return null;
}

// --------------------------------------------------------------- planejamento
function atender(v, livres, inicioMin) {
  const i = livres.indexOf(Math.min(...livres));
  const inicio = Math.max(livres[i], inicioMin);
  livres[i] = inicio + DURACAO;
  return { veiculo: v, inicio, fim: inicio + DURACAO, doca: i + 1,
           espera: Math.max(0, inicio - v.eta) };
}

/** Base de comparação: ordem fixa pelo horário reservado, ignora o ETA. */
function planejarEstatico(veiculos, abertura) {
  const livres = Array(DOCAS).fill(abertura);
  return [...veiculos].sort((a, b) => a.janela - b.janela)
    .map((v) => atender(v, livres, v.eta));
}

/** RF09/RF10: a cada doca livre chama quem já chegou, pela prioridade (RN06). */
function planejarDinamico(veiculos, abertura) {
  const livres = Array(DOCAS).fill(abertura);
  let pendentes = [...veiculos];
  const plano = [];
  while (pendentes.length) {
    let agora = Math.min(...livres);
    let prontos = pendentes.filter((v) => v.eta <= agora);
    if (!prontos.length) {                       // ninguém chegou: espera o próximo
      agora = Math.min(...pendentes.map((v) => v.eta));
      prontos = pendentes.filter((v) => v.eta <= agora);
    }
    const escolhido = prontos.sort(comparar)[0];
    plano.push(atender(escolhido, livres, escolhido.eta));
    pendentes = pendentes.filter((v) => v !== escolhido);
  }
  return plano;
}

function metricas(plano, abertura) {
  const espera = plano.reduce((s, a) => s + a.espera, 0) / plano.length;
  const fim = Math.max(...plano.map((a) => a.fim));
  const ocioso = DOCAS * (fim - abertura) - plano.length * DURACAO;
  return { espera, ocioso, fim };
}

/** RF19: explica ao motorista por que a posição dele mudou. */
function motivos(dinamico, estatico) {
  const ordemEstatica = estatico.map((a) => a.veiculo.id);
  const resultado = {};
  dinamico.forEach((a, k) => {
    const v = a.veiculo;
    const antes = ordemEstatica.indexOf(v.id);
    if (!noPrazo(v)) {
      resultado[v.id] = `chegou ${v.eta - v.janela} min depois da janela ` +
        `(tolerância ${TOLERANCIA} min): perde a prioridade`;
    } else if (k < antes) {
      const depois = dinamico.slice(k + 1).map((x) => x.veiculo.id);
      const ultrapassados = ordemEstatica.slice(0, antes).filter((id) => depois.includes(id));
      resultado[v.id] = `avançou ${antes - k} posição(ões): ${ultrapassados.join(", ")} não chegou no prazo`;
    } else {
      resultado[v.id] = "mantém a posição";
    }
  });
  return resultado;
}

// ----------------------------------------------------------------- cenários
const cenario1 = () => ({
  abertura: hm(10, 0),
  frota: [
    { id: "A", janela: hm(10, 0), eta: hm(11, 30) },    // imprevisto na rodovia
    { id: "B", janela: hm(10, 30), eta: hm(9, 50) },    // chega antes
    { id: "C", janela: hm(11, 0), eta: hm(10, 20) },    // chega antes
  ],
});

const cenario2 = () => ({
  abertura: hm(10, 0),
  frota: [
    { id: "X", janela: hm(9, 30), eta: hm(10, 12) },    // perdeu a janela
    { id: "Y", janela: hm(10, 0), eta: hm(9, 58) },     // chegou no prazo
    { id: "W", janela: hm(10, 30), eta: hm(10, 20) },   // chegou no prazo
  ],
});

const cenario3 = () => {
  const validos = Object.fromEntries(CERTIFICADOS.map((n) => [n, "2027-06-01"]));
  return [
    { id: "F", janela: hm(10, 0), eta: hm(9, 55), perigosa: true, certificados: validos },
    { id: "G", janela: hm(10, 30), eta: hm(10, 25), perigosa: true,
      certificados: { ...validos, CIPP: "2026-10-30" } },
    { id: "H", janela: hm(11, 0), eta: hm(10, 50), perigosa: false },
  ];
};

// ------------------------------------------------------------------- saída
function tabela(titulo, plano, comMotivo) {
  console.log(`\n  ${titulo}`);
  let cab = "  " + ["pos", "caminhão", "janela", "ETA", "início", "espera"]
    .map((t, i) => t.padEnd([4, 10, 8, 7, 8, 10][i])).join("");
  if (comMotivo) cab += "motivo";
  console.log(cab);
  console.log("  " + "-".repeat(comMotivo ? 97 : 47));
  plano.forEach((a, k) => {
    const v = a.veiculo;
    let linha = "  " + [String(k + 1), v.id, fmt(v.janela), fmt(v.eta), fmt(a.inicio), `${a.espera} min`]
      .map((t, i) => t.padEnd([4, 10, 8, 7, 8, 10][i])).join("");
    if (comMotivo) linha += comMotivo[v.id];
    console.log(linha);
  });
}

function resumo(rotulo, plano, abertura) {
  const m = metricas(plano, abertura);
  console.log(`  ${rotulo}: espera média ${m.espera.toFixed(1)} min · doca ociosa ${m.ocioso} min ` +
    `· último atendimento termina às ${fmt(m.fim)}`);
}

const cabecalho = (t) => console.log(`\n${"=".repeat(78)}\n${t}\n${"=".repeat(78)}`);

function rodarCenario(titulo, c, tituloEstatico, tituloDinamico) {
  cabecalho(titulo);
  const est = planejarEstatico(c.frota, c.abertura);
  const din = planejarDinamico(c.frota, c.abertura);
  tabela(tituloEstatico, est);
  tabela(tituloDinamico, din, motivos(din, est));
  console.log();
  resumo("Estática ", est, c.abertura);
  resumo("FlowDock ", din, c.abertura);
}

function rodarCenario3() {
  cabecalho("CENÁRIO 3: certificado vencido bloqueia o agendamento (RN01, RF07)");
  console.log(`\n  Data da operação: ${dataBr(DIA)}\n`);
  const aceitos = [];
  for (const v of cenario3()) {
    const problema = certificadoProblema(v);
    const tipo = v.perigosa ? "carga perigosa" : "carga comum";
    if (problema) console.log(`  ${v.id} (${tipo}): BLOQUEADO, ${problema}. Agendamento não confirmado.`);
    else { console.log(`  ${v.id} (${tipo}): agendamento confirmado.`); aceitos.push(v.id); }
  }
  console.log(`\n  Entram na fila: ${aceitos.join(", ")}`);
}

// ------------------------------------------------------------------- testes
function testar() {
  const assert = require("assert");
  let c = cenario1();
  let est = planejarEstatico(c.frota, c.abertura), din = planejarDinamico(c.frota, c.abertura);
  assert.deepStrictEqual(din.map((a) => a.veiculo.id), ["B", "C", "A"], "cenário 1: ordem");
  assert.deepStrictEqual(din.map((a) => fmt(a.inicio)), ["10:00", "10:30", "11:30"], "cenário 1: horários");
  assert.strictEqual(metricas(est, c.abertura).ocioso, 90, "cenário 1: ociosidade estática");
  assert.strictEqual(metricas(din, c.abertura).ocioso, 30, "cenário 1: ociosidade dinâmica");
  assert.ok(metricas(din, c.abertura).espera < metricas(est, c.abertura).espera, "cenário 1: espera");

  c = cenario2();
  est = planejarEstatico(c.frota, c.abertura); din = planejarDinamico(c.frota, c.abertura);
  assert.deepStrictEqual(est.map((a) => a.veiculo.id), ["X", "Y", "W"], "cenário 2: base estática");
  assert.deepStrictEqual(din.map((a) => a.veiculo.id), ["Y", "W", "X"], "cenário 2: RN06");

  const [f, g, h] = cenario3();
  assert.strictEqual(certificadoProblema(f), null);
  assert.ok(certificadoProblema(g).startsWith("CIPP vencido"), "cenário 3: CIPP");
  assert.strictEqual(certificadoProblema(h), null);
  console.log("Todas as verificações passaram.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--testar")) return testar();
  const rl = args.includes("--pausar")
    ? require("readline").createInterface({ input: process.stdin, output: process.stdout }) : null;
  const pausa = () => new Promise((ok) => rl.question("\n[ENTER para o próximo cenário] ", ok));
  console.log("FlowDock · Prova de Conceito · motor de fila dinâmica por ETA");
  console.log(`Parâmetros: ${DOCAS} doca, ${DURACAO} min por atendimento, tolerância de ${TOLERANCIA} min. Dados simulados.`);
  const etapas = [
    () => rodarCenario("CENÁRIO 1: o caminhão A atrasa 1h30 (exemplo do relatório M1)", cenario1(),
      "Agenda estática (ordem fixa pelo horário reservado)", "FlowDock (fila dinâmica pelo ETA)"),
    () => rodarCenario("CENÁRIO 2: quem chegou fora da janela não passa na frente (RN06)", cenario2(),
      "Agenda estática (X, atrasado, é chamado antes de quem esperava no prazo)", "FlowDock (prioridade por janela)"),
    rodarCenario3,
  ];
  for (const etapa of etapas) { if (rl) await pausa(); etapa(); }
  console.log();
  if (rl) rl.close();
}

// Exporta as funções para o frontend (módulo) e roda a demo quando chamado pelo Node.
const api = { planejarDinamico, planejarEstatico, metricas, motivos, certificadoProblema, noPrazo, hm, fmt };
if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
  if (require.main === module) main();
} else if (typeof window !== "undefined") {
  window.FilaDinamica = api;
}
