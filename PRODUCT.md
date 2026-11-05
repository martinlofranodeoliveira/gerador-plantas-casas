# Casa Aberta

Ferramenta open source, em português, para pessoas que querem estudar a distribuição
de uma casa antes de conversar com arquiteto/engenheiro. Reimplementação genérica
inspirada no Projeto Casa autorizado pelo proprietário, sem copiar plantas, fotos,
pedidos familiares, revisões, chaves ou artefatos pessoais.

O usuário define terreno, recuos próprios, ambientes e espessura de parede;
gera uma proposta paramétrica, ajusta as medidas, confere erros e exporta
JSON, SVG cotado, PNG, relatório CSV e uma apresentação 3D/WebM.
Planta, volumes e exports compartilham a mesma geometria. Coordenadas em metros
com resolução de 1 mm. Desfazer/refazer, importação validada e dados locais.

Não é CAD/BIM completo, projeto executivo, cálculo estrutural, aprovação legal,
avaliação de acessibilidade ou garantia de habitabilidade. Recuos e dimensões
mínimas precisam ser fornecidos/revistos por profissional e legislação local.
Imagens de IA são opcionais, ilustrativas e explicitamente acionadas por CLI;
nenhuma chave entra no navegador e nenhuma chamada paga acontece por padrão.

## Direção e hipóteses

Modo Operate. Editor no navegador como proposta inicial; pergunta de preferência
enviada ao usuário. Herda do Projeto Casa o papel claro, verde oliva, cotas
legíveis e prioridade da planta, com painel de propriedades e vista 3D.
Exemplo inteiramente fictício. Público brasileiro, uso em computador e celular.
Funcionamento local sem conta; depois da instalação, o editor não consulta rede.
