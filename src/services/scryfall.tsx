import { match, P } from "ts-pattern";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { parseCardColor, parseCardFrame } from "../types/backgrounds";
import { Card } from "../types/card";
import { CardError } from "../types/error";
import {
	isBiType,
	ManaLetter,
	manaLetters,
	manaLetterToType as manaLetterToTypeMap, ManaType
} from "../types/mana";

class RequestQueue {
	private queue: (() => Promise<void>)[] = [];
	private processing = false;
	private lastRequestTime = 0;
	private minDelay = 200; // Aumentado para 200ms para ser mais conservador

	async add<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.queue.push(async () => {
				try {
					const now = Date.now();
					const elapsed = now - this.lastRequestTime;
					if (elapsed < this.minDelay) {
						await new Promise((r) => setTimeout(r, this.minDelay - elapsed));
					}
					const result = await fn();
					this.lastRequestTime = Date.now();
					resolve(result);
				} catch (e) {
					// Importante: atualizar o tempo mesmo em caso de erro para manter o gap
					this.lastRequestTime = Date.now();
					reject(e);
				}
			});
			this.process();
		});
	}

	private async process() {
		if (this.processing) return;
		this.processing = true;
		try {
			while (this.queue.length > 0) {
				const task = this.queue.shift();
				if (task) {
					try {
						await task();
					} catch (e) {
						// Ignora erro aqui, pois a Promise individual já foi rejeitada no add()
					}
				}
			}
		} finally {
			this.processing = false;
		}
	}
}

const scryfallQueue = new RequestQueue();
const translateQueue = new RequestQueue();

const requestCache = new Map<string, Promise<any>>();

async function fetchCachedJson(
	url: string, 
	retryCount = 0, 
	options: RequestInit = {}
): Promise<any> {
	const cacheKey = options.body 
		? `${url}:${options.method}:${options.body}` 
		: url;

	const isScryfall = url.includes("scryfall.com");

	if (requestCache.has(cacheKey) && retryCount === 0) {
		return requestCache.get(cacheKey)!;
	}

	// Try persistent cache if it's a Scryfall result (longer lived)
	if (isScryfall && retryCount === 0) {
		try {
			const persisted = await idbGet(cacheKey);
			if (persisted) {
				requestCache.set(cacheKey, Promise.resolve(persisted));
				return persisted;
			}
		} catch (e) {
			console.warn("Persistent cache read failed", e);
		}
	}

	const executeFetch = async () => {
		let currentRetry = retryCount;
		while (currentRetry < 4) {
			try {
				const response = await fetch(url, {
					...options,
					headers: {
						"Accept": "application/json",
						...(options.body ? { "Content-Type": "application/json" } : {}),
						...(options.headers || {}),
					}
				});
				
				// Tratamento de Rate Limit (429) para Scryfall e Google Translate
				if (response.status === 429) {
					const delay = (isScryfall ? 1000 : 2000) * Math.pow(2, currentRetry);
					console.warn(`Rate limit hit (429) for ${isScryfall ? 'Scryfall' : 'Google Translate'}. Retrying in ${delay}ms... (attempt ${currentRetry + 1})`);
					await new Promise(r => setTimeout(r, delay));
					currentRetry++;
					continue;
				}

				const json = await response.json().catch(() => null);
				return json || { status: response.status };
			} catch (e) {
				// Se falhou por CORS ou Rede, frequentemente é um 429 disfarçado
				if (currentRetry < 3) {
					const delay = isScryfall ? 2000 * (currentRetry + 1) : 300;
					console.warn(`Network error fetching ${url} (potential rate limit/CORS). Retrying in ${delay}ms... (attempt ${currentRetry + 1}):`, e);
					await new Promise((r) => setTimeout(r, delay));
					currentRetry++;
					continue;
				}
				console.error(`Network error fetching ${url} after multiple retries:`, e);
				return { status: 500 };
			}
		}
		return { status: 500 };
	};

	const promise = isScryfall ? scryfallQueue.add(executeFetch) : translateQueue.add(executeFetch);

	if (retryCount === 0) {
		requestCache.set(cacheKey, promise);
		
		promise.then(data => {
			if (data && data.status && data.status >= 400) {
				requestCache.delete(cacheKey);
			} else if (isScryfall && data && !data.error) {
				// Persist successful Scryfall results
				idbSet(cacheKey, data).catch(e => console.warn("Persistent cache write failed", e));
			}
		}).catch(() => {
			// Remove from cache if it failed, so we can retry next time
			requestCache.delete(cacheKey);
		});
	}
	
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
	"Land": "Terreno",
	"Sorcery": "Feitiço",
	"Instant": "Mágica Instantânea",
	"Toxic": "tóxico",
	"loyalty counter": "marcador de lealdade",
	"charge counter": "marcador de carga",
	"+1/+1 counter": "marcador +1/+1",
	"-1/-1 counter": "marcador -1/-1",
	"Deathtouch": "Toque Mortal",
	"Defender": "Defensor",
	"Double Strike": "Golpe Duplo",
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
	"Enchant": "Encantar",
	"Protection": "Proteção",
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
	"Changeling": "Morfolóide",
	"Sliver": "Fractius",
	"Slivers": "Fractius",
	"tapped": "virado",
};

const BOLD_KEYWORDS = [
	"Deathtouch",
	"Defender",
	"Double Strike",
	"Enchant",
	"Equip",
	"First Strike",
	"Flash",
	"Flying",
	"Haste",
	"Hexproof",
	"Indestructible",
	"Lifelink",
	"Menace",
	"Protection",
	"Prowess",
	"Reach",
	"Trample",
	"Vigilance"
];

const ALL_KEYWORDS_PT = Object.entries(MTG_TERMS_PT)
	.filter(([en]) => BOLD_KEYWORDS.includes(en))
	.map(([_, pt]) => pt)
	.sort((a, b) => b.length - a.length);

const ALL_KEYWORDS_EN = Object.keys(MTG_TERMS_PT)
	.filter(en => BOLD_KEYWORDS.includes(en))
	.sort((a, b) => b.length - a.length);

export function enrichOracleText(text: string, lang: string = "en"): string {
	if (!text) return text;

	if (lang.toLowerCase().startsWith("pt")) {
		text = text.replace(/entra em virado/gi, "entra virado");
		text = text.replace(/entra no virado/gi, "entra virado");
	}

	const lines = text.split("\n");
	let firstLine = lines[0];

	const keywords = lang.toLowerCase().startsWith("pt") ? ALL_KEYWORDS_PT : ALL_KEYWORDS_EN;
	const wordChars = "a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ";

	// Replace keywords with *keyword* if they are not already wrapped
	// We avoid lookbehind for better cross-browser compatibility
	for (const keyword of keywords) {
		const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(^|[^\\*${wordChars}])${escapedKeyword}(?![\\*${wordChars}])`, "gi");
		firstLine = firstLine.replace(regex, (match, before) => `${before || ""}*${match.slice(before ? before.length : 0)}*`);
	}

	// Special case for Ninjutsu (italic on first line)
	firstLine = firstLine.replace(/\b(Ninjutsu)\b/gi, "_$1_");

	lines[0] = firstLine;

	// Ability words (italics for any line starting with "Word —")
	const processedLines = lines.map(line => {
		return line.replace(/^([A-Z][^—–\n]+?)\s*(?:—|–|--)/, (match, word) => `_${word}_ —`);
	});

	return processedLines.join("\n");
}

const MTG_TERMS_KEYS = Object.keys(MTG_TERMS_PT).sort((a, b) => b.length - a.length);

let customDictionaryCachePromise: Promise<Record<string, string>> | null = null;
let customDictionaryCache: Record<string, string> | null = null;

export async function getCustomDictionary(): Promise<Record<string, string>> {
	if (customDictionaryCache) return customDictionaryCache;
	if (customDictionaryCachePromise) return customDictionaryCachePromise;

	customDictionaryCachePromise = (async () => {
		try {
			const res = await fetch('/api/dictionary');
			if (res.ok) {
				const dict = await res.json() as Record<string, string>;
				customDictionaryCache = dict;
				return dict;
			}
		} catch (e) {
			console.warn("API de dicionário local não disponível.");
		}

		try {
			const dict = await idbGet("mtg-custom-dict") as Record<string, string>;
			customDictionaryCache = dict || {};
			return customDictionaryCache!;
		} catch {
			return {};
		}
	})();

	return customDictionaryCachePromise;
}

export async function saveToCustomDictionary(enText: string, ptText: string) {
	const dict = await getCustomDictionary();
	dict[enText] = ptText;
	customDictionaryCache = dict;
	
	try {
		const response = await fetch('/api/dictionary', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(dict, null, 2)
		});
		if (response.ok) return; // Se salvou via API local, sucesso!
	} catch (e) {
		console.warn("Fallback para IndexedDB: falha ao salvar arquivo local.");
	}

	await idbSet("mtg-custom-dict", dict);
}

function prepareMtgText(text: string, lang: string, customDict: Record<string, string>): { preparedText: string; placeholders: string[] } {
	if (lang !== 'pt') return { preparedText: text, placeholders: [] };

	let preparedText = text;
	const placeholders: string[] = [];

	const lines = preparedText.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line && customDict[line]) {
			lines[i] = lines[i].replace(line, `[[${customDict[line]}]]`);
		}
	}
	preparedText = lines.join('\n');

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
			
			// Usamos double brackets como placeholder semântico. 
			// O Google Tradutor entende o sentido da palavra, mas o script consegue identificar.
			return `[[${translation}]]`;
		});
	}
	return { preparedText, placeholders: [] };
}

function restoreMtgText(translatedText: string, _placeholders: string[]): string {
	// Remove os delimitadores [[ ]] mantendo o conteúdo interno que o Google traduziu/manteve
	let restored = translatedText.replace(/\[\[\s*(.*?)\s*\]\]/g, '$1');
	restored = restored.replace(/entra em virado/gi, "entra virado");
	restored = restored.replace(/entra no virado/gi, "entra virado");
	return restored;
}

export async function translateGoogle(text: string, targetLang: string = "pt"): Promise<string> {
	if (!text) return text;
	
	let dict: Record<string, string> = {};
	let preparedText = text;
	let placeholders: string[] = [];

	try {
		dict = await getCustomDictionary();
		const prep = prepareMtgText(text, targetLang, dict);
		preparedText = prep.preparedText;
		placeholders = prep.placeholders;

		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(preparedText)}`;
		const json = await fetchCachedJson(url);
		if (json && json.status && json.status >= 400) throw new Error(`Translation request failed with status ${json.status}`);
		
		let translatedText = json?.[0]?.map((x: any) => x?.[0] || '')?.join('') || preparedText;
		
		return restoreMtgText(translatedText, placeholders);
	} catch (e) {
		console.error("Translation failed", e);
		// Fallback gracioso: Se a API falhar, pelo menos o dicionário local será preservado
		return restoreMtgText(preparedText, placeholders);
	}
}

export async function processCorrection(originalEn: string, editedPt: string) {
	if (!originalEn || !editedPt) return;
	
	const enLines = originalEn.split('\n');
	const editedLines = editedPt.split('\n');

	if (enLines.length === editedLines.length) {
		for (let i = 0; i < enLines.length; i++) {
			const enLine = enLines[i].trim();
			const editedLine = editedLines[i].trim();

			if (enLine && editedLine && enLine !== editedLine) {
				await saveToCustomDictionary(enLine, editedLine);
			}
		}
	} else {
		if (originalEn !== editedPt) {
			await saveToCustomDictionary(originalEn.trim(), editedPt.trim());
		}
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

export function mapScryfallToCard(scryfallCard: any, lang: string): Card {
	const enCardFaceInfo = scryfallCard.layout === 'transform' && scryfallCard.card_faces?.length === 2 
		? scryfallCard.card_faces[0] 
		: scryfallCard;
	
	const colorsToUse: string[] = enCardFaceInfo["type_line"].toLowerCase().includes("land")
		? scryfallCard["color_identity"]
		: enCardFaceInfo["colors"] ?? scryfallCard["color_identity"];

	const manaTypes = colorsToUse.flatMap(manaLetterToType);
	const manaCost = parseMana(enCardFaceInfo["mana_cost"]);

	const overrideWithScanUrl = getCardScanUrl(enCardFaceInfo, { ifNecessary: true }) ?? getCardScanUrl(scryfallCard, { ifNecessary: true });

	const finalLang = scryfallCard["lang"] || "en";

	const card: Card = {
		title: enCardFaceInfo["printed_name"] || enCardFaceInfo["name"],
		originalName: enCardFaceInfo["name"],
		manaCost,
		artUrl: enCardFaceInfo["image_uris"]?.["art_crop"],
		totalVariants: 1, // Será atualizado depois se necessário
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
				scryfallCard["frame_effects"]?.includes("legendary") ||
				enCardFaceInfo["type_line"].toLowerCase().includes("legendary"),
		},
		typeText: enCardFaceInfo["printed_type_line"] || enCardFaceInfo["type_line"],
		oracleText: enrichOracleText(enCardFaceInfo["printed_text"] || enCardFaceInfo["oracle_text"], finalLang),
		originalOracleText: enCardFaceInfo["printed_text"] || enCardFaceInfo["oracle_text"],
		flavorText: enCardFaceInfo["flavor_text"],
		power: enCardFaceInfo["power"],
		toughness: enCardFaceInfo["toughness"],
		artist: enCardFaceInfo["artist"],
		collectorNumber: scryfallCard["collector_number"],
		lang: finalLang,
		rarity: scryfallCard["rarity"],
		set: scryfallCard["set"],
		...(enCardFaceInfo["type_line"].toLowerCase().includes("planeswalker")
			? { category: "Planeswalker" as const, loyalty: enCardFaceInfo["loyalty"] }
			: { category: "Regular" as const }),
		overrideWithScanUrl,
	};

	if (scryfallCard.layout === 'transform' && scryfallCard.card_faces?.length === 2) {
		const enReverseFaceInfo = scryfallCard.card_faces[1];
		card.verso = {
			title: enReverseFaceInfo["printed_name"] || enReverseFaceInfo["name"],
			originalName: enReverseFaceInfo["name"],
			manaCost,
			artUrl: enReverseFaceInfo["image_uris"]?.["art_crop"],
			totalVariants: 1,
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
					scryfallCard["frame_effects"]?.includes("legendary") ||
					enReverseFaceInfo["type_line"].toLowerCase().includes("legendary"),
			},
			typeText: enReverseFaceInfo["printed_type_line"] || enReverseFaceInfo["type_line"],
			oracleText: enrichOracleText(enReverseFaceInfo["printed_text"] || enReverseFaceInfo["oracle_text"], finalLang),
			originalOracleText: enReverseFaceInfo["printed_text"] || enReverseFaceInfo["oracle_text"],
			flavorText: enReverseFaceInfo["flavor_text"],
			power: enReverseFaceInfo["power"],
			toughness: enReverseFaceInfo["toughness"],
			artist: enReverseFaceInfo["artist"],
			collectorNumber: scryfallCard["collector_number"],
			lang: finalLang,
			rarity: scryfallCard["rarity"],
			set: scryfallCard["set"],
			...(enReverseFaceInfo["type_line"].toLowerCase().includes("planeswalker")
				? { category: "Planeswalker" as const, loyalty: enReverseFaceInfo["loyalty"] }
				: { category: "Regular" as const }),
			overrideWithScanUrl,
		} satisfies Card;
	}

	return card;
}

export async function fetchCardsCollection(names: string[]): Promise<any[]> {
	if (names.length === 0) return [];
	
	const identifiers = names.map(name => ({ name }));
	const response = await fetchCachedJson("https://api.scryfall.com/cards/collection", 0, {
		method: "POST",
		body: JSON.stringify({ identifiers })
	});

	return response.data || [];
}

export async function fetchCardsBulk(
	names: string[], 
	lang = "en", 
	onProgress?: (current: number, total: number, cardName: string) => void
): Promise<Card[]> {
	const chunks = [];
	for (let i = 0; i < names.length; i += 50) {
		chunks.push(names.slice(i, i + 50));
	}

	const allCards: Card[] = [];
	let processedCount = 0;

	for (const chunk of chunks) {
		const scryfallResults = await fetchCardsCollection(chunk);
		
		for (let i = 0; i < chunk.length; i++) {
			const name = chunk[i];
			const scryfallCard = scryfallResults[i];
			processedCount++;
			
			if (onProgress) {
				onProgress(processedCount, names.length, name);
			}

			if (!scryfallCard || scryfallCard.object === "error") {
				// Fallback para fetch individual se não achou na collection (ou erro)
				// Isso garante que queries complexas (tokens etc) ainda funcionem
				try {
					const card = await fetchCard(name, lang);
					allCards.push(card);
				} catch (e) {
					console.error(`Failed to fetch card ${name}:`, e);
				}
				continue;
			}

			// Mapeia a carta básica
			const card = mapScryfallToCard(scryfallCard, lang);
			card.translationSource = (lang !== "en" && scryfallCard.lang === "en") ? "google" : "scryfall";
			
			// Busca variantes para saber o total disponível (necessário para o contador de artes)
			const variants = await fetchVariants(card.originalName);
			card.totalVariants = variants.length;
			if (card.verso && typeof card.verso !== "string") {
				card.verso.totalVariants = variants.length;
				card.verso.translationSource = card.translationSource;
			}

			// Se o idioma não for inglês e a carta veio em inglês, tentamos traduzir
			if (lang !== "en" && scryfallCard.lang === "en") {
				card.title = await translateGoogle(card.title, lang);
				card.typeText = await translateGoogle(
					lang === "pt" ? card.typeText.replace(/Basic Land/gi, "[[Terreno Básico]]") : card.typeText,
					lang
				);
				card.oracleText = enrichOracleText(await translateGoogle(card.oracleText, lang), lang);
				if (card.flavorText) card.flavorText = await translateGoogle(card.flavorText, lang);
				
				if (card.verso && typeof card.verso !== "string") {
					card.verso.title = await translateGoogle(card.verso.title, lang);
					card.verso.typeText = await translateGoogle(
						lang === "pt" ? card.verso.typeText.replace(/Basic Land/gi, "[[Terreno Básico]]") : card.verso.typeText,
						lang
					);
					card.verso.oracleText = enrichOracleText(await translateGoogle(card.verso.oracleText, lang), lang);
					if (card.verso.flavorText) card.verso.flavorText = await translateGoogle(card.verso.flavorText, lang);
				}
			}

			allCards.push(card);
		}
	}

	return allCards;
}

export async function fetchCard(
	title: string,
	lang = "en",
	variant: number = 0,
): Promise<Card> {
	let frCards = await fetchCachedJson(
		`https://api.scryfall.com/cards/search/?q=((!"${title}" lang:${lang}) or ("${title}" t:token)) order:released direction:asc`,
	);
	let enCards = await fetchCachedJson(
		`https://api.scryfall.com/cards/search/?q=((!"${title}") or ("${title}" t:token)) order:released direction:asc`,
	);

	const enCardsStatus = enCards.status ?? 200;
	if (enCardsStatus === 404 || enCardsStatus >= 500) {
		throw new CardError(title, "Not found");
	}

	const frCardsStatus = frCards.status ?? 200;
	if (frCardsStatus === 404 || frCardsStatus >= 500) {
		frCards = enCards;
	}

	const findMatch = (cards: any) => {
		if (!cards?.data?.length) return null;
		// Tenta encontrar o nome exato primeiro
		const exact = cards.data.find((c: any) => c.name.toLowerCase() === title.toLowerCase());
		if (exact) return exact;
		// Fallback para o primeiro que inclui o título
		const partial = cards.data.find((c: any) => c.name.toLowerCase().includes(title.toLowerCase()));
		if (partial) return partial;
		// Último fallback: o primeiro resultado da lista (confiando no !nome do Scryfall)
		return cards.data[0];
	};

	const fr = findMatch(frCards);
	const en = findMatch(enCards);

	if (!fr || !en) {
		console.error("Card match failure:", { title, frLength: frCards?.data?.length, enLength: enCards?.data?.length });
		throw new CardError(
			title,
			'Not found'
		);
	}

	const variants = await fetchVariants(en["name"]);
	const targetLang = lang.startsWith("pt") ? "pt" : lang;
	
	// Mapeia a carta (usa a versão EN como base para estrutura, mas FR para os textos se disponíveis)
	const card = mapScryfallToCard(en, lang);
	
	// Atualiza com textos em PT se existirem
	const frCardFaceInfo = en['layout'] == 'transform' && 'card_faces' in en && en['card_faces'].length == 2 ? fr['card_faces'][0] : fr;
	const frReverseFaceInfo = en['layout'] == 'transform' && 'card_faces' in en && en['card_faces'].length == 2 ? fr['card_faces'][1] : fr;
	
	card.title = frCardFaceInfo["printed_name"] || frCardFaceInfo["name"];
	card.typeText = frCardFaceInfo["printed_type_line"] || frCardFaceInfo["type_line"];
	card.oracleText = enrichOracleText(frCardFaceInfo["printed_text"] || frCardFaceInfo["oracle_text"], fr["lang"]);
	card.flavorText = frCardFaceInfo["flavor_text"];
	card.artist = frCardFaceInfo["artist"];
	card.totalVariants = variants.length;

	if (card.verso && typeof card.verso !== "string") {
		card.verso.title = frReverseFaceInfo["printed_name"] || frReverseFaceInfo["name"];
		card.verso.typeText = frReverseFaceInfo["printed_type_line"] || frReverseFaceInfo["type_line"];
		card.verso.oracleText = enrichOracleText(frReverseFaceInfo["printed_text"] || frReverseFaceInfo["oracle_text"], fr["lang"]);
		card.verso.flavorText = frReverseFaceInfo["flavor_text"];
		card.verso.totalVariants = variants.length;
	}

	const hasPrintedText = !!frCardFaceInfo["printed_text"];
	const needsTranslation = lang !== "en" && (
		frCardsStatus === 404 ||
		fr["lang"] === "en" ||
		!hasPrintedText
	);

	card.translationSource = needsTranslation ? "google" : "scryfall";
	if (card.verso && typeof card.verso !== "string") {
		card.verso.translationSource = card.translationSource;
	}
	
	if (needsTranslation) {
		card.title = await translateGoogle(card.title, targetLang);
		card.typeText = await translateGoogle(
			targetLang === "pt" ? card.typeText.replace(/Basic Land/gi, "[[Terreno Básico]]") : card.typeText,
			targetLang
		);
		card.oracleText = enrichOracleText(await translateGoogle(card.oracleText, targetLang), lang);
		card.flavorText = await translateGoogle(card.flavorText ?? "", targetLang);
		
		if (card.verso && typeof card.verso !== "string") {
			card.verso.title = await translateGoogle(card.verso.title, targetLang);
			card.verso.typeText = await translateGoogle(
				targetLang === "pt" ? card.verso.typeText.replace(/Basic Land/gi, "[[Terreno Básico]]") : card.verso.typeText,
				targetLang
			);
			card.verso.oracleText = enrichOracleText(await translateGoogle(card.verso.oracleText, targetLang), lang);
			card.verso.flavorText = await translateGoogle(card.verso.flavorText ?? "", targetLang);
		}
	}

	// Seleciona a variante escolhida pelo usuário
	let selectedVariant: Partial<Card> = variants.length > 0 ? (variants[variant % variants.length] ?? {}) : {};

	if (lang !== "en" && selectedVariant.typeText) {
		selectedVariant = {
			...selectedVariant,
			typeText: await translateGoogle(
				targetLang === "pt" ? selectedVariant.typeText.replace(/Basic Land/gi, "[[Terreno Básico]]") : selectedVariant.typeText,
				targetLang
			),
			oracleText: enrichOracleText(
				await translateGoogle(selectedVariant.oracleText ?? "", targetLang),
				lang
			),
			flavorText: await translateGoogle(selectedVariant.flavorText ?? "", targetLang),
		};
	}

	return {
		...card,
		...selectedVariant,
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
				const manaTypes = (card["colors"] ?? card["color_identity"] ?? []).flatMap(
					manaLetterToType,
				);
				const manaCost = parseMana(card["mana_cost"]);

				partial = {
					...partial,
					typeText: card["type_line"],
					oracleText: card["printed_text"] || card["oracle_text"],
					originalOracleText: card["printed_text"] || card["oracle_text"],
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

	const response = await fetchCachedJson(
		`https://api.scryfall.com/cards/search/?q=${encodeURIComponent(search)}`,
	);

	if (response.status === 404) return [];
	if (response.status >= 500) throw new Error("Erro na API do Scryfall");


	const result: Array<{
		name: string;
		type_line: string;
	}> = response.data;

	const deduped = result.filter(
		(card, index) => result.findIndex((c) => c.name == card.name) == index,
	);

	return deduped;
}
