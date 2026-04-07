import { Match, Switch } from "solid-js";
import { defaultVerso } from "../../app";
import { Card } from "../../types/card";
import CardComponent from "./card";
import cardBack from "../../assets/images/card-back.png";

export default function CardVerso(props: { 
	verso: Card["verso"];
	onArtClick?: () => void;
}) {
	return (
		<Switch
			fallback={
				<div
					style={{
						position: "relative",
						height: "auto",
						display: "flex",
						width: "var(--card-width)",
						"min-width": "var(--card-width)",
						"max-width": "var(--card-width)",
						"aspect-ratio": "63/88",
						border: "var(--card-bleed) solid transparent",
						margin: "auto",
						"box-sizing": "content-box",
					}}
				/>
			}
		>
			<Match when={props.verso && props.verso == "default"}>
				<CardVerso verso={defaultVerso() || cardBack} onArtClick={props.onArtClick} />
			</Match>

			<Match when={props.verso && typeof props.verso == "string"}>
				<img
					class="rounded-xl hidden print:flex print:rounded-none card group outline-amber-500 print:outline-none"
					style={{
						position: "relative",
						"background-color": "var(--card-bgc, #161410)",
						height: "auto",
						display: "flex",
						width: "var(--card-width)",
						"min-width": "var(--card-width)",
						"max-width": "var(--card-width)",
						"aspect-ratio": "63/88",
						border: "var(--card-bleed) solid var(--card-bgc)",
						margin: "auto",
						"box-sizing": "content-box",
					}}
					src={props.verso as string}
					alt=""
					onClick={props.onArtClick}
				/>
			</Match>

			<Match when={props.verso && typeof props.verso == "object"}>
				<CardComponent card={props.verso as Card} onArtClick={props.onArtClick} />
			</Match>
		</Switch>
	);
}
