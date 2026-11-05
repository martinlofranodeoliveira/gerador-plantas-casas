# Casa Aberta — sistema da interface

Modo Operate: uma bancada de estudo residencial com planta central, campos à
esquerda e propriedades/áreas à direita. A linguagem herda do projeto de referência
papel claro, verde oliva, cotas e áreas com tintas suaves, sem copiar seus dados.

## Composição

Cabeçalho com nome e estado local; terreno/programa e lista de ambientes; abas
Planta 2D / Modelo 3D; painel de propriedades selecionadas; exports e limites.
Até 1150 px, propriedades passam para baixo; até 720 px os painéis empilham,
mantendo controles e região de desenho independentes. Nenhuma animação de entrada.
A planta oferece zoom de 100% a 800%, com controles de ampliar, reduzir e
enquadrar; a região de desenho permite rolagem para consultar cotas ampliadas.

## Tokens e estados

- Texto `#283c31`, secundário `#596a5d`, ação `#294e38`.
- Fundo `#f5f3ed`, papel `#fbf9f3`, seleção `#e4ebd9`, linhas `#d8ddd1`.
- Tipografia do sistema, números tabulares nas áreas/medidas, labels compactos.
- Primária preenchida em verde; secundárias contornadas e exclusões em terra.
- Foco visível de 3 px; estado selecionado por cor e `aria-pressed`/`aria-selected`.
- Geometria inválida: aviso textual e exports visuais desabilitados. JSON continua
  disponível para recuperar o trabalho. Toasts usam `role=status`.

## Vista 3D e captura

- A inicialização do modelo usa uma única Promise compartilhada para evitar
  canvases duplicados quando há acionamentos concorrentes.
- O enquadramento considera FOV, proporção da viewport e esfera que contém o
  lote e as paredes; distância máxima e plano distante acompanham esse cálculo.
- A captura PNG da planta limita o maior lado a 2.200 pixels e o total a
  4.000.000 pixels. Ambas as dimensões são arredondadas para baixo para preservar
  o orçamento; o zoom do editor não altera a geometria exportada.

## Evidências e limitações da revisão

Build e 14 testes de contrato aprovados, incluindo orçamento de pixels,
proporção da captura e projeção dos cantos no enquadramento 3D. A tolerância de
`1e-9` na comparação de proporção cobre erro de ponto flutuante; o limite de
4.000.000 pixels é estrito. Revisão independente de fontes aprovou as correções
de zoom, inicialização única, captura e câmera, sem bloqueadores residuais nesse
escopo. Detector rodou uma vez em modo degradado,
sem parsers HTML/CSS, portanto não avaliou contraste computado/seletores. O único
achado mecânico (fonte Inter) foi substituído pelo stack de sistema apropriado ao
editor. Teste visual de desktop/celular e WebGL/MediaRecorder não executado nesta
sessão: controle do navegador desativado no Work, sem contorno desse bloqueio.
Não existem screenshots aprovados nem alegação de equivalência visual completa.
