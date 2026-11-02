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
- Clique no ícone de uma receita como mestre para alterá-lo globalmente para todos os personagens, com prévia, seletor de arquivos, URL e restauração do padrão.

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

A versão 1.2.0 passou em 132 testes automatizados e em verificações de interface no navegador com o CSS real do Foundry V13 e APIs simuladas. O ícone global foi conferido em duas sessões, incluindo mestre e jogador, atualização da bancada, persistência e restauração do padrão. A validação no navegador não substitui uma sessão de testes dentro de um mundo real, especialmente com fichas ou módulos de terceiros.
