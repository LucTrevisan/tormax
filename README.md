# Laboratório de Monitoramento e Diagnóstico — Torno ROMI T 350

Aplicação Babylon.js (tela, RV e RA) em que o aluno explora o torno em 3D, acompanha cinco grandezas medidas
(temperatura, nível de óleo, corrente, vibração e rotação) e resolve situações de manutenção.

Reúne os projetos 1, 2 e 4 da proposta em quatro modos:

| Modo | Para que serve |
|---|---|
| **Ao vivo** | Acompanha o torno real (ESP32 → broker MQTT → app), mostra a idade da última leitura e grava a sessão. |
| **Simulação** | Funciona sem sensores. O professor controla a operação (ciclo típico ou manual), aplica situações, simula falha de sensor e acelera o tempo. |
| **Replay** | Reproduz uma sessão gravada: pausar, voltar, ir a um instante clicando no gráfico, marcar instantes e comparar curvas. |
| **Desafio** | O professor escolhe ou sorteia uma situação oculta; a turma registra evidências (também no headset), responde e recebe a avaliação. |

## Como rodar

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev          # http://localhost:5173
```

- **Headset na rede local** (Quest etc.): `npm run dev:https` e abra `https://<ip-do-computador>:5173` no navegador do
  headset, aceitando o certificado autoassinado. O WebXR só funciona em HTTPS (ou em `localhost`).
- **Publicar**: `npm run build` gera `dist/` com caminhos relativos (serve em GitHub Pages ou qualquer servidor estático).

## As cinco etapas

| Etapa | Entrega | Arquivos principais |
|---|---|---|
| 1. Base 3D | GLB carregado (15 conjuntos, pivôs originais), identificação de componentes por clique/lista, pontos instrumentados com rótulos, visor de óleo virtual, placa girando, RV/RA com painel 3D. Malhas mescladas por componente e material (547 → 114) para o headset. | `src/cena/*`, `src/xr/*`, `src/config/componentes.js`, `src/config/grandezas.js` |
| 2. Indicadores | Estados Normal / Atenção / Alarme / Sem dados (cor + ícone + texto), cartões com minigráfico, detalhe com limites, estatísticas, cuidados de interpretação e tabela; comparação em pequenos múltiplos; indicador de conexão. | `src/dados/fluxo.js`, `src/ui/sensoresUI.js`, `src/ui/graficos.js`, `public/config.json` |
| 3. Fontes de dados | MQTT sobre WebSocket, modelo de simulação, painel do professor, configurações (broker, limites, tipo de sensor de nível). | `src/fontes/*`, `src/simulacao/*`, `src/ui/painelSimulacao.js`, `src/ui/configuracoesUI.js` |
| 4. Registro e replay | Gravação de sessões (IndexedDB + download .json), quatro sessões de exemplo, reprodução sincronizada com o modelo, marcadores do aluno. | `src/dados/gravador.js`, `src/fontes/fonteReplay.js`, `src/ui/painelReplay.js`, `public/sessoes/` |
| 5. Desafios | Aquecimento, nível baixo de óleo e vibração elevada, com situação oculta, registro de evidências, resposta, avaliação por critérios e relatório. | `src/config/desafios.js`, `src/ui/painelDesafio.js` |

## Conexão ao vivo

```
ESP32 ──MQTT/TCP 1883──▶ broker ──MQTT/WebSocket 9001──▶ aplicação
```

Tópicos (base configurável, padrão `senai/torno01`):

| Tópico | Conteúdo |
|---|---|
| `<base>/temperatura`, `/oleo`, `/corrente`, `/vibracao`, `/rotacao` | número (`42.3`) ou JSON `{"v": 42.3, "ts": 1760000000000}` |
| `<base>/leituras` | várias grandezas: `{"ts": …, "temperatura": 42.3, "rotacao": 800}` |
| `<base>/status` | `online` / `offline` (Last Will do ESP32) |

`ts` é opcional. Se o relógio do dispositivo estiver mais de 60 s diferente do navegador (ESP32 sem NTP), vale a hora de chegada.

Para testar sem hardware:

```bash
npm run broker                                    # broker local: TCP 1883 + WebSocket 9001
npm run publicador -- --cenario vibracao --apos 30   # faz o papel do ESP32 (usa o modelo da simulação)
```

Depois, no app: **Ao vivo** → endereço `ws://localhost:9001` (padrão). Para outro broker use ⚙ **Configurações**.
Há um exemplo de firmware em `exemplos/esp32/torno_monitor/` e de configuração do Mosquitto em `exemplos/mosquitto.conf`.
Em páginas HTTPS o navegador só aceita `wss://`.

## Limites e estados

`public/config.json` traz limites **de exemplo** — ajuste conforme a máquina, o ponto medido e a condição de operação.
Ajustes feitos em ⚙ Configurações ficam salvos só naquele navegador (“Restaurar config.json” desfaz).

- `sentido`: `acima` (alarme quando sobe) ou `abaixo` (quando desce, como o nível de óleo).
- `persistenciaS`: o limite precisa ser ultrapassado durante esse tempo para mudar o estado (a corrente usa 2 s para
  o pico de partida não disparar alarme).
- `oleo.sensor`: `continuo` (porcentagem) ou `boia` (só “OK” / “Baixo”; a leitura 1 é OK e 0 é baixo).
- `leituraVelhaS`: depois desse tempo sem leitura, o indicador passa a **Sem dados** e mostra a idade da última.

## Sessões

Formato `lab-torno-sessao/1` (descrito em `src/dados/sessao.js`). As sessões de exemplo em `public/sessoes/` são geradas
pelo modelo de simulação (`npm run sessoes`) e têm títulos neutros; a causa de cada uma não está no arquivo:

| Sessão | Situação (para o professor) |
|---|---|
| 01 · Eixo SAE 1045 (referência) | operação normal |
| 02 · Eixo SAE 1045 (lote 2) | vibração aumenta a partir de 2:00, corrente oscila, temperatura sobe depois |
| 03 · Buchas de latão | vazamento de óleo a partir de 1:00; temperatura sobe quando o nível fica baixo |
| 04 · Eixo longo SAE 1020 | aquecimento do cabeçote a partir de 1:30 |

A Sessão 02 é a atividade da proposta: localizar quando a vibração começou, o que mudou junto e propor inspeções.

## Desafio em aula

1. Professor: **Desafio** → escolha a situação ou “Sortear” → velocidade (5× é um bom ponto de partida) → **Iniciar**.
2. A máquina começa normal; a alteração se inicia sem aviso entre 40 s e 90 s de simulação.
3. A turma registra evidências (botão no rodapé ou no painel do headset) e clica em **Responder**.
4. A avaliação (100 pontos) pesa evidências (40), sequência dos sinais (15), hipótese (20), inspeção (20) e registros (5).
   Citar algo que não aconteceu desconta; propor troca de peça antes de confirmar a causa também.
5. **Revelar situação** mostra a explicação; **Baixar relatório** gera um .txt com evidências, respostas e avaliação.

## Dentro do headset

O HUD HTML não aparece em RV/RA. O painel 3D ao lado da área do operador mostra as cinco leituras, o gráfico (toque numa
linha para trocar a grandeza), **Comparar curvas**, **Aproximar painel** (traz para perto do rosto) e os controles do modo
(reprodução no Replay, registro de evidência no Desafio). Aponte o controle para o cabeçote, a placa ou os rótulos para
abrir as medições.

## Ajustes finos pelo console

```js
lab.moverRotulo("temperatura", -1.15, 1.62, 0.2)   // posição (m) de um rótulo, sem recompilar
lab.simulacao.controle.aceleracao = 10              // velocidade da simulação
lab.replay.irPara(120000)                           // replay: ir para 2:00
```

Quando chegar a uma posição boa, copie os valores para `src/config/grandezas.js`.

## Cuidados de interpretação (também exibidos no app)

- Temperatura: uma medição pontual não representa a temperatura de toda a máquina.
- Nível de óleo: porcentagem só com sensor contínuo; com boia, apenas os estados.
- Corrente: sozinha, não determina potência nem identifica a causa de uma sobrecarga.
- Vibração: o diagnóstico depende do sensor, da montagem e da qualidade da aquisição.
- Rotação: acima de 90 rpm a animação da placa é ilustrativa; a leitura numérica é a referência.

O modelo de simulação é didático (coeficientes plausíveis, evolução térmica acelerada para caber na aula), não um gêmeo
digital calibrado.

## Próximos passos possíveis

- Serviço de histórico no servidor (hoje o histórico fica no navegador e nas sessões exportadas).
- Movimentos didáticos dos carros, contraponto e proteções, identificados como simulados quando não houver sensor de posição.
- Análise de frequência da vibração, se a aquisição permitir.
- Projetos 3 (inspeção guiada com checklist) e 5 (comparador de condições de usinagem) reaproveitando sessões e painéis.
