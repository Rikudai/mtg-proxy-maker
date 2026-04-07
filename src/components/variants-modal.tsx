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
			class="z-[150] modal modal-bottom sm:modal-middle"
			open={props.open}
		>
			<div class="modal-backdrop bg-mtg-black" onClick={() => props.onClose()} />
			<div class="modal-box max-w-5xl border border-mtg-white/10 shadow-glass p-0 overflow-hidden rounded-3xl bg-mtg-stone-900">
				<div class="p-6 border-b border-mtg-white/10 bg-mtg-stone-900 flex items-center justify-between">
					<h3 class="font-beleren text-xl text-mtg-white tracking-widest uppercase">
						Select Art: <span class="text-mtg-gold italic">{props.cardName}</span>
					</h3>
					<button class="text-mtg-stone-500 hover:text-mtg-white transition-colors" onClick={() => props.onClose()}>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				</div>
				
				<div class="p-6">
					<Show when={props.isLoading}>
						<div class="flex flex-col items-center justify-center p-20 gap-6">
							<span class="loading loading-ring loading-lg text-mtg-gold"></span>
							<p class="text-mtg-stone-400 font-beleren tracking-widest uppercase animate-pulse">Summoning Alternate Artworks...</p>
						</div>
					</Show>
					
					<Show when={!props.isLoading}>
						<Show 
							when={props.variants.length > 0} 
							fallback={
								<div class="flex flex-col items-center justify-center p-20 gap-4 bg-mtg-black/30 rounded-2xl border border-dashed border-mtg-white/10">
									<svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 text-mtg-stone-700" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
									<p class="text-mtg-stone-300 font-bold text-lg uppercase tracking-wider">No alternative artworks found</p>
									<p class="text-mtg-stone-500 text-sm italic">This card might only have one official printing.</p>
								</div>
							}
						>
							<div class="grid grid-cols-2 lg:grid-cols-4 gap-8 overflow-y-auto max-h-[60vh] p-4 custom-scrollbar">
								<For each={props.variants}>
									{(variant, index) => (
										<button
											class="group relative rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg border-2 border-mtg-white/10 hover:border-mtg-gold hover:shadow-glow-gold bg-mtg-black w-full flex flex-col"
											onClick={() => props.onSelect(index())}
										>
											<div class="aspect-[626/457] w-full overflow-hidden bg-mtg-stone-950">
												<img 
													src={variant.artUrl} 
													alt={`Variant ${index()}`} 
													class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
													loading="lazy"
												/>
											</div>
											
											<div class="p-3 flex flex-col gap-0.5 bg-mtg-stone-900 border-t border-mtg-white/5 text-left">
												<div class="font-bold text-mtg-white text-[9px] uppercase tracking-wider truncate">
													{variant.set?.toUpperCase()} <span class="text-mtg-gold mx-0.5 opacity-50">•</span> {variant.rarity?.toUpperCase()}
												</div>
												<div class="text-mtg-stone-500 text-[8px] italic truncate font-medium">
													{variant.artist}
												</div>
											</div>
										</button>
									)}
								</For>
							</div>
						</Show>
					</Show>
				</div>
				
				<div class="p-6 bg-mtg-stone-900 border-t border-mtg-white/10 flex justify-end">
					<button class="px-10 py-4 rounded-xl bg-mtg-stone-800 text-mtg-stone-200 font-bold text-xs uppercase tracking-widest hover:bg-mtg-stone-700 active:scale-95 transition-all border border-mtg-white/5" onClick={() => props.onClose()}>
						Dismiss
					</button>
				</div>
			</div>
		</dialog>
	);
}
