# Selos de Drakkenheim

Coleta de componentes de monstros, estudo de receitas e fabricação para **Foundry VTT V13** e **D&D 5e 5.3.x**, com interface em português.

## Instalação

Na tela inicial do Foundry, abra **Módulos adicionais → Instalar módulo** e cole este endereço em **Manifest URL**:

```text
https://github.com/vinipdiass/selos-de-drakkenheim/releases/latest/download/module.json
```

Depois, ative **Selos de Drakkenheim** em **Gerenciar módulos** no seu mundo D&D 5e. Para atualizar, use **Atualizar** na lista de módulos.

O pacote requer Foundry V13.347 ou posterior da geração 13 e D&D 5e 5.3.x. Não exige Socketlib.

## Recursos

- Coleta por ícones ao clicar com o botão direito em um inimigo com 0 PV.
- Coleta exige um Container chamado **Monster Harvesting Tools** e guarda os componentes dentro dele.
- Estudo no descanso longo descobre receitas aleatórias compatíveis ainda desconhecidas.
- Descobertas anunciadas no chat com os nomes dos itens em português e inglês.
- Grimório, bancada com arrasto de componentes e fabricação com aprovação do mestre.
- O mestre pode ensinar e remover receitas de um personagem.
- O mestre vincula itens físicos às receitas pelo ícone do grimório ou pelo catálogo. Os vínculos e ícones são globais, com vários resultados por raridade.
- Sem resultado vinculado, o jogador consulta a receita, mas não pode forjá-la. O item escolhido é entregue ao inventário do solicitante após a aprovação.
- **Ver item** no grimório e na bancada mostra a descrição e os detalhes públicos de cada resultado vinculado, inclusive de compêndios restritos ao mestre.
- Componentes superiores podem atender a requisitos de raridade menor.
- A coleta pode ser configurada por token do mapa ou token protótipo; criaturas sem cadastro recebem uma anatomia inicial estimada.
- O estudo apresenta os materiais disponíveis antes dos indisponíveis.

Leia o [manual completo](selos-de-drakkenheim/README.md) para configurar criaturas, receitas e itens de resultado. Os [Releases](https://github.com/vinipdiass/selos-de-drakkenheim/releases) incluem o manifesto e o ZIP para instalação manual.

## Desenvolvimento e validação

Os arquivos de execução estão em `selos-de-drakkenheim/`. O catálogo importa 223 monstros, 73 receitas e 345 registros de ingredientes da planilha fornecida ao projeto. A planilha original e arquivos de mundos do Foundry não são distribuídos neste repositório. As referências das imagens externas estão no manual.

Com Node.js 22 ou posterior:

```shell
node --test tests/*.test.mjs
node tools/check.mjs
```

Para gerar o ZIP no Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/package.ps1
```

A versão 1.3.1 passou em 152 testes automatizados e em verificações de interface no navegador com o CSS real do Foundry V13 e APIs simuladas. Foram conferidos a consulta de resultados no grimório e na bancada, múltiplas opções e raridades, descrições de compêndios restritos, ausência de trechos secretos e preservação do inventário durante a consulta, além dos fluxos anteriores de coleta, estudo e fabricação. A validação no navegador não substitui uma sessão de testes dentro de um mundo real, especialmente com fichas ou módulos de terceiros.
