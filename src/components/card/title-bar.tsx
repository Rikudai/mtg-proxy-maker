import { mergeProps, JSX } from "solid-js";
import { Card } from "../../types/card";
import {
	ManaType,
	manaTypeToSvg,
	manaTypes,
	customManaTypes,
} from "../../types/mana";
import { symbols } from "../../types/symbols";
import ShrinkToFit from "./shrink-to-fit";

type TitleBarProps = {
	title: string;
	category: Card["category"];
	manaCost?: ManaType[];
};

const style: Record<Card["category"], JSX.CSSProperties> = {
	Planeswalker: {
		top: "3mm",
		height: "4.4mm",
		left: "4.5mm",
		right: "4.6mm",
	},
	Regular: {
		top: "4.5mm",
		height: "4.9mm",
		left: "4.7mm",
		right: "4.6mm",
	},
};

function Mana({ src, name }: { src: string; name: ManaType }) {
	return (
		<img
			style={{
				width: "3mm",
				height: "3mm",
				"margin-left": "0.3mm",
				"margin-bottom": "0.8mm",
				"border-radius": customManaTypes.includes(name) ? "0" : "100%",
				"box-shadow": customManaTypes.includes(name)
					? ""
					: "-0.5px 1px 0px black",
			}}
			src={src}
		/>
	);
}

export default function TitleBar(p: TitleBarProps) {
	const props = mergeProps({ manaCost: [] }, p);

	const sortedMana = () =>
		props.manaCost.sort(
			(a, b) =>
				manaTypes.findIndex((t) => t === a) -
				manaTypes.findIndex((t) => t === b),
		);

	const colorlessMana = () =>
		sortedMana().filter((mana) => mana == "colorless");
	const coloredMana = () => sortedMana().filter((mana) => mana != "colorless");

	return (
		<div
			style={{
				display: "flex",
				"justify-content": "space-around",
				position: "absolute",
				"font-family": "Beleren",
				"white-space": "nowrap",
				"z-index": 2,
				...style[props.category],
			}}
		>
			<ShrinkToFit
				minFontSize={7}
				maxFontSize={10.5}
				unit="pt"
				justifyContent="flex-start"
				style={{
					flex: 1,
					margin: 0,
					"margin-left": "0.5mm",
				}}
			>
				<h1
					style={{
						margin: 0,
						"margin-top": "auto",
						"margin-bottom": "auto",
						"font-size": "inherit",
					}}
				>
					{props.title}
				</h1>
			</ShrinkToFit>
			{props.manaCost.length > 0 && (
				<div
					style={{
						display: "flex",
						"align-items": "center",
					}}
				>
					{colorlessMana().length > 0 && colorlessMana().length in symbols && (
						<Mana
							src={symbols[colorlessMana().length as keyof typeof symbols]}
							name="colorless"
						/>
					)}
					{coloredMana().map((mana) => (
						<Mana src={manaTypeToSvg[mana]} name={mana} />
					))}
				</div>
			)}
		</div>
	);
}
