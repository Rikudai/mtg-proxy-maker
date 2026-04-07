import { createSignal, createEffect, JSX, onMount } from "solid-js";

type ShrinkToFitProps = {
	children: JSX.Element;
	minFontSize: number;
	maxFontSize: number;
	unit: "pt" | "px" | "mm";
	containerHeight?: string;
	justifyContent?: "center" | "flex-start" | "flex-end";
	className?: string;
	style?: JSX.CSSProperties;
};

export default function ShrinkToFit(props: ShrinkToFitProps) {
	const [fontSize, setFontSize] = createSignal(props.maxFontSize);
	let containerRef: HTMLDivElement | undefined;

	const adjustFontSize = () => {
		if (!containerRef) return;

		let currentSize = props.maxFontSize;
		setFontSize(currentSize);

		// We use a small timeout to allow the browser to perform layout
		// This is necessary because we need scrollHeight/clientWidth to be accurate
		const checkAndShrink = () => {
			if (!containerRef) return;

			if (
				(containerRef.scrollHeight > containerRef.clientHeight ||
					containerRef.scrollWidth > containerRef.clientWidth) &&
				currentSize > props.minFontSize
			) {
				currentSize -= 0.2;
				setFontSize(currentSize);
				requestAnimationFrame(checkAndShrink);
			}
		};

		requestAnimationFrame(checkAndShrink);
	};

	onMount(() => {
		adjustFontSize();
	});

	createEffect(() => {
		// Re-run if children change
		props.children;
		adjustFontSize();
	});

	return (
		<div
			ref={containerRef}
			class={props.className}
			style={{
				...(props.style as any),
				"font-size": `${fontSize()}${props.unit}`,
				display: "flex",
				"flex-direction": "column",
				"justify-content": props.justifyContent || "center",
				overflow: "hidden",
				height: props.containerHeight || "100%",
			}}
		>
			{props.children}
		</div>
	);
}
