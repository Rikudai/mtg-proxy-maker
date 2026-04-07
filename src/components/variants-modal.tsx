import { For, Show } from "solid-js";
import { Card } from "../types/card";

type VariantsModalProps = {
	open: boolean;
	onClose: () => void;
	variants: Partial<Card>[];
	isLoading: boolean;
	cardName: string;
	onSelect: (variantIndex: number) => void;
};

export default function VariantsModal(props: VariantsModalProps) {
	return (
		<dialog
			class="z-[100] modal modal-bottom sm:modal-middle"
			open={props.open}
		>
			<div class="modal-box bg-stone-700 max-w-4xl border border-stone-600 shadow-2xl">
				<h3 class="font-bold text-xl text-white mb-6 flex items-center justify-between">
					<span>Select Art: <span class="text-primary italic">{props.cardName}</span></span>
					<button class="btn btn-sm btn-circle btn-ghost" onClick={() => props.onClose()}>✕</button>
				</h3>
				
				<Show when={props.isLoading}>
					<div class="flex flex-col items-center justify-center p-20 gap-4">
						<span class="loading loading-spinner loading-lg text-primary"></span>
						<p class="text-stone-300 animate-pulse">Fetching alternate artworks from Scryfall...</p>
					</div>
				</Show>
				
				<Show when={!props.isLoading}>
					<Show 
						when={props.variants.length > 0} 
						fallback={
							<div class="flex flex-col items-center justify-center p-20 gap-4 bg-stone-800/50 rounded-xl border border-dashed border-stone-600">
								<span class="text-5xl opacity-50">🖼️</span>
								<p class="text-stone-300 font-medium text-lg">No alternative artworks found.</p>
								<p class="text-stone-500 text-sm italic">This card might only have one official printing or artwork.</p>
							</div>
						}
					>
						<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[65vh] p-2 custom-scrollbar">
						<For each={props.variants}>
							{(variant, index) => (
								<button
									class="group relative hover:ring-4 hover:ring-primary rounded-xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1 shadow-lg"
									onClick={() => props.onSelect(index())}
								>
									<img 
										src={variant.artUrl} 
										alt={`Variant ${index()}`} 
										class="w-full h-auto object-cover aspect-[4/3] bg-stone-800" 
										loading="lazy"
									/>
									<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
										<span class="btn btn-primary btn-sm rounded-full">Select</span>
									</div>
									<div class="bg-stone-900/90 text-white text-[10px] p-2 text-center border-t border-stone-800 flex flex-col gap-0.5">
										<div class="font-bold text-stone-200">
											{variant.set?.toUpperCase()} {variant.rarity ? `- ${variant.rarity.toUpperCase()}` : ''}
										</div>
										<div class="text-stone-400 italic truncate">
											{variant.artist}
										</div>
									</div>
								</button>
							)}
						</For>
					</div>
					</Show>
				</Show>
				
				<div class="modal-action mt-6">
					<button class="btn btn-secondary" onClick={() => props.onClose()}>Cancel</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop bg-black/80 backdrop-blur-sm" onClick={() => props.onClose()}>
				<button>close</button>
			</form>
		</dialog>
	);
}
