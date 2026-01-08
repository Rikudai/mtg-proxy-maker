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
	let [frCards, enCards]: [any, any] = await Promise.all([
		fetch(
			`https://api.scryfall.com/cards/search/?q=((!"${title}" lang:${lang}) or ("${title}" t:token)) -t:card order:released direction:asc`,
			{
				headers: {
					Origin: window.location.href
				}
			}
		).catch((e) => {
			console.error(e);
			throw new CardError(
				title,
				`not found for ${lang}`
			);
		}),
		fetch(
			`https://api.scryfall.com/cards/search/?q=((!"${title}") or ("${title}" t:token)) -t:card order:released direction:asc`,
			{
				headers: {
					Origin: window.location.href
				}
			}
		).catch((e) => {
			console.error(e);
			throw new CardError(
				title,
				'Not found'
			);
		}),
	]).then(([fr, en]) => Promise.all([fr.json(), en.json()]));

	if (enCards.status == 404) {
		throw new CardError(
			title,
			'Not found'
		);
	}

	if (frCards.status == 404) {
		frCards = enCards;
	}

	const fr = frCards.data.find((c: any) => c.name.includes(title));
	const en = enCards.data.find((c: any) => c.name.includes(title));

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

	const card: Card = {
		title: frCardFaceInfo["printed_name"] || frCardFaceInfo["name"],
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
		typeText: frCardFaceInfo["printed_type_line"] || frCardFaceInfo["type_line"] || enCardFaceInfo["printed_type_line"] || enCardFaceInfo["type_line"],
		oracleText: frCardFaceInfo["printed_text"] || frCardFaceInfo["oracle_text"],
		flavorText: frCardFaceInfo["flavor_text"],
		power: frCardFaceInfo["power"],
		toughness: frCardFaceInfo["toughness"],
		artist: frCardFaceInfo["artist"],
		collectorNumber: fr["collector_number"],
		lang: fr["lang"],
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
			title: frReverseFaceInfo["printed_name"] || frReverseFaceInfo["name"],
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
			typeText: frReverseFaceInfo["printed_type_line"] || frReverseFaceInfo["type_line"] || enReverseFaceInfo["printed_type_line"] || enReverseFaceInfo["type_line"],
			oracleText: frReverseFaceInfo["printed_text"] || frReverseFaceInfo["oracle_text"],
			flavorText: frReverseFaceInfo["flavor_text"],
			power: frReverseFaceInfo["power"],
			toughness: frReverseFaceInfo["toughness"],
			artist: frReverseFaceInfo["artist"],
			collectorNumber: fr["collector_number"],
			lang: fr["lang"],
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
	const response = await fetch(
		`https://api.scryfall.com/cards/search/?q=!"${title}" unique:art prefer:newest`,
		{
			headers: {
				Origin: window.location.href
			}
		}

	).then((r) => r.json() as any);

	return response.data
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
}

export async function fetchCardType(name: string): Promise<string> {
	const response = await fetch(
		`https://api.scryfall.com/cards/search/?q=!"${name}"`,
		{
			headers: {
				Origin: window.location.href
			}
		}
	).then((r) => r.json() as any);

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
