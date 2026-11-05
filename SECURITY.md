# Segurança e privacidade

O editor usa arquivos locais e armazenamento do navegador. JSON importado é
validado antes de entrar no estado. Nomes são escapados no SVG/HTML; CSV protege
rótulos com prefixos de fórmula. Não há login, sincronização remota, upload
automático, execução de código de projetos ou chave de IA no frontend.

Não exponha o servidor de desenvolvimento em uma rede pública. `dist/` é
estático, mas o operador de hospedagem controla sua política de acesso/logs.
Importações limitadas a 512 KB; até 40 ambientes e 160 aberturas. A imagem de IA
opcional envia um resumo ao endpoint oficial, somente após opção explícita.

Para uma falha, procure o canal privado de segurança no perfil do mantenedor.
Se não estiver disponível, abra uma issue apenas solicitando um canal de contato,
sem publicar exploração, chaves ou dados sensíveis. Não há promessa de SLA.
