import fs from 'fs';

async function fixDataset() {
    const rawData = fs.readFileSync('c:/Users/Rikudai/Documents/Projetos/mtg-proxy-maker/LLM/ptbr_cards_dataset.json', 'utf8');
    const dataset = JSON.parse(rawData);

    console.log("Buscando link do Bulk Data do Scryfall (Oracle Cards)...");
    const bulkRes = await fetch("https://api.scryfall.com/bulk-data/oracle-cards");
    const bulkMeta = await bulkRes.json();
    
    console.log(`Baixando Oracle Cards (${(bulkMeta.size / 1024 / 1024).toFixed(2)} MB)...`);
    // Passando o buffer para evitar crash de tamanho string
    const dataRes = await fetch(bulkMeta.download_uri);
    const enBulkData = await dataRes.json();
    
    console.log("Criando dicionário rápido...");
    const enDict = {};
    for (const card of enBulkData) {
        enDict[card.name.toLowerCase()] = card;
    }
    
    console.log("Corrigindo o dataset local...");
    let fixed = 0;
    for (const ptCard of dataset) {
        // Move o que tava no en pro pt, se existir
        const realPt = ptCard.flavor_text_en || ptCard.flavor_text_pt || "";
        ptCard.flavor_text_pt = realPt;
        
        const enCard = enDict[ptCard.name_en.toLowerCase()];
        if (enCard) {
            ptCard.flavor_text_en = enCard.flavor_text || "";
            
            if (ptCard.faces && enCard.card_faces) {
                for (let f = 0; f < ptCard.faces.length; f++) {
                    const ptFace = ptCard.faces[f];
                    const realFacePt = ptFace.flavor_text_en || ptFace.flavor_text_pt || "";
                    ptFace.flavor_text_pt = realFacePt;
                    
                    if (enCard.card_faces[f]) {
                        ptFace.flavor_text_en = enCard.card_faces[f].flavor_text || "";
                    } else {
                        ptFace.flavor_text_en = "";
                    }
                }
            }
            fixed++;
        } else {
            ptCard.flavor_text_en = "";
            if (ptCard.faces) {
                ptCard.faces.forEach(f => {
                    f.flavor_text_pt = f.flavor_text_en || f.flavor_text_pt || "";
                    f.flavor_text_en = "";
                });
            }
        }
    }
    
    console.log(`Sucesso! ${fixed} de ${dataset.length} cartas encontradas no Bulk.`);
    console.log("Salvando arquivo...");
    fs.writeFileSync('c:/Users/Rikudai/Documents/Projetos/mtg-proxy-maker/LLM/ptbr_cards_dataset.json', JSON.stringify(dataset, null, 2));
    console.log("Concluído!");
}

fixDataset();
