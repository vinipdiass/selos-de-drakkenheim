# Histórico

## 1.4.0

- Troca os ícones de fechar janela e alternar controles por SVGs locais, preservando suas ações e rótulos acessíveis.
- Mantém **Estudar** disponível no grimório e na bancada, inclusive sem descanso, análises restantes, componentes ou receitas compatíveis.
- Adiciona estudo fora do descanso com pedido ao mestre, revisão por **Aceitar** ou **Recusar** e sorteio somente após a aprovação.
- Revalida o inventário e o conhecimento do personagem ao aprovar, evita receitas repetidas e recupera aprovações interrompidas sem novo sorteio.
- Preserva componentes e o saldo do descanso nos estudos manuais. O estudo automático do descanso longo continua disponível, com opção de retomada das análises restantes.
- Usa o modificador de Inteligência, com mínimo zero, como padrão do limite por descanso; mantém a opção de valor total.
- 164 testes automatizados e fluxos de interface conferidos em duas sessões simuladas.

## 1.3.1

- Adiciona **Ver item** no grimório e na bancada para consultar a imagem, a descrição formatada e os detalhes públicos do resultado vinculado.
- Permite alternar entre resultados e raridades; a bancada abre o item selecionado.
- Compartilha a descrição pública para consulta mesmo quando a origem está em um compêndio restrito ao mestre, sem trechos secretos não revelados ou notas privadas. Respeita a descrição de itens não identificados.
- Prepara as descrições dos vínculos existentes quando o mestre ativo abre o mundo.
- Oferece acesso à ficha original para usuários com permissão de observador. A consulta não adiciona itens nem consome componentes.
- 152 testes automatizados e fluxos de interface conferidos em duas sessões simuladas.

## 1.3.0

- Substitui a edição independente de ícones pelo vínculo de itens físicos: o ícone deriva do item vinculado.
- Permite vincular pelo grimório ou catálogo, manter vários resultados por raridade e selecionar o resultado na bancada.
- Bloqueia a fabricação sem vínculo válido e entrega o item escolhido ao inventário do solicitante, preservando nome, imagem, atividades e efeitos.
- Converte vínculos antigos para o formato por raridade.
- Permite editar componentes coletáveis de um token de mapa ou token protótipo, inclusive listas vazias e partes personalizadas.
- Estima partes para criaturas sem cadastro usando tipo e características, incluindo pós elementais e dracônicos e ausência de sangue em constructos.
- Aceita materiais de raridade superior na fabricação de itens menores e prioriza materiais disponíveis na tela de estudo.
- 147 testes automatizados e fluxos de interface verificados em duas sessões simuladas.

## 1.2.0

- Permite ao mestre clicar no ícone de uma receita no grimório de qualquer personagem e alterá-lo para todos os personagens do mundo.
- Inclui prévia, seleção de imagem pelo navegador de arquivos do Foundry, campo de caminho/URL e restauração do ícone padrão.
- Atualiza grimórios, bancadas e descobertas; receitas aprendidas no futuro usam o mesmo ícone global.
- Armazena os ícones nas configurações do mundo, sem alterar o conhecimento de receitas dos personagens.
- Testes de permissão e atualização entre duas sessões, incluindo persistência ao recarregar.

## 1.1.5

- Corrige a expansão dos requisitos na bancada: cada texto ocupa seu próprio espaço e empurra as próximas linhas.
- Confere múltiplos requisitos abertos, textos longos e janelas estreitas.
- Primeira distribuição pública por GitHub Releases, com instalação pelo manifesto e atualização pelo Foundry.

## Funcionalidades incluídas

- Coleta automática por ícones, controle das partes já coletadas e armazenamento em Monster Harvesting Tools.
- Grimório e descoberta aleatória de receitas desconhecidas durante o descanso longo.
- Mensagens de descoberta no chat com nomes em português e inglês.
- Bancada com arrasto do inventário e fabricação aprovada pelo mestre.
- Ensino e remoção de receitas pelo mestre.
- Correções na abertura assíncrona das janelas e no layout dos componentes coletáveis.
