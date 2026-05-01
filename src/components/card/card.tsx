import { Show } from "solid-js";
import { getFrameAndBackgroundFromAspect } from "../../types/backgrounds";
import { Card } from "../../types/card";
import Art from "./art";
import Metadata from "./metadata";
import PlaneswalkerDescription from "./planeswalker-description";
import PlaneswalkerLoyalty from "./planeswalker-loyalty";
import RegularDescription from "./regular-description";
import Strength from "./strength";
import TitleBar from "./title-bar";
import TypeBar from "./type-bar";
import { toPng } from 'html-to-image';
import { createEffect, createSignal, onMount } from "solid-js";

export default function CardComponent(props: {
	card: Card;
	id?: string;
	onClick?: () => void;
	onArtClick?: () => void;
	onUpdate?: (updates: Partial<Card>) => void;
	selected?: boolean;
	shouldRender?: boolean;
	isHighQuality?: boolean;
}) {
	const [isCapturing, setIsCapturing] = createSignal(false);
	const [isTitleReady, setIsTitleReady] = createSignal(false);
	const [isOracleReady, setIsOracleReady] = createSignal(false);
	const [isArtReady, setIsArtReady] = createSignal(!props.card.artUrl);
	
	let cardRef: HTMLDivElement | undefined;

	const frameAndBackground = () =>
		getFrameAndBackgroundFromAspect(props.card.aspect);

	const captureSnapshot = async () => {
		if (!cardRef || isCapturing() || props.selected || !props.shouldRender) return;
		
		try {
			setIsCapturing(true);
			// Extra safety wait for final paint and fonts
			await document.fonts.ready;
			await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
			
			const dataUrl = await Promise.race([
				toPng(cardRef, { 
					pixelRatio: 1, 
					cacheBust: true,
					fontEmbedCSS: undefined 
				}),
				new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
			]);
			props.onUpdate?.({ snapshotUrl: dataUrl });
		} catch (e) {
			console.warn("Snapshot failed", e);
			props.onUpdate?.({ snapshotError: true });
		} finally {
			setIsCapturing(false);
		}
	};

	createEffect(() => {
		// Only capture if all parts are ready, no snapshot exists, and not currently selected
		// Also DISABLE during high quality (export/print) to avoid competing for CPU
		if (
			isTitleReady() && isOracleReady() && isArtReady() && 
			!props.card.snapshotUrl && !props.card.snapshotError && 
			!props.card.isLoading && !props.selected && 
			props.shouldRender && !props.isHighQuality
		) {
			// Random delay to stagger snapshot requests and prevent UI freezing
			const delay = Math.random() * 2000;
			const timeout = setTimeout(captureSnapshot, delay);
			onCleanup(() => clearTimeout(timeout));
		}
	});

	// Reset readiness when card changes substantially
	createEffect(() => {
		const url = props.card.artUrl;
		const isBasicLand = props.card.category === "Regular" && props.card.aspect.frame === "Basic Land";
		
		setIsArtReady(!url);
		setIsTitleReady(false);
		setIsOracleReady(isBasicLand); // Basic lands don't have oracle sizing
	});

	return (
		<div
			tabIndex={0}
			ref={cardRef}
			id={props.id}
			data-name={props.card.title}
			onClick={props.onClick}
			class="rounded-xl print:rounded-none group outline !focus:outline outline-amber-500 print:outline-none card-export-target text-black overflow-hidden"
			style={{
				position: "relative",
				display: "flex",
				"font-family": "MPlantin",
				"font-size": "12pt",
				color: "black",
				"background-color": "var(--card-bgc, #161410)",
				height: "auto",
				width: "var(--card-width)",
				"min-width": "var(--card-width)",
				"max-width": "var(--card-width)",
				"aspect-ratio": "63/88",
				border: "var(--card-bleed) solid var(--card-bgc)",
				"outline-style": props.selected ? "solid" : "none",
				"outline-width": props.selected ? "2px" : "0px",
				margin: "auto",
				"box-sizing": "content-box",
			}}
		>
			<Show 
				when={props.card.snapshotUrl && !props.selected && !props.isHighQuality} 
				fallback={
					<Show when={props.shouldRender || props.selected || props.isHighQuality}>
						<Show when={!props.card.overrideWithScanUrl}>
							<img
								style={{
									width: "100%",
									height: "100%",
									position: "absolute",
									top: 0,
									left: 0,
								}}
								src={frameAndBackground().background}
							/>
							{/* Black mask for the bottom of the card */}
							<div
								style={{
									bottom: "5.5mm",
									height: "2mm",
									left: "0",
									right: "0",
									position: "absolute",
									background: 'var(--card-bgc, "black")',
								}}
							/>
							{(props.card.artUrl || props.card.isLoading) && (
								<Art 
									url={props.card.artUrl} 
									isLoading={props.card.isLoading} 
									category={props.card.category} 
									onArtClick={props.onArtClick}
									onLoaded={() => setIsArtReady(true)}
								/>
							)}
							<img
								style={{
									width: "100%",
									height: "100%",
									position: "absolute",
									top: 0,
									left: 0,
									"z-index": props.card.category == "Planeswalker" ? 1 : 0,
								}}
								src={frameAndBackground().frame}
							/>
							<TitleBar
								title={props.card.title}
								manaCost={props.card.manaCost}
								category={props.card.category}
								initialFontSize={props.card.titleFontSize}
								onFontSizeCalculated={(size) => {
									props.onUpdate?.({ titleFontSize: size });
									setIsTitleReady(true);
								}}
							/>
							<TypeBar 
								type={props.card.typeText} 
								category={props.card.category} 
							/>
							{props.card.category == "Regular" ? (
								props.card.aspect.frame != "Basic Land" && (
									<RegularDescription
										flavor={props.card.flavorText}
										oracle={props.card.oracleText}
										lang={props.card.lang}
										initialFontSize={props.card.oracleFontSize}
										onFontSizeCalculated={(size) => {
											props.onUpdate?.({ oracleFontSize: size });
											setIsOracleReady(true);
										}}
									/>
								)
							) : (
								<PlaneswalkerDescription
									oracle={props.card.oracleText}
									lang={props.card.lang}
									initialFontSize={props.card.oracleFontSize}
									onFontSizeCalculated={(size) => {
										props.onUpdate?.({ oracleFontSize: size });
										setIsOracleReady(true);
									}}
								/>
							)}
							{props.card.category == "Regular" ? (
								<Show when={!!props.card.power || !!props.card.toughness}>
									<Strength
										power={props.card.power}
										toughness={props.card.toughness}
										textColor={props.card.aspect.frame == "Vehicle" ? "white" : "black"}
									/>
								</Show>
							) : (
								<PlaneswalkerLoyalty value={props.card.loyalty} />
							)}
							<Metadata {...props.card} />
						</Show>
						<Show when={props.card.overrideWithScanUrl && !props.card.snapshotUrl}>
							<img 
								class="rounded-xl" 
								src={props.card.overrideWithScanUrl} 
								alt={props.card.title} 
								onLoad={() => {
									setIsTitleReady(true);
									setIsOracleReady(true);
									setIsArtReady(true);
								}}
								onError={() => {
									setIsTitleReady(true);
									setIsOracleReady(true);
									setIsArtReady(true);
								}}
							/>
						</Show>
					</Show>
				}
			>
				<img 
					src={props.card.snapshotUrl} 
					style={{ width: "100%", height: "100%", "object-fit": "contain" }} 
					alt={props.card.title}
				/>
			</Show>
		</div>
	);
}
