import fs from 'fs';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchAllPtCards() {
    let dataset = [];
    let url = 'https://api.scryfall.com/cards/search?q=lang:pt&unique=cards';
    let page = 1;

    console.log('Iniciando o download de cartas em PT-BR do Scryfall...');

    while (url) {
        try {
            console.log(`Baixando página ${page}...`);
            const res = await fetch(url);
            
            if (res.status === 429) {
                console.log('Rate limit atingido. Aguardando 2 segundos...');
                await delay(2000);
                continue;
            }
            
            if (!res.ok) {
                console.error(`Erro ao buscar: ${res.statusText}`);
                break;
            }

            const json = await res.json();
            
            for (const card of json.data) {
                // Ignore tokens or cards that don't have a Portuguese printed name
                if (!card.printed_name && !card.card_faces) continue;

                let cardData = {
                    id: card.id,
                    set: card.set,
                    rarity: card.rarity,
                    name_en: card.name,
                    name_pt: card.printed_name || card.name,
                    type_en: card.type_line,
                    type_pt: card.printed_type_line || '',
                    text_en: card.oracle_text || '',
                    text_pt: card.printed_text || '',
                    mana_cost: card.mana_cost || '',
                    flavor_text_en: card.flavor_text || '',
                    flavor_text_pt: card.printed_flavor_text || '',
                };

                // Handle double-faced cards (e.g. Transform, Modal DFCs)
                if (card.card_faces) {
                    cardData.faces = card.card_faces.map(face => ({
                        name_en: face.name,
                        name_pt: face.printed_name || face.name,
                        type_en: face.type_line,
                        type_pt: face.printed_type_line || '',
                        text_en: face.oracle_text || '',
                        text_pt: face.printed_text || '',
                        mana_cost: face.mana_cost || '',
                        flavor_text_en: face.flavor_text || '',
                        flavor_text_pt: face.printed_flavor_text || '',
                    }));
                    
                    // If it's a DFC, Scryfall sometimes leaves the top-level printed_name empty
                    if (!card.printed_name) {
                        cardData.name_pt = cardData.faces.map(f => f.name_pt).join(" // ");
                        cardData.name_en = cardData.faces.map(f => f.name_en).join(" // ");
                    }
                }

                dataset.push(cardData);
            }

            url = json.has_more ? json.next_page : null;
            page++;
            
            // Be nice to Scryfall API (150ms delay to avoid 429)
            await delay(150);
        } catch (err) {
            console.error('Erro na requisição:', err.message);
            await delay(1000);
        }
    }

    console.log(`Download concluído. Total de cartas processadas: ${dataset.length}`);
    fs.writeFileSync('c:/Users/Rikudai/Documents/Projetos/mtg-proxy-maker/LLM/ptbr_cards_dataset.json', JSON.stringify(dataset, null, 2));
    console.log('Arquivo salvo com sucesso em LLM/ptbr_cards_dataset.json');
}

fetchAllPtCards();
