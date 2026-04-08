import { createSignal, Show } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Card } from "../../types/card";

type ArtProps = {
	url: string;
	category: Card["category"];
	isLoading?: boolean;
	onArtClick?: () => void;
};

const style: Record<Card["category"], JSX.CSSProperties> = {
	Planeswalker: {
		width: "53.7mm",
		height: "40.1mm",
		position: "absolute",
		top: "8.3mm",
		left: "4.7mm",
		"object-fit": "cover",
	},
	Regular: {
		width: "53.4mm",
		height: "38.8mm",
		position: "absolute",
		top: "10.3mm",
		left: "4.9mm",
		"object-fit": "cover",
	},
};

export default function Art(props: ArtProps) {
	const [imgLoaded, setImgLoaded] = createSignal(false);
	const showSkeleton = () => props.isLoading || (!imgLoaded() && !!props.url);

	return (
		<>
			{/* Skeleton shimmer — visível enquanto carrega */}
			<Show when={showSkeleton()}>
				<div
					style={{
						...style[props.category],
						overflow: "hidden",
						"border-radius": "2px",
					}}
				>
					<div
						style={{
							width: "100%",
							height: "100%",
							background: "linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)",
							"background-size": "200% 100%",
							animation: "art-shimmer 1.4s ease-in-out infinite",
						}}
					/>
				</div>
			</Show>

			{/* Imagem real — renderizada mas invisível até carregar */}
			<Show when={!props.isLoading && !!props.url}>
				<img
					style={{
						...style[props.category],
						opacity: imgLoaded() ? 1 : 0,
						transition: "opacity 0.4s ease",
					}}
					src={props.url}
					onLoad={() => setImgLoaded(true)}
					onClick={props.onArtClick}
				/>
			</Show>
		</>
	);
}
