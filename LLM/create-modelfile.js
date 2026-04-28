import fs from 'fs';

function extractDictionary() {
    const scryfallCode = fs.readFileSync('c:/Users/Rikudai/Documents/Projetos/mtg-proxy-maker/src/services/scryfall.tsx', 'utf8');
    
    const dictMatch = scryfallCode.match(/const MTG_TERMS_PT: Record<string, string> = {([\s\S]*?)};/);
    let dictString = "";
    if (dictMatch) {
        dictString = dictMatch[1].trim().split('\n').map(line => line.trim()).join('\n');
    }

    const boldMatch = scryfallCode.match(/const BOLD_KEYWORDS = \[([\s\S]*?)\];/);
    let boldString = "";
    if (boldMatch) {
        boldString = boldMatch[1].trim().split('\n').map(line => line.trim().replace(/['",]/g, '')).filter(Boolean).join(', ');
    }

    return { dictString, boldString };
}

function generateModelfile() {
    const rawData = fs.readFileSync('c:/Users/Rikudai/Documents/Projetos/mtg-proxy-maker/LLM/ptbr_cards_dataset.json', 'utf8');
    const dataset = JSON.parse(rawData);

    // Filtramos para pegar apenas cartas que realmente tem texto para traduzir
    const validCards = dataset.filter(c => c.text_en && c.text_pt && c.text_en.length > 10);

    // Seleciona 15 cartas variadas pulando a lista para garantir diversidade de mecânicas e textos
    const sampleSize = 15;
    const step = Math.floor(validCards.length / sampleSize);
    const examples = [];
    for (let i = 0; i < validCards.length; i += step) {
        if (examples.length < sampleSize) {
            examples.push(validCards[i]);
        }
    }

    const { dictString, boldString } = extractDictionary();

    let modelfileContent = `FROM llama3.2
    
PARAMETER temperature 0.0
PARAMETER num_ctx 8192

SYSTEM """Você é um tradutor especialista de Magic: The Gathering.
Sua única função é receber os dados de uma carta em Inglês e retornar EXATAMENTE um JSON válido com a tradução para PT-BR.
NUNCA adicione notas explicativas, análises de mecânicas, ou texto fora do JSON. Responda APENAS com o objeto JSON.

# REGRAS DE TRADUÇÃO (DICIONÁRIO OFICIAL):
${dictString}

# REGRAS DE FORMATAÇÃO:
1. Mantenha todas as tags de mana iguais (ex: {T}, {B}, {W}).
2. Palavras-chave no início de frases devem ficar em negrito com asteriscos simples (*Palavra*). Aplique isso a estas palavras originais: ${boldString}.
3. Textos explicativos "()" devem ficar em itálico usando underline (_(Texto)_).

# EXEMPLOS DE ENTRADA E SAÍDA:
`;

    for (let i = 0; i < examples.length; i++) {
        const card = examples[i];
        const inputJson = JSON.stringify({
            name_en: card.name_en,
            type_en: card.type_en,
            text_en: card.text_en,
            flavor_text_en: card.flavor_text_en
        }, null, 2);
        
        const outputJson = JSON.stringify({
            name_pt: card.name_pt,
            type_pt: card.type_pt,
            text_pt: card.text_pt,
            flavor_text_pt: card.flavor_text_pt
        }, null, 2);

        modelfileContent += `\n[Exemplo ${i+1} - Entrada do Usuário]:\n${inputJson}\n[Exemplo ${i+1} - Sua Resposta JSON]:\n${outputJson}\n`;
    }

    modelfileContent += `\nLembre-se: Responda APENAS com o JSON da carta fornecida."""\n`;

    fs.writeFileSync('c:/Users/Rikudai/Documents/Projetos/mtg-proxy-maker/LLM/Modelfile', modelfileContent);
    console.log(`Modelfile atualizado com apenas 3 exemplos embutidos no System Prompt!`);
}

generateModelfile();
