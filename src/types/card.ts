import { CardColor, CardFrame } from "./backgrounds";
import { ManaType } from "./mana";

export type Card = {
	overrideWithScanUrl?: string;
	artUrl: string;
	isLoading?: boolean;
	artist?: string;
	aspect: { frame: CardFrame; color: CardColor; legendary: boolean };
	collectorNumber?: string;
	flavorText: string;
	lang?: string;
	manaCost: ManaType[];
	oracleText: string;
	originalOracleText?: string;
	power?: string;
	rarity?: string;
	set?: string;
	title: string;
	originalName: string;
	totalVariants: number;
	toughness?: string;
	typeText: string;
	verso?: "default" | string | Card;
	titleFontSize?: number;
	oracleFontSize?: number;
	snapshotUrl?: string;
	translationSource?: "scryfall" | "google";
} & (
		| {
			category: "Regular";
		}
		| {
			category: "Planeswalker";
			loyalty: string;
		}
	);

export function getEmptyCard(): Card {
	return {
		artUrl: "",
		totalVariants: 0,
		flavorText: "",
		manaCost: [],
		oracleText: "",
		title: "",
		originalName: "",
		typeText: "",
		aspect: {
			frame: "Noncreature",
			color: "Artifact",
			legendary: false,
		},
		category: "Regular",
	};
}
