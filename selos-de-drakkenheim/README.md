# Selos de Drakkenheim

Módulo em português para **Foundry VTT V13.347 ou posterior da geração 13** e **D&D 5e 5.3.x**. Não exige Socketlib ou outros módulos.

## Instalação pelo manifesto

Na tela inicial do Foundry, abra **Módulos adicionais → Instalar módulo**, cole o endereço abaixo em **Manifest URL** e clique em **Instalar**:

```text
https://github.com/vinipdiass/selos-de-drakkenheim/releases/latest/download/module.json
```

Depois, abra o mundo D&D 5e e ative **Selos de Drakkenheim** em **Gerenciar módulos**. As próximas versões poderão ser obtidas pelo botão **Atualizar** na lista de módulos.

## Instalação manual

1. Extraia `selos-de-drakkenheim-v1.3.0.zip` dentro da pasta `Data/modules` do seu Foundry.
2. Confirme que o arquivo está em `Data/modules/selos-de-drakkenheim/module.json`, sem uma pasta duplicada no caminho.
3. Reinicie o Foundry, abra seu mundo D&D 5e e ative **Selos de Drakkenheim** em **Gerenciar módulos**.

O manifesto e o ZIP são publicados nos [Releases do GitHub](https://github.com/vinipdiass/selos-de-drakkenheim/releases).

## Coleta automática pelo jogador

Clique com o **botão direito** no token de um **NPC inimigo, visível, com exatamente 0 PV**, e escolha **Coletar componente**, identificado pelo ícone de ferramentas. A janela mostra as partes cadastradas para aquela criatura em uma **grade de ícones**, com retrato do monstro, nome da parte, categoria e raridade. **Clique no ícone para coletar**: o item vai diretamente para dentro do contêiner **Monster Harvesting Tools** do personagem, sem preencher nome, raridade, descrição, imagem ou outros dados. A parte recebida fica marcada como **Guardado**, permitindo continuar a coleta de outras partes sem reabrir a janela. Os filtros de categoria ajudam a encontrar o material.

**É obrigatório possuir um item chamado `Monster Harvesting Tools`, do tipo `Container` (Contêiner), com quantidade maior que zero, no inventário do próprio personagem.** Um item de outro tipo com esse nome não atende à regra. Sem a ferramenta, os ícones ficam bloqueados e a janela explica o que falta. Adicionar, remover ou renomear a ferramenta atualiza a coleta aberta. A ferramenta não é consumida.

Cada novo componente é armazenado usando o contêiner nativo do D&D 5e. **O jogador pode arrastá-lo para fora depois**, como qualquer item da ficha; o módulo não o devolve automaticamente. Estudo e fabricação continuam aceitando os componentes no inventário, dentro ou fora do contêiner.

O destino é o personagem cujo token você controla. Sem um token controlado, o módulo usa o personagem atribuído ao seu usuário, ou o único personagem que você controla no mundo. Se controlar vários tokens de personagens ao mesmo tempo, selecione somente o personagem que fará a coleta antes de abrir o menu.

Nome, tipo de criatura, raridade, retrato, imagem do componente, características e origem da coleta são preenchidos automaticamente. A origem identifica o próprio token da criatura. Cada parte fornece um componente por cadáver, e esse registro é compartilhado entre os jogadores: outra pessoa não pode retirar a mesma parte novamente. Dois tokens do mesmo monstro contam como cadáveres diferentes.

**É necessário haver um mestre conectado**, mas ele não precisa aprovar cada coleta. A sessão do mestre registra o pedido automaticamente, confere novamente os PV, a parte escolhida, a permissão sobre o inventário e a presença do Container Monster Harvesting Tools, e guarda o item dentro dele. A fabricação continua exigindo aprovação manual, como antes.

O menu de coleta é exclusivo dos jogadores. Para o mestre, o botão direito mantém os controles padrão do Foundry. Na **configuração de um token do mapa** ou na **configuração do token protótipo da ficha de uma criatura**, expanda as opções do cabeçalho e use **Configurar componentes**. Marque ou desmarque as partes disponíveis, adicione componentes personalizados, escolha uma base do catálogo se desejar e salve. A lista do token do mapa pode substituir o padrão do protótipo. Uma lista salva sem partes impede a coleta; **Restaurar padrão automático** volta à anatomia do catálogo ou estimada pela ficha.

Criaturas ausentes da planilha ou sem partes cadastradas recebem uma anatomia inicial estimada a partir do tipo, nome e características da ficha. Por exemplo, mephits recebem pó elemental, dragões recebem pó dracônico e escamas, e constructos não recebem sangue por padrão. Plantas, limos e criaturas incorpóreas usam listas diferentes das criaturas orgânicas. Ataques como mordida, garras e chifrada ajudam a identificar armas naturais. O mestre deve conferir e ajustar as exceções pela configuração de coleta.

## Coleta manual pelo mestre

Nas ferramentas de **Tokens**, o mestre encontra um botão com uma **pata**. Ele também pode abrir o módulo pela aba **Itens**.

Pesquise o nome da criatura e escolha um registro da planilha, um ator do mundo ou um compêndio acessível. Selecione a parte, confira o tipo de criatura e a raridade, e clique em **Criar componente**. O destino padrão é a aba Itens, dentro da pasta **Componentes de Drakkenheim**. Também é possível criar diretamente no inventário de um personagem: nesse caso, ele precisa do Container **Monster Harvesting Tools**, e o componente é guardado dentro dele automaticamente.

O componente recebe, por exemplo:

```text
Garras (Ratling) | (Comum)
```

A descrição contém **TIPO DE ITEM: ARMA NATURAL**, **TIPO DE MONSTRO: MONSTRUOSIDADE**, em maiúsculas e em parágrafos separados, e o retrato da criatura. Quando a criatura vem de um ator do mundo ou compêndio, seu retrato é preenchido automaticamente. Registros exclusivos da planilha não incluem imagens de monstros: informe o retrato no formulário ou selecione o ator correspondente no Foundry.

A raridade específica registrada na planilha tem prioridade. O formulário também mostra o resultado calculado pelo ND, para o mestre poder escolher a exceção adequada. Na coleta automática, a ausência de uma raridade definida na planilha ou de uma faixa de ND usa **Comum** como padrão; o mestre pode ajustar essa raridade na configuração da coleta.

Na coleta manual, **Ânima** exige marcar que a criatura está morta. Outros componentes podem ser registrados conforme a decisão do mestre sobre a anatomia da criatura. O peso padrão é **0,5 kg**, ajustável para escamas, placas e outras partes mais pesadas.

**Origem da coleta** identifica um cadáver. Use o mesmo identificador para todas as partes retiradas desse cadáver. Use identificadores diferentes para criaturas diferentes. Essa informação permite conferir as receitas que exigem múltiplas criaturas. Para essas receitas, não junte materiais de vários cadáveres em uma única pilha com uma única origem.

## Aprender e guardar receitas

O botão com um **livro** nas ferramentas abre o **Grimório do caçador**. As receitas conhecidas aparecem em cartões com ícone, cor de raridade, requisitos e acesso à bancada. Há busca por nome, filtro de raridade, aba **Materiais**, bolsa de componentes arrastáveis, contador de análises e acesso à ficha. A ficha também recebe um acesso pelo cabeçalho e uma seção no inventário com as receitas conhecidas.

Ao concluir um **descanso longo**, abre-se a tela de estudo. O jogador marca **somente os ícones dos componentes** que deseja estudar, acompanhando o contador de análises disponíveis. Os materiais que podem revelar uma receita aparecem antes dos materiais indisponíveis. Ao confirmar, o módulo **sorteia uma receita compatível ainda desconhecida por componente**, salva a descoberta no personagem e só então revela os resultados em cartões. A descoberta também é anunciada publicamente no **chat**, com o nome do personagem e de cada item aprendido **em português e em inglês**, além do componente estudado. A janela não mostra opções de receitas. Fechar antes de confirmar não realiza sorteio nem gasta análises.

O sorteio filtra a categoria, a parte, a raridade e as restrições de criatura exigidas pelo requisito correspondente. Receitas genéricas e específicas entram no mesmo conjunto quando aceitam o componente estudado. Por exemplo, garras raras de Ratling podem revelar tanto a **Adaga Dente de Rato** quanto as **Luvas de Garras**; garras raras de Troll podem revelar as Luvas, mas não a Adaga. Um ingrediente genérico pode revelar uma receita que também tenha outros ingredientes específicos: basta que o componente estudado possa cumprir um dos requisitos dessa receita.

Receitas já conhecidas são removidas antes do sorteio. Uma receita aparece apenas uma vez no conjunto, mesmo quando aceita o material em mais de um requisito. Ao estudar vários componentes, o módulo não repete receitas na mesma análise e organiza os resultados para aproveitar o maior número possível de descobertas compatíveis. Quando não resta nenhuma receita inédita compatível, não há descoberta nem gasto de análise para esse componente.

O estudo não consome materiais. O limite e as análises já realizadas ficam salvos no personagem, permitindo retomar uma seleção fechada pelo botão **Analisar componentes** no livro. Fechar a janela de resultados não desfaz a descoberta nem permite sortear novamente o mesmo componente naquele descanso.

O padrão usa a **pontuação de Inteligência**, seguindo o pedido. Em **Configurações do módulo**, o mestre pode mudar para o **modificador de Inteligência**, com mínimo zero, ou desativar a pergunta automática.

Se o mestre inicia o descanso e há um proprietário jogador conectado, o convite de análise é enviado a esse jogador. Sem jogador conectado, o mestre pode realizar a análise. Se vários jogadores controlam o mesmo personagem, o convite automático vai para um deles.

**Para vincular resultados e alterar o ícone de uma receita:** entre como mestre e clique no ícone da receita no grimório de qualquer personagem, ou use **Vincular resultado** no catálogo. Arraste um item físico do mundo, compêndio ou inventário para a área de vínculo; também é possível colar seu UUID. O ícone passa a ser o do item vinculado para todos os personagens. A edição independente de imagem foi substituída por esse vínculo.

Nas receitas de raridade variável, selecione a raridade e vincule as opções desejadas para aquela faixa. Podem existir vários resultados por raridade. O jogador escolhe o item de resultado na bancada. Sem vínculo na raridade escolhida, a fabricação fica bloqueada; os requisitos da receita continuam disponíveis para consulta. O primeiro resultado disponível fornece o ícone padrão do cartão, e a bancada usa a imagem do resultado selecionado. Vínculos antigos são convertidos automaticamente quando o mestre ativo entra.

**Para remover uma receita:** entre como mestre, abra o grimório, selecione o personagem e clique em **Remover receita** no cartão correspondente. O botão aparece somente para o mestre e retira o conhecimento apenas desse personagem. Ele pode aprender a receita novamente, e o mestre pode ensiná-la de novo pelo catálogo. A aprovação de pedidos de fabricação confere novamente se o personagem conhece a receita.

Para ensinar uma receita manualmente: abra o grimório, selecione o personagem e use **Catálogo do mestre**, seguido de **Ensinar**. O mestre também encontra o catálogo pelas ferramentas de coleta. **Nova receita** permite cadastrar uma receita própria com nome em português, nome original em inglês opcional, raridade, categorias, partes, tipos de criatura e quantidades. Receitas personalizadas sem nome original mostram no anúncio que o nome em inglês não foi informado.

## Fabricar com aprovação do mestre

1. O personagem precisa conhecer a receita e possuir os componentes no inventário.
2. Com um resultado vinculado, no grimório clique em **Abrir bancada** e escolha o item que será criado. **Arraste os materiais da bolsa ou do inventário da ficha para os espaços da receita.** Abra **Requisito** abaixo de cada espaço para ler o texto completo; a bancada expande a linha conforme o conteúdo, inclusive com vários requisitos abertos. A janela da bancada permanece aberta junto da ficha. Um clique no material da bolsa também encaixa a primeira unidade compatível, como alternativa ao arrasto.
3. Cada espaço informa o requisito e a raridade mínima exigida. É permitido usar um componente de raridade superior para fabricar um item de raridade menor; partes, criaturas, unidades e origens continuam sendo conferidas. Materiais incompatíveis são recusados com uma explicação na própria janela. A bancada controla as unidades reservadas, permite remover materiais ou limpar a montagem, e confere as receitas que exigem origens diferentes. Selecione a oficina disponível e, opcionalmente, informe o local ou observações. Oficinas de raridade superior também são aceitas.
4. **Solicitar fabricação** fica disponível quando a montagem e a oficina atendem à receita. O botão cria um pedido privado no chat e mostra o estado do pedido na bancada. Nenhum material é consumido nessa etapa.
5. O mestre ativo abre **Pedidos** ou **Revisar fabricação** no chat, confere os materiais, confirma a oficina e os requisitos especiais, e aprova ou recusa.

**O resultado precisa ser vinculado a um item físico do Foundry.** Na aba **Catálogo**, use **Vincular resultado** e cole o UUID do item do mundo ou de um compêndio. O vínculo precisa existir antes de solicitar a fabricação e é conferido novamente na aprovação. O menu de contexto no cabeçalho de um item permite copiar seu UUID.

A planilha contém receitas, não as fichas mecânicas completas dos itens. Por isso o módulo copia o item vinculado: suas atividades, efeitos, dano, cura e demais propriedades são preservados. Não são inventadas estatísticas para os itens de Drakkenheim. O item fabricado recebe quantidade 1, o nome e a imagem do item de resultado escolhido e a raridade da fabricação. Ele é colocado no inventário do personagem que enviou o pedido. O vínculo do catálogo é reutilizado nos próximos pedidos.

A aprovação confere novamente o inventário, a receita conhecida e as quantidades. Apenas as unidades necessárias são consumidas. As pilhas esgotadas permanecem com quantidade zero para permitir recuperação segura. Clique repetido não produz duas cópias do resultado.

Os arrastos aceitam apenas componentes que estejam no inventário do próprio personagem, inclusive quando vêm da ficha padrão do D&D 5e. Arrastar diretamente de um compêndio, de Itens do mundo ou de outro personagem não cria materiais nem atende aos requisitos. A montagem é apenas uma reserva visual: remover um material da bancada não remove nem acrescenta itens no inventário.

Se ocorrer uma falha parcial, o módulo tenta remover o resultado incompleto e restaurar os materiais. Se a sessão for interrompida, o registro de recuperação fica salvo no personagem. Em **Pedidos**, use **Restaurar materiais / concluir registro** para recuperar uma operação interrompida. Um resultado que já foi concluído não é fabricado novamente.

Pedidos enviados sem um mestre conectado permanecem no chat e são registrados quando o mestre entra. Não apague a mensagem antes de o pedido ser registrado. Em mundos com vários mestres, as decisões são processadas pela sessão que o Foundry identifica como **mestre ativo**.

## Dados e interpretação

O catálogo importa **223 monstros**, **73 receitas** e **345 registros de ingredientes** do arquivo `Drakkenheim_Crafting_Reference (Public).xlsx` fornecido pelo usuário. Os nomes próprios das criaturas foram preservados para a busca e a correspondência com os compêndios. Nomes de receitas, tipos, partes e mensagens foram traduzidos.

As frações de ND que o Excel armazenou como datas foram recuperadas, inclusive 1/8, 1/4 e 1/2. As raridades específicas da tabela foram preservadas, mesmo quando diferem da regra geral por ND.

Nas receitas, partes separadas por **vírgula** são componentes distintos. Listas com **or** são alternativas. Tipos ou nomes de criaturas após **from/of** são restrições de origem. Quantidades explícitas de dois componentes são respeitadas. As receitas de raridade **Variável** permitem escolher a raridade antes de montar a combinação.

Condições como causar dano elétrico, possuir a característica metamorfo ou ter imunidade a frio ficam registradas no componente. A coleta tenta preencher essas informações a partir dos campos estruturados da ficha do monstro, e o mestre deve conferir os três campos **Características da criatura de origem** no formulário. O estudo exige uma confirmação positiva para sortear uma receita a partir de um requisito com essa condição; não trata uma condição desconhecida como verdadeira. As alternativas explícitas de criatura continuam válidas por si só, como o coração de um Dragão Branco na receita do Diadema da Geada.

A validação automática não interpreta todo o texto das habilidades da criatura. Não foram adicionados custos em ouro, tempo de fabricação, testes de perícia ou CDs, pois esses dados não estavam nas regras fornecidas.

Para conferir essas características em componentes já coletados, inclusive os criados na versão 1.0.0, o mestre pode abrir o item e usar **Conferir origem do componente** no menu do cabeçalho (ou **Origem**, nas fichas antigas). Componentes antigos sem essa informação continuam válidos para requisitos genéricos; uma condição especial desconhecida não é presumida verdadeira no sorteio.

## Imagens de The Witcher 3

O módulo usa URLs diretos de imagens de componentes de **The Witcher 3**, com seleção por parte e por categoria. Foram conferidos os URLs de osso, garra, coração, sangue, essência, pelo, couro, pó, olho, cérebro, dente e penas no [Games Lantern](https://witcher3.gameslantern.com/crafting-components/monster-bone).

A [categoria da Fandom indicada no pedido](https://witcher-games.fandom.com/wiki/Category:The_Witcher_3_monster_parts) também está integrada por consulta à API da wiki para partes sem URL direto cadastrado. Se as fontes externas estiverem indisponíveis, o módulo usa ícones locais do Foundry. O formulário de coleta aceita um URL manual. O botão **Imagens**, na tela de coleta, permite definir uma imagem padrão por categoria.

Os arquivos de imagem externos não são incluídos no ZIP. As artes de The Witcher pertencem aos respectivos titulares, incluindo a CD Projekt Red. A fonte e os URLs diretos estão documentados em `scripts/images.mjs`.

## Armazenamento e cópias de segurança

- Receitas aprendidas, estudos e registro de recuperação: flags do próprio ator em `flags.selos-de-drakkenheim`.
- Componentes: itens `loot` normais com metadados nas flags do módulo.
- Pedidos, receitas personalizadas e vínculos de resultado: configurações do mundo.
- Vínculos de itens e ícones derivados: configuração do mundo `recipeResults`, por receita e raridade.
- Cache de URLs de imagens: configuração do cliente.
- Partes retiradas de cada cadáver e vínculo de criatura: flags do token em `flags.selos-de-drakkenheim`. O componente mantém o identificador do token de origem.

Esses dados acompanham a cópia de segurança normal do mundo. O módulo não modifica a planilha original.

## Validação desta versão

A abertura do grimório, bancada, estudo e coleta aguarda a criação assíncrona da janela antes de trazê-la para frente. Cliques rápidos reutilizam a janela em abertura. Testes de regressão cobrem o erro `Cannot read properties of undefined (reading 'style')`, foco após fechar uma janela e atualizações do inventário sem mudar o foco.

Testes automatizados cobrem regras de ND, importação, tradução, montagem de receitas, estudo aleatório, permissão do mestre, aprovação, recusa, quantidades, repetição de aprovação e restauração após falhas. A coleta automática também verifica o token inimigo, os PV, a anatomia cadastrada, o inventário de destino, a exigência de Monster Harvesting Tools, ferramentas removidas durante o pedido, armazenamento no contêiner, retirada livre, pedidos simultâneos, partes já retiradas e recuperação após falhas. A bancada tem testes de reserva de unidades, troca e remoção de materiais, compatibilidade, origem dos itens arrastados e mudanças no inventário. Componentes dentro do contêiner continuam cobertos pelos testes de estudo e fabricação.

A interface possui um teste em navegador com o CSS real e as APIs do Foundry simuladas: bloqueio sem ferramentas, atualização ao adicionar ou remover o contêiner, coleta automática e manual para dentro dele, retirada livre dos componentes, coleta por ícones, grimório, estudo e revelação de receitas, anúncio bilíngue no chat, arrasto HTML5 da bolsa e de uma ficha separada, rejeição de materiais incompatíveis ou de outro personagem, pedido sem consumo antecipado e layout em janela compacta. A integração foi conferida no código do Foundry V13.351 e D&D 5e 5.3.1 instalados nesta máquina.

Esta versão ainda precisa de uma sessão de validação dentro de um mundo real do Foundry, especialmente para fichas de terceiros e módulos que substituem o descanso padrão. Não foi instalado nem alterado nenhum mundo durante o desenvolvimento.
