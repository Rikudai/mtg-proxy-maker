async function fetchTest() {
    try {
        const res = await fetch('https://api.scryfall.com/cards/search?q=lang:pt&unique=cards');
        const json = await res.json();
        console.log(`Total cards found: ${json.total_cards}`);
        if (json.data && json.data.length > 0) {
            const card = json.data[0];
            console.log(JSON.stringify({
                id: card.id,
                name_en: card.name,
                name_pt: card.printed_name,
                type_en: card.type_line,
                type_pt: card.printed_type_line,
                text_en: card.oracle_text,
                text_pt: card.printed_text,
                mana_cost: card.mana_cost,
            }, null, 2));
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

fetchTest();
