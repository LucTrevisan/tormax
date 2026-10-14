import { Camera } from "@babylonjs/core";
import { svgIcone } from "../util/icones.js";

const CONSULTA = "(max-width: 900px)";

/**
 * Layout de celular (só interface; não muda a lógica do app).
 * - Barra de abas embaixo: Peças, Medições e Controles do modo atual.
 * - Cada aba abre uma folha que sobe da base; só uma aberta por vez.
 * - A folha recolhe pelo ×, tocando de novo na aba, arrastando para baixo ou com o Voltar do aparelho.
 * - Diálogos (Configurações, resposta do desafio) ganham × e também fecham com o Voltar.
 *
 * As folhas usam a mesma classe "oculta" que o restante do código já liga e desliga
 * (ex.: tocar num rótulo 3D abre as Medições), então tudo continua funcionando igual.
 */
export function criarLayoutMovel({ camera = null, scene = null } = {}) {
  const mq = window.matchMedia(CONSULTA);
  const estreito = () => mq.matches;
  const $ = (s) => document.querySelector(s);

  const folhas = [
    { id: "pecas", el: $("#lateral-esquerda"), rotulo: "Peças", titulo: () => "Componentes", icone: "camadas" },
    { id: "medicoes", el: $("#lateral-direita"), rotulo: "Medições", titulo: () => "Medições", icone: "grafico" },
    {
      id: "controles",
      el: $("#rodape"),
      rotulo: "Controles",
      titulo: () => `Controles · ${$('#modos [aria-pressed="true"]')?.textContent ?? ""}`,
      icone: "controles",
    },
  ];

  // ---------- cabeçalho de cada folha (oculto no desktop via CSS)
  for (const f of folhas) {
    f.el.classList.add("folha");
    f.el.setAttribute("aria-label", f.titulo());
    const cab = document.createElement("div");
    cab.className = "cab-folha";
    cab.innerHTML = `<span class="puxador" aria-hidden="true"></span><h2></h2>
      <button type="button" class="fechar-folha" aria-label="Recolher">${svgIcone("fechar", { tamanho: 20 })}</button>`;
    f.el.prepend(cab);
    f.cab = cab;
    f.tituloEl = cab.querySelector("h2");
    cab.querySelector(".fechar-folha").addEventListener("click", () => fecharTodas());
    habilitarArrasto(f);
  }

  // ---------- barra de abas
  const barra = document.createElement("nav");
  barra.className = "barra-abas";
  barra.setAttribute("aria-label", "Painéis");
  barra.innerHTML = folhas
    .map(
      (f) => `<button type="button" class="aba" data-folha="${f.id}" aria-controls="${f.el.id}" aria-expanded="false">
        ${svgIcone(f.icone, { tamanho: 22 })}<span>${f.rotulo}</span></button>`,
    )
    .join("");
  document.body.appendChild(barra);
  barra.addEventListener("click", (e) => {
    const b = e.target.closest("[data-folha]");
    if (!b) return;
    if (atual === b.dataset.folha) fecharTodas();
    else abrir(b.dataset.folha);
  });

  function abrir(id) {
    for (const f of folhas) f.el.classList.toggle("oculta", f.id !== id);
  }
  function fecharTodas() {
    for (const f of folhas) f.el.classList.add("oculta");
  }

  // ---------- histórico: o Voltar do aparelho fecha a camada de cima
  let camadas = 0;
  let ignorarVoltas = 0;
  let fechandoPeloVoltar = false;

  function empilhar() {
    history.pushState({ labTorno: true }, "");
    camadas++;
  }
  function desempilhar() {
    if (camadas === 0) return;
    camadas--;
    ignorarVoltas++;
    history.back();
  }
  window.addEventListener("popstate", () => {
    if (ignorarVoltas > 0) {
      ignorarVoltas--;
      return;
    }
    if (camadas === 0) return;
    camadas--;
    fechandoPeloVoltar = true;
    const dialogo = [...document.querySelectorAll("dialog[open]")].pop();
    if (dialogo) dialogo.close();
    else fecharTodas();
  });

  // ---------- sincronia: uma folha por vez, abas e histórico
  let atual = null;
  function sincronizar() {
    if (!estreito()) return;
    const visiveis = folhas.filter((f) => !f.el.classList.contains("oculta"));
    if (visiveis.length > 1) {
      // a que acabou de abrir fica; as outras recolhem (o observador chama de novo)
      const nova = visiveis.find((f) => f.id !== atual) ?? visiveis[0];
      for (const f of visiveis) if (f !== nova) f.el.classList.add("oculta");
      return;
    }
    const nova = visiveis[0]?.id ?? null;
    for (const f of folhas) f.tituloEl.textContent = f.titulo();
    if (nova === atual) return;
    const antes = atual;
    atual = nova;
    for (const b of barra.querySelectorAll("[data-folha]")) b.setAttribute("aria-expanded", String(b.dataset.folha === nova));
    if (!antes && nova) empilhar();
    if (antes && !nova) {
      if (fechandoPeloVoltar) fechandoPeloVoltar = false;
      else desempilhar();
    }
    if (nova) folhas.find((f) => f.id === nova).el.scrollTop = 0;
  }
  const observador = new MutationObserver(sincronizar);
  for (const f of folhas) observador.observe(f.el, { attributes: true, attributeFilter: ["class"] });
  // título da folha de controles acompanha o modo
  new MutationObserver(() => folhas.forEach((f) => (f.tituloEl.textContent = f.titulo()))).observe($("#modos"), {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-pressed"],
  });

  // escolher um componente na lista recolhe a folha para mostrar a peça destacada
  $("#lista-componentes").addEventListener("click", (e) => {
    if (estreito() && e.target.closest("button[data-id]")) fecharTodas();
  });

  // ---------- diálogos: botão × no cabeçalho e Voltar fecha
  for (const dialogo of document.querySelectorAll("dialog")) {
    let empilhado = false;
    new MutationObserver(() => {
      if (dialogo.open) {
        const cab = dialogo.querySelector(".cab-modo");
        if (cab && !cab.querySelector(".fechar-dialogo")) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "fechar-dialogo";
          b.setAttribute("aria-label", "Fechar");
          b.innerHTML = svgIcone("fechar", { tamanho: 20 });
          b.addEventListener("click", () => dialogo.close());
          cab.appendChild(b);
        }
        if (estreito() && !empilhado) {
          empilhar();
          empilhado = true;
          // foco no × em vez do primeiro campo: o teclado virtual não abre sozinho
          dialogo.querySelector(".fechar-dialogo")?.focus({ preventScroll: true });
        }
      } else if (empilhado) {
        empilhado = false;
        if (fechandoPeloVoltar) fechandoPeloVoltar = false;
        else desempilhar();
      }
    }).observe(dialogo, { attributes: true, attributeFilter: ["open"], childList: true });
  }

  // ---------- arrastar o cabeçalho para baixo recolhe a folha
  function habilitarArrasto(f) {
    let y0 = null;
    let dy = 0;
    f.cab.addEventListener("pointerdown", (e) => {
      if (!estreito() || e.target.closest("button")) return;
      y0 = e.clientY;
      dy = 0;
      f.el.classList.add("arrastando");
      f.cab.setPointerCapture(e.pointerId);
    });
    f.cab.addEventListener("pointermove", (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      f.el.style.transform = `translateY(${dy}px)`;
    });
    const soltar = () => {
      if (y0 === null) return;
      y0 = null;
      f.el.classList.remove("arrastando");
      f.el.style.transform = "";
      if (dy > 70) fecharTodas();
    };
    f.cab.addEventListener("pointerup", soltar);
    f.cab.addEventListener("pointercancel", soltar);
  }

  // ---------- com uma folha aberta, a vista 3D sobe para o torno continuar visível acima dela
  // (desloca só a imagem na tela; a câmera, o alvo e a seleção continuam iguais)
  if (camera && scene) {
    let deslocamento = 0;
    scene.onBeforeRenderObservable.add(() => {
      if (scene.activeCamera !== camera) return;
      let alvo = 0;
      if (estreito()) {
        const H = window.innerHeight;
        const topo = $(".topo")?.getBoundingClientRect().bottom ?? 0;
        const aberta = folhas.find((f) => f.id === atual);
        const limite = aberta ? H - barra.offsetHeight - aberta.el.offsetHeight : H - barra.offsetHeight;
        const centroVisivel = (topo + limite) / 2;
        // altura visível no plano do alvo, conforme o modo de campo de visão
        const aspecto = scene.getEngine().getAspectRatio(camera);
        const meioV = camera.fovMode === Camera.FOVMODE_HORIZONTAL_FIXED ? Math.atan(Math.tan(camera.fov / 2) / aspecto) : camera.fov / 2;
        const alturaMundo = 2 * camera.radius * Math.tan(meioV);
        alvo = ((H / 2 - centroVisivel) / H) * alturaMundo;
      }
      const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
      deslocamento += (alvo - deslocamento) * Math.min(1, dt * 8);
      if (Math.abs(alvo - deslocamento) < 1e-4) deslocamento = alvo;
      camera.targetScreenOffset.y = deslocamento;
    });
  }

  // ---------- entrar/sair do layout de celular (girar tablet, redimensionar janela)
  function aplicarModo() {
    if (estreito()) {
      fecharTodas();
    } else {
      atual = null;
      for (const f of folhas) {
        f.el.style.transform = "";
        if (f.id === "controles") f.el.classList.remove("oculta");
      }
      // no desktop as laterais voltam a aparecer
      folhas[0].el.classList.remove("oculta");
      folhas[1].el.classList.remove("oculta");
      $("#btn-componentes")?.setAttribute("aria-pressed", "true");
    }
  }
  mq.addEventListener("change", aplicarModo);
  if (estreito()) fecharTodas();
  sincronizar();

  return { abrir, fecharTodas };
}
