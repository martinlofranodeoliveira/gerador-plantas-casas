# Formato aberto do projeto

JSON versão 1, unidade fixa `m`. Sem scripts, URLs, anexos ou credenciais.
O exemplo completo em [casa-exemplo.json](../examples/casa-exemplo.json) é fictício.

Campos da raiz: `schemaVersion`, `units`, `name`, `lot`, `settings`, `rooms`,
`openings`. Campos desconhecidos são recusados pela validação estrutural. O parser
JSON do navegador usa a semântica padrão de chaves repetidas (última ocorrência);
não utilize chaves duplicadas ao produzir arquivos.

- `lot`: `width` e `depth`, de 3 a 100 metros.
- `settings`: `wallThickness` (0,05–0,50), `wallHeight` (2–5), `setbacks`
  com `front`, `back`, `left`, `right` (0–30).
- `rooms`: até 40 retângulos `{id,name,type,x,y,width,depth}`. IDs únicos com
  letras ASCII, dígitos, `_` ou `-`. Tipos: `social`, `bedroom`, `kitchen`,
  `bath`, `service`, `garage`, `hall`. Coordenadas e tamanhos no eixo da parede;
  números finitos em passos de 0,001 m. Nomes até 80 caracteres sem controles
  nem `<`/`>`. As dimensões precisam deixar ao menos 0,20 m livre.
- `openings`: até 160 entradas `{id,roomId,kind,wall,offset,width,height,sill}`.
  `kind`: `door` ou `window`. `wall`: `north` (frente), `south` (fundos),
  `west` (esquerda), `east` (direita). `offset` mede da esquerda à direita nas
  paredes horizontais ou da frente aos fundos nas verticais. A abertura deve
  caber entre as faces de extremidade, sem sobreposição com outra abertura.
  Portas têm `sill:0`; `sill+height` não pode ultrapassar o pé-direito.

Erros de esquema/abertura recusam a edição. Colisão de ambientes e ultrapassagem
dos recuos geram avisos editáveis; exports visuais exigem ausência desses erros.
Este contrato não valida solidez estrutural, passagem acessível, luminância,
ventilação, orientação solar, limite de ocupação ou legislação.
