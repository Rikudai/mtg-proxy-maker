# MTG Proxy Maker - Fluxograma de Processamento

Este diagrama detalha as etapas de funcionamento, interações dos componentes e o fluxo de dados do projeto **MTG Proxy Maker**. O projeto foi concebido para fornecer proxies de alta qualidade gerando os componentes visuais nativamente (HTML/CSS vetorizado) em vez de utilizar meros "scans".

```mermaid
flowchart TD
    %% Entidades Externas
    User(("👤 Usuário"))
    Scryfall["🌐 API Scryfall"]
    GoogleTranslate["🌍 API Google Tradutor"]
    LocalStorage[("💾 Local Storage Browser")]

    %% Ponto de Entrada
    subgraph Inicialização ["1. Inicialização (app.tsx)"]
        Init[Verificar URL ou Storage]
        ParseURL[Extrair parâmetros da URL '?cardlist']
        LoadLocal[Carregar 'cardList' Salvo]
        SetLang[Definir Idioma 'language']
        SetPrint[Definir 'printVersos']
    end

    %% Interface
    subgraph UI ["2. Ações da Interface do Usuário"]
        Sidebar["📁 Barra Lateral (Sidebar)"]
        CardGrid["🎴 Grade de Cartas (App)"]
        EditForm["⚙️ Formulário de Edição"]
    end

    %% Processamento e Serviços
    subgraph Processamento ["3. Lógica e Intermediários"]
        MTGOParser["mtgo-parser.ts"]
        ScryfallService["scryfall.tsx"]
        State(["Store Local (Signals SolidJS)"])
    end

    %% Impressão
    subgraph LayoutImpressao ["4. Processamento para Impressão"]
        SplitPages[Dividir 9 cartas por página]
        PrintVersos[Injetar Versos Calculados para Impressão Duplex]
        BrowserPrint["PDF Driver / Navegador"]
    end


    %% Relações Iniciais
    Init -->|Se tem param '?cardList'| ParseURL
    Init -->|Sem param URL| LoadLocal
    ParseURL --> State
    LoadLocal --> State
    Init --> SetLang
    Init --> SetPrint

    %% Interação do Usuário com a Barra Lateral
    User -->|Cola Lista MTGO| Sidebar
    User -->|Digita e Busca Carta| Sidebar
    User -->|Limpa Lista| Sidebar
    User -->|Muda Idioma/Versos| Sidebar

    %% Ações de Inserção a partir da Sidebar
    Sidebar -->|Limpa lista| State
    Sidebar -->|Busca unitária| ScryfallService
    Sidebar -->|Importar Lista| MTGOParser

    MTGOParser -->|Array com {nome, qtde}| ScryfallService
    ScryfallService -->|1. Busca Idioma Alvo & EN fallback| Scryfall
    ScryfallService -->|2. Busca Variantes (Artes)| Scryfall
    Scryfall <--> ScryfallService
    ScryfallService -->|3. Tradução Fallback (se falhar alvo)| GoogleTranslate
    GoogleTranslate <--> ScryfallService
    ScryfallService -->|Transfoma em Objeto 'Card'| State

    %% Seleção e Edição
    State -->|Renderiza Cartas| CardGrid
    User -->|Clica na Carta| CardGrid
    CardGrid -->|Seleciona a Carta (Index)| EditForm
    User -->|Edita Dados| EditForm
    User -->|Modifica Arte/Dados| EditForm
    User -->|Duplica / Deleta| EditForm
    EditForm -->|Atualiza diretamente| State

    %% Persistência e Impressão
    State -.->|Sincronização reativa (createEffect)| LocalStorage
    SetLang -.-> LocalStorage
    SetPrint -.-> LocalStorage

    User -->|Ctrl+P / Cmd+P| LayoutImpressao
    State --> LayoutImpressao
    SetPrint -->|Se ativado (true)| PrintVersos
    SplitPages --> BrowserPrint
    PrintVersos --> BrowserPrint

    %% Formatação
    classDef ui color:#fff,stroke:#333,stroke-width:2px;
    classDef process color:#000,stroke:#333,stroke-width:2px;
    classDef state fill:#f9f,color:#333,stroke:#333,stroke-width:2px;
    
    class Sidebar,CardGrid,EditForm ui;
    class MTGOParser,ScryfallService,SplitPages,PrintVersos process;
    class State state;
```

## Resumo das Etapas Principais:

1. **Inicialização (`app.tsx`)**: 
   A aplicação baseada em SolidJS verifica a existência do banco de dados local (`localStorage`) para trazer a vida as cartas da sessão anterior. Além disso, há um interpretador para roteamento via URL, permitindo que cópias de lista sejam inseridas diretamente pelo link (`?cardlist=...`).

2. **Importação e Conversão (Interface vs `mtgo-parser.ts`)**: 
   A `Sidebar` atua como o principal painel de injeção de dados. Quando o usuário busca individualmente ou "Importa de MTGO", a engine processa o texto multilinhas retirando quantidades e nomes de cartas. Estes dados são enfileirados como um vetor e enviados à camada de serviço.

3. **Integração Externa (`scryfall.tsx`) e Data Mapping**:
   Ao iniciar o componente de busca em rede, a aplicação tenta carregar informações tanto em um pacote Inglês de fallback (para assegurar texturas e templates base), quanto o seu respectivo traduzido da API pública **Scryfall**. Adicionalmente, busca-se por variações alternativas de artwork. Caso o Scryfall não retorne a carta no idioma alvo selecionado, o serviço utiliza a API pública do **Google Tradutor** para traduzir o título, regras e subtextos da versão em Inglês. Após a obtenção assíncrona e traduções, todos os descritivos são montados em uma única tipagem internalizada (`Card`), que gerencia dados espaciais da carta, custos de *mana* comutados, fidelidade às regras e identidades relativas a 'planeswalkers' e dupla faces.

4. **Estado (Solid Store) e Edição Direta**:
   A principal premissa deste gerador não-scan repousa aqui. Como toda estrutura descritiva está alocada na Store reativa da página, ao selecionar uma carta, o `EditCardForm` é exposto permitindo edição completa de texto livre, ajustes de arte baseados na web, status Lendário e até duplicação do objeto na Store. Tudo reflete render-to-DOM de imediato e dispara um `createEffect` de backup automático usando o `localStorage`.

5. **Engenharia de Impressão (CSS e Reverse-logic)**:
   A interface é propositalmente montada com classes `print:` (uma diretiva TailwindCSS limitante e exclusiva para a árvore do renderizador PDF do browser). Quando exposta em papel (via `Ctrl+P`), a grade ignora `Sidebar` e restringe formatações para manter o tamanho A4 ou Carta, assegurando `63x88mm` (aferido por css variables) por slot com limite de 9 cartas por folha.
   Caso a flag `PrintVersos` esteja ativa, a app insere e calcula as lógicas reversas, renderizando os versos num layout inverso nas próximas folhas (slots modulares do layout), de forma a garantir que toda folha da frente preenchida corresponda proporcional e sequencialmente no driver a uma folha verso pronta para ser impressa na ordem inversa, validando o **Duplex Printing** sem necessitar intervenções de ferramentas externas.
