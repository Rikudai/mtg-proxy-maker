import { JSX } from "solid-js";
import flavorTextDividerUrl from "../../assets/images/flavor-text-divider.png";
import ShrinkToFit from "./shrink-to-fit";
import { processText } from "../../services/text-processor";

type RegularDescriptionProps = {
	oracle?: string;
	flavor?: string;
	lang?: string;
};

export default function RegularDescription(props: RegularDescriptionProps) {
	return (
		<ShrinkToFit
			minFontSize={6}
			maxFontSize={9.5}
			unit="pt"
			style={{
				top: "55.1mm",
				left: "4.9mm",
				right: "4.7mm",
				position: "absolute",
				padding: "1mm",
				"font-family": "MPlantin",
				"line-height": 0.9,
			}}
			containerHeight="24.5mm"
		>
			{props.oracle && (
				<div
					style={{
						margin: 0,
						"font-weight": 500,
						display: "flex",
						"flex-direction": "column",
						"white-space": "pre-wrap",
					}}
				>
					{props.oracle.split("\n").map((paragraph, index) => (
						<p
							style={{
								margin: 0,
								"margin-top": index > 0 ? "1mm" : 0,
							}}
						>
							{processText(paragraph, props.lang)}
						</p>
					))}
				</div>
			)}
			{props.flavor && props.oracle && (
				<img
					src={flavorTextDividerUrl}
					style={{
						"margin-top": "1mm",
						"margin-bottom": "1mm",
					}}
				/>
			)}
			{props.flavor && (
				<p
					style={{
						margin: 0,
						"font-style": "italic",
						"white-space": "pre-wrap",
					}}
				>
					{props.flavor}
				</p>
			)}
		</ShrinkToFit>
	);
}
