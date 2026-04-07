import { match, P } from "ts-pattern";
import { parseCardColor, parseCardFrame } from "../types/backgrounds";
import { Card } from "../types/card";
import { CardError } from "../types/error";
import {
	isBiType,
	ManaLetter,
	manaLetters,
	manaLetterToType as manaLetterToTypeMap, ManaType
} from "../types/mana";

const requestCache = new Map<string, Promise<any>>();
async function fetchCachedJson(url: string): Promise<any> {
	if (requestCache.has(url)) {
		return requestCache.get(url)!;
	}
	
	const promise = fetch(url)
		.then(async (r) => {
			const json = await r.json().catch(() => null);
			return json || { status: r.status };
		})
		.catch(e => {
			console.error("Network error:", e);
			return { status: 500 };
		});
		
	requestCache.set(url, promise);
	return promise;
}
export function parseMana(manaCostString: string = ""): ManaType[] {
	const manaCost = manaCostString.match(/\{(.+?)\}/g) ?? [];
	return manaCost.flatMap((manaWithBraces): ManaType | ManaType[] => {
		const mana = manaWithBraces.replace("{", "").replace("}", "");
		return manaLetterToType(mana);
	});
}

export function serializeMana(manaCost: ManaType[]): string {
	const manaWithoutColorless = manaCost.filter((type) => type != "colorless");
	const entries = Object.entries(manaLetterToTypeMap) as [
		ManaLetter,
		ManaType,
	][];

	const withoutColorless = manaWithoutColorless
		.map((mana) => {
			const letter = entries.find(([_letter, type]) => type == mana)?.[0];
			if (letter) {
				return `{${letter}}`;
			}
		})
		.filter((v) => v != null)
		.join("");
	const colorlessCount = manaCost.filter((type) => type == "colorless").length;

	if (colorlessCount > 0) {
		return `{${colorlessCount}}${withoutColorless}`;
	} else {
		return withoutColorless;
	}
}

export function manaLetterToType(manaLetter: string): ManaType | ManaType[] {
	if (manaLetters.includes(manaLetter as ManaLetter)) {
		return manaLetterToTypeMap[manaLetter as ManaLetter];
	} else {
		return [...new Array(parseInt(manaLetter) || 0)].map(
			() => "colorless" as const,
		);
	}
}

const MTG_TERMS_PT: Record<string, string> = {
	"Battlefield": "Campo de Batalha",
	"Graveyard": "Cemitério",
	"Library": "Grimório",
	"Hand": "Mão",
	"Mana pool": "Reserva de mana",
	"Token": "Ficha",
	"Tokens": "Fichas",
	"Planeswalker": "Planeswalker",
	"Spell": "Mágica",
	"loyalty counter": "marcador de lealdade",
	"charge counter": "marcador de carga",
	"+1/+1 counter": "marcador +1/+1",
	"-1/-1 counter": "marcador -1/-1",
	"Deathtouch": "Toque Mortal",
	"Defender": "Defensor",
	"Double Strike": "Golpe Duplo",
	"Enchant": "Encantar",
	"Equip": "Equipar",
	"First Strike": "Iniciativa",
	"Flash": "Lampejo",
	"Flying": "Voar",
	"Haste": "Ímpeto",
	"Hexproof": "Resistência a Magia",
	"Indestructible": "Indestrutível",
	"Lifelink": "Vínculo com a Vida",
	"Menace": "Ameaçar",
	"Reach": "Alcance",
	"Shroud": "Manto",
	"Trample": "Atropelar",
	"Vigilance": "Vigilância",
	"Ward": "Salvaguarda",
	"Affinity": "Afinidade",
	"Amass": "Arregimentar",
	"Cascade": "Cascata",
	"Companion": "Companheiro",
	"Convoke": "Convocação",
	"Crew": "Tripular",
	"Cycling": "Reciclar",
	"Dash": "Investida",
	"Delve": "Esquadrinhar",
	"Discover": "Descobrir",
	"Dredge": "Escavar",
	"Echo": "Eco",
	"Evolve": "Evoluir",
	"Exalted": "Exaltado",
	"Fearsome": "Assustador",
	"Flanking": "Flanquear",
	"Flashback": "Recapitular",
	"Incubate": "Incubar",
	"Infect": "Infectar",
	"Investigate": "Investigar",
	"Kicker": "Reforço",
	"Madness": "Loucura",
	"Mill": "Triturar",
	"Mutate": "Mutação",
	"Ninjutsu": "Ninjutsu",
	"Partner": "Parceiro",
	"Phasing": "Fase",
	"Populate": "Povoar",
	"Proliferate": "Proliferar",
	"Prowess": "Destreza",
	"Riot": "Tumulto",
	"Scavenge": "Necrofagia",
	"Scry": "Vidência",
	"Shadow": "Sombra",
	"Splice": "Unir",
	"Split Second": "Fração de Segundo",
	"Storm": "Rajada",
	"Surveil": "Vigiar",
	"Suspend": "Suspender",
	"Transmute": "Transmutar",
	"Unearth": "Desenterrar",
	"Undying": "Imortal",
	"Replicate": "Replicar",
	"Casualty": "Baixa",
	"Blitz": "Blitz",
	"Cleave": "Retalhar",
	"Daybound": "Vinculado ao Dia",
	"Nightbound": "Vinculado à Noite",
	"Learn": "Aprender",
	"Connive": "Maquinar",
	"Exert": "Esforçar",
	"Encore": "Bis",
};

const ALL_KEYWORDS_PT = Object.values(MTG_TERMS_PT).sort((a, b) => b.length - a.length);
const ALL_KEYWORDS_EN = Object.keys(MTG_TERMS_PT).sort((a, b) => b.length - a.length);

export function enrichOracleText(text: string, lang: string = "en"): string {
	if (!text) return text;

	const keywords = lang.toLowerCase().startsWith("pt") ? ALL_KEYWORDS_PT : ALL_KEYWORDS_EN;
	const wordChars = "a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ";

	let enriched = text;

	// Replace keywords with *keyword* if they are not already wrapped
	// We use a regex that avoids double-wrapping
	for (const keyword of keywords) {
		const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// Match keyword not preceded or followed by * or other word characters
		const regex = new RegExp(`(?<![\\*${wordChars}])${escapedKeyword}(?![\\*${wordChars}])`, "gi");
		enriched = enriched.replace(regex, (match) => `*${match}*`);
	}

	return enriched;
}

const MTG_TERMS_KEYS = Object.keys(MTG_TERMS_PT).sort((a, b) => b.length - a.length);

function prepareMtgText(text: string, lang: string): { preparedText: string; placeholders: string[] } {
	if (lang !== 'pt') return { preparedText: text, placeholders: [] };

	let preparedText = text;
	const placeholders: string[] = [];

	for (const term of MTG_TERMS_KEYS) {
		const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const startBoundary = /^\w/.test(term) ? '\\b' : '';
		const endBoundary = /\w$/.test(term) ? '\\b' : '';
		
		const regex = new RegExp(`${startBoundary}${escapedTerm}${endBoundary}`, 'gi');
		preparedText = preparedText.replace(regex, (match) => {
			const isFirstUpper = match[0] === match[0].toUpperCase();
			let translation = MTG_TERMS_PT[term];
			if (!isFirstUpper) {
				translation = translation.toLowerCase();
			}
			const placeholderStr = `_P${placeholders.length}_`;
			placeholders.push(translation);
			return placeholderStr;
		});
	}
	return { preparedText, placeholders };
}

function restoreMtgText(translatedText: string, placeholders: string[]): string {
	let restored = translatedText;
	for (let i = 0; i < placeholders.length; i++) {
		const regex = new RegExp(`_\\s*P${i}\\s*_`, 'gi');
		restored = restored.replace(regex, placeholders[i]);
	}
	return restored;
}

async function translateGoogle(text: string, targetLang: string): Promise<string> {
	if (!text) return text;
	try {
		const { preparedText, placeholders } = prepareMtgText(text, targetLang);
		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(preparedText)}`;
		const json = await fetchCachedJson(url);
		if (json && json.status && json.status >= 400) throw new Error("Translation request failed");
		
		let translatedText = json?.[0]?.map((x: any) => x?.[0] || '')?.join('') || preparedText;
		
		return restoreMtgText(translatedText, placeholders);
	} catch (e) {
		console.error("Translation failed", e);
		return text;
	}
}

function needScan(scryfallResult: any) {
	return ['Stickers', 'Dungeon'].includes(scryfallResult['type_line']) || ['split', 'modal_dfc', 'adventure', 'planar', 'host', 'class', 'saga', 'flip'].includes(scryfallResult['layout'])
}

function getCardScanUrl(scryfallResult: any, { ifNecessary }: { ifNecessary: boolean }) {
	// Skip if not necessary
	if (ifNecessary && !needScan(scryfallResult)) {
		return undefined
	}

	let uris

	if ('image_uris' in scryfallResult) {
		uris = scryfallResult['image_uris']
	} else if ('card_faces' in scryfallResult) {
		uris = scryfallResult['card_faces'].find((f: any) => 'image_uris' in f)?.['image_uris']
	}

	return uris['large'] ?? uris['normal'] ?? uris['small']
}

export async function fetchCard(
	title: string,
	lang = "en",
	variant: number = 0,
): Promise<Card> {
	let [frCards, enCards] = await Promise.all([
		fetchCachedJson(
			`https://api.scryfall.com/cards/search/?q=((!"${title}" lang:${lang}) or ("${title}" t:token)) -t:card order:released direction:asc`,
		),
		fetchCachedJson(
			`https://api.scryfall.com/cards/search/?q=((!"${title}") or ("${title}" t:token)) -t:card order:released direction:asc`,
		),
	]);

	const enCardsStatus = enCards.status ?? 200;
	if (enCardsStatus === 404 || enCardsStatus >= 500) {
		throw new CardError(title, "Not found");
	}

	const frCardsStatus = frCards.status ?? 200;
	if (frCardsStatus === 404 || frCardsStatus >= 500) {
		frCards = enCards;
	}

	const fr = frCards.data?.find((c: any) => c.name.includes(title));
	const en = enCards.data?.find((c: any) => c.name.includes(title));

	if (!fr || !en) {
		throw new CardError(
			title,
			'Not found'
		);
	}

	const variants = await fetchVariants(en["name"]);

	const biFaced = en['layout'] == 'transform' && 'card_faces' in en && en['card_faces'].length == 2
	console.debug('biFaced', biFaced)
	const frCardFaceInfo = biFaced ? fr['card_faces'][0] : fr
	const enCardFaceInfo = biFaced ? en['card_faces'][0] : en
	const frReverseFaceInfo = biFaced ? fr['card_faces'][1] : fr
	const enReverseFaceInfo = biFaced ? en['card_faces'][1] : en

	const colorsToUse: string[] = enCardFaceInfo["type_line"].toLowerCase().includes("land")
		? frCardFaceInfo["color_identity"]
		: frCardFaceInfo["colors"] ?? frCardFaceInfo["color_identity"];

	const manaTypes = colorsToUse.flatMap(manaLetterToType);

	const manaCost = parseMana(enCardFaceInfo["mana_cost"]);

	const overrideWithScanUrl = getCardScanUrl(frCardFaceInfo, { ifNecessary: true }) ?? getCardScanUrl(enCardFaceInfo, { ifNecessary: true })

	console.debug('en', enCardFaceInfo)
	console.debug('fr', frCardFaceInfo)

	let primaryText = {
		title: frCardFaceInfo["printed_name"] || frCardFaceInfo["name"],
		typeText: frCardFaceInfo["printed_type_line"] || frCardFaceInfo["type_line"] || enCardFaceInfo["printed_type_line"] || enCardFaceInfo["type_line"],
		oracleText: frCardFaceInfo["printed_text"] || frCardFaceInfo["oracle_text"],
		flavorText: frCardFaceInfo["flavor_text"]
	};

	let reverseText = biFaced ? {
		title: frReverseFaceInfo["printed_name"] || frReverseFaceInfo["name"],
		typeText: frReverseFaceInfo["printed_type_line"] || frReverseFaceInfo["type_line"] || enReverseFaceInfo["printed_type_line"] || enReverseFaceInfo["type_line"],
		oracleText: frReverseFaceInfo["printed_text"] || frReverseFaceInfo["oracle_text"],
		flavorText: frReverseFaceInfo["flavor_text"]
	} : null;

	const targetLang = lang.startsWith("pt") ? "pt" : lang;
	const needsTranslation = lang !== "en" && (frCardsStatus === 404 || frCardFaceInfo["lang"] === "en");
	
	if (needsTranslation) {
		primaryText.title = await translateGoogle(primaryText.title, lang);
		primaryText.typeText = await translateGoogle(primaryText.typeText, lang);
		primaryText.oracleText = await translateGoogle(primaryText.oracleText, lang);
		primaryText.flavorText = await translateGoogle(primaryText.flavorText, lang);
		
		if (reverseText) {
			reverseText.title = await translateGoogle(reverseText.title, lang);
			reverseText.typeText = await translateGoogle(reverseText.typeText, lang);
			reverseText.oracleText = await translateGoogle(reverseText.oracleText, lang);
			reverseText.flavorText = await translateGoogle(reverseText.flavorText, lang);
		}
	}

	const finalLang = needsTranslation ? lang : fr["lang"];

	const card: Card = {
		title: primaryText.title,
		originalName: enCardFaceInfo["name"],
		manaCost,
		artUrl: enCardFaceInfo["image_uris"]?.["art_crop"],
		totalVariants: variants.length,
		aspect: {
			frame: parseCardFrame(enCardFaceInfo["type_line"]),
			color: parseCardColor(
				manaTypes,
				enCardFaceInfo["type_line"].toLowerCase().includes("artifact") &&
				!enCardFaceInfo["type_line"].toLowerCase().includes("vehicle"),
				manaCost
					.filter((type) => type != "colorless" && type != "x")
					.every(isBiType),
			),
			legendary:
				en["frame_effects"]?.includes("legendary") ||
				enCardFaceInfo["type_line"].toLowerCase().includes("legendary"),
		},
		typeText: primaryText.typeText,
		oracleText: enrichOracleText(primaryText.oracleText, finalLang),
		flavorText: primaryText.flavorText,
		power: frCardFaceInfo["power"],
		toughness: frCardFaceInfo["toughness"],
		artist: frCardFaceInfo["artist"],
		collectorNumber: fr["collector_number"],
		lang: finalLang,
		rarity: fr["rarity"],
		set: fr["set"],
		category: enCardFaceInfo["type_line"].toLowerCase().includes("planeswalker")
			? "Planeswalker"
			: "Regular",
		loyalty: enCardFaceInfo["loyalty"],
		overrideWithScanUrl,
	};

	return {
		verso: biFaced ? {
			title: reverseText!.title,
			originalName: enReverseFaceInfo["name"],
			manaCost,
			artUrl: enReverseFaceInfo["image_uris"]?.["art_crop"],
			totalVariants: variants.length,
			aspect: {
				frame: parseCardFrame(enReverseFaceInfo["type_line"]),
				color: parseCardColor(
					manaTypes,
					enReverseFaceInfo["type_line"].toLowerCase().includes("artifact") &&
					!enReverseFaceInfo["type_line"].toLowerCase().includes("vehicle"),
					manaCost
						.filter((type) => type != "colorless" && type != "x")
						.every(isBiType),
				),
				legendary:
					en["frame_effects"]?.includes("legendary") ||
					enReverseFaceInfo["type_line"].toLowerCase().includes("legendary"),
			},
			typeText: reverseText!.typeText,
			oracleText: enrichOracleText(reverseText!.oracleText, finalLang),
			flavorText: reverseText!.flavorText,
			power: frReverseFaceInfo["power"],
			toughness: frReverseFaceInfo["toughness"],
			artist: frReverseFaceInfo["artist"],
			collectorNumber: fr["collector_number"],
			lang: finalLang,
			rarity: fr["rarity"],
			set: fr["set"],
			category: enReverseFaceInfo["type_line"].toLowerCase().includes("planeswalker")
				? "Planeswalker"
				: "Regular",
			loyalty: enReverseFaceInfo["loyalty"],
			overrideWithScanUrl,
		} satisfies Card : "default",
		...card,
		...variants[variant % variants.length],
	} as Card;
}

export async function fetchVariants(title: string): Promise<Partial<Card>[]> {
	const response = await fetchCachedJson(
		`https://api.scryfall.com/cards/search/?q=!"${title}" unique:art prefer:newest`,
	);

	const variants = (response.data || [])
		.map((card: any, i: number, arr: any[]): Partial<Card> => {
			let partial: Partial<Card> = {
				artUrl: card["image_uris"]?.["art_crop"],
				artist: card["artist"],
				collectorNumber: card["collector_number"],
				set: card["set"],
				rarity: card["rarity"],
				totalVariants: arr.length,
			};

			if (card["type_line"]?.toLowerCase().includes("token")) {
				const manaTypes = (card["colors"] ?? card["color_identity"]).flatMap(
					manaLetterToType,
				);
				const manaCost = parseMana(card["mana_cost"]);

				partial = {
					...partial,
					typeText: card["type_line"],
					oracleText: card["printed_text"] || card["oracle_text"],
					flavorText: card["flavor_text"],
					power: card["power"],
					toughness: card["toughness"],
					aspect: {
						frame: parseCardFrame(card["type_line"]),
						color: parseCardColor(
							manaTypes,
							card["type_line"].toLowerCase().includes("artifact") &&
							!card["type_line"].toLowerCase().includes("vehicle"),
							manaCost
								.filter((type) => type != "colorless" && type != "x")
								.every(isBiType),
						),
						legendary:
							card["frame_effects"]?.includes("legendary") ||
							card["type_line"].toLowerCase().includes("legendary"),
					},
				};
			}

			return partial;
		})
		.filter((v: any) => {
			return v?.artUrl != null;
		});

	return variants;
}

export async function fetchCardType(name: string): Promise<string> {
	const response = await fetchCachedJson(
		`https://api.scryfall.com/cards/search/?q=!"${name}"`,
	);

	const [card] = response.data ?? [];

	return card?.["type_line"] ?? "";
}

export async function searchCard(search: string) {
	if (search.length < 3) return [];

	const response = await fetch(
		`https://api.scryfall.com/cards/search/?q=${search}`,
	).then(async (r) => {
		const json = (await r.json()) as any;
		if ("status" in json) {
			throw new Error(
				match(json.status)
					.with(404, () => "No cards found")
					.otherwise(() => "An error occured"),
			);
		} else {
			return json;
		}
	});

	const result: Array<{
		name: string;
		type_line: string;
	}> = response.data;

	const deduped = result.filter(
		(card, index) => result.findIndex((c) => c.name == card.name) == index,
	);

	return deduped;
}
