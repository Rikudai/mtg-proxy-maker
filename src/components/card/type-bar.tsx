import { JSX } from "solid-js";
import { Card } from "../../types/card";
import ShrinkToFit from "./shrink-to-fit";

type TypeBarProps = {
	type: string;
	category: Card["category"];
};

const style: Record<Card["category"], JSX.CSSProperties> = {
	Planeswalker: {
		top: "49.4mm",
		left: "4.7mm",
		right: "4.6mm",
		height: "4.3mm",
		position: "absolute",
	},
	Regular: {
		top: "49.6mm",
		left: "4.7mm",
		right: "4.6mm",
		height: "5mm",
	},
};

export default function TypeBar(props: TypeBarProps) {
	return (
		<div
			style={{
				display: "flex",
				"align-items": "center",
				position: "absolute",
				"z-index": 2,
				...style[props.category],
			}}
		>
			<ShrinkToFit
				minFontSize={6}
				maxFontSize={9}
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
						"font-family": "Beleren",
						"font-size": "inherit",
					}}
				>
					{props.type}
				</h1>
			</ShrinkToFit>
		</div>
	);
}
